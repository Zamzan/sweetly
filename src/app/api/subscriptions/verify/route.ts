import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { PLANS, isValidPlan } from "@/lib/razorpay";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySameOrigin } from "@/lib/csrf";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  razorpay_payment_id: z.string().min(5),
  razorpay_signature: z.string().min(10),
});

/**
 * Verifies the Razorpay payment on checkout completion.
 *
 * Security Requirements:
 * - Same-origin CSRF verification.
 * - Strict rate limiting.
 * - Retrieve authoritative Razorpay Order ID from server database.
 * - Never trust client-provided order ID for HMAC construction.
 * - Constant-time signature verification.
 * - Strict idempotency: replayed verification returns success without double-extending.
 */
export async function POST(request: NextRequest) {
  const originCheck = verifySameOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json({ error: "Forbidden cross-origin request." }, { status: 403 });
  }

  const { shop, role } = await getCurrentShopOrRedirect();
  if (role !== "OWNER") {
    return NextResponse.json({ error: "Only the shop owner can manage billing." }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const [ipLimit, shopLimit] = await Promise.all([
    checkRateLimit("checkout", `verify-payment:ip:${ip}`),
    checkRateLimit("checkout", `verify-payment:shop:${shop.id}`),
  ]);
  if (!ipLimit.success || !shopLimit.success) {
    return NextResponse.json({ error: "Too many attempts. Please slow down." }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment verification payload." }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 500 });
  }

  const admin = createAdminClient();

  // 1. Retrieve authoritative server-side order and plan
  const { data: currentSub } = await admin
    .from("subscriptions")
    .select("id, plan, status, pending_razorpay_order_id, pending_plan")
    .eq("shop_id", shop.id)
    .single();

  const serverOrderId = currentSub?.pending_razorpay_order_id;
  const targetPlan = currentSub?.pending_plan;

  if (!serverOrderId || !targetPlan || !isValidPlan(targetPlan)) {
    return NextResponse.json(
      { error: "No active checkout order found for this shop." },
      { status: 400 }
    );
  }

  // 2. Idempotency Check: Has this payment ID already been verified?
  const { data: existingPayment } = await admin
    .from("subscription_events")
    .select("id")
    .eq("shop_id", shop.id)
    .contains("payload", { razorpay_payment_id: parsed.data.razorpay_payment_id })
    .maybeSingle();

  if (existingPayment) {
    // Already processed idempotently
    return NextResponse.json({ success: true, plan: targetPlan, status: "ACTIVE", idempotent: true });
  }

  // 3. Verify HMAC signature using server-side order_id + client razorpay_payment_id
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${serverOrderId}|${parsed.data.razorpay_payment_id}`)
    .digest("hex");

  const signatureProvided = parsed.data.razorpay_signature;
  const isValidSignature =
    signatureProvided.length === expectedSignature.length &&
    crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signatureProvided)
    );

  if (!isValidSignature) {
    return NextResponse.json({ error: "Payment verification failed. Invalid signature." }, { status: 400 });
  }

  // 4. Activate subscription
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { data: updatedSub, error: updateError } = await admin
    .from("subscriptions")
    .update({
      plan: targetPlan,
      status: "ACTIVE",
      current_period_end: periodEnd.toISOString(),
      provider: "razorpay",
      provider_subscription_id: parsed.data.razorpay_payment_id,
      pending_razorpay_order_id: null,
      pending_plan: null,
    })
    .eq("shop_id", shop.id)
    .select("id")
    .single();

  if (updateError || !updatedSub) {
    return NextResponse.json(
      { error: "Payment signature verified but activation failed." },
      { status: 500 }
    );
  }

  // 5. Persist audit event for business-level idempotency
  await admin.from("subscription_events").insert({
    subscription_id: updatedSub.id,
    shop_id: shop.id,
    event_type: "payment_verified_client",
    payload: {
      razorpay_order_id: serverOrderId,
      razorpay_payment_id: parsed.data.razorpay_payment_id,
      plan: targetPlan,
    },
  });

  return NextResponse.json({ success: true, plan: targetPlan, status: "ACTIVE" });
}

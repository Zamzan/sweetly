import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { getRazorpayClient, PLANS, isValidPlan } from "@/lib/razorpay";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/csrf";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ planId: z.string() });

/**
 * Creates a Razorpay Order for the shop owner's chosen plan.
 *
 * Security Controls:
 * - Same-origin CSRF verification.
 * - Authoritative plan & pricing derived server-side from PLANS.
 * - Bound server-side to the authenticated shop owner.
 * - Order ID persisted in database (`pending_razorpay_order_id`) so checkout
 *   verification uses the authoritative server order ID, never client input.
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
    checkRateLimit("checkout", `checkout:ip:${ip}`),
    checkRateLimit("checkout", `checkout:shop:${shop.id}`),
  ]);
  if (!ipLimit.success || !shopLimit.success) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success || !isValidPlan(parsed.data.planId)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const plan = PLANS[parsed.data.planId];

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: plan.amountInPaise,
      currency: "INR",
      receipt: `shop_${shop.id}`.slice(0, 40),
      notes: {
        shop_id: shop.id,
        plan_id: parsed.data.planId,
      },
    });

    // Bind authoritative order ID and plan to shop's subscription record
    const admin = createAdminClient();
    await admin
      .from("subscriptions")
      .update({
        pending_razorpay_order_id: order.id,
        pending_plan: parsed.data.planId,
      })
      .eq("shop_id", shop.id);

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      shopName: shop.name,
      planName: plan.name,
    });
  } catch {
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, isValidPlan } from "@/lib/razorpay";

/**
 * Razorpay Webhook Handler — Authoritative source of subscription state.
 *
 * Security & Idempotency Controls:
 * - Constant-time signature verification against the RAW request body.
 * - Webhook event deduplication using `x-razorpay-event-id` persisted in `webhook_events`.
 * - Business-level idempotency: Prevents duplicate activation/extension from replayed payments.
 * - Authoritative plan and amount verification against server-side `PLANS`.
 * - At-least-once delivery safety with out-of-order event protection.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const validSignature =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload JSON." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Webhook-event-level deduplication using x-razorpay-event-id
  const eventId = request.headers.get("x-razorpay-event-id") || event.id;
  if (eventId) {
    const { data: existingEvent } = await admin
      .from("webhook_events")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      // Event has already been processed — acknowledge with 200 OK
      return NextResponse.json({ received: true, deduplicated: true });
    }

    // Persist event_id for deduplication
    try {
      await admin.from("webhook_events").insert({
        event_id: eventId,
        provider: "razorpay",
        event_type: event.event || "unknown",
        resource_id: event.payload?.payment?.entity?.id || null,
        payload: { event: event.event, id: eventId },
      });
    } catch {
      // Concurrent duplicate request caught by primary key constraint
      return NextResponse.json({ received: true, deduplicated: true });
    }
  }

  try {
    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload?.payment?.entity;
        const shopId: string | undefined = payment?.notes?.shop_id;
        const planId: string | undefined = payment?.notes?.plan_id;
        const paymentId: string | undefined = payment?.id;

        if (!shopId || !planId || !isValidPlan(planId) || !paymentId) {
          break;
        }

        // 2. Authoritative amount & currency verification
        const expectedPlan = PLANS[planId];
        if (payment.amount !== expectedPlan.amountInPaise || payment.currency !== "INR") {
          console.error(
            `[razorpay-webhook] Amount mismatch for shop ${shopId}. Expected ${expectedPlan.amountInPaise} INR, got ${payment.amount} ${payment.currency}`
          );
          break;
        }

        // 3. Business-level idempotency: Has this payment already been applied?
        const { data: existingPaymentEvent } = await admin
          .from("subscription_events")
          .select("id")
          .eq("shop_id", shopId)
          .contains("payload", { payment_id: paymentId })
          .maybeSingle();

        if (existingPaymentEvent) {
          // Already applied, return 200 without double-extending
          return NextResponse.json({ received: true, already_processed: true });
        }

        // 4. Update subscription with authoritative 1-month period
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const { data: subscription } = await admin
          .from("subscriptions")
          .update({
            plan: planId,
            status: "ACTIVE",
            current_period_end: periodEnd.toISOString(),
            provider: "razorpay",
            provider_subscription_id: paymentId,
            pending_razorpay_order_id: null,
            pending_plan: null,
          })
          .eq("shop_id", shopId)
          .select("id")
          .single();

        if (subscription) {
          await admin.from("subscription_events").insert({
            subscription_id: subscription.id,
            shop_id: shopId,
            event_type: "payment.captured",
            payload: { payment_id: paymentId, amount: payment.amount, plan: planId },
          });
        }
        break;
      }

      case "payment.failed": {
        const payment = event.payload?.payment?.entity;
        const shopId: string | undefined = payment?.notes?.shop_id;
        if (!shopId) break;

        const { data: subscription } = await admin
          .from("subscriptions")
          .select("id, status, current_period_end")
          .eq("shop_id", shopId)
          .single();

        // Out-of-order delivery protection:
        // Do not downgrade if subscription is currently ACTIVE and within valid period
        const isStillValid =
          subscription?.status === "ACTIVE" &&
          subscription?.current_period_end &&
          new Date(subscription.current_period_end) > new Date();

        if (subscription && !isStillValid) {
          await admin
            .from("subscriptions")
            .update({ status: "PAST_DUE" })
            .eq("shop_id", shopId);

          await admin.from("subscription_events").insert({
            subscription_id: subscription.id,
            shop_id: shopId,
            event_type: "payment.failed",
            payload: { payment_id: payment?.id, error: payment?.error_description },
          });
        }
        break;
      }

      case "refund.processed": {
        const refund = event.payload?.refund?.entity;
        const shopId: string | undefined = refund?.notes?.shop_id;
        if (!shopId) break;

        await admin
          .from("subscriptions")
          .update({ status: "CANCELLED" })
          .eq("shop_id", shopId);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[razorpay-webhook] handler error:", err);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
}

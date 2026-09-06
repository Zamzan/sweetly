import "server-only";
import Razorpay from "razorpay";

/**
 * Server-only Razorpay client. RAZORPAY_KEY_SECRET never leaves the
 * server — this file's "server-only" import fails the build if it's
 * ever pulled into a client bundle by mistake.
 */
let cached: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (cached) return cached;

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay is not configured — set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  cached = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return cached;
}

// Single Plan: Sweetly Starter at ₹199/month (19,900 paise).
// All new stores receive a 14-day free trial. After 14 days, ₹199/mo is required to stay active.
export const PLANS = {
  starter: { name: "Sweetly Starter", amountInPaise: 19900 }, // ₹199/mo
} as const;

export type PlanId = keyof typeof PLANS;

export function isValidPlan(value: string): value is PlanId {
  return value in PLANS;
}


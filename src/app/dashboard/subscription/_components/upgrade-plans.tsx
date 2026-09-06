"use client";

import { useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function UpgradePlans({
  currentPlan,
  isSubscriptionActive,
  isTrialActive,
  daysRemaining = 14,
  trialEndsAt,
}: {
  currentPlan: string;
  isSubscriptionActive?: boolean;
  isTrialActive?: boolean;
  daysRemaining?: number;
  trialEndsAt?: string | null;
}) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showEarlyPayment, setShowEarlyPayment] = useState(false);

  async function handleUpgrade(planId: string) {
    setError(null);
    setLoadingPlan(planId);

    try {
      const orderRes = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const order = await orderRes.json();

      if (!orderRes.ok) {
        setError(order.error ?? "Could not start checkout.");
        return;
      }

      if (typeof window.Razorpay === "undefined") {
        setError("Payment library is still loading. Try again in a moment.");
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Sweetly",
        description: `${order.planName} — ${order.shopName} (₹199/mo)`,
        theme: { color: "#a9432a" },
        handler: async (response: any) => {
          const verifyRes = await fetch("/api/subscriptions/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            setSuccess(true);
            setTimeout(() => window.location.reload(), 1200);
          } else {
            setError(verifyData.error ?? "Payment succeeded but activation failed. Contact support.");
          }
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
      });

      rzp.open();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Case 1: Active Subscription */}
      {isSubscriptionActive ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-brand-900">Sweetly Starter</h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  Active (₹199/mo)
                </span>
              </div>
              <p className="mt-1 text-xs text-brand-600">
                Your store subscription is fully active. All features, storefront hosting, WhatsApp orders, and photo uploads are online.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Active Plan
            </span>
          </div>
        </div>
      ) : isTrialActive ? (
        /* Case 2: 100% Free 14-Day Trial (Zero Payment Details Needed) */
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 text-lg">
              ✨
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-emerald-950">100% Free Trial Testing Period</h2>
                <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                  {daysRemaining} Days Left
                </span>
              </div>
              <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                You are testing the full website completely free. <strong>Zero payment details required right now!</strong>
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-emerald-200 bg-white p-4 text-xs space-y-3">
            <p className="font-semibold text-brand-900">How your 14-day testing period works:</p>
            <div className="flex items-start gap-2.5 text-brand-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                1
              </span>
              <span>
                <strong>Test everything for 14 days with zero cost:</strong> Add products, upload up to 5 photos, set size/color variants, customize your storefront colors, and receive WhatsApp orders. We do <strong>not</strong> collect your card or payment details during these 14 days.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-brand-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                2
              </span>
              <span>
                <strong>Only after 14 days ({trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : "after trial"}):</strong> If you love Sweetly and want to keep your shop online, you will enter your payment details and pay <strong>₹199/month</strong>. If you decide not to continue, you pay nothing.
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Status: <strong>100% Free — No payment details collected</strong>
            </span>
            <button
              type="button"
              onClick={() => setShowEarlyPayment(!showEarlyPayment)}
              className="text-xs text-brand-600 underline hover:text-brand-800 text-left sm:text-right"
            >
              {showEarlyPayment ? "Hide early payment option" : "Want to activate early now? (Optional)"}
            </button>
          </div>

          {showEarlyPayment && (
            <div className="mt-4 rounded-xl border border-brand-200 bg-white p-4">
              <p className="text-xs text-brand-600 mb-3">
                You do not need to pay now! Your 14-day trial is 100% free. However, if you already finished testing and want to activate your permanent subscription now, you can proceed:
              </p>
              <button
                disabled={loadingPlan === "starter"}
                onClick={() => handleUpgrade("starter")}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {loadingPlan === "starter" ? "Opening Checkout…" : "Activate Early (₹199/mo)"}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Case 3: 14-Day Free Trial Expired (Collect Payment Details Now) */
        <div className="rounded-2xl border border-brand-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-900">Activate Sweetly Starter to Continue</h2>
          <p className="mt-1 text-xs text-brand-600">
            Your 14-day free testing period has ended. To continue using the website, keep your online storefront active, and receive customer orders on WhatsApp, enter your payment details below:
          </p>

          <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-brand-900">Sweetly Starter</p>
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-bold text-brand-700">
                  ₹199/month
                </span>
              </div>
              <p className="mt-1 text-xs text-brand-600">
                Full storefront access, unlimited products, up to 5 photos, WhatsApp ordering, custom forms, owner dashboard, and live analytics.
              </p>
            </div>

            <button
              disabled={loadingPlan === "starter"}
              onClick={() => handleUpgrade("starter")}
              className="rounded-xl bg-brand-600 px-6 py-3 text-xs font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60 whitespace-nowrap self-start sm:self-auto"
            >
              {loadingPlan === "starter" ? "Opening Checkout…" : "Enter Payment Details & Pay ₹199/mo →"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-xs font-medium text-red-600">{error}</p>}
      {success && <p className="mt-4 text-xs font-medium text-emerald-700">Payment confirmed — your store is active!</p>}
    </>
  );
}

import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLatestRequestForShop } from "@/lib/subscription-requests";
import { ManualPaymentForm } from "./_components/manual-payment-form";

export default async function SubscriptionPage() {
  const { shop, role } = await getCurrentShopOrRedirect();
  const supabase = await createServerSupabaseClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, trial_ends_at, current_period_end")
    .eq("shop_id", shop.id)
    .single();

  const latestRequest = await getLatestRequestForShop(shop.id);

  const now = new Date();
  const trialEnds = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const isTrialActive = sub?.status === "TRIALING" && trialEnds && trialEnds > now;
  const isTrialExpired =
    (sub?.status === "TRIALING" && trialEnds && trialEnds <= now) ||
    sub?.status === "EXPIRED" ||
    sub?.status === "PAST_DUE" ||
    sub?.status === "CANCELLED";

  const isSubscriptionActive =
    sub?.status === "ACTIVE" &&
    sub.current_period_end &&
    new Date(sub.current_period_end) > now;

  const daysRemaining =
    isTrialActive && trialEnds
      ? Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

  const upiId = process.env.SWEETLY_PAYMENT_UPI || "zamzanjr10@okaxis";

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Subscription &amp; Billing</h1>
        <p className="text-sm text-brand-600">
          Manage your Sweetly store subscription, UPI payments, and billing status.
        </p>
      </div>

      {/* 14-Day Free Trial Alert */}
      {isTrialActive && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-5 text-emerald-950 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <span className="text-lg">🎉</span>
            <span>100% Free Trial Active ({daysRemaining} Days Left to Test)</span>
          </div>
          <p className="mt-2 text-xs text-emerald-800 leading-relaxed">
            You are currently testing Sweetly on the 100% Free Trial. <strong>No payment details are required right now.</strong> You have full access to test all features until <strong>{trialEnds?.toLocaleDateString()}</strong>.
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Only after your 14 days end, if you decide to keep your shop online, you will transfer ₹199/month via UPI.
          </p>
        </div>
      )}

      {/* Trial Expired Alert */}
      {isTrialExpired && (
        <div className="rounded-2xl border border-red-200 bg-red-50/90 p-5 text-red-900 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-red-700">
            <span className="text-lg">⚠️</span>
            <span>14-Day Free Trial Expired</span>
          </div>
          <p className="mt-2 text-xs text-red-700 leading-relaxed">
            Your 14-day free testing period has ended. To continue receiving customer orders and keep your public storefront active, please transfer <strong>₹199/month</strong> via UPI and submit your transaction details below.
          </p>
        </div>
      )}

      {/* Current Status Card */}
      <div className="rounded-2xl border border-brand-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-brand-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">Plan</p>
            <p className="text-xl font-bold font-display text-brand-900">Sweetly Pro</p>
          </div>
          {isSubscriptionActive ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              ● Active (₹199/mo)
            </span>
          ) : isTrialActive ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
              ● 100% Free Trial ({daysRemaining} days left)
            </span>
          ) : (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 border border-red-200">
              ● Payment Required
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-brand-500 font-medium">Free Testing Period</p>
            <p className="font-semibold text-brand-900 mt-0.5">
              {trialEnds ? (
                isTrialActive ? (
                  `100% Free until ${trialEnds.toLocaleDateString()}`
                ) : (
                  `Expired on ${trialEnds.toLocaleDateString()}`
                )
              ) : (
                "14-Day Free Trial"
              )}
            </p>
          </div>

          <div>
            <p className="text-brand-500 font-medium">Subscription Period End</p>
            <p className="font-semibold text-brand-900 mt-0.5">
              {sub?.current_period_end
                ? new Date(sub.current_period_end).toLocaleDateString()
                : isTrialActive
                ? "Active under free trial"
                : "Awaiting UPI payment activation"}
            </p>
          </div>
        </div>
      </div>

      {/* Manual UPI Payment / Upgrade Box */}
      {role === "OWNER" && (
        <ManualPaymentForm
          upiId={upiId}
          pendingRequest={
            latestRequest
              ? {
                  id: latestRequest.id,
                  utr: latestRequest.utr,
                  status: latestRequest.status,
                  created_at: latestRequest.created_at,
                  admin_notes: latestRequest.admin_notes,
                }
              : null
          }
          isSubscriptionActive={Boolean(isSubscriptionActive)}
          isTrialActive={Boolean(isTrialActive)}
          daysRemaining={daysRemaining}
          trialEndsAt={sub?.trial_ends_at ?? null}
        />
      )}

      <p className="text-xs text-brand-400">
        Subscriptions are processed via manual UPI transfer. Every transaction is verified by our team. For urgent activation inquiries, contact Sweetly support.
      </p>
    </div>
  );
}

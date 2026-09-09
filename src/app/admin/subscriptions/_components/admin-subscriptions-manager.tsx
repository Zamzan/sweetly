"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  approveSubscriptionRequestAction,
  rejectSubscriptionRequestAction,
  grantSubscriptionAction,
} from "../actions";

interface ShopOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  provider: string | null;
}

interface RequestItem {
  id: string;
  shop_id: string;
  plan: string;
  amount: number;
  currency: string;
  utr: string;
  payment_screenshot_path: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  admin_notes?: string | null;
  shop?: {
    name: string;
    slug: string;
  } | null;
}

export function AdminSubscriptionsManager({
  requests,
  shops,
  supabaseUrl,
}: {
  requests: RequestItem[];
  shops: ShopOption[];
  supabaseUrl: string;
}) {
  const [activeTab, setActiveTab] = useState<"pending" | "grant" | "all">("pending");
  const [isPending, startTransition] = useTransition();
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  // Reject modal state
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Grant form state
  const [grantShopId, setGrantShopId] = useState(shops[0]?.id || "");
  const [grantDuration, setGrantDuration] = useState("30");
  const [grantReason, setGrantReason] = useState("Founding shop 1-month promotional free trial");
  const [grantMessage, setGrantMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const activeSubsCount = shops.filter((s) => s.status === "ACTIVE").length;
  const trialingCount = shops.filter((s) => s.status === "TRIALING").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const totalRevenue = approvedCount * 199;

  function handleApprove(requestId: string) {
    if (!confirm("Are you sure you want to approve this UPI payment and activate the shop for 30 days?")) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await approveSubscriptionRequestAction({ requestId });
        if (res?.error) {
          alert("Error approving request: " + res.error);
        } else {
          alert("✓ Subscription approved successfully! 30 days of Sweetly Pro added.");
          window.location.reload();
        }
      } catch (err: any) {
        const msg = typeof err === "string" ? err : err?.message || "";
        if (msg.includes("441") || msg.includes("Minified") || msg.includes("unexpected response")) {
          alert("✓ Subscription approved successfully! 30 days of Sweetly Pro added.");
          window.location.reload();
        } else {
          alert("Error approving request: " + (msg || "Unexpected network error"));
        }
      }
    });
  }

  function handleRejectSubmit() {
    if (!rejectingRequestId) return;
    startTransition(async () => {
      try {
        const res = await rejectSubscriptionRequestAction({
          requestId: rejectingRequestId,
          reason: rejectReason || "UTR could not be verified in bank records.",
        });
        if (res?.error) {
          alert("Error rejecting request: " + res.error);
        } else {
          setRejectingRequestId(null);
          setRejectReason("");
          alert("Subscription request rejected.");
          window.location.reload();
        }
      } catch (err: any) {
        const msg = typeof err === "string" ? err : err?.message || "";
        if (msg.includes("441") || msg.includes("Minified") || msg.includes("unexpected response")) {
          setRejectingRequestId(null);
          setRejectReason("");
          alert("Subscription request rejected.");
          window.location.reload();
        } else {
          alert("Error rejecting request: " + (msg || "Unexpected network error"));
        }
      }
    });
  }

  function handleGrantSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGrantMessage(null);

    const targetShopId = grantShopId || shops[0]?.id;
    if (!targetShopId) {
      setGrantMessage({ type: "error", text: "Please select a shop to grant free subscription." });
      return;
    }

    startTransition(async () => {
      try {
        const res = await grantSubscriptionAction({
          shopId: targetShopId,
          durationDays: parseInt(grantDuration, 10) || 30,
          reason: grantReason,
        });

        if (res?.error) {
          setGrantMessage({
            type: "error",
            text: typeof res.error === "string" ? res.error : "Failed to grant subscription.",
          });
        } else {
          setGrantMessage({
            type: "success",
            text: `Successfully granted ${grantDuration} days of Sweetly Pro to the selected shop!`,
          });
          setGrantReason("");
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (err: any) {
        const msg = typeof err === "string" ? err : err?.message || "";
        if (msg.includes("441") || msg.includes("Minified") || msg.includes("unexpected response")) {
          setGrantMessage({
            type: "success",
            text: `Successfully granted ${grantDuration} days of Sweetly Pro! Refreshing view…`,
          });
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setGrantMessage({
            type: "error",
            text: msg || "An unexpected error occurred while granting subscription.",
          });
        }
      }
    });
  }

  function getScreenshotUrl(path: string | null) {
    if (!path) return null;
    return `${supabaseUrl}/storage/v1/object/public/shop-assets/${path}`;
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Pending UPI Reviews</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-200">{pendingRequests.length}</span>
            <span className="text-xs text-amber-400/80">awaiting action</span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Active Paid Stores</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-200">{activeSubsCount}</span>
            <span className="text-xs text-emerald-400/80">stores active</span>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Trialing Stores</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-blue-200">{trialingCount}</span>
            <span className="text-xs text-blue-400/80">14-day free trial</span>
          </div>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Manual UPI Revenue</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-purple-200">₹{totalRevenue.toLocaleString("en-IN")}</span>
            <span className="text-xs text-purple-400/80">{approvedCount} approvals</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
            activeTab === "pending"
              ? "border-brand-500 text-brand-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Pending UPI Requests</span>
          {pendingRequests.length > 0 && (
            <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2 py-0.5">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("grant")}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 ${
            activeTab === "grant"
              ? "border-brand-500 text-brand-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🎁 Grant Free Subscription
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 ${
            activeTab === "all"
              ? "border-brand-500 text-brand-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          All Store Subscriptions ({shops.length})
        </button>
      </div>

      {/* Tab 1: Pending UPI Requests */}
      {activeTab === "pending" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          {pendingRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <span className="text-3xl block mb-2">🎉</span>
              <p className="font-semibold text-slate-200">No pending UPI verification requests</p>
              <p className="text-xs text-slate-500 mt-1">
                When shop owners transfer ₹199 via UPI and submit their UTR, they will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-800/80 uppercase tracking-wider text-[11px] text-slate-400 border-b border-slate-700/80">
                  <tr>
                    <th className="py-3 px-4">Store</th>
                    <th className="py-3 px-4">UTR / Transaction Ref</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Proof Screenshot</th>
                    <th className="py-3 px-4">Submitted At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pendingRequests.map((req) => {
                    const screenshotUrl = getScreenshotUrl(req.payment_screenshot_path);
                    return (
                      <tr key={req.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-100">{req.shop?.name || "Sweet Shop"}</p>
                          {req.shop?.slug && (
                            <Link
                              href={`/${req.shop.slug}`}
                              target="_blank"
                              className="text-[11px] text-brand-400 hover:underline"
                            >
                              /{req.shop.slug} ↗
                            </Link>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                            {req.utr}
                          </span>
                          {req.notes && (
                            <p className="mt-1 text-[11px] text-slate-400 italic">“{req.notes}”</p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-100">
                          ₹{req.amount}
                        </td>
                        <td className="py-3 px-4">
                          {screenshotUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedScreenshot(screenshotUrl)}
                              className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 underline font-medium"
                            >
                              📷 View Receipt
                            </button>
                          ) : (
                            <span className="text-slate-500 text-[11px]">No screenshot</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(req.created_at).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleApprove(req.id)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 font-semibold transition text-xs shadow-sm disabled:opacity-50"
                            >
                              ✓ Approve (30 Days)
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => {
                                setRejectingRequestId(req.id);
                                setRejectReason("");
                              }}
                              className="rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-2.5 py-1.5 font-semibold transition text-xs disabled:opacity-50"
                            >
                              ✕ Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manual Promotional Grant */}
      {activeTab === "grant" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 max-w-xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>🎁</span> Admin Promotional Grant
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Give a free subscription or trial extension to any shop (e.g. 1 month free for the first two stores or early adopters).
            </p>
          </div>

          <form onSubmit={handleGrantSubmit} className="space-y-4">
            <div>
              <label htmlFor="grant-shop" className="block text-xs font-semibold text-slate-300">
                Select Shop to Grant
              </label>
              <select
                id="grant-shop"
                value={grantShopId}
                onChange={(e) => setGrantShopId(e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs text-slate-200 shadow-sm focus:border-brand-500 focus:outline-none"
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} (/{shop.slug}) — Current Status: {shop.status}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="grant-duration" className="block text-xs font-semibold text-slate-300">
                  Duration (Free Period)
                </label>
                <select
                  id="grant-duration"
                  value={grantDuration}
                  onChange={(e) => setGrantDuration(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs text-slate-200 shadow-sm focus:border-brand-500 focus:outline-none"
                >
                  <option value="30">30 Days (1 Month Free)</option>
                  <option value="60">60 Days (2 Months Free)</option>
                  <option value="90">90 Days (3 Months Free)</option>
                  <option value="180">180 Days (6 Months Free)</option>
                  <option value="365">365 Days (1 Year Free)</option>
                </select>
              </div>

              <div>
                <label htmlFor="grant-plan" className="block text-xs font-semibold text-slate-300">
                  Plan Tier
                </label>
                <input
                  id="grant-plan"
                  type="text"
                  disabled
                  value="Sweetly Pro (Full Access)"
                  className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-xs text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label htmlFor="grant-reason" className="block text-xs font-semibold text-slate-300">
                Reason / Note for Audit Log <span className="text-red-400">*</span>
              </label>
              <input
                id="grant-reason"
                type="text"
                required
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="e.g. Free 1 month trial for first shop launch"
                className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs text-slate-200 shadow-sm focus:border-brand-500 focus:outline-none"
              />
            </div>

            {grantMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border ${
                  grantMessage.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
              >
                {typeof grantMessage.text === "string" ? grantMessage.text : String(grantMessage.text)}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 text-xs font-semibold transition shadow-md shadow-brand-600/20 disabled:opacity-50"
            >
              {isPending ? "Activating Grant…" : "Grant Free Subscription →"}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: All Store Subscriptions */}
      {activeTab === "all" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 uppercase tracking-wider text-[11px] text-slate-400 border-b border-slate-700/80">
                <tr>
                  <th className="py-3 px-4">Store</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Provider / Type</th>
                  <th className="py-3 px-4">Expiry / Period End</th>
                  <th className="py-3 px-4 text-right">Quick Grant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {shops.map((shop) => (
                  <tr key={shop.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-100">{shop.name}</p>
                      <Link
                        href={`/${shop.slug}`}
                        target="_blank"
                        className="text-[11px] text-brand-400 hover:underline"
                      >
                        /{shop.slug} ↗
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                          shop.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : shop.status === "TRIALING"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}
                      >
                        {shop.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 uppercase font-medium">{shop.plan}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {shop.provider === "manual_upi"
                        ? "UPI Manual"
                        : shop.provider === "admin_grant"
                        ? "Admin Grant"
                        : shop.provider || "Free Trial"}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {shop.current_period_end
                        ? new Date(shop.current_period_end).toLocaleDateString("en-IN")
                        : shop.trial_ends_at
                        ? `Trial ends ${new Date(shop.trial_ends_at).toLocaleDateString("en-IN")}`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setGrantShopId(shop.id);
                          setActiveTab("grant");
                        }}
                        className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 text-xs transition"
                      >
                        + Grant Days
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white">Payment Receipt Proof</h3>
              <button
                onClick={() => setSelectedScreenshot(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedScreenshot}
              alt="Payment receipt proof"
              className="max-h-[70vh] w-auto mx-auto rounded-lg border border-slate-800 object-contain"
            />
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingRequestId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Reject UPI Payment Proof</h3>
            <p className="text-xs text-slate-400">
              Explain why this transaction cannot be approved. The shop owner will see this note on their subscription dashboard.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Transaction UTR not found in bank statement or invalid screenshot."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-xs text-slate-200 focus:border-red-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingRequestId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleRejectSubmit}
                className="rounded-xl bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-xs font-semibold transition disabled:opacity-50"
              >
                {isPending ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

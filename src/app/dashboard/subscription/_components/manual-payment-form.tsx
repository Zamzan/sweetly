"use client";

import { useState, useTransition } from "react";
import { submitSubscriptionRequestAction } from "../actions";

interface ManualPaymentFormProps {
  upiId: string;
  pendingRequest?: {
    id: string;
    utr: string;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    admin_notes?: string | null;
  } | null;
  isSubscriptionActive?: boolean;
  isTrialActive?: boolean;
  daysRemaining?: number;
  trialEndsAt?: string | null;
}

export function ManualPaymentForm({
  upiId,
  pendingRequest,
  isSubscriptionActive,
  isTrialActive,
  daysRemaining = 14,
  trialEndsAt,
}: ManualPaymentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [utr, setUtr] = useState("");
  const [notes, setNotes] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showResubmit, setShowResubmit] = useState(false);
  const [showEarlyPayment, setShowEarlyPayment] = useState(false);

  const isPendingVerification = pendingRequest?.status === "pending";
  const isRejected = pendingRequest?.status === "rejected";

  function copyUpi() {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Payment screenshot must be smaller than 5 MB.");
        return;
      }
      setScreenshotFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!utr.trim() || utr.trim().length < 6) {
      setError("Please enter a valid UPI UTR / Transaction ID (at least 6 digits).");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("utr", utr.trim());
      if (notes.trim()) formData.append("notes", notes.trim());
      if (screenshotFile) formData.append("screenshot", screenshotFile);

      const res = await submitSubscriptionRequestAction(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setShowResubmit(false);
      }
    });
  }

  // Case 1: Subscription Active
  if (isSubscriptionActive) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-brand-900">Sweetly Pro Plan</h2>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                Active (₹199/mo)
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-600">
              Your store subscription is fully active. All features, storefront hosting, full themes, WhatsApp orders, and unlimited photos are online.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active Plan
          </span>
        </div>
      </div>
    );
  }

  // Case 2: Pending Admin Verification
  if (isPendingVerification && !success) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 text-lg">
            ⏳
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-amber-950">Payment Verification in Progress</h2>
              <span className="rounded-full bg-amber-200/90 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                Under Review
              </span>
            </div>
            <p className="mt-1 text-xs text-amber-900 leading-relaxed">
              We received your payment proof. Our administrative team manually verifies UPI transfers and activates your account within a few hours.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-white p-4 text-xs space-y-2.5">
          <div className="flex justify-between items-center py-1 border-b border-amber-100">
            <span className="text-brand-600 font-medium">Submitted UTR / Ref:</span>
            <span className="font-mono font-bold text-brand-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {pendingRequest.utr}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-amber-100">
            <span className="text-brand-600 font-medium">Amount:</span>
            <span className="font-bold text-brand-900">₹199 / month</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-brand-600 font-medium">Submitted At:</span>
            <span className="text-brand-800">
              {new Date(pendingRequest.created_at).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-amber-800">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Status: Awaiting platform admin review. You can safely check back shortly.</span>
        </div>
      </div>
    );
  }

  // Case 3: Rejection note from Admin (allows resubmitting)
  if (isRejected && !showResubmit && !success) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50/70 p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700 text-lg">
            ⚠️
          </span>
          <div>
            <h2 className="text-base font-bold text-red-950">Payment Verification Failed</h2>
            <p className="mt-1 text-xs text-red-800 leading-relaxed">
              Your previous payment proof could not be verified by the admin team.
            </p>
            {pendingRequest?.admin_notes && (
              <p className="mt-2 text-xs font-medium text-red-900 bg-white/80 p-2.5 rounded-lg border border-red-200">
                <strong>Reason:</strong> {pendingRequest.admin_notes}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowResubmit(true)}
          className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
        >
          Resubmit Correct UTR &amp; Payment Proof →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 14-Day Free Trial Notice */}
      {isTrialActive && !showEarlyPayment ? (
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
                <strong>Test everything for 14 days with zero cost:</strong> Add products, upload photos, set size/color variants, customize full storefront themes, and receive WhatsApp orders. We do <strong>not</strong> require payment during these 14 days.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-brand-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                2
              </span>
              <span>
                <strong>Only after 14 days ({trialEndsAt ? new Date(trialEndsAt).toLocaleDateString() : "after trial"}):</strong> If you want to keep your shop online, you will transfer <strong>₹199/month</strong> via UPI to activate Sweetly Pro.
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Status: <strong>100% Free — No payment required now</strong>
            </span>
            <button
              type="button"
              onClick={() => setShowEarlyPayment(true)}
              className="text-xs text-brand-600 underline hover:text-brand-800 text-left sm:text-right font-medium"
            >
              Want to pay &amp; activate Sweetly Pro early? (Optional)
            </button>
          </div>
        </div>
      ) : (
        /* Manual UPI Activation Form */
        <div className="rounded-2xl border border-brand-200/90 bg-white p-6 shadow-sm space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-900">Sweetly Pro Subscription</h2>
              <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-bold text-brand-700">
                ₹199 / month
              </span>
            </div>
            <p className="mt-1 text-xs text-brand-600">
              Manual UPI activation workflow. Transfer ₹199 via any UPI app and submit your transaction details below for quick verification.
            </p>
          </div>

          {/* UPI Payment Box */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-5 space-y-4">
            <p className="text-xs font-bold text-brand-900 uppercase tracking-wider">Step 1: Pay via UPI</p>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-brand-200">
              <div>
                <p className="text-[11px] font-medium text-brand-500">Official Sweetly UPI ID</p>
                <p className="font-mono text-sm font-bold text-brand-900 tracking-wide">{upiId}</p>
              </div>
              <button
                type="button"
                onClick={copyUpi}
                className="self-start sm:self-auto rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-800 px-3 py-1.5 text-xs font-semibold transition"
              >
                {copied ? "✓ Copied!" : "Copy UPI ID"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-brand-100 font-medium text-brand-700">
                Google Pay
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-brand-100 font-medium text-brand-700">
                PhonePe
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-brand-100 font-medium text-brand-700">
                Paytm
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-brand-100 font-medium text-brand-700">
                BHIM / Any UPI
              </div>
            </div>

            <p className="text-[11px] text-brand-600">
              Amount to transfer: <strong>₹199.00</strong>. Enter your store name in the payment remark if possible.
            </p>
          </div>

          {/* Submission Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs font-bold text-brand-900 uppercase tracking-wider">
              Step 2: Submit Payment Details
            </p>

            <div>
              <label htmlFor="utr" className="block text-xs font-semibold text-brand-800">
                UPI UTR / Transaction ID / Ref No. <span className="text-red-500">*</span>
              </label>
              <input
                id="utr"
                type="text"
                required
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="e.g. 423985729103 or UPI Reference No."
                className="mt-1.5 block w-full rounded-xl border border-brand-200 px-3.5 py-2.5 text-xs text-brand-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <p className="mt-1 text-[11px] text-brand-500">
                Found in your Google Pay, PhonePe, or Paytm receipt (typically 12 digits).
              </p>
            </div>

            <div>
              <label htmlFor="screenshot" className="block text-xs font-semibold text-brand-800">
                Payment Screenshot (Optional but recommended)
              </label>
              <input
                id="screenshot"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="mt-1.5 block w-full text-xs text-brand-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-100 file:text-brand-800 hover:file:bg-brand-200 cursor-pointer"
              />
              {previewUrl && (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Payment receipt preview"
                    className="h-16 w-16 object-cover rounded-lg border border-brand-200"
                  />
                  <span className="text-xs text-brand-600">{screenshotFile?.name}</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="notes" className="block text-xs font-semibold text-brand-800">
                Additional Notes (Optional)
              </label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special remarks or payment details"
                className="mt-1.5 block w-full rounded-xl border border-brand-200 px-3.5 py-2 text-xs text-brand-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 font-medium">
                🎉 Payment proof submitted successfully! Our team will verify and activate your store within a few hours.
              </div>
            ) : (
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-brand-600 px-6 py-3 text-xs font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {isPending ? "Submitting Payment Proof…" : "Submit Payment for Verification →"}
                </button>
                {isTrialActive && showEarlyPayment && (
                  <button
                    type="button"
                    onClick={() => setShowEarlyPayment(false)}
                    className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

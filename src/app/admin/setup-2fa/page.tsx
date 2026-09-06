"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { getOrStartMfaSetupAction, confirmMfaEnrollmentAction } from "./actions";

export default function AdminSetup2FaPage() {
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<{
    secretBase32: string;
    qrCodeUrl: string;
    recoveryCodes: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codesSaved, setCodesSaved] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function loadSetup() {
      setLoading(true);
      setError(null);
      const res = await getOrStartMfaSetupAction();
      if ("error" in res && res.error) {
        setError(res.error);
      } else if ("qrCodeUrl" in res) {
        setSetupData(res);
      }
      setLoading(false);
    }
    loadSetup();
  }, []);

  const handleCopyCodes = () => {
    if (!setupData) return;
    navigator.clipboard.writeText(setupData.recoveryCodes.join("\n"));
    setCopiedCodes(true);
    setCodesSaved(true);
    setTimeout(() => setCopiedCodes(false), 3000);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError("Please enter the 6-digit verification code from your authenticator app.");
      return;
    }
    if (!codesSaved) {
      setError("Please confirm you have saved your recovery codes before proceeding.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await confirmMfaEnrollmentAction(code.trim());
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Initializing secure MFA enrollment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-6 px-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Super Admin MFA Enrollment</h1>
            <p className="text-xs text-slate-400">Set up standard Two-Factor Authentication (TOTP) to secure platform administration.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-400">
            {error}
          </div>
        )}

        {setupData && (
          <div className="space-y-8">
            {/* Step 1: QR Code Scan */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">1</span>
                <h2 className="text-sm font-semibold text-slate-200">Scan QR in Authenticator App</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Open Google Authenticator, Microsoft Authenticator, 1Password, or Authy, and scan the QR code below:
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-6 justify-center bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="rounded-lg bg-white p-2 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={setupData.qrCodeUrl}
                    alt="Authenticator QR Code"
                    width={180}
                    height={180}
                    className="block"
                  />
                </div>

                <div className="text-center sm:text-left space-y-2 max-w-xs">
                  <p className="text-xs font-medium text-slate-300">Can&apos;t scan the QR code?</p>
                  <button
                    type="button"
                    onClick={() => setShowManualKey(!showManualKey)}
                    className="text-xs text-brand-400 hover:text-brand-300 underline"
                  >
                    {showManualKey ? "Hide manual key" : "View manual entry key"}
                  </button>
                  {showManualKey && (
                    <div className="mt-2 rounded-lg bg-slate-900 border border-slate-700 p-2 text-center">
                      <p className="text-[11px] font-mono tracking-wider text-amber-300 select-all break-all">
                        {setupData.secretBase32}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Time-based • 30s • SHA-1 • 6 Digits</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: Backup Recovery Codes */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">2</span>
                  <h2 className="text-sm font-semibold text-slate-200">Save Single-Use Recovery Codes</h2>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCodes}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 text-slate-200 border border-slate-700 transition"
                >
                  {copiedCodes ? "✓ Copied!" : "Copy All Codes"}
                </button>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                If you ever lose access to your authenticator application, each code can be used exactly once to log in. Store them in a secure password manager.
              </p>

              <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-3 rounded-lg border border-slate-800 font-mono text-xs text-brand-300">
                {setupData.recoveryCodes.map((c, i) => (
                  <div key={i} className="px-2 py-1 bg-slate-950/50 rounded flex justify-between">
                    <span className="text-slate-500">{i + 1}.</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={codesSaved}
                  onChange={(e) => setCodesSaved(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500"
                />
                <span>I have saved and securely backed up these single-use recovery codes</span>
              </label>
            </div>

            {/* Step 3: Enter confirmation code */}
            <form onSubmit={handleConfirm} className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">3</span>
                <h2 className="text-sm font-semibold text-slate-200">Verify & Activate MFA</h2>
              </div>
              <p className="text-xs text-slate-400">
                Enter the 6-digit code currently showing in your authenticator app to confirm setup.
              </p>

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-white placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending || code.length !== 6 || !codesSaved}
                  className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? "Activating MFA..." : "Confirm & Enter Admin Console"}
                </button>
                <Link
                  href="/dashboard"
                  className="rounded-xl px-4 py-3 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel / Return to Dashboard
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

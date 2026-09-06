"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { verifyAdminMfaAction } from "./actions";

export default function AdminVerifyPage() {
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("mode", mode);
    formData.set("code", code.trim());

    startTransition(async () => {
      const res = await verifyAdminMfaAction(formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>

        <h1 className="text-center font-display text-2xl font-bold text-white">
          Super Admin Verification
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          {mode === "totp"
            ? "Enter the 6-digit code from Google Authenticator, 1Password, or your authenticator app."
            : "Enter one of your single-use 12-character emergency recovery codes."}
        </p>

        <div className="mt-6 flex rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode("totp");
              setCode("");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
              mode === "totp" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Authenticator Code
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("recovery");
              setCode("");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition ${
              mode === "recovery" ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Recovery Code
          </button>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="code"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
            >
              {mode === "totp" ? "6-Digit Authenticator Code" : "Single-Use Recovery Code"}
            </label>
            <input
              id="code"
              type="text"
              inputMode={mode === "totp" ? "numeric" : "text"}
              autoComplete="one-time-code"
              maxLength={mode === "totp" ? 6 : 14}
              value={code}
              onChange={(e) => {
                if (mode === "totp") {
                  setCode(e.target.value.replace(/\D/g, ""));
                } else {
                  setCode(e.target.value.toUpperCase());
                }
              }}
              placeholder={mode === "totp" ? "000000" : "XXXX-XXXX-XXXX"}
              required
              className={`mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-center font-mono text-white placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                mode === "totp" ? "text-2xl tracking-[0.4em]" : "text-lg tracking-wider"
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={isPending || (mode === "totp" ? code.length !== 6 : code.length < 8)}
            className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-medium text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Verifying Authenticator Code..." : "Verify & Open Master Console"}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 border-t border-slate-800/80 pt-4 text-center">
          <Link
            href="/admin/setup-2fa"
            className="text-xs text-brand-400 hover:text-brand-300 transition"
          >
            Need to configure or re-enroll 2FA? Click here
          </Link>
          <p className="text-[11px] text-slate-500">
            Protected by RFC 6238 TOTP, AES-256-GCM encryption & atomic replay defense.
          </p>
        </div>
      </div>
    </div>
  );
}

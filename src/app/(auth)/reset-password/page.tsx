"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function initSession() {
      const code = searchParams.get("code");
      const supabase = createClient();

      if (code) {
        // Direct link exchange if redirected without /auth/callback
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          console.warn("PKCE code exchange error:", exchangeErr.message);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // User may need to request a fresh link if not authenticated
        setError("No active reset session found. If your link expired, please request a new one below.");
      }
      setIsInitializing(false);
    }

    initSession();
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setIsSubmitting(false);
      setError(
        updateError.message ||
          "Could not reset password. The link may have expired — please request a new one."
      );
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login?message=Password+updated+successfully!+Please+log+in."), 1800);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-brand-100 bg-white p-8 shadow-sm">
        <h1 className="mb-2 font-display text-2xl font-bold text-brand-900">Set a new password</h1>
        <p className="mb-6 text-sm text-brand-600">
          Enter a strong, secure password for your Sweetly account.
        </p>

        {isInitializing ? (
          <div className="py-8 text-center text-sm text-brand-500 animate-pulse">
            Verifying security token…
          </div>
        ) : done ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
            <p className="font-semibold text-emerald-800">Password updated successfully!</p>
            <p className="mt-1 text-xs text-emerald-700">Redirecting to login…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-700">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full rounded-xl border border-brand-200 px-4 py-3 pr-11 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-brand-400 hover:text-brand-600 transition"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-xl border border-brand-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-500 disabled:opacity-50"
            >
              {isSubmitting ? "Updating password…" : "Save New Password"}
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-brand-100 pt-4 text-center">
          <Link href="/forgot-password" className="text-xs text-brand-600 hover:text-brand-800 underline">
            Need a fresh reset link?
          </Link>
          <span className="mx-2 text-brand-300">•</span>
          <Link href="/login" className="text-xs text-brand-600 hover:text-brand-800 underline">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}

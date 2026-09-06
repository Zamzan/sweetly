"use client";

import { useState, useEffect, useActionState, Suspense } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-500 disabled:opacity-60"
    >
      {pending ? "Logging in…" : "Login"}
    </button>
  );
}

function LoginForm() {
  const [state, formAction] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const searchParams = useSearchParams();
  const infoMessage = searchParams.get("message");

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("sweetly_remember_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleRememberToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setRememberMe(checked);
    try {
      if (!checked) {
        localStorage.removeItem("sweetly_remember_email");
      } else if (email) {
        localStorage.setItem("sweetly_remember_email", email);
      }
    } catch {}
  };

  const handleSubmit = (formData: FormData) => {
    if (rememberMe && email) {
      try {
        localStorage.setItem("sweetly_remember_email", email);
      } catch {}
    } else {
      try {
        localStorage.removeItem("sweetly_remember_email");
      } catch {}
    }
    formAction(formData);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-brand-100 bg-white p-8 shadow-sm">
        <h1 className="mb-1 font-display text-2xl font-bold text-brand-900">Shop Owner Login</h1>
        <p className="mb-6 text-sm text-brand-600">Access your Sweetly dashboard.</p>

        {infoMessage && (
          <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800">
            {infoMessage}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={handleEmailChange}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-brand-200 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="Enter password"
                className="w-full rounded-xl border border-brand-200 px-4 py-2.5 pr-11 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-brand-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={handleRememberToggle}
                className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Remember me</span>
            </label>

            <Link href="/forgot-password" className="text-brand-600 hover:text-brand-800 underline">
              Forgot password?
            </Link>
          </div>

          {state?.error && (
            <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-xs text-brand-600">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand-700 underline">
            Create your shop (14-day free trial)
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
          <div className="rounded-2xl border border-brand-100 bg-white p-8 shadow-sm animate-pulse">
            <div className="h-6 w-32 bg-brand-100 rounded mb-4" />
            <div className="h-4 w-48 bg-brand-50 rounded mb-8" />
            <div className="space-y-4">
              <div className="h-10 bg-brand-50 rounded" />
              <div className="h-10 bg-brand-50 rounded" />
              <div className="h-10 bg-brand-600/30 rounded" />
            </div>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

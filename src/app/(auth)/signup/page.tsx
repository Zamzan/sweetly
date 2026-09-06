"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { signupAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-500 py-3 font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
    >
      {pending ? "Creating your shop…" : "Create My Shop"}
    </button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useActionState(signupAction, undefined);
  const [showPassword, setShowPassword] = useState(false);

  if (state?.success) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
            ✉️
          </div>
          <h1 className="mb-2 text-2xl font-bold text-emerald-950">Verify Your Email</h1>
          <p className="mb-6 text-sm leading-relaxed text-emerald-800">
            {state.message || "A verification link has been sent to your email. Please check your inbox and confirm your email to activate your shop."}
          </p>
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Go to Log In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-1 text-3xl font-bold text-brand-900">Create Your Shop</h1>
      <p className="mb-4 text-brand-600">Join sweet shops and bakeries selling online with Sweetly.</p>

      <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900">
        <p className="font-bold flex items-center gap-1.5 text-emerald-800 text-sm">
          <span>✨</span> 100% Free 14-Day Trial — No Card Required!
        </p>
        <p className="mt-1 text-emerald-700 leading-relaxed">
          Test the website for 14 days completely free without providing any payment details. Only after 14 days, pay ₹199/month if you decide to keep your shop online.
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <Field label="Shop Name" name="shopName" placeholder="e.g. Rahman Sweets" required />
        <Field label="Owner Name" name="ownerName" placeholder="e.g. Abdul Rahman" required />
        <Field label="Email" name="email" type="email" placeholder="you@example.com" required />
        <Field label="Phone" name="phone" type="tel" placeholder="10-digit mobile number (e.g. 9876543210)" required />
        
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-brand-900">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={8}
              required
              placeholder="Minimum 8 characters"
              className="w-full rounded-lg border border-brand-100 px-4 py-2.5 pr-11 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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

        {state?.error && (
          <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700">
            {state.error}
          </p>
        )}

        <SubmitButton />
      </form>

      <p className="mt-6 text-center text-sm text-brand-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </main>
  );
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  const { label, name, type = "text", ...rest } = props;
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-brand-900">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        {...rest}
        className="w-full rounded-lg border border-brand-100 px-4 py-2.5 focus:border-brand-500"
      />
    </div>
  );
}

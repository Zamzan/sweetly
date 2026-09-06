"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(forgotPasswordAction, undefined);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-1 text-3xl">Reset your password</h1>
      <p className="mb-8 text-brand-600">We'll email you a reset link.</p>

      <form action={formAction} className="space-y-4">
        <input
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-lg border border-brand-100 px-4 py-2.5 focus:border-brand-500"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.message && <p className="text-sm text-green-700">{state.message}</p>}
        <button className="w-full rounded-lg bg-brand-500 py-3 font-medium text-white hover:bg-brand-600">
          Send reset link
        </button>
      </form>
    </main>
  );
}

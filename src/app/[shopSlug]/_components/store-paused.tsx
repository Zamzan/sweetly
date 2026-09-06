import Link from "next/link";

export function StorePaused({ shopName }: { shopName: string }) {
  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-brand-200/80 bg-white p-8 text-center shadow-xl shadow-brand-500/5">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
          <span className="text-2xl">⏳</span>
        </div>

        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          Store Temporarily Paused
        </span>

        <h1 className="mt-4 font-display text-2xl font-bold text-brand-900">
          {shopName}
        </h1>

        <p className="mt-3 text-sm text-brand-600 leading-relaxed">
          This online store is temporarily paused pending subscription renewal. If you are the store owner, please sign in to your dashboard to activate your <strong>₹199/month</strong> Sweetly Starter plan and resume taking orders.
        </p>

        <div className="mt-8 pt-6 border-t border-brand-100 flex flex-col gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700"
          >
            Shop Owner Sign In →
          </Link>
          <Link
            href="/"
            className="text-xs text-brand-400 hover:text-brand-600 transition"
          >
            Powered by Sweetly
          </Link>
        </div>
      </div>
    </div>
  );
}

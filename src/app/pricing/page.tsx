import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1 text-xs font-semibold text-emerald-800">
          ✨ 100% Free 14-Day Trial — No Card Required
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
          Test everything free for 14 days.
        </h1>
        <p className="mt-3 text-base text-brand-700">
          Create your shop and test all features for 14 days without giving any payment details.
          Only after 14 days, if you want to keep your shop online, enter your payment details and pay ₹199/month.
        </p>
      </div>

      <div className="mx-auto max-w-xl rounded-3xl border-2 border-emerald-500/30 bg-white p-8 sm:p-10 shadow-xl shadow-brand-500/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-1 rounded-bl-xl">
          100% Free 14-Day Trial
        </div>

        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Sweetly Starter</p>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-display text-5xl font-bold text-brand-900">₹199</span>
          <span className="text-base font-medium text-brand-600">/month</span>
        </div>
        <p className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Test 100% free for 14 days · Zero card details collected upfront
        </p>

        <div className="mt-6 rounded-2xl bg-emerald-50/70 p-4 text-xs text-emerald-900 border border-emerald-200/80 space-y-1.5">
          <p className="font-bold flex items-center gap-2">
            <span>🛡️</span> How the 14-Day Free Trial Works:
          </p>
          <p className="leading-relaxed">
            • <strong>Days 1–14:</strong> Test the website completely free. You do not need to give us any card details or payment information. Everything is unlocked.
          </p>
          <p className="leading-relaxed">
            • <strong>After 14 Days:</strong> If you love Sweetly and want to keep your store online taking orders, enter your payment details and pay <strong>₹199/month</strong>.
          </p>
          <p className="leading-relaxed">
            • If you decide not to continue, you pay nothing. No hidden charges.
          </p>
        </div>

        <div className="mt-8 border-t border-brand-100 pt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-500 mb-4">
            Everything Included:
          </p>

          <ul className="space-y-3 text-sm text-brand-800">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span>
                <strong>Your own Sweetly storefront</strong> — e.g. <code className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700 font-mono">sweetly.vercel.app/rahman-sweets</code>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>Product catalog</strong> &amp; up to 5 photos per product</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>Categories &amp; Sections</strong> to organize cakes, sweets, bags &amp; fancy gifts</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>Custom-order form</strong> with celebration details &amp; design inspiration</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>Wedding &amp; gift-order options</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>WhatsApp ordering</strong> with automatically formatted WhatsApp messages</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>Owner dashboard &amp; order management</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>Shop information &amp; logo/cover image</strong> branding</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>Basic analytics</strong> &amp; live revenue tracking badge</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>High-speed Hosting &amp; SSL included</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 mt-0.5">✓</span>
              <span><strong>Security updates, bug fixes &amp; platform updates</strong></span>
            </li>
          </ul>

          <div className="mt-6 rounded-2xl bg-brand-50/60 p-4 text-xs text-brand-700 space-y-1.5 border border-brand-200/60">
            <p className="flex items-center gap-2 font-medium">
              <span className="text-emerald-600 font-bold">✓</span> No setup fee.
            </p>
            <p className="flex items-center gap-2 font-medium">
              <span className="text-emerald-600 font-bold">✓</span> No custom-domain fee because we&apos;re not offering custom domains yet.
            </p>
            <p className="flex items-center gap-2 font-medium">
              <span className="text-emerald-600 font-bold">✓</span> 100% Free 14-day trial without entering any payment details.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-brand-100">
          <Link
            href="/signup"
            className="block w-full rounded-2xl bg-brand-600 px-6 py-3.5 text-center text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700"
          >
            Start 14-Day Free Trial (No Card Needed) →
          </Link>
          <p className="mt-2 text-center text-xs text-brand-400">
            Zero commitment • No payment details collected upfront
          </p>
        </div>
      </div>
    </main>
  );
}

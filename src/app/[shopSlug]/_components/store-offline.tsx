import Link from "next/link";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";

export function StoreOffline({
  shopName,
  whatsappNumber,
}: {
  shopName: string;
  whatsappNumber?: string | null;
}) {
  let whatsappUrl: string | null = null;
  if (whatsappNumber) {
    try {
      const digits = normalizeWhatsAppNumber(whatsappNumber);
      whatsappUrl = `https://wa.me/${digits}?text=${encodeURIComponent(
        `Hi ${shopName}, I was visiting your Sweetly online store!`
      )}`;
    } catch {}
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 border border-slate-200">
          <span className="text-2xl">💤</span>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Storefront Offline
        </span>

        <h1 className="mt-4 font-display text-2xl font-bold text-slate-900">
          {shopName}
        </h1>

        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          This store is currently taking a break or offline. Please check back later, or contact the shop owner directly.
        </p>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-3">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 flex items-center justify-center gap-2"
            >
              <span>💬</span>
              <span>Message Shop on WhatsApp</span>
            </a>
          )}
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-slate-600 transition"
          >
            Powered by Sweetly
          </Link>
        </div>
      </div>
    </div>
  );
}

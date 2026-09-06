"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function StorefrontLinkBar({
  shopSlug,
  shopName,
  isPublished,
}: {
  shopSlug: string;
  shopName: string;
  isPublished: boolean;
}) {
  const [copiedStore, setCopiedStore] = useState(false);
  const [copiedCustom, setCopiedCustom] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const storeUrl = origin ? `${origin}/${shopSlug}` : `/${shopSlug}`;
  const customOrderUrl = `${storeUrl}/custom-order`;

  function copyToClipboard(text: string, type: "store" | "custom") {
    navigator.clipboard.writeText(text);
    if (type === "store") {
      setCopiedStore(true);
      setTimeout(() => setCopiedStore(false), 2500);
    } else {
      setCopiedCustom(true);
      setTimeout(() => setCopiedCustom(false), 2500);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-brand-200/80 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-900 p-4 text-white shadow-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Store link details */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">
              Your Public Storefront Website
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isPublished
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isPublished ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {isPublished ? "Live" : "Unpublished / Draft"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-black/30 px-2.5 py-1 text-xs font-mono text-brand-100 select-all">
              {storeUrl}
            </code>
            {!isPublished && (
              <Link
                href="/dashboard/settings"
                className="text-xs text-amber-300 underline underline-offset-2 hover:text-amber-200"
              >
                (Click here to publish)
              </Link>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Copy Storefront Link */}
          <button
            type="button"
            onClick={() => copyToClipboard(storeUrl, "store")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
          >
            {copiedStore ? (
              <>
                <span className="text-emerald-400">✓</span> Copied Link!
              </>
            ) : (
              <>
                <span>🔗</span> Copy Store Link
              </>
            )}
          </button>

          {/* Copy Custom Order Link */}
          <button
            type="button"
            onClick={() => copyToClipboard(customOrderUrl, "custom")}
            title="Direct link for buyers to place custom cake & order requests"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-700/80 px-3.5 py-2 text-xs font-medium text-brand-100 transition hover:bg-brand-700 active:scale-95"
          >
            {copiedCustom ? (
              <>
                <span className="text-emerald-400">✓</span> Copied Custom Link!
              </>
            ) : (
              <>
                <span>🎂</span> Copy Custom Order Link
              </>
            )}
          </button>

          {/* Open Store */}
          <Link
            href={`/${shopSlug}`}
            target="_blank"
            className="inline-flex items-center gap-1 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-400 active:scale-95"
          >
            Visit Storefront ↗
          </Link>
        </div>
      </div>
    </div>
  );
}

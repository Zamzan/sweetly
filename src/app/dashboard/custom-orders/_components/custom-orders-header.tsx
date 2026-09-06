"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function CustomOrdersHeader({ shopSlug }: { shopSlug: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const customOrderUrl = origin
    ? `${origin}/${shopSlug}/custom-order`
    : `/${shopSlug}/custom-order`;

  function handleCopy() {
    navigator.clipboard.writeText(customOrderUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900">
          Custom Cake & Dessert Orders
        </h1>
        <p className="mt-1 text-sm text-brand-600">
          Manage personalized cake inquiries, client photo inspirations, and WhatsApp orders.
        </p>
      </div>

      {/* Customer-Facing Link & Explainer Box */}
      <div className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              🎂 Shareable Custom Order Form
            </span>
            <p className="text-sm font-medium text-brand-900">
              Your customers use this dedicated link to submit customized cake and catering requests:
            </p>
            <code className="block rounded-lg bg-brand-50/80 px-3 py-1.5 text-xs font-mono text-brand-800 break-all select-all">
              {customOrderUrl}
            </code>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-95"
            >
              {copied ? "✓ Copied Link!" : "📋 Copy Custom Order Link"}
            </button>
            <Link
              href={`/${shopSlug}/custom-order`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-white px-3.5 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
            >
              Preview Form ↗
            </Link>
          </div>
        </div>

        {/* 4 Step Workflow Explainer */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-brand-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-brand-50/40 p-3">
            <span className="font-semibold text-brand-800 text-xs">1. Share Your Link</span>
            <p className="mt-1 text-xs text-brand-600">
              Put this link in your Instagram bio, WhatsApp Business profile, or send to clients.
            </p>
          </div>
          <div className="rounded-xl bg-brand-50/40 p-3">
            <span className="font-semibold text-brand-800 text-xs">2. Clients Submit Details</span>
            <p className="mt-1 text-xs text-brand-600">
              They specify design ideas, delivery date, occasion, and upload up to 5 reference photos.
            </p>
          </div>
          <div className="rounded-xl bg-brand-50/40 p-3">
            <span className="font-semibold text-brand-800 text-xs">3. Instant WhatsApp Chat</span>
            <p className="mt-1 text-xs text-brand-600">
              Client is redirected to WhatsApp with order details pre-filled for rapid communication.
            </p>
          </div>
          <div className="rounded-xl bg-brand-50/40 p-3">
            <span className="font-semibold text-brand-800 text-xs">4. Track & Fulfill</span>
            <p className="mt-1 text-xs text-brand-600">
              Review reference photos below, message them back, and track status until delivered.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

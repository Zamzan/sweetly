"use client";

import { useState, useTransition } from "react";
import { toggleShopPublishStatusAction } from "../actions";

export function ShopStatusToggle({
  shopId,
  isPublished,
  shopName,
  compact = false,
}: {
  shopId: string;
  isPublished: boolean;
  shopName: string;
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    const nextState = !isPublished;
    const confirmPrompt = nextState
      ? `Are you sure you want to put "${shopName}" LIVE? Customers will be able to access the storefront and place orders.`
      : `Are you sure you want to take "${shopName}" OFFLINE? Customers will NOT be able to view or order from this storefront.`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setError(null);
    const formData = new FormData();
    formData.set("shopId", shopId);
    formData.set("isPublished", String(nextState));

    startTransition(async () => {
      const res = await toggleShopPublishStatusAction(formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
            isPublished
              ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
          } disabled:opacity-50`}
        >
          {isPending ? "Updating…" : isPublished ? "Take Offline" : "Go Live"}
        </button>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-md transition ${
          isPublished
            ? "bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20"
            : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
        } disabled:opacity-50`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isPublished ? "bg-red-400" : "bg-emerald-400 animate-pulse"
          }`}
        />
        <span>
          {isPending
            ? "Updating Storefront…"
            : isPublished
            ? "🛑 Take Shop Offline"
            : "✅ Put Shop Live (Publish)"}
        </span>
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

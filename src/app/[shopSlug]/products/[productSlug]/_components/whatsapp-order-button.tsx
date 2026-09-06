"use client";

import { useState } from "react";

export function WhatsAppOrderButton({
  shopSlug,
  shopName,
  productName,
  price,
}: {
  shopSlug: string;
  shopName?: string;
  productName: string;
  price: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/whatsapp-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopSlug, productName, price }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start WhatsApp order.");
        return;
      }
      // User-initiated navigation — WhatsApp opens with the message
      // pre-filled; the user must press Send themselves.
      window.open(data.link, "_blank", "noopener,noreferrer");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700 disabled:opacity-60"
      >
        {loading ? "Preparing…" : "Order on WhatsApp"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

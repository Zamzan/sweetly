"use client";

import { useState } from "react";
import Image from "next/image";
import { useCart } from "@/context/cart-context";

export function CartDrawer({
  shopSlug,
  shopName,
  whatsappNumber,
}: {
  shopSlug: string;
  shopName: string;
  whatsappNumber?: string | null;
}) {
  const { items, removeItem, updateQuantity, clearCart, totalAmount, isCartOpen, closeCart } =
    useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderSent, setOrderSent] = useState(false);

  if (!isCartOpen) return null;

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/cart-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug,
          customerName,
          customerPhone,
          address,
          notes,
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to place order. Please try again.");
        return;
      }

      setOrderSent(true);
      clearCart();

      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={closeCart}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-brand-100 px-6 py-5">
            <div>
              <h2 className="text-lg font-bold text-brand-900">Your Order Bag</h2>
              <p className="text-xs text-brand-500">
                {items.length} {items.length === 1 ? "item" : "items"} from {shopName}
              </p>
            </div>
            <button
              onClick={closeCart}
              className="rounded-full p-2 text-brand-400 hover:bg-brand-50 hover:text-brand-700"
              aria-label="Close cart"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {orderSent ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
                  ✓
                </div>
                <h3 className="text-base font-bold text-emerald-900">Order Sent to Shop!</h3>
                <p className="mt-1 text-xs text-emerald-700">
                  Your order details and instructions were prepared. If WhatsApp opened in another tab, press Send there to chat directly with {shopName}.
                </p>
                <button
                  onClick={() => {
                    setOrderSent(false);
                    closeCart();
                  }}
                  className="mt-5 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800"
                >
                  Done
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-4xl">🛍️</p>
                <h3 className="mt-3 text-base font-semibold text-brand-900">Your bag is empty</h3>
                <p className="mt-1 text-xs text-brand-500">
                  Explore our treats and click &quot;Add to Bag&quot; to build your order.
                </p>
                <button
                  onClick={closeCart}
                  className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Browse Products
                </button>
              </div>
            ) : (
              <>
                {/* Cart Items List */}
                <div className="divide-y divide-brand-100">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-brand-100 bg-brand-50">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-brand-300">
                            Treat
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-brand-900">{item.name}</h4>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-xs text-brand-400 hover:text-red-600"
                            title="Remove item"
                          >
                            ×
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs font-bold text-brand-800">
                            ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                          </span>

                          <div className="flex items-center rounded-lg border border-brand-200 bg-brand-50/50">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="px-2 py-0.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
                            >
                              -
                            </button>
                            <span className="px-2 text-xs font-semibold text-brand-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="px-2 py-0.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Checkout & Custom Notes Form */}
                <form id="cart-checkout-form" onSubmit={handleCheckout} className="space-y-3 pt-2">
                  <div className="border-t border-brand-100 pt-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
                      Your Contact & Delivery Info
                    </h4>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Your Name *"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                      />
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={10}
                        placeholder="10-digit Mobile Number *"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Delivery / Pickup Address (optional)"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="mt-2.5 w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  {/* Notes & Special Instructions */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-700">
                      Notes & Special Instructions for {shopName}
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Gift wrapping requested, message on box, delivery timing, dietary preferences..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3 py-2 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                      {error}
                    </div>
                  )}
                </form>
              </>
            )}
          </div>

          {/* Drawer Footer */}
          {!orderSent && items.length > 0 && (
            <div className="border-t border-brand-100 bg-brand-50/30 p-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-brand-600">Subtotal</span>
                <span className="text-base font-bold text-brand-900">
                  ₹{totalAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <button
                type="submit"
                form="cart-checkout-form"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-60 active:scale-[0.99]"
              >
                <span>💬</span>
                {submitting ? "Preparing Order…" : "Order on WhatsApp"}
              </button>

              <p className="text-center text-[11px] text-brand-500">
                You will review your order and chat directly with {shopName} on WhatsApp.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

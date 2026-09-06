"use client";

import { useCart } from "@/context/cart-context";

export function CartHeaderButton() {
  const { itemCount, totalAmount, toggleCart } = useCart();

  return (
    <button
      type="button"
      onClick={toggleCart}
      className="relative flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-3.5 py-2 text-xs font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50 active:scale-95"
      aria-label="View shopping bag"
    >
      <span className="text-sm">🛍️</span>
      <span className="hidden sm:inline">Bag</span>
      {itemCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
          {itemCount}
        </span>
      )}
      {totalAmount > 0 && (
        <span className="hidden font-bold text-brand-900 md:inline">
          ₹{totalAmount.toLocaleString("en-IN")}
        </span>
      )}
    </button>
  );
}

export function FloatingCartBar() {
  const { itemCount, totalAmount, openCart } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden animate-in slide-in-from-bottom duration-300">
      <button
        type="button"
        onClick={openCart}
        className="flex w-full items-center justify-between rounded-2xl bg-brand-900 px-5 py-3.5 text-white shadow-xl backdrop-blur-md active:scale-95"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
            {itemCount}
          </span>
          <span className="text-xs font-semibold">View Order Bag</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">₹{totalAmount.toLocaleString("en-IN")}</span>
          <span className="text-xs text-brand-300">→</span>
        </div>
      </button>
    </div>
  );
}

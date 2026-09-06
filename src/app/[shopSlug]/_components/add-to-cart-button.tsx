"use client";

import { useState } from "react";
import { useCart } from "@/context/cart-context";

export function AddToCartButton({
  product,
  size = "md",
}: {
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string | null;
    slug?: string;
  };
  size?: "sm" | "md" | "lg";
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-xs",
    lg: "px-6 py-3 text-sm",
  }[size];

  return (
    <button
      type="button"
      onClick={handleAdd}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition active:scale-95 ${sizeClasses} ${
        added
          ? "bg-emerald-600 text-white shadow-sm"
          : "bg-brand-600 text-white shadow-sm hover:bg-brand-700"
      }`}
    >
      {added ? (
        <>
          <span>✓</span> Added
        </>
      ) : (
        <>
          <span>+</span> Add to Bag
        </>
      )}
    </button>
  );
}

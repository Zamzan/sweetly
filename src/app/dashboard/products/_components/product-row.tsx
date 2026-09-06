"use client";

import { useTransition } from "react";
import Image from "next/image";
import { deleteProductAction, updateProductAction } from "../actions";
import { getPublicAssetUrl } from "@/lib/images";

export interface ProductItem {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  available: boolean;
  featured: boolean;
  category_id?: string | null;
  category_name?: string | null;
  section_id?: string | null;
  section_name?: string | null;
  has_variants?: boolean;
  variants?: any[];
  sizes?: string[];
  colors?: string[];
  categories?: string[];
  category_ids?: string[];
  section_ids?: string[];
  product_images?: { id: string; storage_path: string }[];
}

export function ProductRow({ product }: { product: ProductItem }) {
  const [pending, startTransition] = useTransition();

  const imageUrl = getPublicAssetUrl(product.product_images?.[0]?.storage_path);
  const imageCount = product.product_images?.length ?? 0;

  function toggleAvailable() {
    const fd = new FormData();
    fd.set("available", (!product.available).toString());
    startTransition(() => {
      void updateProductAction(product.id, fd);
    });
  }

  function toggleFeatured() {
    const fd = new FormData();
    fd.set("featured", (!product.featured).toString());
    startTransition(() => {
      void updateProductAction(product.id, fd);
    });
  }

  function remove() {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    startTransition(() => {
      void deleteProductAction(product.id);
    });
  }

  return (
    <tr className="border-t border-brand-100/60 transition hover:bg-brand-50/30">
      {/* Product Image & Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-brand-100 bg-brand-50">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-brand-300">
                🍰
              </div>
            )}
            {imageCount > 1 && (
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0.2 text-[9px] font-bold text-white backdrop-blur-xs">
                📷 {imageCount}
              </span>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-brand-900">{product.name}</span>
              {product.featured && (
                <span className="rounded-full bg-amber-100 px-2 py-0.2 text-[10px] font-semibold text-amber-800">
                  Featured ⭐
                </span>
              )}
              {product.has_variants && product.sizes && product.sizes.length > 0 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.2 text-[10px] font-semibold text-purple-800">
                  {product.sizes.length} sizes
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-brand-500">
              {product.category_name && (
                <span className="rounded bg-brand-50 border border-brand-200/60 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                  {product.category_name}
                </span>
              )}
              {product.categories &&
                product.categories
                  .filter((c) => c !== product.category_name)
                  .map((c) => (
                    <span
                      key={c}
                      className="rounded bg-brand-50/80 border border-brand-200/40 px-1.5 py-0.5 text-[10px] font-medium text-brand-600"
                    >
                      {c}
                    </span>
                  ))}
              {product.section_name && (
                <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                  Section: {product.section_name}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Price */}
      <td className="px-4 py-3 font-semibold text-brand-800">
        ₹{Number(product.price).toLocaleString("en-IN")}
        {product.has_variants && (
          <span className="block text-[11px] font-normal text-brand-500">Base price</span>
        )}
      </td>

      {/* Availability Status */}
      <td className="px-4 py-3">
        <button
          onClick={toggleAvailable}
          disabled={pending}
          title="Click to toggle availability"
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
            product.available
              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              product.available ? "bg-emerald-500" : "bg-gray-400"
            }`}
          />
          {product.available ? "Available" : "Hidden"}
        </button>
      </td>

      {/* Featured Toggle & Delete */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={toggleFeatured}
            disabled={pending}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              product.featured
                ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "text-brand-500 hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            {product.featured ? "Unfeature" : "Feature"}
          </button>
          <button
            onClick={remove}
            disabled={pending}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

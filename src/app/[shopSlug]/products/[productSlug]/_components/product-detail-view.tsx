"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getPublicAssetUrl } from "@/lib/images";
import { AddToCartButton } from "../../../_components/add-to-cart-button";
import { WhatsAppOrderButton } from "./whatsapp-order-button";

interface ProductImage {
  id: string;
  storage_path: string;
}

interface Variant {
  id: string;
  name: string;
  size?: string;
  color?: string;
  price: number;
  available?: boolean;
}

export function ProductDetailView({
  shop,
  product,
}: {
  shop: { id: string; name: string; slug: string; whatsapp_number?: string | null };
  product: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    price: number;
    has_variants?: boolean;
    variants?: Variant[];
    sizes?: string[];
    colors?: string[];
    product_images?: ProductImage[];
  };
}) {
  const images = (product.product_images || []).map((img) => getPublicAssetUrl(img.storage_path)).filter(Boolean) as string[];
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Variant selections
  const variants = product.variants || [];
  const hasVariants = product.has_variants && variants.length > 0;

  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    hasVariants ? variants[0]?.id || "" : ""
  );

  const selectedVariant = hasVariants
    ? variants.find((v) => v.id === selectedVariantId) || variants[0]
    : null;

  // Active displayed price (variant price if available, otherwise base price)
  const currentPrice = selectedVariant ? selectedVariant.price : Number(product.price);
  const currentSize = selectedVariant?.size;
  const currentColor = selectedVariant?.color;

  const activeImageUrl = images[activeImageIndex] || null;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* 5-Photo Gallery */}
      <div className="space-y-3">
        {/* Large Active Photo */}
        <div className="relative h-80 overflow-hidden rounded-3xl border border-brand-100 bg-brand-50 shadow-sm md:h-[440px]">
          {activeImageUrl ? (
            <Image
              src={activeImageUrl}
              alt={`${product.name} - Photo ${activeImageIndex + 1}`}
              fill
              priority
              className="object-cover transition duration-200"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-3xl text-brand-300">
              🛍️
            </div>
          )}

          {images.length > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              {activeImageIndex + 1} / {images.length}
            </span>
          )}
        </div>

        {/* Thumbnails Row (Up to 5 photos) */}
        {images.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border-2 transition ${
                  activeImageIndex === idx
                    ? "border-brand-600 shadow-md ring-2 ring-brand-500/20"
                    : "border-brand-200 hover:border-brand-400"
                }`}
              >
                <Image
                  src={imgUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Details & Variant Picker */}
      <div className="flex flex-col justify-between py-2">
        <div className="space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">
              Fresh from {shop.name}
            </span>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-950 font-display">
              {product.name}
            </h1>
            <div className="mt-3 flex items-baseline gap-3">
              <p className="text-3xl font-extrabold text-brand-800 font-display">
                ₹{currentPrice.toLocaleString("en-IN")}
              </p>
              {hasVariants && selectedVariant?.size && (
                <span className="text-xs text-brand-500">
                  for {selectedVariant.size}
                  {selectedVariant.color ? ` (${selectedVariant.color})` : ""}
                </span>
              )}
            </div>
          </div>

          {/* Variants Selector: Size & Color */}
          {hasVariants && (
            <div className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-800">
                  Select Size / Option:
                </label>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const isSelected = v.id === selectedVariant?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                          isSelected
                            ? "border-brand-800 bg-brand-900 text-white shadow-sm"
                            : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
                        }`}
                      >
                        <span>{v.size || v.name}</span>
                        <span className="ml-1.5 opacity-80">₹{v.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Details if any */}
              {selectedVariant?.color && (
                <div className="flex items-center gap-2 pt-1 border-t border-brand-100/60">
                  <span className="text-xs font-medium text-brand-600">Color:</span>
                  <span className="rounded-md bg-white border border-brand-200 px-2 py-0.5 text-xs font-semibold text-brand-800">
                    {selectedVariant.color}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {product.description ? (
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700">
                Product Details
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-brand-800">
                {product.description}
              </p>
            </div>
          ) : (
            <p className="text-xs italic text-brand-400">
              Crafted fresh with quality ingredients and attention to detail.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 border-t border-brand-100 pt-6">
          <div className="flex items-center gap-3">
            <AddToCartButton
              product={{
                id: product.id,
                name: hasVariants && currentSize ? `${product.name} (${currentSize})` : product.name,
                price: currentPrice,
                image_url: activeImageUrl,
              }}
            />

            <WhatsAppOrderButton
              shopSlug={shop.slug}
              shopName={shop.name}
              productName={
                hasVariants && currentSize
                  ? `${product.name} - ${currentSize}${currentColor ? ` [${currentColor}]` : ""}`
                  : product.name
              }
              price={currentPrice}
            />
          </div>

          <Link
            href={`/${shop.slug}/products`}
            className="text-center text-xs font-medium text-brand-600 hover:text-brand-900 hover:underline"
          >
            ← Continue shopping other items
          </Link>
        </div>
      </div>
    </div>
  );
}

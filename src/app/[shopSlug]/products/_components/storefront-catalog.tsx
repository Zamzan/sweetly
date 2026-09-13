"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getPublicAssetUrl } from "@/lib/images";
import { AddToCartButton } from "../../_components/add-to-cart-button";
import type { ProductVariantItem } from "@/lib/product-variants";

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  description?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  section_id?: string | null;
  section_name?: string | null;
  has_variants?: boolean;
  variants?: ProductVariantItem[];
  sizes?: string[];
  colors?: string[];
  categories?: string[];
  category_ids?: string[];
  section_ids?: string[];
  product_images?: Array<{ id: string; storage_path: string }>;
}

export function StorefrontCatalog({
  shopSlug,
  shopName,
  products,
  categories,
  sections,
  initialCategory,
}: {
  shopSlug: string;
  shopName: string;
  products: CatalogProduct[];
  categories: Array<{ id: string; name: string; slug: string }>;
  sections: Array<{ id: string; name: string; slug: string }>;
  initialCategory?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || "all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedSize, setSelectedSize] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"featured" | "price-asc" | "price-desc" | "newest" | "name">("featured");

  // Collect all unique categories / occasions across all products and formal categories
  const allCategoryOptions = useMemo(() => {
    const list: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();

    categories.forEach((c) => {
      list.push({ id: c.id, name: c.name });
      seen.add(c.name.toLowerCase());
      seen.add(c.id);
    });

    products.forEach((p) => {
      (p.categories || []).forEach((cat) => {
        if (!seen.has(cat.toLowerCase())) {
          seen.add(cat.toLowerCase());
          list.push({ id: cat, name: cat });
        }
      });
    });

    return list;
  }, [categories, products]);

  // Collect all unique sizes across all products for the size filter pills
  const allSizes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      (p.sizes || []).forEach((s) => set.add(s));
      (p.variants || []).forEach((v) => {
        if (v.size) set.add(v.size);
      });
    });
    return Array.from(set);
  }, [products]);

  // Filtering and sorting logic
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // 1. Multi-Category / Occasion filter (matches by category_id, category_ids, or category name)
    if (selectedCategory !== "all") {
      const matchKey = selectedCategory.toLowerCase();
      list = list.filter((p) => {
        const matchesDirectId = p.category_id === selectedCategory;
        const matchesCatIds = (p.category_ids || []).includes(selectedCategory);
        const matchesName = (p.category_name || "").toLowerCase() === matchKey;
        const matchesInCategories = (p.categories || []).some(
          (c) => c.toLowerCase() === matchKey
        );
        return matchesDirectId || matchesCatIds || matchesName || matchesInCategories;
      });
    }

    // 2. Multi-Section filter
    if (selectedSection !== "all") {
      list = list.filter((p) => {
        const matchesDirectId = p.section_id === selectedSection;
        const matchesSecIds = (p.section_ids || []).includes(selectedSection);
        const matchesName = (p.section_name || "").toLowerCase() === selectedSection.toLowerCase();
        return matchesDirectId || matchesSecIds || matchesName;
      });
    }

    // 3. Size filter
    if (selectedSize !== "all") {
      list = list.filter((p) => {
        const hasDirectSize = (p.sizes || []).includes(selectedSize);
        const hasVariantSize = (p.variants || []).some((v) => v.size === selectedSize);
        return hasDirectSize || hasVariantSize;
      });
    }

    // 4. Amazon-like search query (matches name, description, category, occasions, section, size, color)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const inName = p.name.toLowerCase().includes(q);
        const cleanDesc = (p.description || "").replace(/<!--sweetly_variants:[\s\S]*?-->/g, "").trim().toLowerCase();
        const inDesc = cleanDesc.includes(q);
        const inCat = (p.category_name || "").toLowerCase().includes(q);
        const inMultiCat = (p.categories || []).some((c) => c.toLowerCase().includes(q));
        const inSec = (p.section_name || "").toLowerCase().includes(q);
        const inSizes = (p.sizes || []).some((s) => s.toLowerCase().includes(q));
        const inColors = (p.colors || []).some((c) => c.toLowerCase().includes(q));
        return inName || inDesc || inCat || inMultiCat || inSec || inSizes || inColors;
      });
    }

    // 5. Sorting
    list.sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0; // default order / featured
    });

    return list;
  }, [products, selectedCategory, selectedSection, selectedSize, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* Search Bar & Sort Header */}
      <div
        className="rounded-2xl border p-4 shadow-sm sm:p-5 transition-colors"
        style={{
          backgroundColor: "var(--theme-card-bg)",
          borderColor: "var(--theme-card-border)",
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm opacity-50">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sweets, cakes, fancy bags, gift boxes, 500g, 1kg..."
              className="w-full rounded-xl border py-2.5 pl-10 pr-10 text-sm transition focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              style={{
                backgroundColor: "var(--theme-bg)",
                borderColor: "var(--theme-card-border)",
                color: "var(--theme-text-primary)",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-xs font-semibold" style={{ color: "var(--theme-text-secondary)" }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border px-3 py-2 text-xs font-medium transition focus:outline-none"
              style={{
                backgroundColor: "var(--theme-bg)",
                borderColor: "var(--theme-card-border)",
                color: "var(--theme-text-primary)",
              }}
            >
              <option value="featured">Featured / Recommended</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Product Name: A to Z</option>
            </select>
          </div>
        </div>


        {/* Category & Occasion Pills */}
        {allCategoryOptions.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-brand-50 pt-3">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-brand-500">
              Occasion / Category:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                selectedCategory === "all"
                  ? "text-white shadow-sm"
                  : "bg-brand-50 text-brand-700 hover:bg-brand-100"
              }`}
              style={selectedCategory === "all" ? { backgroundColor: "var(--shop-primary, #b43b67)" } : undefined}
            >
              All
            </button>
            {allCategoryOptions.map((c) => {
              const isSelected =
                selectedCategory === c.id ||
                selectedCategory.toLowerCase() === c.name.toLowerCase();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? "all" : c.id)}
                  className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                    isSelected
                      ? "text-white shadow-sm"
                      : "bg-brand-50 text-brand-700 hover:bg-brand-100"
                  }`}
                  style={isSelected ? { backgroundColor: "var(--shop-primary, #b43b67)" } : undefined}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Sections / Groups Pills */}
        {sections.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-1">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-brand-500">
              Section:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSection("all")}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                selectedSection === "all"
                  ? "text-white shadow-sm"
                  : "bg-amber-50 text-amber-900 hover:bg-amber-100"
              }`}
              style={selectedSection === "all" ? { backgroundColor: "var(--shop-accent, #d97706)" } : undefined}
            >
              All Sections
            </button>
            {sections.map((s) => {
              const isSelected = selectedSection === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSection(isSelected ? "all" : s.id)}
                  className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                    isSelected
                      ? "text-white shadow-sm"
                      : "bg-amber-50 text-amber-900 hover:bg-amber-100"
                  }`}
                  style={isSelected ? { backgroundColor: "var(--shop-accent, #d97706)" } : undefined}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Size Filter Pills (e.g. 500g, 1kg, Small, Large) */}
        {allSizes.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-brand-50/70 pt-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-brand-500">
              Size / Weight:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSize("all")}
              className={`rounded-lg px-2.5 py-0.5 text-xs font-medium transition ${
                selectedSize === "all"
                  ? "text-white shadow-xs"
                  : "bg-white border border-brand-200 text-brand-700 hover:bg-brand-50"
              }`}
              style={selectedSize === "all" ? { backgroundColor: "var(--shop-primary, #b43b67)" } : undefined}
            >
              All
            </button>
            {allSizes.map((sz) => {
              const isSelected = selectedSize === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(isSelected ? "all" : sz)}
                  className={`rounded-lg px-2.5 py-0.5 text-xs font-medium transition ${
                    isSelected
                      ? "text-white shadow-xs"
                      : "bg-white border border-brand-200 text-brand-700 hover:bg-brand-50"
                  }`}
                  style={isSelected ? { backgroundColor: "var(--shop-primary, #b43b67)" } : undefined}
                >
                  {sz}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium text-brand-600">
          Showing <span className="font-bold text-brand-950">{filteredProducts.length}</span>{" "}
          {filteredProducts.length === 1 ? "item" : "items"}
          {searchQuery && ` for "${searchQuery}"`}
        </p>

        {(selectedCategory !== "all" ||
          selectedSection !== "all" ||
          selectedSize !== "all" ||
          searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setSelectedSection("all");
              setSelectedSize("all");
              setSearchQuery("");
            }}
            className="text-xs font-medium text-brand-600 hover:text-brand-900 hover:underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const coverImage = product.product_images?.[0];
            const imageUrl = getPublicAssetUrl(coverImage?.storage_path);
            const photoCount = product.product_images?.length ?? 0;

            return (
              <div
                key={product.id}
                className="group flex flex-col justify-between overflow-hidden rounded-3xl border shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md"
                style={{
                  backgroundColor: "var(--theme-card-bg)",
                  borderColor: "var(--theme-card-border)",
                }}
              >
                <div>
                  {/* Photo Container */}
                  <Link
                    href={`/${shopSlug}/products/${product.slug}`}
                    className="relative block h-56 w-full overflow-hidden"
                    style={{ backgroundColor: "var(--theme-bg)" }}
                  >
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-3xl opacity-30">
                        🛍️
                      </div>
                    )}

                    {/* Badge Pills */}
                    <div className="absolute left-3 top-3 flex flex-col gap-1">
                      {photoCount > 1 && (
                        <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          📷 {photoCount} photos
                        </span>
                      )}
                      {product.section_name && (
                        <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          {product.section_name}
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Body Info */}
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                        {product.category_name || "Special Item"}
                      </span>
                    </div>

                    <Link
                      href={`/${shopSlug}/products/${product.slug}`}
                      className="mt-1 block font-bold transition hover:opacity-80"
                      style={{ color: "var(--theme-text-primary)" }}
                    >
                      {product.name}
                    </Link>


                    {/* Sizes and Colors preview */}
                    {(() => {
                      const vList = Array.isArray(product.variants) ? product.variants : [];
                      const szList: string[] = Array.isArray(product.sizes) && product.sizes.length > 0
                        ? product.sizes
                        : Array.from(new Set(vList.map((v: any) => v.size).filter(Boolean)));
                      const colList: string[] = Array.isArray(product.colors) && product.colors.length > 0
                        ? product.colors
                        : Array.from(new Set(vList.map((v: any) => v.color).filter(Boolean)));

                      return (
                        <div className="mt-2 space-y-1.5">
                          {szList.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[10px] font-semibold text-brand-500 uppercase tracking-wider">Sizes:</span>
                              {szList.map((sz) => (
                                <span
                                  key={sz}
                                  className="rounded-md bg-brand-50 border border-brand-100/80 px-1.5 py-0.5 text-[10px] font-medium text-brand-700"
                                >
                                  {sz}
                                </span>
                              ))}
                            </div>
                          )}

                          {colList.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Colors:</span>
                              {colList.map((c) => (
                                <span
                                  key={c}
                                  className="rounded-md bg-amber-50/80 border border-amber-200/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {product.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-brand-600">
                        {product.description.replace(/<!--sweetly_variants:[\s\S]*?-->/g, "").trim()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer / Price & Add to Bag */}
                <div className="flex items-center justify-between border-t border-brand-50 p-5 pt-3">
                  <div>
                    <span className="text-xs text-brand-500">
                      {(() => {
                        const vList = Array.isArray(product.variants) ? product.variants : [];
                        const prices = vList.map((v: any) => Number(v.price)).filter((n: number) => n > 0);
                        return prices.length > 1 ? "Starting at" : "Price";
                      })()}
                    </span>
                    <p className="text-lg font-extrabold text-brand-950 font-display">
                      {(() => {
                        const vList = Array.isArray(product.variants) ? product.variants : [];
                        const prices = vList.map((v: any) => Number(v.price)).filter((n: number) => n > 0);
                        if (prices.length > 1) {
                          const minP = Math.min(...prices);
                          return `₹${minP.toLocaleString("en-IN")}`;
                        }
                        return `₹${Number(product.price).toLocaleString("en-IN")}`;
                      })()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <AddToCartButton
                      product={{
                        id: product.id,
                        name: product.name,
                        price: Number(product.price),
                        image_url: imageUrl,
                      }}
                    />
                    <Link
                      href={`/${shopSlug}/products/${product.slug}`}
                      className="rounded-xl border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                    >
                      {((product.variants && product.variants.length > 0) || (product.sizes && product.sizes.length > 0)) ? "Options" : "View"}
                    </Link>
                  </div>
                </div>
              </div>

            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-brand-200 bg-white/60 p-12 text-center">
          <p className="text-3xl">🔍</p>
          <h3 className="mt-3 text-lg font-bold text-brand-950">No products match your search</h3>
          <p className="mt-1 text-xs text-brand-600">
            Try adjusting your search terms, changing the size filter, or browsing another category.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("all");
              setSelectedSection("all");
              setSelectedSize("all");
              setSearchQuery("");
            }}
            className="mt-4 inline-flex items-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}

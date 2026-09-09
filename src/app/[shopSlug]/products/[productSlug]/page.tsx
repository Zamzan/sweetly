import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicShopBySlug } from "@/lib/public-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProductDetailView } from "./_components/product-detail-view";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; productSlug: string }>;
}) {
  const { shopSlug, productSlug } = await params;
  const shop = await getPublicShopBySlug(shopSlug);
  const supabase = await createServerSupabaseClient();

  let product: any = null;

  // 1. First try query with extended columns (if schema migrations were applied)
  const fullRes = await supabase
    .from("products")
    .select(`
      id,
      slug,
      name,
      description,
      price,
      available,
      has_variants,
      variants,
      sizes,
      colors,
      product_images (
        id,
        storage_path
      )
    `)
    .eq("shop_id", shop.id)
    .eq("slug", productSlug)
    .maybeSingle();

  if (!fullRes.error && fullRes.data) {
    product = fullRes.data;
  } else {
    // 2. Core fallback query containing only core guaranteed columns
    const coreRes = await supabase
      .from("products")
      .select(`
        id,
        slug,
        name,
        description,
        price,
        available,
        product_images (
          id,
          storage_path
        )
      `)
      .eq("shop_id", shop.id)
      .eq("slug", productSlug)
      .maybeSingle();

    if (!coreRes.error && coreRes.data) {
      product = coreRes.data;
    } else {
      // 3. Fallback matching by ID in case productSlug is an ID
      const idRes = await supabase
        .from("products")
        .select(`
          id,
          slug,
          name,
          description,
          price,
          available,
          product_images (
            id,
            storage_path
          )
        `)
        .eq("shop_id", shop.id)
        .eq("id", productSlug)
        .maybeSingle();

      if (!idRes.error && idRes.data) {
        product = idRes.data;
      }
    }
  }

  if (!product) notFound();

  const rawProduct = product as any;
  let variants = Array.isArray(rawProduct.variants) ? rawProduct.variants : [];
  let cleanDescription = rawProduct.description || "";

  // Extract embedded variants from description if stored via resilient encoding
  const variantMarker = "<!--sweetly_variants:";
  if (cleanDescription.includes(variantMarker)) {
    try {
      const markerStart = cleanDescription.indexOf(variantMarker);
      const markerEnd = cleanDescription.indexOf("-->", markerStart);
      if (markerEnd !== -1) {
        const jsonStr = cleanDescription.slice(markerStart + variantMarker.length, markerEnd);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          variants = parsed;
        }
        cleanDescription = cleanDescription.slice(0, markerStart).trim();
      }
    } catch (e) {
      console.warn("Failed parsing embedded variants:", e);
    }
  }

  const derivedSizes = Array.isArray(rawProduct.sizes) && rawProduct.sizes.length > 0
    ? rawProduct.sizes
    : Array.from(new Set(variants.map((v: any) => v.size).filter(Boolean)));
  const derivedColors = Array.isArray(rawProduct.colors) && rawProduct.colors.length > 0
    ? rawProduct.colors
    : Array.from(new Set(variants.map((v: any) => v.color).filter(Boolean)));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={`/${shop.slug}/products`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
      >
        ← Back to {shop.name} products
      </Link>

      <div className="mt-6">
        <ProductDetailView
          shop={{
            id: shop.id,
            name: shop.name,
            slug: shop.slug,
            whatsapp_number: shop.whatsapp_number,
          }}
          product={{
            id: product.id,
            slug: product.slug,
            name: product.name,
            description: cleanDescription,
            price: Number(product.price),
            has_variants: Boolean(
              product.has_variants ||
              variants.length > 0 ||
              derivedSizes.length > 0 ||
              derivedColors.length > 0
            ),
            variants,
            sizes: derivedSizes,
            colors: derivedColors,
            product_images: product.product_images ?? [],
          }}
        />
      </div>

    </main>
  );
}

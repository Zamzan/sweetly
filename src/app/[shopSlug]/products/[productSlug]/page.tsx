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
  const prodRes = await supabase
    .from("products")
    .select(`
      id,
      slug,
      name,
      description,
      price,
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
    .eq("available", true)
    .maybeSingle();

  if (prodRes.error && (prodRes.error.message?.includes("column") || prodRes.error.message?.includes("schema cache"))) {
    const fallbackRes = await supabase
      .from("products")
      .select(`
        id,
        slug,
        name,
        description,
        price,
        variants,
        product_images (
          id,
          storage_path
        )
      `)
      .eq("shop_id", shop.id)
      .eq("slug", productSlug)
      .eq("available", true)
      .maybeSingle();
    product = fallbackRes.data;
  } else {
    product = prodRes.data;
  }

  if (!product) notFound();


  const rawProduct = product as any;
  const variants = Array.isArray(rawProduct.variants) ? rawProduct.variants : [];
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
            description: product.description,
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

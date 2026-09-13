import Link from "next/link";
import { getPublicShopBySlug } from "@/lib/public-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StorefrontCatalog, CatalogProduct } from "./_components/storefront-catalog";
import { StorePaused } from "../_components/store-paused";
import { StoreOffline } from "../_components/store-offline";
import { parseProductVariants } from "@/lib/product-variants";

export default async function ShopProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>;
  searchParams?: Promise<{ category?: string }>;
}) {
  const { shopSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const shop = await getPublicShopBySlug(shopSlug);

  if (!shop.is_published) {
    return <StoreOffline shopName={shop.name} whatsappNumber={shop.whatsapp_number} />;
  }

  if (shop.isSubscriptionExpired) {
    return <StorePaused shopName={shop.name} />;
  }

  const supabase = await createServerSupabaseClient();
  const selectedCategory = resolvedSearchParams?.category;

  const theme = (shop.theme && typeof shop.theme === "object" ? shop.theme : {}) as Record<
    string,
    any
  >;
  const primaryColor = theme.primary_color || "#b43b67";
  const customOrderEnabled = theme.custom_order_enabled !== false;
  const customOrderButtonText = theme.custom_order_button_text || "Custom Orders";

  let rawProducts: any[] | null = null;
  const prodRes = await supabase
    .from("products")
    .select(`
      id,
      name,
      slug,
      price,
      description,
      category_id,
      section_id,
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
    .eq("available", true)
    .order("created_at", { ascending: false })
    .limit(100);


  if (prodRes.error && (prodRes.error.message?.includes("column") || prodRes.error.message?.includes("schema cache"))) {
    const fallbackRes = await supabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        price,
        description,
        category_id,
        product_images (
          id,
          storage_path
        )
      `)
      .eq("shop_id", shop.id)
      .eq("available", true)
      .order("created_at", { ascending: false })
      .limit(100);
    rawProducts = fallbackRes.data || [];
  } else {
    rawProducts = prodRes.data || [];
  }

  const [
    { data: categories },
    sectionsRes,
  ] = await Promise.all([
    supabase
      .from("product_categories")
      .select("id, name, slug")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_sections")
      .select("id, name, slug")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true }),
  ]);

  const sections = sectionsRes?.data || [];

  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const sectionMap = new Map((sections ?? []).map((s) => [s.id, s.name]));

  const products: CatalogProduct[] = (rawProducts ?? []).map((p: any) => {
    const parsed = parseProductVariants(p.description, p.variants, p.sizes, p.colors);
    const productCategories = Array.isArray(p.categories) ? p.categories : [];

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      description: parsed.cleanDescription,
      category_id: p.category_id,
      category_name: p.category_id ? categoryMap.get(p.category_id) ?? null : null,
      section_id: p.section_id,
      section_name: p.section_id ? sectionMap.get(p.section_id) ?? null : null,
      has_variants: parsed.variants.length > 0 || Boolean(p.has_variants),
      variants: parsed.variants,
      sizes: parsed.sizes,
      colors: parsed.colors,
      categories: productCategories,
      category_ids: p.category_ids ?? [],
      section_ids: p.section_ids ?? [],
      product_images: p.product_images ?? [],
    };
  });

  return (
    <main className="min-h-screen pb-16 transition-colors" style={{ backgroundColor: "var(--theme-bg)", color: "var(--theme-text-primary)" }}>
      {/* Header Bar */}
      <div
        className="border-b py-6 transition-colors"
        style={{
          backgroundColor: "var(--theme-card-bg)",
          borderColor: "var(--theme-card-border)",
        }}
      >
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href={`/${shop.slug}`}
                className="text-xs font-semibold hover:opacity-80 transition"
                style={{ color: primaryColor }}
              >
                ← Back to {shop.name}
              </Link>
              <h1 className="mt-1 text-3xl font-bold tracking-tight" style={{ color: "var(--theme-text-primary)" }}>
                Products &amp; Treats
              </h1>
              <p className="mt-0.5 text-xs" style={{ color: "var(--theme-text-secondary)" }}>
                Browse our fresh collection, select your preferred sizes/colors, and order directly
              </p>
            </div>

            {customOrderEnabled && (
              <Link
                href={`/${shop.slug}/custom-order`}
                className="inline-flex items-center gap-1.5 self-start rounded-xl border px-4 py-2 text-xs font-semibold transition hover:opacity-90"
                style={{
                  backgroundColor: "var(--theme-bg)",
                  borderColor: "var(--theme-card-border)",
                  color: "var(--theme-text-primary)",
                }}
              >
                ✨ {customOrderButtonText}
              </Link>
            )}
          </div>
        </div>
      </div>


      {/* Interactive Catalog with Search, Filters & Grid */}
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <StorefrontCatalog
          shopSlug={shop.slug}
          shopName={shop.name}
          products={products}
          categories={categories ?? []}
          sections={sections ?? []}
          initialCategory={selectedCategory}
        />
      </div>
    </main>
  );
}

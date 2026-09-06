import { getPublicShopBySlug } from "@/lib/public-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CustomOrderForm } from "./_components/custom-order-form";
import { StorePaused } from "../_components/store-paused";

export default async function CustomOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<{ product?: string; category?: string }>;
}) {
  const { shopSlug } = await params;
  const { product, category } = await searchParams;
  const shop = await getPublicShopBySlug(shopSlug);

  if (shop.isSubscriptionExpired) {
    return <StorePaused shopName={shop.name} />;
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: categories }, { data: referenceProducts }] = await Promise.all([
    supabase
      .from("product_categories")
      .select("id, name")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("id, name, price, category_id, product_images(storage_path)")
      .eq("shop_id", shop.id)
      .eq("available", true)
      .limit(16),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-brand-950 font-display">
        Create Your Custom Order
      </h1>
      <p className="mt-2 text-sm text-brand-600">
        Tell {shop.name} what custom cake, sweet box, fancy bag, or gift hamper you need. We&apos;ll prepare your details and connect you directly on WhatsApp.
      </p>

      <CustomOrderForm
        shopSlug={shop.slug}
        categories={categories ?? []}
        referenceProducts={referenceProducts ?? []}
        defaultProductType={product ?? ""}
        defaultCategory={category ?? ""}
      />
    </main>
  );
}

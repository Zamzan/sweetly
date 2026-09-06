import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProductForm } from "./_components/product-form";
import { ProductRow, ProductItem } from "./_components/product-row";
import { CategoriesList } from "./_components/categories-list";

export default async function ProductsPage() {
  const { shop } = await getCurrentShopOrRedirect();
  const supabase = await createServerSupabaseClient();

  let rawProducts: any[] | null = null;
  const prodRes = await supabase
    .from("products")
    .select(`
      id,
      name,
      price,
      description,
      available,
      featured,
      category_id,
      section_id,
      variants,
      product_images (
        id,
        storage_path
      )
    `)
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  if (prodRes.error && (prodRes.error.message?.includes("column") || prodRes.error.message?.includes("schema cache"))) {
    // Fallback to core base schema
    const fallbackRes = await supabase
      .from("products")
      .select(`
        id,
        name,
        price,
        description,
        available,
        featured,
        category_id,
        product_images (
          id,
          storage_path
        )
      `)
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false });
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
      .select("id, name, slug, description")
      .eq("shop_id", shop.id)
      .order("sort_order", { ascending: true }),
  ]);

  const sections = sectionsRes?.data || [];

  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const sectionMap = new Map((sections ?? []).map((s) => [s.id, s.name]));

  const products: ProductItem[] = (rawProducts ?? []).map((p: any) => {
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const sizes = Array.isArray(p.sizes) && p.sizes.length > 0
      ? p.sizes
      : Array.from(new Set(variants.map((v: any) => v.size).filter(Boolean)));
    const colors = Array.isArray(p.colors) && p.colors.length > 0
      ? p.colors
      : Array.from(new Set(variants.map((v: any) => v.color).filter(Boolean)));
    const productCategories = Array.isArray(p.categories) ? p.categories : [];

    return {
      id: p.id,
      name: p.name,
      price: Number(p.price),
      description: p.description,
      available: p.available,
      featured: p.featured,
      category_id: p.category_id,
      category_name: p.category_id ? categoryMap.get(p.category_id) ?? null : null,
      section_id: p.section_id,
      section_name: p.section_id ? sectionMap.get(p.section_id) ?? null : null,
      has_variants: p.has_variants,
      variants,
      sizes,
      colors,
      categories: productCategories,
      category_ids: p.category_ids ?? [],
      section_ids: p.section_ids ?? [],
      product_images: p.product_images ?? [],
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900">Products & Catalog</h1>
        <p className="mt-1 text-sm text-brand-600">
          Manage your sweets, cakes, fancy bags, gift boxes, variants, and storefront sections.
        </p>
      </div>

      {/* Category Management Bar */}
      <CategoriesList categories={categories ?? []} />

      {/* Add Product Section */}
      <ProductForm
        categories={categories ?? []}
        sections={sections ?? []}
      />

      {/* Products Table */}
      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="border-b border-brand-100 bg-brand-50/40 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-brand-900">
              Your Products ({products.length})
            </h2>
            <span className="text-xs text-brand-500">
              {products.filter((p) => p.available).length} available online
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/20 text-xs font-semibold uppercase tracking-wider text-brand-600">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100/50">
              {products.map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-brand-400">
                    <div className="mx-auto max-w-sm">
                      <p className="text-3xl">🛍️</p>
                      <p className="mt-2 font-medium text-brand-800">No products yet</p>
                      <p className="mt-1 text-xs text-brand-500">
                        Add your cakes, sweets, fancy bags, or gift items using the form above to start selling.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

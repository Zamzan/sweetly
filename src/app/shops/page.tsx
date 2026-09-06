import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const revalidate = 60;

export default async function ShopsDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { q: qParam } = await searchParams;
  const q = (qParam ?? "").trim();

  // Public read: RLS policy "shops: public can read published" scopes
  // this to is_published = true automatically — no owner/private
  // fields are exposed by this select list either way.
  let query = supabase
    .from("shops")
    .select("slug, name, city, state, logo_url, cover_image_url")
    .eq("is_published", true)
    .limit(24);

  if (q) query = query.ilike("name", `%${q}%`);

  const { data: shops } = await query;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-6 text-3xl">Find Your Favourite Sweet Shop</h1>

      <form className="mb-8">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by shop name…"
          className="w-full rounded-lg border border-brand-100 px-4 py-3 md:w-96"
        />
      </form>

      <div className="grid gap-6 md:grid-cols-3">
        {(shops ?? []).map((shop) => (
          <Link
            key={shop.slug}
            href={`/${shop.slug}`}
            className="block rounded-xl border border-brand-100 bg-white p-4 hover:shadow-md"
          >
            <div className="mb-3 h-32 w-full rounded-lg bg-brand-50" />
            <p className="font-medium">{shop.name}</p>
            <p className="text-sm text-brand-600">{[shop.city, shop.state].filter(Boolean).join(", ")}</p>
          </Link>
        ))}
        {(!shops || shops.length === 0) && (
          <p className="col-span-3 py-12 text-center text-brand-400">No shops found.</p>
        )}
      </div>
    </main>
  );
}

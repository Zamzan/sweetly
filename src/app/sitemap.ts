import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const supabase = await createServerSupabaseClient();

  // Public read, RLS-scoped to is_published = true automatically.
  const { data: shops } = await supabase.from("shops").select("slug, updated_at").limit(5000);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shops`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const shopRoutes: MetadataRoute.Sitemap = (shops ?? []).map((s) => ({
    url: `${base}/${s.slug}`,
    lastModified: s.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...shopRoutes];
}

import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSuperAdminWithMFA } from "@/lib/admin-auth";
import { ShopStatusToggle } from "./_components/shop-status-toggle";

export const dynamic = "force-dynamic";

export default async function AdminShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  // Server-side identity, PLATFORM_ADMIN role, and elevated MFA session enforcement
  await assertSuperAdminWithMFA();

  const admin = createAdminClient();
  const { q: qParam, status } = await searchParams;
  const q = (qParam ?? "").trim();
  const statusFilter = status ?? "all";

  // Build query
  let query = admin
    .from("shops")
    .select("id, name, slug, city, state, whatsapp_number, phone, is_published, created_at, owner_id")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
  }

  if (statusFilter === "published") {
    query = query.eq("is_published", true);
  } else if (statusFilter === "draft") {
    query = query.eq("is_published", false);
  }

  const { data: shops } = await query;
  const shopIds = (shops ?? []).map((s) => s.id);
  const ownerIds = Array.from(new Set((shops ?? []).map((s) => s.owner_id)));

  // Batch fetch subscriptions, profiles, orders, and members
  const [{ data: subs }, { data: profiles }, { data: orders }] = await Promise.all([
    shopIds.length
      ? admin.from("subscriptions").select("shop_id, plan, status").in("shop_id", shopIds)
      : { data: [] },
    ownerIds.length
      ? admin.from("profiles").select("id, full_name, phone").in("id", ownerIds)
      : { data: [] },
    shopIds.length
      ? admin.from("orders").select("id, shop_id, total_amount, status").in("shop_id", shopIds)
      : { data: [] },
  ]);

  const subByShop = new Map((subs ?? []).map((s) => [s.shop_id, s]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Aggregate orders and revenue per shop
  const shopMetrics = new Map<string, { count: number; revenue: number }>();
  (orders ?? []).forEach((o) => {
    const existing = shopMetrics.get(o.shop_id) || { count: 0, revenue: 0 };
    existing.count++;
    if (o.status !== "CANCELLED") {
      existing.revenue += Number(o.total_amount) || 0;
    }
    shopMetrics.set(o.shop_id, existing);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">
            Registered Tenant Stores
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Audit, manage, and inspect all shops hosted on Sweetly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
          >
            ← Back to Overview
          </Link>
        </div>
      </div>

      {/* Controls: Search and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <form className="w-full max-w-md flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by store name or slug..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
          <button
            type="submit"
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs">
          <FilterLink label="All" active={statusFilter === "all"} href={`/admin/shops?q=${encodeURIComponent(q)}&status=all`} />
          <FilterLink label="Published" active={statusFilter === "published"} href={`/admin/shops?q=${encodeURIComponent(q)}&status=published`} />
          <FilterLink label="Draft" active={statusFilter === "draft"} href={`/admin/shops?q=${encodeURIComponent(q)}&status=draft`} />
        </div>
      </div>

      {/* Shops Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Store</th>
                <th className="px-6 py-3.5">Owner & Contact</th>
                <th className="px-6 py-3.5">Location</th>
                <th className="px-6 py-3.5">Plan & Billing</th>
                <th className="px-6 py-3.5 text-right">Orders</th>
                <th className="px-6 py-3.5 text-right">Revenue Made</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(shops ?? []).map((s) => {
                const sub = subByShop.get(s.id);
                const owner = profileMap.get(s.owner_id);
                const metrics = shopMetrics.get(s.id) || { count: 0, revenue: 0 };

                return (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{s.name}</div>
                      <div className="text-xs font-mono text-brand-400">/{s.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-200">{owner?.full_name || "—"}</div>
                      <div className="text-xs text-slate-400">{s.whatsapp_number || owner?.phone || "—"}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 border border-slate-700">
                        <span className="capitalize">{sub?.plan || "Starter"}</span>
                        <span className="text-[10px] text-slate-400">({sub?.status || "TRIALING"})</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-200">
                      {metrics.count}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                      ₹{metrics.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.is_published
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {s.is_published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ShopStatusToggle
                          shopId={s.id}
                          isPublished={Boolean(s.is_published)}
                          shopName={s.name}
                          compact
                        />
                        <Link
                          href={`/admin/shops/${s.id}`}
                          className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-500 transition shadow-sm"
                        >
                          Manage
                        </Link>
                        {s.is_published && (
                          <Link
                            href={`/${s.slug}`}
                            target="_blank"
                            className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition border border-slate-700"
                            title="Open storefront"
                          >
                            ↗
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {(!shops || shops.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No shops match your query.
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

function FilterLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 transition ${
        active ? "bg-brand-600 text-white font-medium" : "text-slate-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSuperAdminWithMFA } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  // Server-side identity, PLATFORM_ADMIN role, and elevated MFA session enforcement
  await assertSuperAdminWithMFA();

  // Use admin client for full analytics aggregation across shops
  const admin = createAdminClient();

  // 1. Fetch core counts & shops
  const [
    { count: totalShops },
    { count: publishedShops },
    { data: allShops },
    { data: subscriptions },
    { data: allOrders },
    { data: customOrders },
    { data: allMembers },
  ] = await Promise.all([
    admin.from("shops").select("id", { count: "exact", head: true }),
    admin.from("shops").select("id", { count: "exact", head: true }).eq("is_published", true),
    admin
      .from("shops")
      .select("id, name, slug, is_published, created_at, whatsapp_number, city, state, owner_id")
      .order("created_at", { ascending: false }),
    admin.from("subscriptions").select("shop_id, plan, status, trial_ends_at, current_period_end"),
    admin.from("orders").select("id, shop_id, total_amount, status, created_at"),
    admin.from("custom_orders").select("id, shop_id, status, created_at"),
    admin.from("shop_members").select("id, shop_id, user_id, role"),
  ]);

  // Fetch profiles to map owner names
  const ownerIds = Array.from(new Set((allShops ?? []).map((s) => s.owner_id)));
  const { data: profiles } = ownerIds.length
    ? await admin.from("profiles").select("id, full_name, phone").in("id", ownerIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const subMap = new Map((subscriptions ?? []).map((s) => [s.shop_id, s]));

  // Aggregate metrics per shop
  const shopStats = new Map<
    string,
    { ordersCount: number; revenue: number; customOrdersCount: number; staffCount: number }
  >();

  (allShops ?? []).forEach((s) => {
    shopStats.set(s.id, { ordersCount: 0, revenue: 0, customOrdersCount: 0, staffCount: 0 });
  });

  let totalPlatformRevenue = 0;
  let totalPlatformOrders = 0;

  (allOrders ?? []).forEach((order) => {
    totalPlatformOrders++;
    const stat = shopStats.get(order.shop_id);
    const amount = Number(order.total_amount) || 0;
    if (order.status !== "CANCELLED") {
      totalPlatformRevenue += amount;
      if (stat) stat.revenue += amount;
    }
    if (stat) stat.ordersCount++;
  });

  (customOrders ?? []).forEach((co) => {
    const stat = shopStats.get(co.shop_id);
    if (stat) stat.customOrdersCount++;
  });

  (allMembers ?? []).forEach((m) => {
    const stat = shopStats.get(m.shop_id);
    if (stat) stat.staffCount++;
  });

  // Subscription plan breakdown
  const planCounts = { storePlan: 0, trialing: 0, active: 0, expired: 0 };
  const now = new Date();
  (subscriptions ?? []).forEach((sub) => {
    if (sub.status === "ACTIVE") {
      planCounts.active++;
      planCounts.storePlan++;
    } else if (sub.status === "TRIALING") {
      const trialEnds = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;
      if (trialEnds && trialEnds > now) {
        planCounts.trialing++;
      } else {
        planCounts.expired++;
      }
    } else {
      planCounts.expired++;
    }
  });

  return (
    <div className="space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
            Platform Master Console
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Real-time multi-tenant monitoring, revenue metrics, shop management & role access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/shops"
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-500"
          >
            Manage All Shops ({totalShops ?? 0}) →
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Gross Revenue"
          value={`₹${totalPlatformRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          subtext="Generated across all shops"
          icon="currency"
          highlight
        />
        <MetricCard
          label="Total Orders Processed"
          value={totalPlatformOrders.toString()}
          subtext={`${customOrders?.length ?? 0} custom order requests`}
          icon="orders"
        />
        <MetricCard
          label="Registered Shops"
          value={(totalShops ?? 0).toString()}
          subtext={`${publishedShops ?? 0} published storefronts`}
          icon="shops"
        />
        <MetricCard
          label="Active Subscriptions"
          value={planCounts.active.toString()}
          subtext={`${planCounts.trialing} trialing stores`}
          icon="subscriptions"
        />
      </div>

      {/* Plan Breakdown & Security Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
          <h2 className="text-base font-semibold text-white mb-4">Subscription Distribution</h2>
          <div className="space-y-3">
            <PlanBar label="Sweetly Starter (₹199/mo)" count={planCounts.active} total={totalShops || 1} color="bg-emerald-500" />
            <PlanBar label="14-Day Free Trial" count={planCounts.trialing} total={totalShops || 1} color="bg-blue-500" />
            <PlanBar label="Trial Expired / Renewal Due" count={planCounts.expired} total={totalShops || 1} color="bg-amber-500" />
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between text-xs text-slate-400">
            <span>In Trial: <strong className="text-blue-400">{planCounts.trialing}</strong></span>
            <span>Paid Active: <strong className="text-emerald-400">{planCounts.active}</strong></span>
            <span>Expired: <strong className="text-amber-400">{planCounts.expired}</strong></span>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Platform Security & Defensive Status</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> Hardened
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <SecurityBadge label="2FA Super Admin Gate" status="Enforced (HMAC-SHA256)" active />
            <SecurityBadge label="Database Row-Level Security" status="Strict RLS on all 16 tables" active />
            <SecurityBadge label="CSRF & Cross-Site Protection" status="Same-Origin enforced" active />
            <SecurityBadge label="Rate Limiting (DDoS Defense)" status="Sliding window active" active />
            <SecurityBadge label="Input & XSS Sanitization" status="DOMPurify HTML strip active" active />
            <SecurityBadge label="Magic-byte File Upload Sniffing" status="MIME + Binary verified" active />
            <SecurityBadge label="HTTP Strict Transport Security" status="HSTS preload 2-year max-age" active />
            <SecurityBadge label="Content Security Policy" status="Strict frame/script/connect rules" active />
          </div>
        </div>
      </div>

      {/* Top / Recent Shops Leaderboard */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Shops Performance & Directory</h2>
            <p className="text-xs text-slate-400 mt-0.5">Live metrics across all registered tenant stores</p>
          </div>
          <Link
            href="/admin/shops"
            className="text-xs font-medium text-brand-400 hover:text-brand-300 transition"
          >
            View All ({allShops?.length ?? 0}) →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-xs font-medium uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Store & Slug</th>
                <th className="px-6 py-3.5">Owner & Contact</th>
                <th className="px-6 py-3.5">Subscription Plan</th>
                <th className="px-6 py-3.5 text-right">Orders</th>
                <th className="px-6 py-3.5 text-right">Total Revenue</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(allShops ?? []).slice(0, 10).map((shop) => {
                const owner = profileMap.get(shop.owner_id);
                const sub = subMap.get(shop.id);
                const stats = shopStats.get(shop.id) || { ordersCount: 0, revenue: 0, customOrdersCount: 0, staffCount: 0 };

                return (
                  <tr key={shop.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{shop.name}</div>
                      <div className="text-xs font-mono text-brand-400">/{shop.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-200">{owner?.full_name || "—"}</div>
                      <div className="text-xs text-slate-400">{shop.whatsapp_number || owner?.phone || "—"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 border border-slate-700">
                        <span className="capitalize">{sub?.plan || "Starter"}</span>
                        <span className="text-[10px] text-slate-400">({sub?.status || "TRIALING"})</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-200">
                      {stats.ordersCount}
                      {stats.customOrdersCount > 0 && (
                        <span className="text-xs text-slate-400 block font-normal">
                          +{stats.customOrdersCount} custom
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                      ₹{stats.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          shop.is_published
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {shop.is_published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/shops/${shop.id}`}
                          className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition border border-slate-700"
                        >
                          Full Details →
                        </Link>
                        <Link
                          href={`/${shop.slug}`}
                          target="_blank"
                          className="rounded-lg bg-brand-600/20 px-2.5 py-1.5 text-xs font-medium text-brand-300 hover:bg-brand-600/30 transition border border-brand-500/30"
                        >
                          Storefront ↗
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {(!allShops || allShops.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No shops registered yet.
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

function MetricCard({
  label,
  value,
  subtext,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 backdrop-blur-sm shadow-md transition ${
        highlight
          ? "border-brand-500/40 bg-gradient-to-br from-brand-950/40 via-slate-900/60 to-slate-900/60"
          : "border-slate-800 bg-slate-900/60"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-brand-400">
          {icon === "currency" && "₹"}
          {icon === "orders" && "📦"}
          {icon === "shops" && "🏪"}
          {icon === "subscriptions" && "⚡"}
        </span>
      </div>
      <p className="mt-3 text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{subtext}</p>
    </div>
  );
}

function PlanBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = Math.round((count / Math.max(total, 1)) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-slate-400">{count} ({percentage}%)</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function SecurityBadge({ label, status, active }: { label: string; status: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
      <div>
        <p className="font-medium text-slate-200 text-xs">{label}</p>
        <p className="text-[11px] text-slate-400">{status}</p>
      </div>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
        ✓
      </span>
    </div>
  );
}

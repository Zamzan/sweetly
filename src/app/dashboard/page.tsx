import Link from "next/link";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardHome() {
  const { shop } = await getCurrentShopOrRedirect();
  const supabase = await createServerSupabaseClient();

  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: completedOrders },
    { data: allCompletedOrders },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .in("status", ["NEW", "CONTACTED", "PAYMENT_PENDING"]),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .eq("status", "COMPLETED"),
    supabase
      .from("orders")
      .select("total_amount")
      .eq("shop_id", shop.id)
      .eq("status", "COMPLETED"),
    supabase
      .from("orders")
      .select("id, customer_name, total_amount, status, created_at")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Calculate Total Revenue / Money Made from completed orders
  const totalRevenue = (allCompletedOrders ?? []).reduce(
    (acc, cur) => acc + (Number(cur.total_amount) || 0),
    0
  );

  const completedCount = completedOrders ?? 0;
  const avgOrderValue = completedCount > 0 ? Math.round(totalRevenue / completedCount) : 0;

  return (
    <div className="space-y-8">
      {/* Top Welcome & Store Quick Link */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-900">
            Welcome back, {shop.name}
          </h1>
          <p className="mt-1 text-sm text-brand-600">
            Here is what&apos;s happening with your online orders and revenue today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/${shop.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-4 py-2 text-xs font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50"
          >
            Visit Live Store ↗
          </Link>
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            + Add Product
          </Link>
        </div>
      </div>

      {/* Revenue & Key Performance Indicators */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Money Made / Revenue Badge */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Total Money Made
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              ● Live Earnings
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-emerald-950 font-display">
            ₹{totalRevenue.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            From {completedCount} fulfilled &amp; paid orders
          </p>
        </div>

        {/* Total Orders */}
        <StatCard
          label="Total Orders Received"
          value={totalOrders ?? 0}
          helper="All-time customer requests"
        />

        {/* Pending Orders */}
        <StatCard
          label="Pending Processing"
          value={pendingOrders ?? 0}
          helper="Awaiting review or payment"
          highlight={Number(pendingOrders) > 0}
        />

        {/* Average Order Value */}
        <StatCard
          label="Avg Order Value"
          value={`₹${avgOrderValue.toLocaleString("en-IN")}`}
          helper="Average cart size"
        />
      </div>

      {/* Recent Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-brand-100 bg-brand-50/40 px-6 py-4">
          <h2 className="font-semibold text-brand-900">Recent Orders</h2>
          <Link
            href="/dashboard/orders"
            className="text-xs font-medium text-brand-600 hover:text-brand-800 hover:underline"
          >
            View all orders →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/20 text-xs font-semibold uppercase tracking-wider text-brand-600">
              <tr>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100/50">
              {(recentOrders ?? []).map((o) => (
                <tr key={o.id} className="transition hover:bg-brand-50/30">
                  <td className="px-6 py-3 font-medium text-brand-900">{o.customer_name}</td>
                  <td className="px-6 py-3 font-semibold text-brand-950">
                    {o.total_amount ? `₹${Number(o.total_amount).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                        o.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : o.status === "NEW"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-brand-100 text-brand-800"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-brand-500">
                    {new Date(o.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                </tr>
              ))}
              {(!recentOrders || recentOrders.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-brand-400">
                    No orders placed yet. Share your store link with customers to start receiving orders!
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

function StatCard({
  label,
  value,
  helper,
  highlight,
}: {
  label: string;
  value: string | number;
  helper?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm ${
        highlight
          ? "border-amber-200 bg-amber-50/50"
          : "border-brand-100 bg-white"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-brand-600">{label}</p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-brand-950 font-display">
        {value}
      </p>
      {helper && <p className="mt-1 text-xs text-brand-500">{helper}</p>}
    </div>
  );
}

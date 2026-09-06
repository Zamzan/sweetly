import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSuperAdminWithMFA } from "@/lib/admin-auth";
import { ShopStatusToggle } from "../_components/shop-status-toggle";

export const dynamic = "force-dynamic";

export default async function AdminShopDetailPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  // Server-side identity, PLATFORM_ADMIN role, and elevated MFA session enforcement
  await assertSuperAdminWithMFA();

  const admin = createAdminClient();
  const { shopId } = await params;

  // 1. Fetch shop record
  const { data: shop } = await admin
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .single();

  if (!shop) {
    notFound();
  }

  // 2. Fetch owner profile, staff members, subscription, orders, custom orders, and products
  const [
    { data: ownerProfile },
    { data: members },
    { data: subscription },
    { data: orders },
    { data: customOrders },
    { data: products },
    { data: categories },
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("id", shop.owner_id).single(),
    admin.from("shop_members").select("id, role, created_at, user_id").eq("shop_id", shopId),
    admin.from("subscriptions").select("*").eq("shop_id", shopId).single(),
    admin
      .from("orders")
      .select("id, customer_name, customer_phone, total_amount, status, created_at, notes")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    admin
      .from("custom_orders")
      .select("id, customer_name, customer_phone, occasion, product_type, quantity, status, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    admin
      .from("products")
      .select("id, name, price, available, featured, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    admin.from("product_categories").select("id, name").eq("shop_id", shopId),
  ]);

  // Fetch profiles for all staff members
  const memberUserIds = (members ?? []).map((m) => m.user_id);
  const { data: memberProfiles } = memberUserIds.length
    ? await admin.from("profiles").select("id, full_name, phone").in("id", memberUserIds)
    : { data: [] };
  const memberProfileMap = new Map((memberProfiles ?? []).map((p) => [p.id, p]));

  // Aggregate financials
  let totalRevenue = 0;
  let completedOrders = 0;
  let newOrders = 0;

  (orders ?? []).forEach((o) => {
    if (o.status !== "CANCELLED") {
      totalRevenue += Number(o.total_amount) || 0;
    }
    if (o.status === "COMPLETED") completedOrders++;
    if (o.status === "NEW") newOrders++;
  });

  return (
    <div className="space-y-8">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/admin" className="hover:text-white transition">Admin</Link>
            <span>/</span>
            <Link href="/admin/shops" className="hover:text-white transition">Shops</Link>
            <span>/</span>
            <span className="text-brand-400 font-mono">{shop.slug}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            {shop.name}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                shop.is_published
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}
            >
              {shop.is_published ? "Published" : "Draft"}
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ShopStatusToggle
            shopId={shop.id}
            isPublished={Boolean(shop.is_published)}
            shopName={shop.name}
          />
          {shop.is_published && (
            <Link
              href={`/${shop.slug}`}
              target="_blank"
              className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-brand-500 flex items-center gap-1.5"
            >
              Open Live Storefront ↗
            </Link>
          )}
          <Link
            href="/admin/shops"
            className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
          >
            Back to Directory
          </Link>
        </div>
      </div>

      {/* Financial & Order Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-950/40 via-slate-900/60 to-slate-900/60 p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Revenue Made</span>
          <p className="mt-2 text-2xl font-display font-bold text-emerald-400">
            ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-400">Across {orders?.length ?? 0} total orders</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Plan</span>
          <p className="mt-2 text-2xl font-display font-bold text-white capitalize">
            {subscription?.plan || "Starter"}
          </p>
          <p className="mt-1 text-xs text-slate-400">Status: <strong className="text-brand-400">{subscription?.status || "TRIALING"}</strong></p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Catalog Size</span>
          <p className="mt-2 text-2xl font-display font-bold text-white">
            {products?.length ?? 0} <span className="text-sm font-normal text-slate-400">Products</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">{categories?.length ?? 0} categories created</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Custom Requests</span>
          <p className="mt-2 text-2xl font-display font-bold text-white">
            {customOrders?.length ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-400">{newOrders} standard orders pending</p>
        </div>
      </div>

      {/* Two-Column Grid: Owner & Staff, Subscription Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Owner & Staff Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center justify-between">
            <span>Store Ownership & Staff Team</span>
            <span className="text-xs font-normal text-slate-400">{(members?.length ?? 0) + 1} users</span>
          </h2>

          <div className="space-y-4">
            {/* Owner Details */}
            <div className="rounded-xl border border-brand-500/20 bg-brand-950/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                    Primary Owner
                  </span>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {ownerProfile?.full_name || "Unknown Owner"}
                  </p>
                  <p className="text-xs text-slate-400">{ownerProfile?.phone || "No phone listed"}</p>
                </div>
                <span className="rounded-full bg-brand-500/20 border border-brand-500/30 px-2.5 py-0.5 text-xs text-brand-300 font-medium">
                  OWNER
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500 mt-2">ID: {shop.owner_id}</p>
            </div>

            {/* Staff Members List */}
            {members && members.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Staff Members</p>
                {members.map((member) => {
                  const prof = memberProfileMap.get(member.user_id);
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-200">{prof?.full_name || "Staff Member"}</p>
                        <p className="text-slate-400">{prof?.phone || "No phone"}</p>
                      </div>
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300 border border-slate-700">
                        {member.role}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Subscription & Store Settings */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-white mb-4">Subscription & Storefront Info</h2>

          <div className="space-y-3 text-xs">
            <InfoRow label="Subscription Plan" value={subscription?.plan?.toUpperCase() || "STARTER"} />
            <InfoRow label="Subscription Status" value={subscription?.status || "TRIALING"} />
            <InfoRow
              label="Trial Ends At"
              value={subscription?.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : "—"}
            />
            <InfoRow
              label="Current Period End"
              value={subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "—"}
            />
            <InfoRow label="Razorpay Customer ID" value={subscription?.razorpay_customer_id || "None"} isMono />
            <InfoRow label="Razorpay Subscription ID" value={subscription?.razorpay_subscription_id || "None"} isMono />
            <div className="border-t border-slate-800 pt-3" />
            <InfoRow label="WhatsApp Contact" value={shop.whatsapp_number || "None"} />
            <InfoRow label="Voice Call Phone" value={shop.phone || "None"} />
            <InfoRow label="Location" value={[shop.city, shop.state, shop.pincode].filter(Boolean).join(", ") || "—"} />
            <InfoRow label="Public Store URL" value={`/${shop.slug}`} isMono />
            <InfoRow label="Created On" value={new Date(shop.created_at).toLocaleDateString()} />
          </div>
        </div>
      </div>

      {/* Orders Audit Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Recent Orders ({orders?.length ?? 0})</h2>
          <span className="text-xs text-slate-400">All customer cart & checkout orders</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3">Notes & Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(orders ?? []).slice(0, 10).map((order) => (
                <tr key={order.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-3 font-medium text-slate-200">{order.customer_name}</td>
                  <td className="px-5 py-3 text-slate-400 font-mono">{order.customer_phone}</td>
                  <td className="px-5 py-3 text-slate-400">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-400">
                    ₹{Number(order.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400 max-w-xs truncate">{order.notes || "—"}</td>
                </tr>
              ))}
              {(!orders || orders.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No orders placed with this shop yet.
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

function InfoRow({ label, value, isMono }: { label: string; value: string; isMono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-400">{label}</span>
      <span className={`text-slate-200 font-medium ${isMono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

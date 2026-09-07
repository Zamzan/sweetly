import { assertSuperAdminWithMFA } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllSubscriptionRequests } from "@/lib/subscription-requests";
import { AdminSubscriptionsManager } from "./_components/admin-subscriptions-manager";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  await assertSuperAdminWithMFA();
  const admin = createAdminClient();

  // Fetch all subscription requests
  const requests = await getAllSubscriptionRequests();

  // Fetch all shops and their subscriptions
  const { data: rawShops } = await admin
    .from("shops")
    .select(`
      id,
      name,
      slug,
      subscriptions (
        plan,
        status,
        trial_ends_at,
        current_period_end,
        provider
      )
    `)
    .order("created_at", { ascending: false });

  const formattedShops = (rawShops || []).map((shop: any) => {
    const sub = Array.isArray(shop.subscriptions) ? shop.subscriptions[0] : shop.subscriptions;
    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      plan: sub?.plan || "starter",
      status: sub?.status || "TRIALING",
      current_period_end: sub?.current_period_end || null,
      trial_ends_at: sub?.trial_ends_at || null,
      provider: sub?.provider || null,
    };
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>💳</span> Subscription Management &amp; Manual UPI Verification
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review manual UPI payment submissions, approve 30-day activations (₹199/mo), and grant promotional free trials.
        </p>
      </div>

      <AdminSubscriptionsManager
        requests={requests}
        shops={formattedShops}
        supabaseUrl={supabaseUrl}
      />
    </div>
  );
}

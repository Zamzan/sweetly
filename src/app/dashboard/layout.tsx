import Link from "next/link";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LogoutButton } from "./_components/logout-button";
import { StorefrontLinkBar } from "./_components/storefront-link-bar";
import { MobileNav } from "./_components/mobile-nav";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/custom-orders", label: "Custom Orders" },
  { href: "/dashboard/staff", label: "Staff" },
  { href: "/dashboard/settings", label: "Storefront & Settings" },
  { href: "/dashboard/subscription", label: "Subscription" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { shop } = await getCurrentShopOrRedirect();
  const supabase = await createServerSupabaseClient();
  const { data: freshShop } = await supabase
    .from("shops")
    .select("id, name, slug, is_published")
    .eq("id", shop.id)
    .single();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("platform_role").eq("id", user.id).single()
    : { data: null };

  const isPlatformAdmin = profile?.platform_role === "PLATFORM_ADMIN";
  const currentShop = freshShop || shop;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, current_period_end")
    .eq("shop_id", shop.id)
    .maybeSingle();

  const now = new Date();
  const trialEnds = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const isTrialActive = sub?.status === "TRIALING" && trialEnds && trialEnds > now;
  const isSubscriptionActive = sub?.status === "ACTIVE" && sub.current_period_end && new Date(sub.current_period_end) > now;
  const isExpired = !isTrialActive && !isSubscriptionActive;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top navigation header */}
      <MobileNav shopName={shop.name} navItems={NAV} />

      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-brand-100 bg-white p-5 md:flex">
        <div className="mb-6 px-2">
          <p className="font-display text-2xl font-bold text-brand-600">Sweetly</p>
          <p className="truncate text-xs font-medium text-brand-900">{shop.name}</p>
        </div>

        <nav className="flex-1 space-y-1.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-xl px-3.5 py-2.5 text-sm font-medium text-brand-900 transition hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}

          {isPlatformAdmin && (
            <Link
              href="/admin"
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <span>Super Admin ⚡</span>
              <span className="text-[10px] rounded bg-brand-500/20 px-1.5 py-0.5 text-brand-400 font-mono">2FA</span>
            </Link>
          )}
        </nav>

        <div className="border-t border-brand-100 pt-4 space-y-2">
          <Link
            href={`/${shop.slug}`}
            target="_blank"
            className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/50 px-3.5 py-2.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            <span>View Storefront</span>
            <span>↗</span>
          </Link>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-cream/60 p-4 md:p-8">
        <div className="mx-auto max-w-6xl">
          {/* Prominent Storefront & Website link bar */}
          <StorefrontLinkBar
            shopSlug={currentShop.slug}
            shopName={currentShop.name}
            isPublished={currentShop.is_published}
          />

          {/* 14-Day Trial Expired Notice Banner */}
          {isExpired && (
            <div className="mb-6 rounded-2xl border border-amber-300/80 bg-amber-50 p-4 text-amber-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-lg">
                  ⚠️
                </span>
                <div>
                  <p className="text-xs font-bold text-amber-900">14-Day Free Trial Expired</p>
                  <p className="text-[11px] text-amber-800">
                    Your 14-day free trial has ended. Subscribe to Sweetly Starter for <strong>₹199/month</strong> to keep your storefront active and receive customer orders.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/subscription"
                className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 whitespace-nowrap self-start sm:self-auto"
              >
                Activate Store (₹199/mo) →
              </Link>
            </div>
          )}

          {children}
        </div>
      </main>
    </div>
  );
}

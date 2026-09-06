import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyAdminElevatedSession } from "@/lib/admin-auth";
import { adminLogoutAction } from "./verify/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  // Multi-layer check: confirm platform role server-side
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, platform_role")
    .eq("id", user.id)
    .single();

  if (profile?.platform_role !== "PLATFORM_ADMIN") {
    redirect("/403");
  }

  const isMfaVerified = await verifyAdminElevatedSession(user.id);

  if (!isMfaVerified) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
        <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md px-6 py-4">
          <div className="mx-auto max-w-7xl flex items-center justify-between">
            <Link href="/" className="font-display text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-white shadow-sm">
                S
              </span>
              Sweetly Platform
            </Link>
            <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-400 border border-brand-500/20">
              Admin Gateway
            </span>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
        <footer className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-500">
          Sweetly Security Console • RFC 6238 TOTP Protected • All Access Logged
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Super Admin Executive Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-6 py-3.5 shadow-lg">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-sm font-bold text-white shadow-md shadow-brand-500/20">
                S
              </span>
              <span>
                Sweetly <span className="text-xs font-mono font-normal uppercase tracking-widest text-brand-400 ml-1.5 px-2 py-0.5 rounded-md bg-brand-500/10 border border-brand-500/20">Super Admin</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link
                href="/admin"
                className="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                Platform Overview
              </Link>
              <Link
                href="/admin/shops"
                className="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                All Shops & Revenue
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>TOTP MFA Authenticated</span>
            </div>

            <div className="hidden lg:block text-right">
              <p className="text-xs font-medium text-slate-200">{profile?.full_name || "Platform Admin"}</p>
              <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{user.email}</p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            >
              Shop Dashboard →
            </Link>

            <form action={adminLogoutAction}>
              <button
                type="submit"
                className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
              >
                Lock / Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-900/30 py-4 px-6 text-center text-xs text-slate-500">
        Sweetly Super Admin Master Console • System Status: Nominal • End-to-End Encrypted
      </footer>
    </div>
  );
}

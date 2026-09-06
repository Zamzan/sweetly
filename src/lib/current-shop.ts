import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Resolves the shop the CURRENTLY AUTHENTICATED user owns/works at,
 * purely from their session — never from a client-supplied shop_id.
 * Every dashboard page/action should call this instead of trusting
 * any shop identifier passed in from the browser.
 */
export async function getCurrentShop() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("shop_members")
    .select("shop_id, role, permissions, shops(*)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !membership.shops) {
    return null;
  }

  return {
    user,
    role: membership.role as "OWNER" | "STAFF",
    permissions: membership.permissions as Record<string, boolean>,
    shop: membership.shops as any,
  };
}

export async function getCurrentShopOrRedirect() {
  const current = await getCurrentShop();
  if (!current) redirect("/login");
  return current;
}

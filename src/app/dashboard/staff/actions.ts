"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";

const inviteSchema = z.object({
  email: z.string().trim().email(),
  canManageProducts: z.boolean(),
  canManageOrders: z.boolean(),
});

/**
 * Adds an existing Sweetly user (identified by email) as staff on
 * the current shop. Only the OWNER may do this (enforced here and
 * again by the `members: owner can insert` RLS policy). This does
 * NOT create a new auth user — the staff member must already have a
 * Sweetly account. Looking up a user by email requires the admin
 * client since `auth.users` isn't queryable by anon/RLS clients;
 * only the id needed for shop_members is read, nothing else.
 */
export async function inviteStaffAction(formData: FormData) {
  const { shop, role } = await getCurrentShopOrRedirect();
  if (role !== "OWNER") return { error: "Only the shop owner can manage staff." };

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    canManageProducts: formData.get("canManageProducts") === "on",
    canManageOrders: formData.get("canManageOrders") === "on",
  });
  if (!parsed.success) return { error: "Enter a valid email." };

  const admin = createAdminClient();
  const { data: userList, error: lookupError } = await admin.auth.admin.listUsers();
  if (lookupError) return { error: "Could not look up that user." };

  const targetUser = userList.users.find(
    (u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase()
  );
  if (!targetUser) {
    return { error: "No Sweetly account found with that email. They must sign up first." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("shop_members").insert({
    shop_id: shop.id,
    user_id: targetUser.id,
    role: "STAFF",
    permissions: {
      products: parsed.data.canManageProducts,
      orders: parsed.data.canManageOrders,
    },
  });

  if (error) {
    return { error: error.code === "23505" ? "That person is already a member of this shop." : "Could not add staff member." };
  }

  revalidatePath("/dashboard/staff");
  return { success: true };
}

export async function removeStaffAction(memberId: string) {
  const { shop, role } = await getCurrentShopOrRedirect();
  if (role !== "OWNER") return { error: "Only the shop owner can manage staff." };

  const supabase = await createServerSupabaseClient();
  // RLS policy "members: owner can delete" also blocks removing the
  // OWNER row itself (role <> 'OWNER' in the policy), so the owner
  // can never accidentally lock themselves out this way.
  const { error } = await supabase
    .from("shop_members")
    .delete()
    .eq("id", memberId)
    .eq("shop_id", shop.id);

  if (error) return { error: "Could not remove staff member." };

  revalidatePath("/dashboard/staff");
  return { success: true };
}

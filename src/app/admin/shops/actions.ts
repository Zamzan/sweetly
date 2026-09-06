"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSuperAdminWithMFA } from "@/lib/admin-auth";
import { safeLogAudit } from "@/lib/audit";

/**
 * Super Admin Action to publish or take a shop offline.
 */
export async function toggleShopPublishStatusAction(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await assertSuperAdminWithMFA();

    const shopId = formData.get("shopId")?.toString().trim();
    const isPublished = formData.get("isPublished") === "true";
    const reason = formData.get("reason")?.toString().trim() || (isPublished ? "Reactivated by admin" : "Taken offline by admin");

    if (!shopId) {
      return { error: "Invalid shop ID." };
    }

    const admin = createAdminClient();

    // Fetch existing shop to retrieve slug for cache invalidation
    const { data: existingShop, error: fetchErr } = await admin
      .from("shops")
      .select("id, name, slug, is_published")
      .eq("id", shopId)
      .single();

    if (fetchErr || !existingShop) {
      return { error: "Shop not found." };
    }

    const { error: updateErr } = await admin
      .from("shops")
      .update({
        is_published: isPublished,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shopId);

    if (updateErr) {
      console.error("Failed to update shop publish status:", updateErr);
      return { error: "Could not update shop status in database." };
    }

    // Log super admin audit trail
    await safeLogAudit({
      shopId,
      actorId: user.id,
      action: isPublished ? "admin.shop.publish" : "admin.shop.offline",
      targetType: "shop",
      targetId: shopId,
    });

    // Revalidate relevant views
    revalidatePath("/admin/shops");
    revalidatePath(`/admin/shops/${shopId}`);
    if (existingShop.slug) {
      revalidatePath(`/${existingShop.slug}`);
      revalidatePath(`/${existingShop.slug}/products`);
    }

    return { success: true };
  } catch (err: any) {
    console.error("toggleShopPublishStatusAction error:", err);
    return { error: err.message || "Failed to update shop status." };
  }
}

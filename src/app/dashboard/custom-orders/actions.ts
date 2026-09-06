"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentShop } from "@/lib/current-shop";
import { safeLogAudit } from "@/lib/audit";
import { z } from "zod";

const statusSchema = z.enum([
  "NEW", "CONTACTED", "PAYMENT_PENDING", "CONFIRMED",
  "PREPARING", "READY", "COMPLETED", "CANCELLED",
]);

export async function updateCustomOrderStatusAction(orderId: string, status: string) {
  try {
    const session = await getCurrentShop();
    if (!session) {
      return { error: "Session expired. Please log in again." };
    }
    const { shop, user, role, permissions } = session;
    if (role !== "OWNER" && !permissions?.orders) {
      return { error: "You don't have permission to manage custom orders." };
    }

    const parsed = statusSchema.safeParse(status);
    if (!parsed.success) return { error: "Invalid status." };

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("custom_orders")
      .update({ status: parsed.data })
      .eq("id", orderId)
      .eq("shop_id", shop.id);

    if (error) {
      console.error("Error updating custom order status:", error);
      return { error: "Could not update order status." };
    }

    await safeLogAudit({
      shopId: shop.id,
      actorId: user.id,
      action: "custom_order.status_update",
      targetType: "custom_order",
      targetId: orderId,
    });

    try {
      revalidatePath("/dashboard/custom-orders");
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("updateCustomOrderStatusAction error:", err);
    return { error: err?.message || "Failed to update custom order status." };
  }
}

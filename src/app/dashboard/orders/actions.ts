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

export async function updateOrderStatusAction(orderId: string, status: string) {
  try {
    const session = await getCurrentShop();
    if (!session) {
      return { error: "Session expired. Please log in again." };
    }
    const { shop, user, role, permissions } = session;
    if (role !== "OWNER" && !permissions?.orders) {
      return { error: "You don't have permission to manage orders." };
    }

    const parsed = statusSchema.safeParse(status);
    if (!parsed.success) return { error: "Invalid status." };

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("orders")
      .update({ status: parsed.data })
      .eq("id", orderId)
      .eq("shop_id", shop.id);

    if (error) return { error: "Could not update order." };

    await safeLogAudit({
      shopId: shop.id,
      actorId: user.id,
      action: "order.status_update",
      targetType: "order",
      targetId: orderId,
    });

    try {
      revalidatePath("/dashboard/orders");
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("updateOrderStatusAction error:", err);
    return { error: err?.message || "Failed to update order status." };
  }
}

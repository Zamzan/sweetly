"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { safeLogAudit } from "@/lib/audit";
import { z } from "zod";

const statusSchema = z.enum([
  "NEW", "CONTACTED", "PAYMENT_PENDING", "CONFIRMED",
  "PREPARING", "READY", "COMPLETED", "CANCELLED",
]);

export async function updateOrderStatusAction(orderId: string, status: string) {
  const { shop, user, role, permissions } = await getCurrentShopOrRedirect();
  if (role !== "OWNER" && !permissions.orders) {
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

  revalidatePath("/dashboard/orders");
  return { success: true };
}

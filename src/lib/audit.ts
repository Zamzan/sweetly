import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function safeLogAudit({
  shopId,
  actorId,
  action,
  targetType,
  targetId,
}: {
  shopId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      shop_id: shopId,
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId ?? null,
    });
  } catch (err) {
    // Best-effort audit trail. Never block the user operation on audit logging failure.
    console.error("Audit log error:", err);
  }
}

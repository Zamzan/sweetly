"use server";

import { revalidatePath } from "next/cache";
import { getSuperAdminWithMFA } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeLogAudit } from "@/lib/audit";
import {
  getAllSubscriptionRequests,
  updateSubscriptionRequestStatus,
} from "@/lib/subscription-requests";
import DOMPurify from "isomorphic-dompurify";

export async function approveSubscriptionRequestAction({ requestId }: { requestId: string }) {
  try {
    const authResult = await getSuperAdminWithMFA();
    if ("error" in authResult) {
      return { error: authResult.error };
    }
    const { user } = authResult;
    const admin = createAdminClient();

    // 1. Fetch the request
    const allRequests = await getAllSubscriptionRequests();
    const request = allRequests.find((r) => r.id === requestId);

    if (!request) {
      return { error: "Subscription request not found." };
    }

    if (request.status !== "pending") {
      return { error: `This request has already been ${request.status}.` };
    }

    // 2. Fetch current shop subscription
    const { data: currentSub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("shop_id", request.shop_id)
      .maybeSingle();

    // 3. Compute 30-day period end
    const now = new Date();
    let baseDate = now;
    if (currentSub?.current_period_end) {
      const existingEnd = new Date(currentSub.current_period_end);
      if (existingEnd > now) {
        baseDate = existingEnd;
      }
    }

    const newPeriodEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 4. Update or insert subscription record to ACTIVE pro
    if (!currentSub) {
      const { error: insError } = await admin.from("subscriptions").insert({
        shop_id: request.shop_id,
        status: "ACTIVE",
        plan: "pro",
        current_period_end: newPeriodEnd.toISOString(),
        provider: "manual_upi",
        provider_subscription_id: request.utr,
        updated_at: now.toISOString(),
      });
      if (insError) {
        console.error("Failed to insert subscription on approval:", insError);
        return { error: "Failed to initialize shop subscription record: " + insError.message };
      }
    } else {
      const { error: subUpdateError } = await admin
        .from("subscriptions")
        .update({
          status: "ACTIVE",
          plan: "pro",
          current_period_end: newPeriodEnd.toISOString(),
          provider: "manual_upi",
          provider_subscription_id: request.utr,
          updated_at: now.toISOString(),
        })
        .eq("shop_id", request.shop_id);

      if (subUpdateError) {
        console.error("Failed to update subscription on approval:", subUpdateError);
        return { error: "Failed to update shop subscription record: " + subUpdateError.message };
      }
    }

    // 5. Update request status to approved
    const updateRes = await updateSubscriptionRequestStatus(
      requestId,
      "approved",
      user.id,
      "Approved by platform administrator via Sweetly Console."
    );

    if (!updateRes.success) {
      console.warn("Failed to mark request as approved in database:", updateRes.error);
    }

    // 6. Safe audit log
    await safeLogAudit({
      shopId: request.shop_id,
      actorId: user.id,
      action: "admin_approved_subscription",
      targetType: "subscription",
      targetId: request.id,
    });

    try {
      revalidatePath("/admin/subscriptions");
      revalidatePath("/dashboard/subscription");
      revalidatePath("/admin");
    } catch (e) {
      console.warn("revalidatePath warning:", e);
    }

    return { success: true };
  } catch (err: any) {
    console.error("approveSubscriptionRequestAction error:", err);
    return { error: err?.message || "An unexpected error occurred while approving payment." };
  }
}

export async function rejectSubscriptionRequestAction({
  requestId,
  reason,
}: {
  requestId: string;
  reason: string;
}) {
  try {
    const authResult = await getSuperAdminWithMFA();
    if ("error" in authResult) {
      return { error: authResult.error };
    }
    const { user } = authResult;

    const cleanReason = DOMPurify.sanitize(reason?.trim() || "Payment could not be verified.", {
      ALLOWED_TAGS: [],
    });

    const allRequests = await getAllSubscriptionRequests();
    const request = allRequests.find((r) => r.id === requestId);

    if (!request) {
      return { error: "Subscription request not found." };
    }

    const updateRes = await updateSubscriptionRequestStatus(
      requestId,
      "rejected",
      user.id,
      cleanReason
    );

    if (!updateRes.success) {
      return { error: updateRes.error || "Failed to reject subscription request." };
    }

    await safeLogAudit({
      shopId: request.shop_id,
      actorId: user.id,
      action: "admin_rejected_subscription",
      targetType: "subscription_request",
      targetId: request.id,
    });

    try {
      revalidatePath("/admin/subscriptions");
      revalidatePath("/dashboard/subscription");
    } catch (e) {
      console.warn("revalidatePath warning:", e);
    }

    return { success: true };
  } catch (err: any) {
    console.error("rejectSubscriptionRequestAction error:", err);
    return { error: err?.message || "An unexpected error occurred while rejecting request." };
  }
}

export async function grantSubscriptionAction({
  shopId,
  durationDays = 30,
  reason,
}: {
  shopId: string;
  durationDays?: number;
  reason: string;
}) {
  try {
    const authResult = await getSuperAdminWithMFA();
    if ("error" in authResult) {
      return { error: authResult.error };
    }
    const { user } = authResult;
    const admin = createAdminClient();

    if (!shopId) {
      return { error: "Please select a valid shop." };
    }

    const cleanReason = DOMPurify.sanitize(reason?.trim() || "", { ALLOWED_TAGS: [] });
    if (!cleanReason || cleanReason.length < 3) {
      return { error: "Please provide a reason for granting free subscription (e.g. Free trial promotion)." };
    }

    const days = Math.min(Math.max(Number(durationDays) || 30, 1), 365);

    // 1. Fetch current subscription
    const { data: currentSub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("shop_id", shopId)
      .maybeSingle();

    // 2. Calculate new period end
    const now = new Date();
    let baseDate = now;
    if (currentSub?.current_period_end) {
      const existingEnd = new Date(currentSub.current_period_end);
      if (existingEnd > now) {
        baseDate = existingEnd;
      }
    }

    const newPeriodEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    // 3. Upsert or update subscription record
    if (!currentSub) {
      const { error: insErr } = await admin.from("subscriptions").insert({
        shop_id: shopId,
        status: "ACTIVE",
        plan: "pro",
        current_period_end: newPeriodEnd.toISOString(),
        provider: "admin_grant",
        provider_subscription_id: `GRANT-${days}D-${Date.now()}`,
        updated_at: now.toISOString(),
      });
      if (insErr) {
        return { error: "Failed to create subscription record: " + insErr.message };
      }
    } else {
      const { error: subUpdateError } = await admin
        .from("subscriptions")
        .update({
          status: "ACTIVE",
          plan: "pro",
          current_period_end: newPeriodEnd.toISOString(),
          provider: "admin_grant",
          provider_subscription_id: `GRANT-${days}D-${Date.now()}`,
          updated_at: now.toISOString(),
        })
        .eq("shop_id", shopId);

      if (subUpdateError) {
        return { error: "Failed to grant subscription: " + subUpdateError.message };
      }
    }

    // 4. Safe audit log
    await safeLogAudit({
      shopId,
      actorId: user.id,
      action: "admin_granted_subscription",
      targetType: "subscription",
      targetId: shopId,
    });

    try {
      revalidatePath("/admin/subscriptions");
      revalidatePath("/admin/shops");
      revalidatePath("/dashboard/subscription");
    } catch (e) {
      console.warn("revalidatePath warning:", e);
    }

    return { success: true };
  } catch (err: any) {
    console.error("grantSubscriptionAction error:", err);
    return { error: err?.message || "An unexpected error occurred while granting subscription." };
  }
}

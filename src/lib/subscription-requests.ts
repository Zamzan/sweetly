import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface SubscriptionRequestRecord {
  id: string;
  shop_id: string;
  user_id: string;
  plan: string;
  amount: number;
  currency: string;
  utr: string;
  payment_screenshot_path: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  admin_notes?: string | null;
  shop?: {
    name: string;
    slug: string;
  } | null;
  user_email?: string | null;
}

/**
 * Checks if subscription_requests table exists in PostgreSQL schema cache.
 */
let cachedTableExists: boolean | null = null;
let cacheExpiry = 0;

export async function hasSubscriptionRequestsTable(): Promise<boolean> {
  const now = Date.now();
  if (cachedTableExists !== null && now < cacheExpiry) {
    return cachedTableExists;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("subscription_requests").select("id").limit(1);

  if (error && (error.code === "PGRST205" || error.message?.includes("subscription_requests"))) {
    cachedTableExists = false;
  } else {
    cachedTableExists = true;
  }
  cacheExpiry = now + 30_000; // cache for 30 seconds
  return cachedTableExists;
}

/**
 * Gets the latest pending or recent request for a given shop.
 */
export async function getLatestRequestForShop(shopId: string): Promise<SubscriptionRequestRecord | null> {
  const admin = createAdminClient();
  const tableExists = await hasSubscriptionRequestsTable();

  if (tableExists) {
    const { data } = await admin
      .from("subscription_requests")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return data as SubscriptionRequestRecord;
  }

  // Fallback: Read from subscription_events
  const { data: events } = await admin
    .from("subscription_events")
    .select("*")
    .eq("shop_id", shopId)
    .eq("event_type", "manual_payment_request")
    .order("created_at", { ascending: false })
    .limit(1);

  if (events && events.length > 0) {
    const ev = events[0];
    const p = (ev.payload as Record<string, any>) || {};
    return {
      id: ev.id,
      shop_id: ev.shop_id,
      user_id: p.user_id || "",
      plan: p.plan || "pro",
      amount: Number(p.amount || 199.0),
      currency: p.currency || "INR",
      utr: p.utr || "",
      payment_screenshot_path: p.payment_screenshot_path || null,
      notes: p.notes || null,
      status: p.status || "pending",
      created_at: ev.created_at,
      reviewed_at: p.reviewed_at || null,
      reviewed_by: p.reviewed_by || null,
      admin_notes: p.admin_notes || null,
    };
  }

  return null;
}

/**
 * Gets all requests, optionally filtered by status (e.g. 'pending').
 */
export async function getAllSubscriptionRequests(statusFilter?: "pending" | "approved" | "rejected"): Promise<SubscriptionRequestRecord[]> {
  const admin = createAdminClient();
  const tableExists = await hasSubscriptionRequestsTable();

  if (tableExists) {
    let query = admin
      .from("subscription_requests")
      .select("*, shop:shops(name, slug)")
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    if (data) return data as SubscriptionRequestRecord[];
  }

  // Fallback: Read from subscription_events
  const { data: events } = await admin
    .from("subscription_events")
    .select("*, shop:shops(name, slug)")
    .eq("event_type", "manual_payment_request")
    .order("created_at", { ascending: false });

  if (!events) return [];

  const results: SubscriptionRequestRecord[] = events.map((ev) => {
    const p = (ev.payload as Record<string, any>) || {};
    return {
      id: ev.id,
      shop_id: ev.shop_id,
      user_id: p.user_id || "",
      plan: p.plan || "pro",
      amount: Number(p.amount || 199.0),
      currency: p.currency || "INR",
      utr: p.utr || "",
      payment_screenshot_path: p.payment_screenshot_path || null,
      notes: p.notes || null,
      status: p.status || "pending",
      created_at: ev.created_at,
      reviewed_at: p.reviewed_at || null,
      reviewed_by: p.reviewed_by || null,
      admin_notes: p.admin_notes || null,
      shop: ev.shop,
    };
  });

  if (statusFilter) {
    return results.filter((r) => r.status === statusFilter);
  }

  return results;
}

/**
 * Creates a new subscription payment request.
 */
export async function createSubscriptionRequest(payload: {
  shop_id: string;
  user_id: string;
  plan: string;
  amount: number;
  currency: string;
  utr: string;
  payment_screenshot_path: string | null;
  notes: string | null;
}): Promise<{ id: string } | { error: string }> {
  const admin = createAdminClient();
  const tableExists = await hasSubscriptionRequestsTable();

  if (tableExists) {
    const { data, error } = await admin
      .from("subscription_requests")
      .insert({
        ...payload,
        status: "pending",
      })
      .select("id")
      .single();

    if (!error && data) {
      return { id: data.id };
    }
  }

  // Fallback: Store in subscription_events
  // First find shop's subscription_id
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("shop_id", payload.shop_id)
    .single();

  if (!sub) {
    return { error: "No subscription record found for this shop." };
  }

  const { data: eventData, error: eventError } = await admin
    .from("subscription_events")
    .insert({
      subscription_id: sub.id,
      shop_id: payload.shop_id,
      event_type: "manual_payment_request",
      payload: {
        ...payload,
        status: "pending",
      },
    })
    .select("id")
    .single();

  if (eventError) {
    return { error: eventError.message || "Failed to record payment request." };
  }

  return { id: eventData.id };
}

/**
 * Updates a subscription request status (approved or rejected).
 */
export async function updateSubscriptionRequestStatus(
  requestId: string,
  status: "approved" | "rejected",
  reviewedBy: string,
  adminNotes?: string | null
): Promise<{ success: boolean; error?: string; request?: SubscriptionRequestRecord }> {
  const admin = createAdminClient();
  const tableExists = await hasSubscriptionRequestsTable();

  if (tableExists) {
    const { data: updated, error } = await admin
      .from("subscription_requests")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        admin_notes: adminNotes || null,
      })
      .eq("id", requestId)
      .select("*, shop:shops(name, slug)")
      .maybeSingle();

    if (!error && updated) {
      return { success: true, request: updated as SubscriptionRequestRecord };
    }
  }

  // Fallback: Update in subscription_events
  const { data: eventRecord } = await admin
    .from("subscription_events")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!eventRecord) {
    return { success: false, error: "Subscription request not found." };
  }

  const currentPayload = (eventRecord.payload as Record<string, any>) || {};
  const updatedPayload = {
    ...currentPayload,
    status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewedBy,
    admin_notes: adminNotes || null,
  };

  const { error: updateError } = await admin
    .from("subscription_events")
    .update({ payload: updatedPayload })
    .eq("id", requestId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return {
    success: true,
    request: {
      id: eventRecord.id,
      shop_id: eventRecord.shop_id,
      user_id: currentPayload.user_id || "",
      plan: currentPayload.plan || "pro",
      amount: Number(currentPayload.amount || 199.0),
      currency: currentPayload.currency || "INR",
      utr: currentPayload.utr || "",
      payment_screenshot_path: currentPayload.payment_screenshot_path || null,
      notes: currentPayload.notes || null,
      status,
      created_at: eventRecord.created_at,
      reviewed_at: updatedPayload.reviewed_at,
      reviewed_by: reviewedBy,
      admin_notes: adminNotes || null,
    },
  };
}

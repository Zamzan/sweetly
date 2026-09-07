"use server";

import { revalidatePath } from "next/cache";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeLogAudit } from "@/lib/audit";
import { sniffImageType } from "@/lib/images";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "@/lib/validation";
import { getLatestRequestForShop, createSubscriptionRequest } from "@/lib/subscription-requests";
import DOMPurify from "isomorphic-dompurify";

export async function submitSubscriptionRequestAction(formData: FormData) {
  // 1. Authenticate user and shop server-side (strictly derived from session)
  const { shop, user, role } = await getCurrentShopOrRedirect();

  if (role !== "OWNER") {
    return { error: "Only shop owners can manage subscriptions and payments." };
  }

  // 2. Validate UTR / Transaction ID (required, min 6 characters)
  const rawUtr = formData.get("utr")?.toString().trim();
  if (!rawUtr || rawUtr.length < 6) {
    return { error: "Please enter a valid UPI UTR / Transaction ID (at least 6 characters)." };
  }

  const cleanUtr = DOMPurify.sanitize(rawUtr, { ALLOWED_TAGS: [] });
  const rawNotes = formData.get("notes")?.toString().trim();
  const cleanNotes = rawNotes ? DOMPurify.sanitize(rawNotes.slice(0, 500), { ALLOWED_TAGS: [] }) : null;

  // Amount is NEVER trusted from client — enforced server-side as 199.00 INR
  const plan = "pro";
  const amount = 199.0;
  const currency = "INR";

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  // 3. Prevent duplicate pending requests for this shop
  const existingRequest = await getLatestRequestForShop(shop.id);
  if (existingRequest && existingRequest.status === "pending") {
    return {
      error: "You already have a subscription payment verification pending. Our team is reviewing it.",
    };
  }

  // 4. Handle Payment Screenshot upload if provided
  let screenshotStoragePath: string | null = null;
  const screenshotFile = formData.get("screenshot");

  if (screenshotFile && screenshotFile instanceof File && screenshotFile.size > 0) {
    if (screenshotFile.size > MAX_IMAGE_BYTES) {
      return { error: "Payment screenshot must be smaller than 5 MB." };
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(screenshotFile.type)) {
      return { error: "Invalid image format. Please upload JPG, PNG, or WebP." };
    }

    try {
      const bytes = new Uint8Array(await screenshotFile.arrayBuffer());
      const sniffed = sniffImageType(bytes);
      if (!sniffed) {
        return { error: "Corrupted or invalid image file. Please re-upload screenshot." };
      }

      const ext = sniffed.split("/")[1] || "jpg";
      const requestId = crypto.randomUUID();
      screenshotStoragePath = `shops/${shop.id}/subscriptions/${requestId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await admin.storage
        .from("shop-assets")
        .upload(screenshotStoragePath, bytes, { contentType: sniffed, upsert: true });

      if (uploadError) {
        console.error("Payment screenshot upload error:", uploadError);
        return { error: "Could not upload payment screenshot. Please try again." };
      }
    } catch (err) {
      console.error("Payment screenshot processing exception:", err);
      return { error: "Failed to process screenshot upload." };
    }
  }

  // 5. Insert request using resilient abstraction
  const requestPayload = {
    shop_id: shop.id,
    user_id: user.id,
    plan,
    amount,
    currency,
    utr: cleanUtr,
    payment_screenshot_path: screenshotStoragePath,
    notes: cleanNotes,
  };

  const result = await createSubscriptionRequest(requestPayload);
  if ("error" in result) {
    return { error: result.error };
  }

  // 6. Record safe audit log
  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: "subscription_request_created",
    targetType: "subscription_request",
    targetId: result.id,
  });

  revalidatePath("/dashboard/subscription");
  return { success: true };
}

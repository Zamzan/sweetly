import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { customOrderSchema, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES_PER_UPLOAD } from "@/lib/validation";
import { buildCustomOrderMessage, buildWhatsAppLink, InvalidWhatsAppNumberError } from "@/lib/whatsapp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/csrf";
import DOMPurify from "isomorphic-dompurify";

// Magic-byte sniffing so a renamed/malicious file can't pass as an
// image just because its declared MIME type looks right (spec #12,
// #22, #26 — never trust client-declared content type alone).
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export async function POST(request: NextRequest) {
  // CSRF verification
  const originCheck = verifySameOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json({ error: "Forbidden cross-origin request." }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const { success } = await checkRateLimit("customOrder", `custom-order:${ip}`);
  if (!success) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });

  const parsed = customOrderSchema.safeParse({
    shopSlug: formData.get("shopSlug"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    occasion: formData.get("occasion") || null,
    productType: formData.get("productType") || null,
    quantity: formData.get("quantity") || null,
    budgetPerUnit: formData.get("budgetPerUnit") || null,
    totalBudget: formData.get("totalBudget") || null,
    desiredDate: formData.get("desiredDate") || null,
    instructions: formData.get("instructions") || null,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up the shop server-side from the slug — this is the ONLY
  // source of truth for which shop_id and WhatsApp number are used.
  const { data: shop } = await admin
    .from("shops")
    .select("id, name, whatsapp_number, is_published")
    .eq("slug", parsed.data.shopSlug)
    .maybeSingle();

  if (!shop || !shop.is_published) {
    return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  }

  // Verify shop subscription is active or within 14-day free trial
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, trial_ends_at, current_period_end")
    .eq("shop_id", shop.id)
    .maybeSingle();

  const now = new Date();
  const trialEnds = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const isTrialActive = sub?.status === "TRIALING" && trialEnds && trialEnds > now;
  const isSubscriptionActive =
    sub?.status === "ACTIVE" &&
    sub?.current_period_end &&
    new Date(sub.current_period_end) > now;

  if (!isTrialActive && !isSubscriptionActive) {
    return NextResponse.json(
      { error: "This store is temporarily paused pending subscription renewal." },
      { status: 403 }
    );
  }

  // 1. Persist the custom order (service role — the customer has no
  //    Supabase session, so this can't go through RLS as "them").
  let customOrder: { id: string } | null = null;
  let insertError: any = null;

  const corePayload = {
    shop_id: shop.id,
    customer_name: DOMPurify.sanitize(parsed.data.customerName, { ALLOWED_TAGS: [] }),
    customer_phone: parsed.data.customerPhone,
    occasion: parsed.data.occasion ? DOMPurify.sanitize(parsed.data.occasion, { ALLOWED_TAGS: [] }) : null,
    product_type: parsed.data.productType ? DOMPurify.sanitize(parsed.data.productType, { ALLOWED_TAGS: [] }) : null,
    quantity: parsed.data.quantity,
    budget_per_unit: parsed.data.budgetPerUnit,
    total_budget: parsed.data.totalBudget,
    desired_date: parsed.data.desiredDate,
    instructions: parsed.data.instructions ? DOMPurify.sanitize(parsed.data.instructions, { ALLOWED_TAGS: [] }) : null,
  };

  const categoryId = formData.get("categoryId")?.toString().trim();
  const refProdId = formData.get("referenceProductId")?.toString().trim();

  // Level 1: Try with enhanced columns (category_id, reference_product_id)
  const enhancedPayload: any = {
    ...corePayload,
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(refProdId ? { reference_product_id: refProdId } : {}),
  };

  const res1 = await admin.from("custom_orders").insert(enhancedPayload).select("id").maybeSingle();
  if (!res1.error && res1.data) {
    customOrder = res1.data;
  } else {
    // Level 2: Fallback to core columns if enhanced columns are not in schema cache
    const res2 = await admin.from("custom_orders").insert(corePayload).select("id").maybeSingle();
    if (!res2.error && res2.data) {
      customOrder = res2.data;
    } else {
      insertError = res2.error || res1.error;
      console.error("Custom order insert failed:", insertError);
    }
  }

  if (insertError || !customOrder) {
    return NextResponse.json({ error: "Could not save your order. Please try again." }, { status: 500 });
  }

  // 2. Handle reference image uploads, if any — validated by size,
  //    declared type, AND magic bytes; stored under a path scoped to
  //    this shop and this custom order.
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length > MAX_IMAGES_PER_UPLOAD) {
    return NextResponse.json({ error: `You can upload up to ${MAX_IMAGES_PER_UPLOAD} images.` }, { status: 400 });
  }

  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "One or more images exceed the 5MB limit." }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, or WebP images are allowed." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImageType(bytes);
    if (!sniffed || sniffed !== file.type) {
      return NextResponse.json(
        { error: "One or more files are not valid images." },
        { status: 400 }
      );
    }

    const ext = sniffed.split("/")[1];
    const path = `shops/${shop.id}/custom-orders/${customOrder.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("custom-order-refs")
      .upload(path, bytes, { contentType: sniffed, upsert: false });

    if (uploadError) {
      // Don't fail the whole order over an image issue — the order
      // itself is already saved; just skip recording this image.
      continue;
    }

    await admin.from("custom_order_images").insert({
      custom_order_id: customOrder.id,
      shop_id: shop.id,
      storage_path: path,
    });
  }

  // 3. Build the WhatsApp Click-to-Chat link. The number comes only
  //    from `shop.whatsapp_number` loaded above — never from the
  //    request body.
  if (!shop.whatsapp_number) {
    // Order is saved either way; WhatsApp is a convenience layer.
    return NextResponse.json({
      success: true,
      whatsappAvailable: false,
      message: "Your custom order request has been sent to the shop.",
    });
  }

  try {
    const message = buildCustomOrderMessage({
      shopName: shop.name,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      occasion: parsed.data.occasion,
      productType: parsed.data.productType,
      quantity: parsed.data.quantity,
      budgetPerUnit: parsed.data.budgetPerUnit,
      desiredDate: parsed.data.desiredDate,
      instructions: parsed.data.instructions,
    });
    const link = buildWhatsAppLink(shop.whatsapp_number, message);
    return NextResponse.json({ success: true, whatsappAvailable: true, link });
  } catch (err) {
    if (err instanceof InvalidWhatsAppNumberError) {
      return NextResponse.json({
        success: true,
        whatsappAvailable: false,
        message: "Your order was saved. This shop's WhatsApp is not configured correctly, so please contact them directly.",
      });
    }
    return NextResponse.json({ success: true, whatsappAvailable: false });
  }
}

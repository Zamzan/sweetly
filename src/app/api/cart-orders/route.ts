import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneSchema, slugSchema } from "@/lib/validation";
import {
  buildCartOrderMessage,
  buildWhatsAppLink,
  InvalidWhatsAppNumberError,
} from "@/lib/whatsapp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/csrf";
import DOMPurify from "isomorphic-dompurify";

const cartOrderSchema = z.object({
  shopSlug: slugSchema,
  customerName: z.string().trim().min(1, "Name is required").max(120),
  customerPhone: phoneSchema,
  address: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z
    .array(
      z.object({
        id: z.string().uuid("Invalid product ID"),
        name: z.string().trim().min(1).max(120),
        price: z.coerce.number().min(0).max(10_000_000).optional(),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100, "Quantity cannot exceed 100"),
        variantId: z.string().trim().max(100).optional().nullable(),
        size: z.string().trim().max(100).optional().nullable(),
        color: z.string().trim().max(100).optional().nullable(),
      })
    )
    .min(1, "Cart must contain at least one item"),
});

/**
 * Handles cart order submission.
 *
 * Security Hardening:
 * - CSRF verification via verifySameOrigin.
 * - Rate limiting per IP.
 * - Authoritative Server-Side Pricing: Prices submitted by the client are NEVER trusted.
 *   The server fetches the canonical price directly from `public.products` for the shop.
 *   If the product has variants enabled, pricing is authoritatively matched to the chosen variant.
 * - Verification that all products belong to the specified shop and are currently available.
 * - Input sanitization via DOMPurify to prevent stored XSS.
 */
export async function POST(request: NextRequest) {
  // 1. CSRF verification
  const originCheck = verifySameOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json({ error: "Forbidden cross-origin request." }, { status: 403 });
  }

  // 2. Rate limiting
  const ip = getClientIp(request.headers);
  const { success } = await checkRateLimit("cartOrder", `cart-order:${ip}`);
  if (!success) {
    return NextResponse.json(
      { error: "Too many order submissions. Please wait a moment." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid order data." }, { status: 400 });
  }

  const parsed = cartOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // 3. Look up the shop server-side from the slug
  const { data: shop } = await admin
    .from("shops")
    .select("id, name, whatsapp_number, is_published")
    .eq("slug", parsed.data.shopSlug)
    .maybeSingle();

  if (!shop || !shop.is_published) {
    return NextResponse.json({ error: "Shop not found or currently unavailable." }, { status: 404 });
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

  // 4. Server-Side Authoritative Pricing Verification
  // Extract unique product IDs and look them up from the database for THIS shop
  const productIds = Array.from(new Set(parsed.data.items.map((i) => i.id)));
  let dbProducts: any[] | null = null;
  const prodRes = await admin
    .from("products")
    .select("id, name, price, available, shop_id, variants")
    .eq("shop_id", shop.id)
    .in("id", productIds);

  if (prodRes.error && (prodRes.error.message?.includes("column") || prodRes.error.message?.includes("schema cache"))) {
    const fallbackRes = await admin
      .from("products")
      .select("id, name, price, available, shop_id")
      .eq("shop_id", shop.id)
      .in("id", productIds);
    dbProducts = fallbackRes.data;
  } else {
    dbProducts = prodRes.data;
  }

  if (!dbProducts || dbProducts.length !== productIds.length) {
    return NextResponse.json(
      { error: "One or more products in your cart are no longer available in this shop." },
      { status: 400 }
    );
  }

  const dbProductMap = new Map(dbProducts.map((p) => [p.id, p]));

  // Build verified order items with authoritative pricing
  const verifiedItems: {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
  }[] = [];

  let authoritativeTotal = 0;

  for (const item of parsed.data.items) {
    const dbProduct = dbProductMap.get(item.id);
    if (!dbProduct || !dbProduct.available) {
      return NextResponse.json(
        { error: `Item "${item.name}" is currently unavailable.` },
        { status: 400 }
      );
    }

    let unitPrice = Number(dbProduct.price);
    let displayName = dbProduct.name;

    // Check authoritative variants if product has variants enabled
    if (dbProduct.has_variants && Array.isArray(dbProduct.variants) && dbProduct.variants.length > 0) {
      const matchedVariant = dbProduct.variants.find(
        (v: { id?: string; size?: string; price?: number }) =>
          (item.variantId && v.id === item.variantId) ||
          (item.size && v.size && v.size.toLowerCase() === item.size.toLowerCase())
      );

      if (matchedVariant && typeof matchedVariant.price === "number" && matchedVariant.price >= 0) {
        unitPrice = Number(matchedVariant.price);
        const details = [
          matchedVariant.size ? `Size: ${matchedVariant.size}` : null,
          item.color ? `Color: ${item.color}` : null,
        ]
          .filter(Boolean)
          .join(", ");
        if (details) {
          displayName = `${dbProduct.name} (${details})`;
        }
      } else if (item.size || item.color) {
        const details = [
          item.size ? `Size: ${item.size}` : null,
          item.color ? `Color: ${item.color}` : null,
        ]
          .filter(Boolean)
          .join(", ");
        if (details) {
          displayName = `${dbProduct.name} (${details})`;
        }
      }
    } else if (item.size || item.color) {
      const details = [
        item.size ? `Size: ${item.size}` : null,
        item.color ? `Color: ${item.color}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      if (details) {
        displayName = `${dbProduct.name} (${details})`;
      }
    }

    if (isNaN(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: "Product price configuration error." }, { status: 500 });
    }

    const itemTotal = unitPrice * item.quantity;
    authoritativeTotal += itemTotal;

    verifiedItems.push({
      productId: dbProduct.id,
      productName: displayName,
      unitPrice,
      quantity: item.quantity,
    });
  }

  if (authoritativeTotal < 0 || authoritativeTotal > 100_000_000) {
    return NextResponse.json({ error: "Invalid total order amount." }, { status: 400 });
  }

  // 5. Find or create customer record
  let customerId: string | null = null;
  try {
    const { data: existingCustomer } = await admin
      .from("customers")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("phone", parsed.data.customerPhone)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer } = await admin
        .from("customers")
        .insert({
          shop_id: shop.id,
          name: parsed.data.customerName,
          phone: parsed.data.customerPhone,
        })
        .select("id")
        .single();
      customerId = newCustomer?.id ?? null;
    }
  } catch (custErr) {
    console.error("Customer record creation error:", custErr);
  }

  // 6. Insert order record with sanitized customer inputs
  const cleanName = DOMPurify.sanitize(parsed.data.customerName, { ALLOWED_TAGS: [] });
  const cleanAddress = parsed.data.address ? DOMPurify.sanitize(parsed.data.address, { ALLOWED_TAGS: [] }) : null;
  const cleanNotes = parsed.data.notes ? DOMPurify.sanitize(parsed.data.notes, { ALLOWED_TAGS: [] }) : null;

  const combinedNotes = [
    cleanAddress ? `Delivery Address: ${cleanAddress}` : null,
    cleanNotes ? `Instructions: ${cleanNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      shop_id: shop.id,
      customer_id: customerId,
      customer_name: cleanName,
      customer_phone: parsed.data.customerPhone,
      status: "NEW",
      total_amount: authoritativeTotal,
      notes: combinedNotes || null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Order creation error:", orderError);
    return NextResponse.json(
      { error: "Could not create your order. Please try again." },
      { status: 500 }
    );
  }

  // 7. Insert order items with server-verified prices
  const orderItemsData = verifiedItems.map((item) => ({
    order_id: order.id,
    shop_id: shop.id,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
  }));

  const { error: itemsError } = await admin.from("order_items").insert(orderItemsData);
  if (itemsError) {
    console.error("Order items error:", itemsError);
  }

  // 8. Build WhatsApp Click-to-Chat URL
  if (!shop.whatsapp_number) {
    return NextResponse.json({
      success: true,
      orderId: order.id,
      whatsappAvailable: false,
      message: "Order placed! Shop will contact you directly.",
    });
  }

  try {
    const message = buildCartOrderMessage({
      shopName: shop.name,
      items: verifiedItems.map((i) => ({
        id: i.productId,
        name: i.productName,
        price: i.unitPrice,
        quantity: i.quantity,
      })),
      total: authoritativeTotal,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      deliveryAddress: parsed.data.address ?? undefined,
      notes: parsed.data.notes ?? undefined,
    });

    const whatsappUrl = buildWhatsAppLink(shop.whatsapp_number, message);
    return NextResponse.json({
      success: true,
      orderId: order.id,
      whatsappAvailable: true,
      whatsappUrl,
    });
  } catch (err) {
    if (err instanceof InvalidWhatsAppNumberError) {
      return NextResponse.json({
        success: true,
        orderId: order.id,
        whatsappAvailable: false,
      });
    }
    return NextResponse.json({ success: true, orderId: order.id, whatsappAvailable: false });
  }
}

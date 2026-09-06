import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWhatsAppLink, InvalidWhatsAppNumberError } from "@/lib/whatsapp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { slugSchema } from "@/lib/validation";
import { verifySameOrigin } from "@/lib/csrf";

const bodySchema = z.object({
  shopSlug: slugSchema,
  productName: z.string().trim().min(1).max(120),
  price: z.coerce.number().min(0).max(1_000_000),
});

/**
 * Returns a wa.me link for a quick "Order on WhatsApp" click from a
 * product page.
 */
export async function POST(request: NextRequest) {
  // CSRF verification
  const originCheck = verifySameOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json({ error: "Forbidden cross-origin request." }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const { success } = await checkRateLimit("publicOrder", `wa-link:${ip}`);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: shop } = await admin
    .from("shops")
    .select("name, whatsapp_number, is_published")
    .eq("slug", parsed.data.shopSlug)
    .maybeSingle();

  if (!shop || !shop.is_published) {
    return NextResponse.json({ error: "Shop not found." }, { status: 404 });
  }
  if (!shop.whatsapp_number) {
    return NextResponse.json(
      { error: "This shop hasn't configured WhatsApp ordering yet." },
      { status: 422 }
    );
  }

  const message = [
    "Hi! I'd like to order from Sweetly:",
    "",
    `Shop: ${shop.name}`,
    `Product: ${parsed.data.productName}`,
    `Price: Rs. ${parsed.data.price}`,
    "",
    "Please let me know how to proceed.",
  ].join("\n");

  try {
    const link = buildWhatsAppLink(shop.whatsapp_number, message);
    return NextResponse.json({ link });
  } catch (err) {
    if (err instanceof InvalidWhatsAppNumberError) {
      return NextResponse.json(
        { error: "This shop's WhatsApp number is not configured correctly." },
        { status: 422 }
      );
    }
    // Never leak internal error details to the client (spec #33).
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

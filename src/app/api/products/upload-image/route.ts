import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/csrf";

function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

/**
 * Uploads a product image for the CURRENT user's shop only.
 */
export async function POST(request: NextRequest) {
  // CSRF verification
  const originCheck = verifySameOrigin(request);
  if (!originCheck.valid) {
    return NextResponse.json({ error: "Forbidden cross-origin request." }, { status: 403 });
  }

  const ip = getClientIp(request.headers);
  const { success } = await checkRateLimit("imageUpload", `upload:${ip}`);
  if (!success) {
    return NextResponse.json({ error: "Too many uploads. Please slow down." }, { status: 429 });
  }

  const { shop, role, permissions } = await getCurrentShopOrRedirect();
  if (role !== "OWNER" && !permissions.products) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");
  const productId = formData?.get("productId");

  if (!(file instanceof File) || typeof productId !== "string") {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Ownership check: this product must belong to the caller's shop.
  // RLS enforces this on the DB write too, but checking explicitly
  // lets us return a clean 403 instead of a generic DB error.
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "Product not found in your shop." }, { status: 404 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image exceeds the 5MB limit." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPG, PNG, or WebP images are allowed." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(bytes);
  if (!sniffed || sniffed !== file.type) {
    return NextResponse.json({ error: "This file is not a valid image." }, { status: 400 });
  }

  const ext = sniffed.split("/")[1];
  const path = `shops/${shop.id}/products/${productId}/${crypto.randomUUID()}.${ext}`;

  // Uploading as the logged-in user (not the admin client) so the
  // storage RLS policy "members can upload to own shop folder" is
  // the thing actually enforcing this, not just app-level logic.
  const { error: uploadError } = await supabase.storage
    .from("shop-assets")
    .upload(path, bytes, { contentType: sniffed, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  const { error: dbError } = await supabase.from("product_images").insert({
    product_id: productId,
    shop_id: shop.id,
    storage_path: path,
  });

  if (dbError) {
    return NextResponse.json({ error: "Upload saved but could not be linked. Try again." }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from("shop-assets").getPublicUrl(path);
  return NextResponse.json({ success: true, url: publicUrl.publicUrl });
}

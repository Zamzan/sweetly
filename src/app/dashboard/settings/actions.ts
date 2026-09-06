"use server";

import { revalidatePath } from "next/cache";
import DOMPurify from "isomorphic-dompurify";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { shopSettingsSchema, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "@/lib/validation";
import { safeLogAudit } from "@/lib/audit";
import { sniffImageType, getPublicAssetUrl } from "@/lib/images";

export async function updateShopSettingsAction(formData: FormData) {
  const { shop, user, role } = await getCurrentShopOrRedirect();
  if (role !== "OWNER") {
    return { error: "Only the shop owner can change storefront settings." };
  }

  const rawName = formData.get("name");
  const rawDescription = formData.get("description");
  const rawWhatsapp = formData.get("whatsappNumber");
  const rawPhone = formData.get("phone");
  const rawAddress = formData.get("address");
  const rawCity = formData.get("city");
  const rawState = formData.get("state");
  const rawPincode = formData.get("pincode");
  const rawMapsUrl = formData.get("googleMapsUrl");
  const rawCustomEnabled = formData.get("customOrderEnabled");
  const rawCustomButton = formData.get("customOrderButtonText");
  const rawCustomTitle = formData.get("customOrderTitle");
  const rawCustomDesc = formData.get("customOrderDescription");

  const parsed = shopSettingsSchema.safeParse({
    name: rawName,
    description: rawDescription,
    whatsappNumber: rawWhatsapp,
    phone: rawPhone,
    address: rawAddress,
    city: rawCity,
    state: rawState,
    pincode: rawPincode,
    googleMapsUrl: rawMapsUrl,
    customOrderEnabled: rawCustomEnabled === "on" || rawCustomEnabled === "true",
    customOrderButtonText: rawCustomButton,
    customOrderTitle: rawCustomTitle,
    customOrderDescription: rawCustomDesc,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid settings.";
    return { error: msg };
  }

  const description = parsed.data.description
    ? DOMPurify.sanitize(parsed.data.description, { ALLOWED_TAGS: [] })
    : null;

  const admin = createAdminClient();

  // Fetch current theme to preserve existing theme data while adding customizations
  const { data: currentShopData } = await admin
    .from("shops")
    .select("theme, logo_url, cover_image_url")
    .eq("id", shop.id)
    .single();

  const currentTheme = (currentShopData?.theme && typeof currentShopData.theme === "object")
    ? currentShopData.theme
    : {};

  const updatedTheme = {
    ...currentTheme,
    primary_color: formData.get("primaryColor")?.toString().trim() || currentTheme.primary_color || "#ec4899",
    accent_color: formData.get("accentColor")?.toString().trim() || currentTheme.accent_color || "#f43f5e",
    theme_style: formData.get("themeStyle")?.toString().trim() || currentTheme.theme_style || "modern",
    banner_style: formData.get("bannerStyle")?.toString().trim() || currentTheme.banner_style || "gradient",
    google_maps_url: parsed.data.googleMapsUrl ?? null,
    custom_order_enabled: parsed.data.customOrderEnabled,
    custom_order_button_text: parsed.data.customOrderButtonText ?? "Order Custom",
    custom_order_title: parsed.data.customOrderTitle ?? null,
    custom_order_description: parsed.data.customOrderDescription ?? null,
  };

  let logoUrl = currentShopData?.logo_url ?? null;
  let coverImageUrl = currentShopData?.cover_image_url ?? null;

  // Handle Logo Upload if provided
  const logoFile = formData.get("logo");
  if (logoFile && logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size <= MAX_IMAGE_BYTES) {
      try {
        const bytes = new Uint8Array(await logoFile.arrayBuffer());
        const sniffed = sniffImageType(bytes);
        if (sniffed && ALLOWED_IMAGE_MIME_TYPES.includes(sniffed)) {
          const ext = sniffed.split("/")[1] || "png";
          const path = `shops/${shop.id}/logo/${Date.now()}.${ext}`;
          const { error: uploadErr } = await admin.storage
            .from("shop-assets")
            .upload(path, bytes, { contentType: sniffed, upsert: true });

          if (!uploadErr) {
            logoUrl = getPublicAssetUrl(path);
          } else {
            console.error("Logo upload storage error:", uploadErr);
          }
        }
      } catch (err) {
        console.error("Failed uploading logo:", err);
      }
    }
  }

  // Handle Cover Banner Upload if provided
  const coverFile = formData.get("coverImage");
  if (coverFile && coverFile instanceof File && coverFile.size > 0) {
    if (coverFile.size <= MAX_IMAGE_BYTES) {
      try {
        const bytes = new Uint8Array(await coverFile.arrayBuffer());
        const sniffed = sniffImageType(bytes);
        if (sniffed && ALLOWED_IMAGE_MIME_TYPES.includes(sniffed)) {
          const ext = sniffed.split("/")[1] || "jpg";
          const path = `shops/${shop.id}/cover/${Date.now()}.${ext}`;
          const { error: uploadErr } = await admin.storage
            .from("shop-assets")
            .upload(path, bytes, { contentType: sniffed, upsert: true });

          if (!uploadErr) {
            coverImageUrl = getPublicAssetUrl(path);
          } else {
            console.error("Cover upload storage error:", uploadErr);
          }
        }
      } catch (err) {
        console.error("Failed uploading cover:", err);
      }
    }
  }

  const { data: updatedShop, error: updateError } = await admin
    .from("shops")
    .update({
      name: parsed.data.name,
      description,
      whatsapp_number: parsed.data.whatsappNumber,
      phone: parsed.data.phone,
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state,
      pincode: parsed.data.pincode,
      theme: updatedTheme,
      logo_url: logoUrl,
      cover_image_url: coverImageUrl,
    })
    .eq("id", shop.id)
    .select("id, name, slug, description, whatsapp_number, phone, address, city, state, pincode, theme, logo_url, cover_image_url, is_published")
    .single();

  if (updateError) {
    console.error("Error updating shop settings:", updateError);
    return { error: updateError.message || "Could not save settings. Please try again." };
  }

  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: "settings.update",
    targetType: "shop",
    targetId: shop.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath(`/${shop.slug}`);
  revalidatePath(`/${shop.slug}/products`);
  return { success: true, shop: updatedShop };
}

export async function togglePublishAction(publish: boolean) {
  const { shop, user, role } = await getCurrentShopOrRedirect();
  if (role !== "OWNER") return { error: "Only the owner can publish/unpublish the storefront." };

  const admin = createAdminClient();
  const { data: updatedShop, error } = await admin
    .from("shops")
    .update({ is_published: publish })
    .eq("id", shop.id)
    .select("id, name, slug, is_published")
    .single();

  if (error) {
    console.error("Publish toggle error:", error);
    return { error: error.message || "Could not update publish state." };
  }

  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: publish ? "shop.publish" : "shop.unpublish",
    targetType: "shop",
    targetId: shop.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath(`/${shop.slug}`);
  revalidatePath(`/${shop.slug}/products`);
  return { success: true, isPublished: publish, shop: updatedShop };
}

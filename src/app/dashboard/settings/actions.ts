"use server";

import { revalidatePath } from "next/cache";
import DOMPurify from "isomorphic-dompurify";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentShop, getCurrentShopOrRedirect } from "@/lib/current-shop";
import { shopSettingsSchema, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "@/lib/validation";
import { safeLogAudit } from "@/lib/audit";
import { sniffImageType, getPublicAssetUrl } from "@/lib/images";

export async function updateShopSettingsAction(formData: FormData) {
  try {
    const session = await getCurrentShop();
    if (!session) {
      return { error: "Your session has expired. Please log in again." };
    }
    const { shop, user, role } = session;
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

  const supabase = await createServerSupabaseClient();

  // Helper to obtain admin client if available, else null
  const getAdminOrNull = () => {
    try {
      return createAdminClient();
    } catch {
      return null;
    }
  };

  const adminClient = getAdminOrNull();
  const dbClient = adminClient || supabase;

  // Fetch current theme to preserve existing theme data while adding customizations
  const { data: currentShopData } = await dbClient
    .from("shops")
    .select("theme, logo_url, cover_image_url")
    .eq("id", shop.id)
    .maybeSingle();

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
          const storageClient = adminClient || supabase;
          const { error: uploadErr } = await storageClient.storage
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
          const storageClient = adminClient || supabase;
          const { error: uploadErr } = await storageClient.storage
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

  const updatePayload = {
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
  };

  let updatedShop: any = null;
  let updateError: any = null;

  // Try updating via supabase authenticated client first
  const { data: userUpdated, error: userError } = await supabase
    .from("shops")
    .update(updatePayload)
    .eq("id", shop.id)
    .select("id, name, slug, description, whatsapp_number, phone, address, city, state, pincode, theme, logo_url, cover_image_url, is_published")
    .maybeSingle();

  if (!userError && userUpdated) {
    updatedShop = userUpdated;
  } else if (adminClient) {
    const { data: adminUpdated, error: adminErr } = await adminClient
      .from("shops")
      .update(updatePayload)
      .eq("id", shop.id)
      .select("id, name, slug, description, whatsapp_number, phone, address, city, state, pincode, theme, logo_url, cover_image_url, is_published")
      .maybeSingle();
    if (!adminErr && adminUpdated) {
      updatedShop = adminUpdated;
    } else {
      updateError = adminErr || userError;
    }
  } else {
    updateError = userError;
  }

  if (updateError || !updatedShop) {
    console.error("Error updating shop settings:", updateError);
    return { error: updateError?.message || "Could not save settings. Please try again." };
  }

  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: "settings.update",
    targetType: "shop",
    targetId: shop.id,
  });

  try {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    revalidatePath(`/${shop.slug}`, "layout");
    revalidatePath(`/${shop.slug}`, "page");
    revalidatePath(`/${shop.slug}/products`, "page");
  } catch {}

  return { success: true, shop: updatedShop };
  } catch (err: any) {
    console.error("updateShopSettingsAction fatal error:", err);
    return { error: err?.message || "Failed to update settings. Please try again." };
  }
}

export async function togglePublishAction(publish: boolean) {
  try {
    const session = await getCurrentShop();
    if (!session) {
      return { error: "Your session has expired. Please refresh and log in again." };
    }
    const { shop, user, role } = session;
    if (role !== "OWNER") {
      return { error: "Only the shop owner can publish/unpublish the storefront." };
    }

    const supabase = await createServerSupabaseClient();
    let updatedShop: any = null;
    let updateError: any = null;

    // 1. Try updating as authenticated user (RLS permits owner to update own shop)
    const { data: userUpdated, error: userError } = await supabase
      .from("shops")
      .update({ is_published: publish })
      .eq("id", shop.id)
      .select("id, name, slug, is_published")
      .maybeSingle();

    if (!userError && userUpdated) {
      updatedShop = userUpdated;
    } else {
      // 2. Fallback to admin client if service role is available
      try {
        const admin = createAdminClient();
        const { data: adminUpdated, error: adminErr } = await admin
          .from("shops")
          .update({ is_published: publish })
          .eq("id", shop.id)
          .select("id, name, slug, is_published")
          .maybeSingle();

        if (!adminErr && adminUpdated) {
          updatedShop = adminUpdated;
        } else {
          updateError = adminErr || userError;
        }
      } catch {
        updateError = userError;
      }
    }

    if (updateError || !updatedShop) {
      console.error("Publish toggle error:", updateError);
      return { error: updateError?.message || "Could not update publish state." };
    }

    await safeLogAudit({
      shopId: shop.id,
      actorId: user.id,
      action: publish ? "shop.publish" : "shop.unpublish",
      targetType: "shop",
      targetId: shop.id,
    });

    try {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/settings");
      revalidatePath(`/${shop.slug}`);
      revalidatePath(`/${shop.slug}/products`);
    } catch {}

    return { success: true, isPublished: publish, shop: updatedShop };
  } catch (err: any) {
    console.error("togglePublishAction fatal error:", err);
    return { error: err?.message || "Failed to update publish state. Please try again." };
  }
}

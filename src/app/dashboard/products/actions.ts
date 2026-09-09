"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentShop, getCurrentShopOrRedirect } from "@/lib/current-shop";
import { productSchema, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "@/lib/validation";
import { safeLogAudit } from "@/lib/audit";
import { sniffImageType } from "@/lib/images";
import DOMPurify from "isomorphic-dompurify";

function cleanSlug(input: string): string {
  let slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug || slug.length < 2) {
    slug = `item-${Date.now().toString(36)}`;
  }
  return slug.slice(0, 50).replace(/-+$/, "");
}

export async function createProductAction(formData: FormData) {
  try {
    const session = await getCurrentShop();
    if (!session) {
      return { error: "Your session has expired. Please refresh and log in again." };
    }
    const { shop, user, role, permissions } = session;

    if (role !== "OWNER" && !permissions?.products) {
      return { error: "You don't have permission to manage products." };
    }

    const rawName = formData.get("name");
    const rawPrice = formData.get("price");
    const rawCategoryId = formData.get("categoryId");
    const rawDescription = formData.get("description");

    const parsed = productSchema.safeParse({
      name: rawName,
      description: rawDescription,
      price: rawPrice,
      categoryId: rawCategoryId || null,
      available: formData.get("available") === "on" || formData.get("available") === "true",
      featured: formData.get("featured") === "on" || formData.get("featured") === "true",
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid product data." };
    }

    const supabase = await createServerSupabaseClient();
    const baseSlug = cleanSlug(parsed.data.name);
    const slug = `${baseSlug}-${Date.now().toString(36).slice(-5)}`;

    const cleanName = DOMPurify.sanitize(parsed.data.name, { ALLOWED_TAGS: [] });
    const cleanDescription = parsed.data.description
      ? DOMPurify.sanitize(parsed.data.description, { ALLOWED_TAGS: [] })
      : null;

  const rawSectionId = formData.get("sectionId")?.toString().trim();
  const sectionId = rawSectionId && rawSectionId !== "none" ? rawSectionId : null;

  // 1. Parse Multi-Categories / Occasions
  let categories: string[] = [];
  const rawCategories = formData.get("categories")?.toString();
  if (rawCategories) {
    try {
      const parsedCat = JSON.parse(rawCategories);
      if (Array.isArray(parsedCat)) {
        categories = parsedCat
          .map((c) => DOMPurify.sanitize(String(c).trim(), { ALLOWED_TAGS: [] }))
          .filter(Boolean);
      }
    } catch {
      categories = rawCategories.split(",").map((c) => c.trim()).filter(Boolean);
    }
  }

  let categoryIds: string[] = [];
  const rawCategoryIds = formData.get("categoryIds")?.toString();
  if (rawCategoryIds) {
    try {
      const parsedIds = JSON.parse(rawCategoryIds);
      if (Array.isArray(parsedIds)) {
        categoryIds = parsedIds.map((id) => String(id).trim()).filter(Boolean);
      }
    } catch {
      categoryIds = rawCategoryIds.split(",").map((id) => id.trim()).filter(Boolean);
    }
  }
  if (parsed.data.categoryId && !categoryIds.includes(parsed.data.categoryId)) {
    categoryIds.unshift(parsed.data.categoryId);
  }

  // 2. Parse Multi-Sections
  let sectionIds: string[] = [];
  const rawSectionIds = formData.get("sectionIds")?.toString();
  if (rawSectionIds) {
    try {
      const parsedSec = JSON.parse(rawSectionIds);
      if (Array.isArray(parsedSec)) {
        sectionIds = parsedSec.map((id) => String(id).trim()).filter(Boolean);
      }
    } catch {
      sectionIds = rawSectionIds.split(",").map((id) => id.trim()).filter(Boolean);
    }
  }
  if (sectionId && !sectionIds.includes(sectionId)) {
    sectionIds.unshift(sectionId);
  }

  const hasVariants = formData.get("hasVariants") === "true" || formData.get("hasVariants") === "on";
  let variants: Array<{ id: string; name: string; size?: string; color?: string; price: number; available?: boolean }> = [];
  let sizes: string[] = [];
  let colors: string[] = [];

  if (hasVariants) {
    const rawVariants = formData.get("variants")?.toString();
    if (rawVariants) {
      try {
        const parsedV = JSON.parse(rawVariants);
        if (Array.isArray(parsedV)) {
          variants = parsedV.map((v, idx) => ({
            id: v.id || `v-${idx + 1}-${Date.now().toString(36)}`,
            name: DOMPurify.sanitize(String(v.name || "").trim(), { ALLOWED_TAGS: [] }),
            size: v.size ? DOMPurify.sanitize(String(v.size).trim(), { ALLOWED_TAGS: [] }) : undefined,
            color: v.color ? DOMPurify.sanitize(String(v.color).trim(), { ALLOWED_TAGS: [] }) : undefined,
            price: Number(v.price) > 0 ? Number(v.price) : parsed.data.price,
            available: v.available !== false,
          }));

          sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean) as string[]));
          colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean) as string[]));
        }
      } catch {
        // Fallback to empty variants
      }
    }
  }

  // If variants exist, embed them in description so they are preserved across any DB schema level
  const finalDescription = variants.length > 0
    ? `${cleanDescription || ""}\n\n<!--sweetly_variants:${JSON.stringify(variants)}-->`.trim()
    : cleanDescription;

  // Base insert payload compatible with initial schema
  const baseInsert: Record<string, any> = {
    shop_id: shop.id,
    category_id: parsed.data.categoryId || categoryIds[0] || null,
    section_id: sectionId || sectionIds[0] || null,
    name: cleanName,
    slug,
    description: finalDescription,
    price: parsed.data.price,
    available: parsed.data.available,
    featured: parsed.data.featured,
    has_variants: hasVariants,
    variants,
  };

  // Full insert payload with extended columns
  const fullInsert: Record<string, any> = {
    ...baseInsert,
    sizes,
    colors,
    categories,
    category_ids: categoryIds,
    section_ids: sectionIds,
  };

  let product: { id: string } | null = null;
  let insertError: any = null;

  const res = await supabase.from("products").insert(fullInsert).select("id").single();
  if (res.error) {
    const msg = res.error.message || "";
    if (msg.includes("column") || msg.includes("schema cache")) {
      console.warn("Product insert Level 1 failed, retrying without extended arrays:", msg);
      const level2 = {
        shop_id: shop.id,
        category_id: parsed.data.categoryId || categoryIds[0] || null,
        name: cleanName,
        slug,
        description: finalDescription,
        price: parsed.data.price,
        available: parsed.data.available,
        featured: parsed.data.featured,
        variants,
      };
      const retry2 = await supabase.from("products").insert(level2).select("id").single();
      if (retry2.error && (retry2.error.message?.includes("column") || retry2.error.message?.includes("schema cache"))) {
        console.warn("Product insert Level 2 failed, retrying with core schema:", retry2.error.message);
        const coreInsert = {
          shop_id: shop.id,
          category_id: parsed.data.categoryId || null,
          name: cleanName,
          slug,
          description: finalDescription,
          price: parsed.data.price,
          available: parsed.data.available,
          featured: parsed.data.featured,
        };
        const retry3 = await supabase.from("products").insert(coreInsert).select("id").single();
        product = retry3.data;
        insertError = retry3.error;
      } else {
        product = retry2.data;
        insertError = retry2.error;
      }
    } else {
      insertError = res.error;
    }
  } else {
    product = res.data;
  }

  if (insertError || !product) {
    console.error("Product insert error:", insertError);
    return { error: insertError?.message ?? "Could not create product. Please try again." };
  }

  // Handle up to 5 product images
  const candidateFiles = formData.getAll("images").filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (candidateFiles.length === 0) {
    const single = formData.get("image");
    if (single instanceof File && single.size > 0) {
      candidateFiles.push(single);
    }
  }

  const filesToUpload = candidateFiles.slice(0, 5);
  const admin = createAdminClient();

  for (let idx = 0; idx < filesToUpload.length; idx++) {
    const file = filesToUpload[idx]!;
    if (file.size > MAX_IMAGE_BYTES) continue;
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) continue;

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const sniffed = sniffImageType(bytes);
      if (sniffed) {
        const ext = sniffed.split("/")[1] || "jpg";
        const storagePath = `shops/${shop.id}/products/${product.id}/${idx}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

        const { error: uploadError } = await admin.storage
          .from("shop-assets")
          .upload(storagePath, bytes, { contentType: sniffed, upsert: true });

        if (!uploadError) {
          await admin.from("product_images").insert({
            product_id: product.id,
            shop_id: shop.id,
            storage_path: storagePath,
            sort_order: idx,
          });
        } else {
          console.error("Image upload error:", uploadError);
        }
      }
    } catch (imgErr) {
      console.error("Failed processing product image:", imgErr);
    }
  }

  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: "product.create",
    targetType: "product",
    targetId: product.id,
  });

  try {
    revalidatePath("/dashboard/products");
    revalidatePath(`/${shop.slug}`);
    revalidatePath(`/${shop.slug}/products`);
  } catch (e) {
    console.warn("revalidatePath warning:", e);
  }

  return { success: true };
  } catch (err: any) {
    console.error("createProductAction fatal error:", err);
    return { error: err?.message || "An unexpected error occurred while creating product." };
  }
}

export async function updateProductAction(productId: string, formData: FormData) {
  try {
    const session = await getCurrentShop();
    if (!session) {
      return { error: "Your session has expired. Please refresh and log in again." };
    }
    const { shop, user, role, permissions } = session;
    if (role !== "OWNER" && !permissions?.products) {
      return { error: "You don't have permission to manage products." };
    }

  const updates: Record<string, unknown> = {};

  if (formData.has("name")) {
    const rawName = formData.get("name")?.toString().trim();
    if (rawName) updates.name = DOMPurify.sanitize(rawName, { ALLOWED_TAGS: [] });
  }
  if (formData.has("price")) {
    const rawPrice = Number(formData.get("price"));
    if (!isNaN(rawPrice) && rawPrice >= 0 && rawPrice <= 10_000_000) updates.price = rawPrice;
  }
  if (formData.has("description")) {
    const rawDesc = formData.get("description")?.toString().trim();
    updates.description = rawDesc ? DOMPurify.sanitize(rawDesc, { ALLOWED_TAGS: [] }) : null;
  }
  if (formData.has("categoryId")) {
    const cat = formData.get("categoryId")?.toString().trim();
    updates.category_id = !cat || cat === "none" ? null : cat;
  }
  if (formData.has("sectionId")) {
    const sec = formData.get("sectionId")?.toString().trim();
    updates.section_id = !sec || sec === "none" ? null : sec;
  }
  if (formData.has("available")) {
    updates.available = formData.get("available") === "on" || formData.get("available") === "true";
  }
  if (formData.has("featured")) {
    updates.featured = formData.get("featured") === "on" || formData.get("featured") === "true";
  }

  if (formData.has("categories")) {
    try {
      const parsedCat = JSON.parse(formData.get("categories")?.toString() || "[]");
      if (Array.isArray(parsedCat)) {
        updates.categories = parsedCat
          .map((c) => DOMPurify.sanitize(String(c).trim(), { ALLOWED_TAGS: [] }))
          .filter(Boolean);
      }
    } catch {
      updates.categories = (formData.get("categories")?.toString() || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    }
  }

  if (formData.has("categoryIds")) {
    try {
      const parsedIds = JSON.parse(formData.get("categoryIds")?.toString() || "[]");
      if (Array.isArray(parsedIds)) {
        updates.category_ids = parsedIds.map((id) => String(id).trim()).filter(Boolean);
      }
    } catch {}
  }

  if (formData.has("sectionIds")) {
    try {
      const parsedSec = JSON.parse(formData.get("sectionIds")?.toString() || "[]");
      if (Array.isArray(parsedSec)) {
        updates.section_ids = parsedSec.map((id) => String(id).trim()).filter(Boolean);
      }
    } catch {}
  }

  if (formData.has("hasVariants")) {
    const hasV = formData.get("hasVariants") === "true" || formData.get("hasVariants") === "on";
    updates.has_variants = hasV;

    if (hasV && formData.has("variants")) {
      try {
        const parsedV = JSON.parse(formData.get("variants")?.toString() || "[]");
        if (Array.isArray(parsedV)) {
          const variants = parsedV.map((v, idx) => ({
            id: v.id || `v-${idx + 1}-${Date.now().toString(36)}`,
            name: DOMPurify.sanitize(String(v.name || "").trim(), { ALLOWED_TAGS: [] }),
            size: v.size ? DOMPurify.sanitize(String(v.size).trim(), { ALLOWED_TAGS: [] }) : undefined,
            color: v.color ? DOMPurify.sanitize(String(v.color).trim(), { ALLOWED_TAGS: [] }) : undefined,
            price: Number(v.price) > 0 ? Number(v.price) : Number(updates.price || 0),
            available: v.available !== false,
          }));
          updates.variants = variants;
          updates.sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean) as string[]));
          updates.colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean) as string[]));

          // Embed in description so variants are retained even on core DB schema
          const baseDesc = (updates.description !== undefined ? updates.description : "") as string;
          updates.description = `${baseDesc || ""}\n\n<!--sweetly_variants:${JSON.stringify(variants)}-->`.trim();
        }
      } catch {
        // Ignore parse errors
      }
    } else if (!hasV) {
      updates.variants = [];
      updates.sizes = [];
      updates.colors = [];
    }
  }

  const supabase = await createServerSupabaseClient();
  let { error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", productId)
    .eq("shop_id", shop.id);

  if (error) {
    const msg = error.message || "";
    if (msg.includes("column") || msg.includes("schema cache")) {
      console.warn("Product update retrying without extended columns due to PostgREST schema cache:", msg);
      const safeUpdates = { ...updates };
      delete safeUpdates.colors;
      delete safeUpdates.sizes;
      delete safeUpdates.categories;
      delete safeUpdates.category_ids;
      delete safeUpdates.section_ids;
      delete safeUpdates.section_id;
      delete safeUpdates.has_variants;

      const retry = await supabase
        .from("products")
        .update(safeUpdates)
        .eq("id", productId)
        .eq("shop_id", shop.id);

      if (retry.error && (retry.error.message?.includes("column") || retry.error.message?.includes("schema cache"))) {
        delete safeUpdates.variants;
        const retryCore = await supabase
          .from("products")
          .update(safeUpdates)
          .eq("id", productId)
          .eq("shop_id", shop.id);
        error = retryCore.error;
      } else {
        error = retry.error;
      }
    }
  }

  if (error) {
    console.error("Product update error:", error);
    return { error: error.message ?? "Could not update product." };
  }

  // Handle multi-image upload if provided
  const candidateFiles = formData.getAll("images").filter(
    (f): f is File => f instanceof File && f.size > 0
  );
  if (candidateFiles.length === 0) {
    const single = formData.get("image");
    if (single instanceof File && single.size > 0) {
      candidateFiles.push(single);
    }
  }

  if (candidateFiles.length > 0) {
    const filesToUpload = candidateFiles.slice(0, 5);
    const admin = createAdminClient();

    for (let idx = 0; idx < filesToUpload.length; idx++) {
      const file = filesToUpload[idx]!;
      if (file.size > MAX_IMAGE_BYTES) continue;
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) continue;

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const sniffed = sniffImageType(bytes);
        if (sniffed) {
          const ext = sniffed.split("/")[1] || "jpg";
          const storagePath = `shops/${shop.id}/products/${productId}/${idx}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

          const { error: uploadError } = await admin.storage
            .from("shop-assets")
            .upload(storagePath, bytes, { contentType: sniffed, upsert: true });

          if (!uploadError) {
            await admin.from("product_images").insert({
              product_id: productId,
              shop_id: shop.id,
              storage_path: storagePath,
              sort_order: idx,
            });
          }
        }
      } catch (imgErr) {
        console.error("Failed updating product image:", imgErr);
      }
    }
  }

  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: "product.update",
    targetType: "product",
    targetId: productId,
  });

  try {
    revalidatePath("/dashboard/products");
    revalidatePath(`/${shop.slug}`);
    revalidatePath(`/${shop.slug}/products`);
  } catch (e) {
    console.warn("revalidatePath warning:", e);
  }

  return { success: true };
  } catch (err: any) {
    console.error("updateProductAction fatal error:", err);
    return { error: err?.message || "Failed to update product." };
  }
}

export async function deleteProductAction(productId: string) {
  try {
    const session = await getCurrentShop();
    if (!session) {
      return { error: "Your session has expired. Please refresh and log in again." };
    }
    const { shop, user, role, permissions } = session;
    if (role !== "OWNER" && !permissions?.products) {
      return { error: "You don't have permission to manage products." };
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("shop_id", shop.id);

    if (error) return { error: "Could not delete product." };

    await safeLogAudit({
      shopId: shop.id,
      actorId: user.id,
      action: "product.delete",
      targetType: "product",
      targetId: productId,
    });

    try {
      revalidatePath("/dashboard/products");
      revalidatePath(`/${shop.slug}`);
      revalidatePath(`/${shop.slug}/products`);
    } catch (e) {
      console.warn("revalidatePath warning:", e);
    }

    return { success: true };
  } catch (err: any) {
    console.error("deleteProductAction fatal error:", err);
    return { error: err?.message || "Failed to delete product." };
  }
}

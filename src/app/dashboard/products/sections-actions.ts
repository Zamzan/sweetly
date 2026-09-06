"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { safeLogAudit } from "@/lib/audit";

function cleanSectionSlug(name: string): string {
  let s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!s || s.length < 2) {
    s = `sec-${Date.now().toString(36)}`;
  }
  return s.slice(0, 50).replace(/-+$/, "");
}

export async function createSectionAction(formData: FormData) {
  const { shop, user, role, permissions } = await getCurrentShopOrRedirect();
  if (role !== "OWNER" && !permissions.products) {
    return { error: "You don't have permission to manage sections." };
  }

  const name = formData.get("name")?.toString().trim();
  if (!name || name.length < 2 || name.length > 80) {
    return { error: "Section name must be between 2 and 80 characters." };
  }

  const description = formData.get("description")?.toString().trim() || null;

  const supabase = await createServerSupabaseClient();
  const baseSlug = cleanSectionSlug(name);
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

  const { data: section, error } = await supabase
    .from("product_sections")
    .insert({
      shop_id: shop.id,
      name,
      slug,
      description,
    })
    .select("id, name, slug, description")
    .single();

  if (error) {
    console.error("Error creating section:", error);
    return { error: "Could not create section. Please try a different name." };
  }

  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: "section.create",
    targetType: "product_section",
    targetId: section.id,
  });

  revalidatePath("/dashboard/products");
  revalidatePath(`/${shop.slug}`);
  revalidatePath(`/${shop.slug}/products`);
  return { success: true, section };
}

export async function deleteSectionAction(sectionId: string) {
  const { shop, user, role, permissions } = await getCurrentShopOrRedirect();
  if (role !== "OWNER" && !permissions.products) {
    return { error: "You don't have permission to manage sections." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("product_sections")
    .delete()
    .eq("id", sectionId)
    .eq("shop_id", shop.id);

  if (error) {
    return { error: "Could not delete section." };
  }

  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: "section.delete",
    targetType: "product_section",
    targetId: sectionId,
  });

  revalidatePath("/dashboard/products");
  revalidatePath(`/${shop.slug}`);
  revalidatePath(`/${shop.slug}/products`);
  return { success: true };
}

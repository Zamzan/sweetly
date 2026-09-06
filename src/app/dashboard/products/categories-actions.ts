"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { categorySchema } from "@/lib/validation";
import { safeLogAudit } from "@/lib/audit";

function cleanCategorySlug(name: string): string {
  let s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!s || s.length < 2) {
    s = `cat-${Date.now().toString(36)}`;
  }
  return s.slice(0, 50).replace(/-+$/, "");
}

export async function createCategoryAction(formData: FormData) {
  const { shop, user, role, permissions } = await getCurrentShopOrRedirect();
  if (role !== "OWNER" && !permissions.products) {
    return { error: "You don't have permission to manage categories." };
  }

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category name." };
  }

  const supabase = await createServerSupabaseClient();
  const baseSlug = cleanCategorySlug(parsed.data.name);
  const slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;

  const { data: category, error } = await supabase
    .from("product_categories")
    .insert({
      shop_id: shop.id,
      name: parsed.data.name,
      slug,
    })
    .select("id, name, slug")
    .single();

  if (error) {
    console.error("Error creating category:", error);
    return { error: "Could not create category. Please try a different name." };
  }

  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: "category.create",
    targetType: "product_category",
    targetId: category.id,
  });

  revalidatePath("/dashboard/products");
  return { success: true, category };
}

export async function deleteCategoryAction(categoryId: string) {
  const { shop, user, role, permissions } = await getCurrentShopOrRedirect();
  if (role !== "OWNER" && !permissions.products) {
    return { error: "You don't have permission to manage categories." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", categoryId)
    .eq("shop_id", shop.id);

  if (error) {
    return { error: "Could not delete category." };
  }

  await safeLogAudit({
    shopId: shop.id,
    actorId: user.id,
    action: "category.delete",
    targetType: "product_category",
    targetId: categoryId,
  });

  revalidatePath("/dashboard/products");
  return { success: true };
}

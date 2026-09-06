"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema, slugSchema, isReservedSlug } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Finds a free, non-reserved slug by appending -1, -2, ... as needed.
 * Uses the admin client for the availability check only — no
 * sensitive data is read, just existence of a slug.
 */
async function findAvailableSlug(baseName: string): Promise<string> {
  const admin = createAdminClient();
  const base = slugify(baseName) || "shop";
  let candidate = base;
  let suffix = 0;

  // Cap attempts to avoid a pathological loop.
  for (let i = 0; i < 50; i++) {
    const parsed = slugSchema.safeParse(candidate);
    if (parsed.success && !isReservedSlug(candidate)) {
      const { data: existing } = await admin
        .from("shops")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();
      if (!existing) return candidate;
    }
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  throw new Error("Could not generate an available shop slug.");
}

export async function signupAction(
  _prevState: { error?: string; success?: boolean; message?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: boolean; message?: string }> {
  const reqHeaders = await headers();
  const ip = getClientIp(reqHeaders);
  const { success } = await checkRateLimit("signup", `signup:${ip}`);
  if (!success) {
    return { error: "Too many signup attempts. Please try again later." };
  }

  const parsed = signupSchema.safeParse({
    ownerName: formData.get("ownerName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    shopName: formData.get("shopName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { ownerName, email, phone, password, shopName } = parsed.data;
  const admin = createAdminClient();

  // Prevent 14-day trial abuse: Enforce 1 trial per mobile number across the platform
  const [{ data: existingShopByPhone }, { data: existingProfileByPhone }] = await Promise.all([
    admin
      .from("shops")
      .select("id, name")
      .or(`whatsapp_number.eq.${phone},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle(),
  ]);

  if (existingShopByPhone || existingProfileByPhone) {
    return {
      error:
        "A shop has already been registered with this mobile number. Each store receives one 14-day free trial. Please log in to your existing account or subscribe to keep your shop online.",
    };
  }

  const host = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host");
  const proto = reqHeaders.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const origin = reqHeaders.get("origin") || (host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || "");
  const redirectTo = origin ? `${origin}/auth/callback` : undefined;

  const supabase = await createServerSupabaseClient();

  // 1. Create the auth user (Supabase Auth)
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: ownerName, phone },
      emailRedirectTo: redirectTo,
    },
  });

  if (signUpError || !signUpData.user) {
    return { error: "Could not create your account. Please try again." };
  }

  // 2. Create the shop using admin client and link phone to prevent repeated trial abuse
  const slug = await findAvailableSlug(shopName);
  const { error: shopError } = await admin.from("shops").insert({
    owner_id: signUpData.user.id,
    name: shopName,
    slug,
    phone,
    whatsapp_number: phone,
  });

  if (shopError) {
    console.error("[signup] shop insert failed:", shopError);
    return { error: "Account created, but shop setup failed. Contact support." };
  }

  // If email confirmation is enabled in Supabase, session is null until verified
  if (!signUpData.session) {
    return {
      success: true,
      message: `A verification link has been sent to ${email}. Please check your inbox and click the link to activate your shop.`,
    };
  }

  redirect("/dashboard");
}

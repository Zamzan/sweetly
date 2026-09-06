"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function loginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const ip = getClientIp(await headers());
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  // Dual-factor rate limiting: by IP and by target account to defeat distributed brute-force
  const normalizedEmail = parsed.data.email.toLowerCase();
  const [ipLimit, accountLimit] = await Promise.all([
    checkRateLimit("login", `login:ip:${ip}`),
    checkRateLimit("login", `login:account:${normalizedEmail}`),
  ]);

  if (!ipLimit.success || !accountLimit.success) {
    return { error: "Too many login attempts. Please wait a minute and try again." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Generic message — never reveal whether the email exists.
    return { error: "Invalid email or password." };
  }

  redirect("/dashboard");
}

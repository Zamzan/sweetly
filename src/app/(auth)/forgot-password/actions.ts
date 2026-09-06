"use server";

import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email() });

export async function forgotPasswordAction(
  _prevState: { message?: string; error?: string } | undefined,
  formData: FormData
) {
  const ip = getClientIp(await headers());
  const { success } = await checkRateLimit("passwordReset", `reset:${ip}`);
  if (!success) {
    return { error: "Too many requests. Please try again later." };
  }

  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };

  const supabase = await createServerSupabaseClient();
  const reqHeaders = await headers();
  const host = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host");
  const proto = reqHeaders.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const origin = reqHeaders.get("origin") || (host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

  const redirectTo = `${origin}/auth/callback?next=/reset-password`;

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  // Always return the same message, whether or not the email exists,
  // to avoid leaking which emails are registered.
  return { message: "If that email is registered, a reset link has been sent." };
}

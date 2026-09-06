import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Handles Supabase email confirmation & password reset PKCE redirects.
 * Exchanges the auth authorization code for an active session.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Successfully authenticated via email verification link
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If code is missing or exchange fails, redirect to login with explanation
  return NextResponse.redirect(
    new URL("/login?error=Email+link+expired+or+invalid.+Please+try+logging+in.", requestUrl.origin)
  );
}

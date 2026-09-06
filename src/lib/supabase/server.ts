import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server client for use inside Server Components, Server Actions,
 * and Route Handlers. Runs AS the logged-in user (via their session
 * cookie) and is still subject to RLS — this is the client you use
 * for almost everything. It never has elevated privileges.
 *
 * Async because Next.js 16 requires cookies() to be awaited — there
 * is no synchronous fallback anymore. Every caller must therefore
 * `await createServerSupabaseClient()`.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component without a mutable response —
            // safe to ignore because proxy.ts refreshes the session.
          }
        },
      },
    }
  );
}

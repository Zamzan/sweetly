import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely — use ONLY in
 * Route Handlers / Server Actions for the small set of operations
 * that legitimately need to act on behalf of an anonymous visitor
 * after the input has been fully validated server-side, e.g.:
 *   - writing a public order / custom-order (the customer has no
 *     Supabase session, so RLS as "them" isn't possible)
 *   - subscription webhook handlers (Razorpay etc. — no user session)
 *
 * DO NOT import this into any file that is bundled for the client.
 * The "server-only" import above makes Next.js fail the build if
 * that ever happens, as a safety net.
 *
 * DO NOT use this client to skip authorization checks you were too
 * lazy to write — every call site using this client must itself
 * verify shop_id/ownership from trusted server-side data, never
 * from a client-supplied field.
 */
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL — " +
        "this client must only be constructed on the server with both set."
    );
  }

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

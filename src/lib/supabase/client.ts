import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client — uses the public anon key only.
 * All authorization is enforced by Postgres RLS policies, so this
 * client can never read/write data it isn't allowed to, regardless
 * of what the UI sends.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

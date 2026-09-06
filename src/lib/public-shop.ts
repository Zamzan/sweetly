import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PublicShop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  whatsapp_number: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  theme: any;
  opening_hours: string | null;
  is_published: boolean;
  isSubscriptionExpired: boolean;
}

/**
 * Loads a shop for public storefront rendering, strictly scoped to
 * the URL slug. Checks if the shop has an active subscription or is within
 * its 14-day free trial.
 */
export async function getPublicShopBySlug(slug: string): Promise<PublicShop> {
  const admin = createAdminClient();

  const { data: shop } = await admin
    .from("shops")
    .select(
      "id, name, slug, description, logo_url, cover_image_url, whatsapp_number, phone, address, city, state, pincode, theme, opening_hours, is_published"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!shop) notFound();

  // Check 14-day trial & subscription status
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, trial_ends_at, current_period_end")
    .eq("shop_id", shop.id)
    .maybeSingle();

  const now = new Date();
  const trialEnds = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const isTrialActive = sub?.status === "TRIALING" && trialEnds && trialEnds > now;
  const isSubscriptionActive =
    sub?.status === "ACTIVE" &&
    sub?.current_period_end &&
    new Date(sub.current_period_end) > now;

  const isExpired = !isTrialActive && !isSubscriptionActive;

  return {
    ...shop,
    isSubscriptionExpired: Boolean(isExpired),
  };
}

import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SettingsForm } from "./_components/settings-form";
import { PublishToggle } from "./_components/publish-toggle";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { shop } = await getCurrentShopOrRedirect();
  const supabase = await createServerSupabaseClient();

  const { data: freshShop } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shop.id)
    .single();

  const currentShop = freshShop || shop;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-900">
          Storefront & Settings
        </h1>
        <p className="mt-1 text-sm text-brand-600">
          Configure your shop branding, contact numbers, address, and live website status.
        </p>
      </div>

      {/* Website Publish Toggle Card */}
      <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-brand-900">Storefront Visibility</h2>
        <p className="mb-4 text-xs text-brand-600">
          Controls whether buyers can view and place orders on your public website.
        </p>
        <PublishToggle isPublished={currentShop.is_published} />
      </div>

      {/* Storefront Details Card */}
      <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-brand-900">Storefront Information</h2>
        <p className="mb-5 text-xs text-brand-600">
          Update the details that appear on your public website.
        </p>
        <SettingsForm shop={currentShop} />
      </div>
    </div>
  );
}

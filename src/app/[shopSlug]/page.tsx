import Link from "next/link";
import Image from "next/image";
import { getPublicShopBySlug } from "@/lib/public-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicAssetUrl } from "@/lib/images";
import { normalizePhone } from "@/lib/validation";
import { AddToCartButton } from "./_components/add-to-cart-button";
import { StorePaused } from "./_components/store-paused";
import { StoreOffline } from "./_components/store-offline";

export default async function ShopHomePage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const { shopSlug } = await params;
  const shop = await getPublicShopBySlug(shopSlug);

  if (!shop.is_published) {
    return <StoreOffline shopName={shop.name} whatsappNumber={shop.whatsapp_number} />;
  }

  if (shop.isSubscriptionExpired) {
    return <StorePaused shopName={shop.name} />;
  }

  const supabase = await createServerSupabaseClient();

  const { data: featured } = await supabase
    .from("products")
    .select(`
      id,
      name,
      slug,
      price,
      product_images (
        id,
        storage_path
      )
    `)
    .eq("shop_id", shop.id)
    .eq("available", true)
    .eq("featured", true)
    .limit(6);

  const theme = (shop.theme && typeof shop.theme === "object" ? shop.theme : {}) as Record<
    string,
    any
  >;
  const primaryColor = theme.primary_color || "#b43b67";
  const accentColor = theme.accent_color || "#d97706";
  const bannerStyle = theme.banner_style || "gradient";
  const googleMapsUrl = theme.google_maps_url || null;

  const customOrderEnabled = theme.custom_order_enabled !== false;
  const customOrderButtonText = theme.custom_order_button_text || "Order Custom";
  const customOrderTitle =
    theme.custom_order_title || "Planning a Special Celebration, Event, or Gift Hamper?";
  const customOrderDescription =
    theme.custom_order_description ||
    "Send us your preferences, personalized gift hamper ideas, or bulk event orders. We'll craft the perfect treat and chat with you directly on WhatsApp!";

  const cleanWhatsapp = shop.whatsapp_number
    ? normalizePhone(shop.whatsapp_number).replace("+", "")
    : null;

  const bannerRounding =
    bannerStyle === "rounded"
      ? "mx-4 mt-4 rounded-3xl"
      : bannerStyle === "pill"
      ? "mx-4 mt-4 rounded-[2.5rem]"
      : "w-full";

  return (
    <main className="min-h-screen bg-cream/30 pb-16">
      {/* Hero / Cover Banner */}
      <div className={`relative h-48 sm:h-64 md:h-80 overflow-hidden shadow-sm ${bannerRounding}`} style={{ backgroundColor: primaryColor }}>
        {shop.cover_image_url ? (
          <Image
            src={shop.cover_image_url}
            alt={`${shop.name} cover`}
            fill
            priority
            className="object-cover opacity-90"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-display text-4xl sm:text-6xl font-bold text-white/20 tracking-wider"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}dd, #0f172a)`,
            }}
          >
            {shop.name}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      </div>

      {/* Shop Header Profile */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-brand-100">
          <div className="flex items-end gap-4">
            <div className="relative h-28 w-28 sm:h-36 sm:w-36 flex-shrink-0 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-lg">
              {shop.logo_url ? (
                <Image
                  src={shop.logo_url}
                  alt={`${shop.name} logo`}
                  fill
                  className="object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-white shadow-inner"
                  style={{ backgroundColor: primaryColor }}
                >
                  {shop.name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="pb-2">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-brand-950">
                {shop.name}
              </h1>
              {shop.city && (
                <p className="text-sm font-medium text-brand-600">
                  {shop.city}{shop.state ? `, ${shop.state}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:pb-2">
            <Link
              href={`/${shop.slug}/products`}
              className="rounded-xl px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-95"
              style={{ backgroundColor: primaryColor }}
            >
              Explore Products
            </Link>
            {customOrderEnabled && (
              <Link
                href={`/${shop.slug}/custom-order`}
                className="rounded-xl border border-brand-300 bg-white px-5 py-2.5 text-xs font-semibold text-brand-800 shadow-sm transition hover:bg-brand-50 active:scale-95"
              >
                {customOrderButtonText}
              </Link>
            )}
          </div>
        </div>

        {/* About the shop */}
        {shop.description && (
          <div className="py-6">
            <p className="max-w-2xl text-base leading-relaxed text-brand-800 whitespace-pre-line">
              {shop.description}
            </p>
          </div>
        )}

        {/* Featured Products */}
        {featured && featured.length > 0 && (
          <section className="py-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-brand-900">
                  Featured Specialties
                </h2>
                <p className="text-xs text-brand-600">Handcrafted favorites available to order</p>
              </div>
              <Link
                href={`/${shop.slug}/products`}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                View all items →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => {
                const imgUrl = getPublicAssetUrl(p.product_images?.[0]?.storage_path);
                return (
                  <div
                    key={p.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <Link
                      href={`/${shop.slug}/products/${p.slug}`}
                      className="relative h-48 w-full overflow-hidden bg-brand-50"
                    >
                      {imgUrl ? (
                        <Image
                          src={imgUrl}
                          alt={p.name}
                          fill
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-display text-sm text-brand-400">
                          {p.name}
                        </div>
                      )}
                    </Link>

                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <Link
                          href={`/${shop.slug}/products/${p.slug}`}
                          className="font-semibold text-brand-900 hover:text-brand-600"
                        >
                          {p.name}
                        </Link>
                        <p className="mt-1 text-sm font-bold text-brand-800">
                          ₹{Number(p.price).toLocaleString("en-IN")}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-brand-50 pt-3">
                        <Link
                          href={`/${shop.slug}/products/${p.slug}`}
                          className="text-xs font-medium text-brand-500 hover:text-brand-800"
                        >
                          Details
                        </Link>
                        <AddToCartButton
                          product={{
                            id: p.id,
                            name: p.name,
                            price: Number(p.price),
                            image_url: imgUrl,
                            slug: p.slug,
                          }}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Custom Order Callout Banner (Owner Controlled) */}
        {customOrderEnabled && (
          <section
            className="my-8 rounded-3xl border p-8 text-white shadow-md"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, #0f172a)`,
              borderColor: `${primaryColor}40`,
            }}
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl space-y-2">
                <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-200">
                  Custom Orders & Events
                </span>
                <h3 className="text-2xl font-bold tracking-tight">
                  {customOrderTitle}
                </h3>
                <p className="text-sm text-brand-200">
                  {customOrderDescription}
                </p>
              </div>
              <Link
                href={`/${shop.slug}/custom-order`}
                className="inline-flex flex-shrink-0 items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-bold shadow-md transition hover:bg-brand-50 active:scale-95"
                style={{ color: primaryColor }}
              >
                {customOrderButtonText}
              </Link>
            </div>
          </section>
        )}

        {/* Location & Contact Card */}
        <section className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-brand-900">Visit & Contact Us</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 text-sm">
            {shop.address && (
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-brand-400">
                  Address
                </span>
                <p className="mt-1 font-medium text-brand-900">
                  {shop.address}
                  {shop.city && `, ${shop.city}`}
                  {shop.state && `, ${shop.state}`}
                  {shop.pincode && ` - ${shop.pincode}`}
                </p>
                {googleMapsUrl && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Get Directions on Google Maps ↗
                  </a>
                )}
              </div>
            )}

            {cleanWhatsapp && (
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-brand-400">
                  WhatsApp Orders
                </span>
                <a
                  href={`https://wa.me/${cleanWhatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:underline"
                >
                  {shop.whatsapp_number}
                </a>
              </div>
            )}

            {shop.phone && (
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-brand-400">
                  Phone Call
                </span>
                <a
                  href={`tel:${shop.phone}`}
                  className="mt-1 inline-flex items-center gap-1.5 font-medium text-brand-800 hover:underline"
                >
                  {shop.phone}
                </a>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

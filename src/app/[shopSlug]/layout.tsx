import Link from "next/link";
import type { Metadata } from "next";
import { getPublicShopBySlug } from "@/lib/public-shop";
import { CartProvider } from "@/context/cart-context";
import { CartHeaderButton, FloatingCartBar } from "./_components/cart-button";
import { CartDrawer } from "./_components/cart-drawer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug } = await params;
  const shop = await getPublicShopBySlug(shopSlug);
  return {
    title: `${shop.name} | Sweetly`,
    description: shop.description ?? `Order from ${shop.name} on Sweetly.`,
    openGraph: {
      title: shop.name,
      description: shop.description ?? undefined,
      images: shop.cover_image_url ? [shop.cover_image_url] : undefined,
    },
  };
}

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const shop = await getPublicShopBySlug(shopSlug);

  const theme = (shop.theme && typeof shop.theme === "object" ? shop.theme : {}) as Record<
    string,
    any
  >;
  const primaryColor = theme.primary_color || "#b43b67";
  const accentColor = theme.accent_color || "#d97706";
  const themeStyle = theme.theme_style || "modern";
  const customOrderEnabled = theme.custom_order_enabled !== false;
  const customOrderButtonText = theme.custom_order_button_text || "Custom Orders";

  return (
    <CartProvider shopSlug={shop.slug}>
      <div
        className={`relative min-h-screen flex flex-col justify-between theme-${themeStyle}`}
        style={
          {
            "--shop-primary": primaryColor,
            "--shop-accent": accentColor,
          } as React.CSSProperties
        }
      >
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-100/80 bg-white/95 px-6 py-3.5 backdrop-blur-md shadow-xs">
          <Link
            href={`/${shop.slug}`}
            className="font-display text-xl font-bold tracking-tight transition hover:opacity-90 flex items-center gap-2.5"
            style={{ color: primaryColor }}
          >
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logo_url}
                alt={shop.name}
                className="h-8 w-8 rounded-xl object-cover shadow-xs border border-black/5"
              />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {shop.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span>{shop.name}</span>
          </Link>

          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-wider text-brand-700 md:flex">
              <Link
                href={`/${shop.slug}`}
                className="hover:text-brand-950 transition"
              >
                Home
              </Link>
              <Link
                href={`/${shop.slug}/products`}
                className="hover:text-brand-950 transition"
              >
                Products
              </Link>
              {customOrderEnabled && (
                <Link
                  href={`/${shop.slug}/custom-order`}
                  className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:opacity-95"
                  style={{ backgroundColor: primaryColor }}
                >
                  {customOrderButtonText}
                </Link>
              )}
            </nav>

            {/* Shopping Bag Button */}
            <CartHeaderButton />
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <FloatingCartBar />
        <CartDrawer
          shopSlug={shop.slug}
          shopName={shop.name}
          whatsappNumber={shop.whatsapp_number}
        />

        <footer className="mt-16 border-t border-brand-100 bg-white px-6 py-8 text-center text-xs text-brand-500">
          Powered by <Link href="/" className="font-semibold text-brand-700 underline">Sweetly</Link>
        </footer>
      </div>
    </CartProvider>
  );
}

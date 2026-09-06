import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sweetly — Your Shop. Your Online Store.",
  description:
    "Create a beautiful online storefront for your sweet shop, bakery, cake business or gift shop — and receive custom orders directly through WhatsApp.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

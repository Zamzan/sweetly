import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <span className="font-display text-2xl text-brand-600">Sweetly</span>
        <nav className="hidden gap-6 text-sm md:flex">
          <Link href="/shops">Explore Shops</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Login</Link>
        </nav>
        <Link href="/signup" className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white">
          Get Started
        </Link>
      </header>

      <section className="px-6 py-16 text-center md:py-24">
        <h1 className="mx-auto max-w-2xl text-4xl md:text-6xl">
          Your Shop. Your Online Store.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-brand-600">
          Create a beautiful online storefront for your sweet shop, bakery, cake
          business or gift shop — and receive custom orders directly through
          WhatsApp.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/signup" className="rounded-lg bg-brand-500 px-6 py-3 text-white">
            Create Your Shop
          </Link>
          <Link href="/shops" className="rounded-lg border border-brand-200 px-6 py-3">
            Explore Shops
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto grid max-w-5xl gap-6 px-6 py-12 md:grid-cols-3">
        <FeatureCard title="1. Create your shop" text="Sign up, pick your shop name and a unique URL like sweetly.vercel.app/your-shop." />
        <FeatureCard title="2. Add your products" text="Upload photos, prices, and categories for your sweets, cakes and gift boxes." />
        <FeatureCard title="3. Receive orders on WhatsApp" text="Customers browse your storefront and send orders straight to your WhatsApp." />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-6 text-center text-2xl">Everything your shop needs</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            "Your own storefront URL",
            "Custom order forms",
            "WhatsApp ordering",
            "Product catalog & categories",
            "Order dashboard",
            "Mobile-friendly design",
          ].map((f) => (
            <div key={f} className="rounded-xl border border-brand-100 bg-white p-4 text-sm">
              {f}
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t border-brand-100 px-6 py-8 text-center text-sm text-brand-400">
        © {new Date().getFullYear()} Sweetly. ·{" "}
        <Link href="/terms" className="underline">Terms</Link> ·{" "}
        <Link href="/privacy" className="underline">Privacy</Link>
      </footer>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-white p-6 text-left">
      <h3 className="mb-2 text-lg">{title}</h3>
      <p className="text-sm text-brand-600">{text}</p>
    </div>
  );
}

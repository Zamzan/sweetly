import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-6xl font-display text-brand-500">404</h1>
      <p className="mt-3 text-lg text-brand-600">We couldn't find that page.</p>
      <Link href="/" className="mt-6 rounded-lg bg-brand-500 px-6 py-3 text-white">
        Back to Sweetly
      </Link>
    </main>
  );
}

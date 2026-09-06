import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-6xl font-display text-brand-500">403</h1>
      <p className="mt-3 text-lg text-brand-600">You don't have access to this page.</p>
      <Link href="/" className="mt-6 rounded-lg bg-brand-500 px-6 py-3 text-white">
        Back to Sweetly
      </Link>
    </main>
  );
}

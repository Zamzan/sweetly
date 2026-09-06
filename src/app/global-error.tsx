"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log server-side/monitoring only. Never render error.message or
    // error.stack to the user — that can leak internals (spec #33).
    console.error("Unhandled application error:", error.digest ?? error.message);
  }, [error]);

  return (
    <html>
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1 className="text-4xl font-display text-brand-500">Something went wrong</h1>
          <p className="mt-3 text-brand-600">
            We hit an unexpected error. Please try again in a moment.
          </p>
          <button onClick={reset} className="mt-6 rounded-lg bg-brand-500 px-6 py-3 text-white">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

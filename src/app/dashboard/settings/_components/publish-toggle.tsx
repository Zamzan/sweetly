"use client";

import { useState } from "react";
import { togglePublishAction } from "../actions";

export function PublishToggle({ isPublished }: { isPublished: boolean }) {
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(isPublished);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleToggle() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setFeedback(null);
    const nextState = !published;

    try {
      const res = await togglePublishAction(nextState);
      if (res?.error) {
        setError(res.error);
      } else {
        setPublished(nextState);
        setFeedback(
          nextState
            ? "Your store is now ONLINE and visible to customers!"
            : "Your store is now UNPUBLISHED (hidden from visitors)."
        );
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err: any) {
      const raw = err?.message || "";
      if (raw.includes("Minified React error") || raw.includes("react.dev/errors")) {
        setError("Unable to update publish state. Please refresh the page and try again.");
      } else {
        setError(raw || "Failed to update publish state. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={handleToggle}
          className={`relative inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition shadow-sm ${
            published
              ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500/30"
              : "bg-amber-600 text-white hover:bg-amber-700 focus:ring-2 focus:ring-amber-500/30"
          } disabled:opacity-60 active:scale-95`}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                published ? "bg-emerald-300" : "bg-amber-300"
              }`}
            />
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white"
            />
          </span>
          {loading
            ? "Updating…"
            : published
            ? "Online (Storefront is Live)"
            : "Draft (Storefront is Hidden)"}
        </button>

        <span className="text-xs text-brand-600">
          {published
            ? "✓ Visitors can access your website link and place orders."
            : "Click above to publish and make your website link live to visitors."}
        </span>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800 animate-in fade-in duration-200">
          ✓ {feedback}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
          ✕ {error}
        </div>
      )}
    </div>
  );
}

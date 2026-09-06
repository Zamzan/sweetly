"use client";

import { useTransition } from "react";
import { deleteCategoryAction } from "../categories-actions";

export function CategoriesList({
  categories,
}: {
  categories: { id: string; name: string; slug?: string }[];
}) {
  const [pending, startTransition] = useTransition();

  if (!categories || categories.length === 0) return null;

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? Products in this category will become uncategorized.`)) {
      return;
    }
    startTransition(() => {
      void deleteCategoryAction(id);
    });
  }

  return (
    <div className="rounded-xl border border-brand-100 bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-500">
        Current Categories ({categories.length})
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <span
            key={cat.id}
            className="group inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/50 px-3 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
          >
            {cat.name}
            <button
              disabled={pending}
              onClick={() => handleDelete(cat.id, cat.name)}
              title="Delete category"
              className="ml-1 text-brand-400 hover:text-red-600 disabled:opacity-40"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

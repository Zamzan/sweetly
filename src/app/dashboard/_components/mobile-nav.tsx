"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

export function MobileNav({
  shopName,
  navItems,
}: {
  shopName: string;
  navItems: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-brand-100 bg-white p-4 md:hidden">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-display text-lg font-bold text-brand-600">Sweetly</span>
          <span className="ml-2 text-xs text-brand-700">({shopName})</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-lg border border-brand-200 p-2 text-brand-700 hover:bg-brand-50"
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <nav className="mt-3 space-y-1 border-t border-brand-100 pt-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2">
            <LogoutButton />
          </div>
        </nav>
      )}
    </div>
  );
}

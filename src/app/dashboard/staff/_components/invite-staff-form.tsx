"use client";

import { useRef, useState, useTransition } from "react";
import { inviteStaffAction } from "../actions";

export function InviteStaffForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          const res = await inviteStaffAction(fd);
          if (res?.error) setError(res.error);
          else { setError(null); formRef.current?.reset(); }
        })
      }
      className="space-y-3"
    >
      <input name="email" type="email" required placeholder="staff@example.com" className="w-full rounded-lg border border-brand-100 px-3 py-2" />
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="canManageProducts" /> Manage products</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="canManageOrders" /> Manage orders</label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600 disabled:opacity-60">
        {pending ? "Adding…" : "Add Staff"}
      </button>
    </form>
  );
}

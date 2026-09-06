"use client";

import { useTransition } from "react";
import { removeStaffAction } from "../actions";

export function RemoveStaffButton({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Remove this staff member?")) {
          startTransition(() => {
            void removeStaffAction(memberId);
          });
        }
      }}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

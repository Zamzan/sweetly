"use client";

import { useTransition } from "react";
import { updateOrderStatusAction } from "../actions";

const STATUSES = [
  "NEW", "CONTACTED", "PAYMENT_PENDING", "CONFIRMED",
  "PREPARING", "READY", "COMPLETED", "CANCELLED",
];

export function StatusSelect({ orderId, status }: { orderId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const newStatus = e.target.value;
        startTransition(() => {
          void updateOrderStatusAction(orderId, newStatus);
        });
      }}
      className="rounded-lg border border-brand-100 px-2 py-1 text-xs"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateCustomOrderStatusAction } from "../actions";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: "bg-blue-100", text: "text-blue-800" },
  CONTACTED: { bg: "bg-purple-100", text: "text-purple-800" },
  PAYMENT_PENDING: { bg: "bg-amber-100", text: "text-amber-800" },
  CONFIRMED: { bg: "bg-indigo-100", text: "text-indigo-800" },
  PREPARING: { bg: "bg-orange-100", text: "text-orange-800" },
  READY: { bg: "bg-teal-100", text: "text-teal-800" },
  COMPLETED: { bg: "bg-emerald-100", text: "text-emerald-800" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-800" },
};

export function CustomOrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [pending, startTransition] = useTransition();

  const color = STATUS_COLORS[status] || { bg: "bg-gray-100", text: "text-gray-800" };

  function handleChange(nextStatus: string) {
    setStatus(nextStatus);
    startTransition(() => {
      void updateCustomOrderStatusAction(orderId, nextStatus);
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className={`rounded-xl border border-transparent px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 ${color.bg} ${color.text}`}
      >
        <option value="NEW">New Request</option>
        <option value="CONTACTED">Contacted</option>
        <option value="PAYMENT_PENDING">Payment Pending</option>
        <option value="CONFIRMED">Confirmed</option>
        <option value="PREPARING">Preparing</option>
        <option value="READY">Ready</option>
        <option value="COMPLETED">Completed</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      {pending && <span className="text-[10px] text-brand-400">Saving…</span>}
    </div>
  );
}

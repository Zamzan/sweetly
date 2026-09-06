import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatusSelect } from "./_components/status-select";

export default async function OrdersPage() {
  const { shop } = await getCurrentShopOrRedirect();
  const supabase = await createServerSupabaseClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      customer_name,
      customer_phone,
      total_amount,
      status,
      delivery_date,
      notes,
      created_at,
      order_items (
        id,
        product_name,
        quantity,
        unit_price
      )
    `)
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-950">Orders</h1>
          <p className="mt-1 text-sm text-brand-600">
            Track customer orders, review custom instructions, and update fulfillment status.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-brand-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-brand-50/80 text-left text-xs font-semibold uppercase tracking-wider text-brand-700">
            <tr>
              <th className="px-5 py-3.5">Customer</th>
              <th className="px-5 py-3.5">Items Ordered</th>
              <th className="px-5 py-3.5">Delivery & Notes</th>
              <th className="px-5 py-3.5">Total</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100">
            {(orders ?? []).map((o) => {
              const cleanPhone = o.customer_phone?.replace(/\D/g, "");
              const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

              return (
                <tr key={o.id} className="hover:bg-brand-50/30 transition">
                  <td className="px-5 py-4 align-top">
                    <div className="font-medium text-brand-900">{o.customer_name || "Guest Customer"}</div>
                    {o.customer_phone && (
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs text-brand-600">{o.customer_phone}</span>
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                            title="Chat with customer on WhatsApp"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-brand-400">
                      {new Date(o.created_at).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </td>

                  <td className="px-5 py-4 align-top">
                    {o.order_items && o.order_items.length > 0 ? (
                      <ul className="space-y-1 text-xs text-brand-800">
                        {o.order_items.map((item: any) => (
                          <li key={item.id} className="flex items-center gap-1.5">
                            <span className="font-semibold text-brand-950">{item.quantity}x</span>
                            <span>{item.product_name}</span>
                            <span className="text-brand-400">
                              (₹{Number(item.unit_price).toLocaleString("en-IN")})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-brand-400 italic">No item list</span>
                    )}
                  </td>

                  <td className="px-5 py-4 align-top max-w-xs">
                    {o.notes ? (
                      <p className="whitespace-pre-line text-xs text-brand-700 leading-relaxed">
                        {o.notes}
                      </p>
                    ) : (
                      <span className="text-xs text-brand-400">—</span>
                    )}
                    {o.delivery_date && (
                      <div className="mt-1 text-[11px] font-medium text-brand-600">
                        Due: {o.delivery_date}
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-4 align-top">
                    <div className="font-bold text-brand-900">
                      ₹{Number(o.total_amount ?? 0).toLocaleString("en-IN")}
                    </div>
                  </td>

                  <td className="px-5 py-4 align-top">
                    <StatusSelect orderId={o.id} status={o.status} />
                  </td>
                </tr>
              );
            })}
            {(!orders || orders.length === 0) && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-brand-400">
                  No orders yet. When customers place orders via your storefront or cart, they will appear here!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { getCurrentShopOrRedirect } from "@/lib/current-shop";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CustomOrdersHeader } from "./_components/custom-orders-header";
import { CustomOrderStatusSelect } from "./_components/custom-order-status-select";
import { normalizePhone } from "@/lib/validation";

interface CustomOrderRecord {
  id: string;
  customer_name: string;
  customer_phone: string;
  occasion?: string | null;
  product_type?: string | null;
  quantity?: number | null;
  budget_per_unit?: number | null;
  total_budget?: number | null;
  desired_date?: string | null;
  instructions?: string | null;
  status: string;
  created_at: string;
  custom_order_images?: { id: string; storage_path: string; signed_url?: string }[];
}

export default async function CustomOrdersPage() {
  const { shop } = await getCurrentShopOrRedirect();
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: rawOrders } = await supabase
    .from("custom_orders")
    .select(`
      id,
      customer_name,
      customer_phone,
      occasion,
      product_type,
      quantity,
      budget_per_unit,
      total_budget,
      desired_date,
      instructions,
      status,
      created_at,
      custom_order_images (
        id,
        storage_path
      )
    `)
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  // Generate signed URLs for reference photos so shop owners can inspect private uploads
  const customOrders: CustomOrderRecord[] = await Promise.all(
    (rawOrders ?? []).map(async (order) => {
      const imagesWithUrls = await Promise.all(
        (order.custom_order_images ?? []).map(async (img) => {
          try {
            const { data } = await admin.storage
              .from("custom-order-refs")
              .createSignedUrl(img.storage_path, 3600);
            return {
              ...img,
              signed_url: data?.signedUrl || undefined,
            };
          } catch {
            return img;
          }
        })
      );
      return {
        ...order,
        custom_order_images: imagesWithUrls,
      };
    })
  );

  return (
    <div className="space-y-8">
      <CustomOrdersHeader shopSlug={shop.slug} />

      {/* Orders List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-900">
            Received Custom Orders ({customOrders.length})
          </h2>
          <span className="text-xs text-brand-500">
            {customOrders.filter((c) => c.status === "NEW").length} new inquiries
          </span>
        </div>

        {customOrders.map((order) => {
          const cleanPhone = normalizePhone(order.customer_phone).replace("+", "");
          const waMessage = encodeURIComponent(
            `Hi ${order.customer_name}! Thank you for your custom order request at ${shop.name} for ${order.occasion || order.product_type || "your event"}. We are excited to work on this with you!`
          );
          const whatsappUrl = `https://wa.me/${cleanPhone}?text=${waMessage}`;

          return (
            <div
              key={order.id}
              className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              {/* Header: Customer info & status selector */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-brand-50 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-brand-900">
                      {order.customer_name}
                    </h3>
                    <span className="text-xs font-mono text-brand-500">
                      {order.customer_phone}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-brand-400">
                    Requested on{" "}
                    {new Date(order.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <CustomOrderStatusSelect
                    orderId={order.id}
                    currentStatus={order.status}
                  />
                </div>
              </div>

              {/* Order Key Details Grid */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-xl bg-brand-50/50 p-3">
                  <span className="text-brand-500">Occasion</span>
                  <p className="mt-1 font-semibold text-brand-900">
                    {order.occasion || "Not specified"}
                  </p>
                </div>
                <div className="rounded-xl bg-brand-50/50 p-3">
                  <span className="text-brand-500">Product / Type</span>
                  <p className="mt-1 font-semibold text-brand-900">
                    {order.product_type || "Custom Cake"}
                  </p>
                </div>
                <div className="rounded-xl bg-brand-50/50 p-3">
                  <span className="text-brand-500">Quantity</span>
                  <p className="mt-1 font-semibold text-brand-900">
                    {order.quantity ? `${order.quantity} pcs/kg` : "1 unit"}
                  </p>
                </div>
                <div className="rounded-xl bg-brand-50/50 p-3">
                  <span className="text-brand-500">Needed By Date</span>
                  <p className="mt-1 font-semibold text-brand-900">
                    {order.desired_date
                      ? new Date(order.desired_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Flexible"}
                  </p>
                </div>
              </div>

              {/* Budget Details */}
              {(order.total_budget || order.budget_per_unit) && (
                <div className="mt-3 flex items-center gap-4 text-xs font-medium text-brand-700">
                  {order.total_budget && (
                    <span>
                      Total Budget:{" "}
                      <strong className="text-brand-900">
                        ₹{Number(order.total_budget).toLocaleString("en-IN")}
                      </strong>
                    </span>
                  )}
                  {order.budget_per_unit && (
                    <span>
                      Budget/Unit:{" "}
                      <strong className="text-brand-900">
                        ₹{Number(order.budget_per_unit).toLocaleString("en-IN")}
                      </strong>
                    </span>
                  )}
                </div>
              )}

              {/* Special Instructions */}
              {order.instructions && (
                <div className="mt-4 rounded-xl border border-brand-100 bg-amber-50/30 p-3.5">
                  <p className="text-xs font-semibold text-brand-800">
                    Special Instructions & Preferences:
                  </p>
                  <p className="mt-1 text-xs text-brand-700 whitespace-pre-wrap">
                    {order.instructions}
                  </p>
                </div>
              )}

              {/* Uploaded Reference Photos */}
              {order.custom_order_images && order.custom_order_images.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-brand-800">
                    Customer Photo Inspirations ({order.custom_order_images.length}):
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {order.custom_order_images.map((img, idx) => (
                      <a
                        key={img.id}
                        href={img.signed_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative h-20 w-20 overflow-hidden rounded-xl border border-brand-200 bg-brand-50 shadow-sm transition hover:scale-105"
                      >
                        {img.signed_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img.signed_url}
                            alt={`Inspiration ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-brand-400">
                            Photo {idx + 1}
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                          <span className="text-[10px] font-semibold text-white">View ↗</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-brand-50 pt-4">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                >
                  <span>💬</span> Chat with Customer on WhatsApp
                </a>

                <a
                  href={`tel:${order.customer_phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3.5 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
                >
                  <span>📞</span> Call Customer
                </a>
              </div>
            </div>
          );
        })}

        {customOrders.length === 0 && (
          <div className="rounded-2xl border border-dashed border-brand-200 bg-white p-12 text-center">
            <div className="mx-auto max-w-sm">
              <span className="text-4xl">🎂</span>
              <h3 className="mt-3 font-semibold text-brand-900">
                No custom orders received yet
              </h3>
              <p className="mt-1 text-xs text-brand-500">
                Share your Custom Order Link on Instagram or WhatsApp to receive personalized cake requests with photos and budgets directly!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

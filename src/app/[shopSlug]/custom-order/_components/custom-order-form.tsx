"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { MAX_IMAGES_PER_UPLOAD } from "@/lib/validation";
import { getPublicAssetUrl } from "@/lib/images";

interface Category {
  id: string;
  name: string;
}

interface ReferenceProduct {
  id: string;
  name: string;
  price: number;
  category_id?: string | null;
  product_images?: Array<{ storage_path: string }>;
}

export function CustomOrderForm({
  shopSlug,
  categories = [],
  referenceProducts = [],
  defaultProductType = "",
  defaultCategory = "",
}: {
  shopSlug: string;
  categories?: Category[];
  referenceProducts?: ReferenceProduct[];
  defaultProductType?: string;
  defaultCategory?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategory);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string>("");
  const [productType, setProductType] = useState<string>(defaultProductType);
  const [customerPhone, setCustomerPhone] = useState<string>("");

  function handleSelectReference(prod: ReferenceProduct) {
    if (selectedReferenceId === prod.id) {
      setSelectedReferenceId("");
    } else {
      setSelectedReferenceId(prod.id);
      if (!productType) setProductType(prod.name);
      if (prod.category_id) setSelectedCategoryId(prod.category_id);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    formData.set("shopSlug", shopSlug);
    if (selectedCategoryId) formData.set("categoryId", selectedCategoryId);
    if (selectedReferenceId) formData.set("referenceProductId", selectedReferenceId);

    try {
      const res = await fetch("/api/custom-orders", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setDone(true);
      if (data.whatsappAvailable && data.link) {
        window.open(data.link, "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
          ✓
        </div>
        <h3 className="text-xl font-bold text-green-950">Your custom order request has been sent!</h3>
        <p className="mt-2 text-sm text-green-800">
          If WhatsApp opened in another tab, press Send there to connect with the shop owner directly.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-8 space-y-6" encType="multipart/form-data">
      {/* Category Selection */}
      {categories.length > 0 && (
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-800">
            1. Select Order Category:
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategoryId("")}
              className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition ${
                !selectedCategoryId
                  ? "border-brand-900 bg-brand-900 text-white shadow-sm"
                  : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
              }`}
            >
              General / Custom Item
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedCategoryId === cat.id
                    ? "border-brand-900 bg-brand-900 text-white shadow-sm"
                    : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reference Products Inspiration */}
      {referenceProducts.length > 0 && (
        <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-brand-800">
            2. Choose a Reference Item from this Shop (Optional):
          </label>
          <p className="mb-3 text-[11px] text-brand-600">
            Click an existing product to base your custom design or order on it.
          </p>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {referenceProducts.map((prod) => {
              const isSelected = selectedReferenceId === prod.id;
              const imgUrl = getPublicAssetUrl(prod.product_images?.[0]?.storage_path);

              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleSelectReference(prod)}
                  className={`flex w-36 flex-shrink-0 flex-col overflow-hidden rounded-xl border text-left transition ${
                    isSelected
                      ? "border-brand-800 bg-white shadow-md ring-2 ring-brand-500/30"
                      : "border-brand-200 bg-white hover:border-brand-400"
                  }`}
                >
                  <div className="relative h-20 w-full bg-brand-50">
                    {imgUrl ? (
                      <Image src={imgUrl} alt={prod.name} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg text-brand-300">
                        🛍️
                      </div>
                    )}
                    {isSelected && (
                      <span className="absolute right-1 top-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        Selected ✓
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-1 text-xs font-semibold text-brand-900">{prod.name}</p>
                    <p className="text-[11px] font-bold text-brand-700">₹{prod.price}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer & Order Details */}
      <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-800">
          3. Your Requirements
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Your Full Name" name="customerName" placeholder="e.g. Ayesha Sharma" required />
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="customerPhone" className="block text-sm font-medium text-brand-800">
                WhatsApp / Phone Number <span className="text-red-500">*</span>
              </label>
              {customerPhone.length > 0 && (
                <span className={`text-[11px] font-semibold ${customerPhone.length === 10 ? "text-emerald-600" : "text-amber-600"}`}>
                  {customerPhone.length}/10 digits
                </span>
              )}
            </div>
            <input
              id="customerPhone"
              name="customerPhone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number (e.g. 9876543210)"
              className="w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="mt-1 text-[11px] text-brand-500">Numbers only, max 10 digits.</p>
          </div>
          <Field label="Occasion / Event" name="occasion" placeholder="Birthday, Wedding, Festival, Corporate…" />
          <Field
            label="Item / Product Type"
            name="productType"
            value={productType}
            onChange={(e: any) => setProductType(e.target.value)}
            placeholder="e.g. 1kg Truffle Cake, Fancy Velvet Bags, Sweet Gift Box"
          />
          <Field label="Quantity / Units" name="quantity" type="number" min={1} placeholder="e.g. 1, 5, 20" />
          <Field label="Total Budget (₹)" name="totalBudget" type="number" min={0} step="1" placeholder="e.g. 1500" />
          <Field label="Delivery / Event Date" name="desiredDate" type="date" />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-brand-900">
            Special Instructions &amp; Customization Notes
          </label>
          <textarea
            name="instructions"
            rows={3}
            placeholder="Describe flavors, message written on card/cake, colors, theme, bag sizes, dietary requests..."
            className="w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-brand-900">
            Reference Photos (optional, up to {MAX_IMAGES_PER_UPLOAD}, JPG/PNG/WebP, 5MB each)
          </label>
          <input
            type="file"
            name="images"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="w-full text-xs text-brand-700 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-100 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-brand-800 hover:file:bg-brand-200"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-emerald-600 px-6 py-3.5 font-bold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {submitting ? "Preparing Your Order…" : "Send Custom Order on WhatsApp →"}
      </button>
    </form>
  );
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const { label, name, type = "text", ...rest } = props;
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-brand-800">
        {label} {props.required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        {...rest}
        className="w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      />
    </div>
  );
}

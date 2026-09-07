"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { updateShopSettingsAction } from "../actions";

interface ShopData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  whatsapp_number?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  theme?: any;
}

export function SettingsForm({ shop }: { shop: ShopData }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Controlled input states to prevent inputs from ever resetting on re-render
  const [name, setName] = useState(shop.name ?? "");
  const [description, setDescription] = useState(shop.description ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(shop.whatsapp_number ?? "");
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [address, setAddress] = useState(shop.address ?? "");
  const [city, setCity] = useState(shop.city ?? "");
  const [stateVal, setStateVal] = useState(shop.state ?? "");
  const [pincode, setPincode] = useState(shop.pincode ?? "");
  const [googleMapsUrl, setGoogleMapsUrl] = useState(
    shop.theme && typeof shop.theme === "object" ? shop.theme.google_maps_url ?? "" : ""
  );

  const [customOrderEnabled, setCustomOrderEnabled] = useState(
    shop.theme && typeof shop.theme === "object"
      ? shop.theme.custom_order_enabled ?? true
      : true
  );
  const [customOrderButtonText, setCustomOrderButtonText] = useState(
    shop.theme && typeof shop.theme === "object"
      ? shop.theme.custom_order_button_text ?? "Order Custom"
      : "Order Custom"
  );
  const [customOrderTitle, setCustomOrderTitle] = useState(
    shop.theme && typeof shop.theme === "object"
      ? shop.theme.custom_order_title ?? ""
      : ""
  );
  const [customOrderDescription, setCustomOrderDescription] = useState(
    shop.theme && typeof shop.theme === "object"
      ? shop.theme.custom_order_description ?? ""
      : ""
  );

  const [primaryColor, setPrimaryColor] = useState(
    shop.theme && typeof shop.theme === "object" ? shop.theme.primary_color ?? "#ec4899" : "#ec4899"
  );
  const [themeStyle, setThemeStyle] = useState(
    shop.theme && typeof shop.theme === "object" ? shop.theme.theme_style ?? "modern" : "modern"
  );
  const [bannerStyle, setBannerStyle] = useState(
    shop.theme && typeof shop.theme === "object" ? shop.theme.banner_style ?? "gradient" : "gradient"
  );

  const [logoPreview, setLogoPreview] = useState<string | null>(shop.logo_url ?? null);
  const [coverPreview, setCoverPreview] = useState<string | null>(shop.cover_image_url ?? null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState<string | null>(null);

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Logo image exceeds 5MB size limit.");
        return;
      }
      setLogoFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Cover banner exceeds 5MB size limit.");
        return;
      }
      setCoverFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => setCoverPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    // Explicitly enforce current controlled state in FormData
    formData.set("name", name);
    formData.set("description", description);
    formData.set("whatsappNumber", whatsappNumber);
    formData.set("phone", phone);
    formData.set("address", address);
    formData.set("city", city);
    formData.set("state", stateVal);
    formData.set("pincode", pincode);
    formData.set("googleMapsUrl", googleMapsUrl);
    formData.set("customOrderEnabled", customOrderEnabled ? "true" : "false");
    formData.set("customOrderButtonText", customOrderButtonText);
    formData.set("customOrderTitle", customOrderTitle);
    formData.set("customOrderDescription", customOrderDescription);

    try {
      const res = await updateShopSettingsAction(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess("✓ Storefront settings saved successfully!");
        if (res?.shop) {
          setName(res.shop.name ?? name);
          setDescription(res.shop.description ?? description);
          setWhatsappNumber(res.shop.whatsapp_number ?? whatsappNumber);
          setPhone(res.shop.phone ?? phone);
          setAddress(res.shop.address ?? address);
          setCity(res.shop.city ?? city);
          setStateVal(res.shop.state ?? stateVal);
          setPincode(res.shop.pincode ?? pincode);
          if (res.shop.logo_url) setLogoPreview(res.shop.logo_url);
          if (res.shop.cover_image_url) setCoverPreview(res.shop.cover_image_url);

          if (res.shop.theme && typeof res.shop.theme === "object") {
            const t = res.shop.theme;
            setCustomOrderEnabled(t.custom_order_enabled ?? true);
            setCustomOrderButtonText(t.custom_order_button_text ?? "Order Custom");
            setCustomOrderTitle(t.custom_order_title ?? "");
            setCustomOrderDescription(t.custom_order_description ?? "");
          }
        }
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while saving. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      method="POST"
      encType="multipart/form-data"
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Branding: Logo & Cover Banner */}
      <div className="rounded-2xl border border-brand-100 bg-brand-50/30 p-5">
        <h3 className="mb-4 text-sm font-bold tracking-tight text-brand-900">
          Store Logo & Cover Banner
        </h3>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Logo Card */}
          <div className="rounded-xl border border-brand-200/70 bg-white p-4 shadow-sm">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-brand-700">
              Store Logo (Square)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-brand-100 bg-brand-50">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Store logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-brand-400">
                    No Logo
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-1">
                <label className="inline-block cursor-pointer rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100">
                  Choose Logo
                  <input
                    type="file"
                    name="logo"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLogoFile}
                    className="hidden"
                  />
                </label>
                {logoFileName && (
                  <p className="truncate text-[11px] font-medium text-brand-600">
                    {logoFileName}
                  </p>
                )}
                <p className="text-[11px] text-brand-400">JPG, PNG, or WebP (max 5MB)</p>
              </div>
            </div>
          </div>

          {/* Cover Banner Card */}
          <div className="rounded-xl border border-brand-200/70 bg-white p-4 shadow-sm">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-brand-700">
              Hero Cover Banner (Wide)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-brand-100 bg-brand-50">
                {coverPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverPreview}
                    alt="Cover banner"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-brand-400">
                    No Cover
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-1">
                <label className="inline-block cursor-pointer rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100">
                  Choose Cover
                  <input
                    type="file"
                    name="coverImage"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleCoverFile}
                    className="hidden"
                  />
                </label>
                {coverFileName && (
                  <p className="truncate text-[11px] font-medium text-brand-600">
                    {coverFileName}
                  </p>
                )}
                <p className="text-[11px] text-brand-400">Wide banner (max 5MB)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* General Store Details */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-800">
            Store / Shop Name <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-brand-800">
            About Your Shop (Description)
          </label>
          <textarea
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Tell customers about your brand story, craftsmanship, specialties, and ingredients..."
            className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Contact Numbers */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-brand-800">
                WhatsApp Order Number <span className="text-red-500">*</span>
              </label>
              {whatsappNumber.length > 0 && (
                <span className={`text-[11px] font-semibold ${whatsappNumber.length === 10 ? "text-emerald-600" : "text-amber-600"}`}>
                  {whatsappNumber.length}/10 digits
                </span>
              )}
            </div>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              name="whatsappNumber"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit WhatsApp number (e.g. 9876543210)"
              required
              className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="mt-1 text-xs text-brand-500">
              Numbers only, max 10 digits. Customers will chat and order directly on this number.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-brand-800">
                Public / Calling Phone Number
              </label>
              {phone.length > 0 && (
                <span className={`text-[11px] font-semibold ${phone.length === 10 ? "text-emerald-600" : "text-amber-600"}`}>
                  {phone.length}/10 digits
                </span>
              )}
            </div>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number (e.g. 9876543210)"
              className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="mt-1 text-xs text-brand-500">
              Numbers only, max 10 digits. Shown for voice calls on your storefront.
            </p>
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-800">
            Bakery Street Address
          </label>
          <input
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Near City Bus Stand, Main Road"
            className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-800">City</label>
            <input
              name="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Valanchery"
              className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-800">State</label>
            <input
              name="state"
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              placeholder="e.g. Kerala"
              className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-800">Pincode</label>
            <input
              name="pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="e.g. 676552"
              className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        {/* Google Maps Link */}
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-800">
            Google Maps Location Link (optional)
          </label>
          <input
            name="googleMapsUrl"
            type="url"
            value={googleMapsUrl}
            onChange={(e) => setGoogleMapsUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/... or https://maps.google.com/..."
            className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <p className="mt-1 text-xs text-brand-500">
            Adds a &quot;Get Directions on Google Maps&quot; button to your storefront.
          </p>
        </div>
      </div>

      {/* Storefront Theme & Branding Customizer */}
      <div className="rounded-2xl border border-brand-100 bg-white p-5 space-y-4 shadow-sm">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-brand-900">
            Storefront Theme &amp; Visual Styling
          </h3>
          <p className="text-xs text-brand-500">
            Personalize your store colors, mood, and banner styling to match your brand.
          </p>
        </div>

        {/* Hidden inputs to send with form */}
        <input type="hidden" name="primaryColor" value={primaryColor} />
        <input type="hidden" name="themeStyle" value={themeStyle} />
        <input type="hidden" name="bannerStyle" value={bannerStyle} />

        {/* Brand Color Presets */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-brand-700">
            Brand Accent Color
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { name: "Sweet Pink", color: "#ec4899" },
              { name: "Royal Ruby", color: "#e11d48" },
              { name: "Purple Luxe", color: "#a855f7" },
              { name: "Warm Caramel", color: "#d97706" },
              { name: "Emerald Artisan", color: "#059669" },
              { name: "Midnight Elegance", color: "#0f172a" },
            ].map((p) => (
              <button
                key={p.color}
                type="button"
                onClick={() => setPrimaryColor(p.color)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  primaryColor === p.color
                    ? "border-brand-900 bg-brand-50 shadow-sm"
                    : "border-brand-200 hover:bg-brand-50/40"
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/10 shadow-inner"
                  style={{ backgroundColor: p.color }}
                />
                <span>{p.name}</span>
              </button>
            ))}

            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-brand-500">Custom:</span>
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded-lg border border-brand-200"
              />
              <span className="text-xs font-mono font-medium text-brand-700">{primaryColor}</span>
            </div>
          </div>
        </div>

        {/* Full Storefront Website Themes */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-brand-700">
            Full Storefront Website Theme
          </label>
          <p className="mb-3 text-xs text-brand-500">
            Transform your entire website appearance — background, headers, cards, and accent colors.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                id: "midnight-black",
                title: "Midnight Black & Gold",
                desc: "Pitch-black background, obsidian cards, and luxury gold accents.",
                primary: "#eab308",
                previewBg: "#09090b",
                previewCard: "#18181b",
                previewText: "#fafafa",
              },
              {
                id: "luxury-gold",
                title: "Royal Gold & Amber",
                desc: "Warm champagne gold background with rich amber and bronze styling.",
                primary: "#ca8a04",
                previewBg: "#fefce8",
                previewCard: "#ffffff",
                previewText: "#422006",
              },
              {
                id: "rose-boutique",
                title: "Rose Bakery & Boutique",
                desc: "Soft blush pastel background with elegant ruby and crimson accents.",
                primary: "#e11d48",
                previewBg: "#fff1f2",
                previewCard: "#ffffff",
                previewText: "#4c0519",
              },
              {
                id: "emerald-artisan",
                title: "Emerald Artisan",
                desc: "Fresh artisan mint and deep forest green styling for premium organic items.",
                primary: "#059669",
                previewBg: "#f0fdf4",
                previewCard: "#ffffff",
                previewText: "#052e16",
              },
              {
                id: "classic-cream",
                title: "Classic Sweetly (Cream)",
                desc: "Warm bakery cream background with vibrant sweet pink branding.",
                primary: "#ec4899",
                previewBg: "#fdfbf7",
                previewCard: "#ffffff",
                previewText: "#2a1711",
              },
            ].map((t) => {
              const isSelected = themeStyle === t.id || (t.id === "classic-cream" && (themeStyle === "modern" || !themeStyle));
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setThemeStyle(t.id);
                    setPrimaryColor(t.primary);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-brand-900 bg-brand-50/70 shadow-md ring-2 ring-brand-800/10"
                      : "border-brand-200 hover:bg-brand-50/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-brand-900">{t.title}</p>
                    <div className="flex items-center gap-1">
                      <span
                        className="h-3.5 w-3.5 rounded-full border shadow-inner"
                        style={{ backgroundColor: t.previewBg }}
                      />
                      <span
                        className="h-3.5 w-3.5 rounded-full border shadow-inner"
                        style={{ backgroundColor: t.primary }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-brand-600">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>


      {/* Custom Orders & Banner Copy Settings */}
      <div className="rounded-2xl border border-brand-100 bg-brand-50/30 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-brand-900">
              Custom Orders & Banner Settings
            </h3>
            <p className="text-xs text-brand-500">
              Customize or disable the special orders section to match your products (sweets, chocolates, cakes, hampers, or catering).
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={customOrderEnabled}
              onChange={(e) => setCustomOrderEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="ml-2 text-xs font-semibold text-brand-800">
              Enable Custom Orders Section
            </span>
          </label>
        </div>

        {customOrderEnabled && (
          <div className="space-y-4 pt-3 border-t border-brand-100/70">
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-800">
                Custom Order Button Text
              </label>
              <input
                type="text"
                value={customOrderButtonText}
                onChange={(e) => setCustomOrderButtonText(e.target.value)}
                placeholder="e.g. Order Custom, Custom Chocolates, Custom Sweets Box"
                className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-brand-500">
                Label displayed on custom order buttons across your storefront navigation and homepage.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-brand-800">
                Banner Headline / Title
              </label>
              <input
                type="text"
                value={customOrderTitle}
                onChange={(e) => setCustomOrderTitle(e.target.value)}
                placeholder="e.g. Planning a Wedding, Bulk Gift Boxes, or Celebration?"
                className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-brand-800">
                Banner Description
              </label>
              <textarea
                rows={2}
                value={customOrderDescription}
                onChange={(e) => setCustomOrderDescription(e.target.value)}
                placeholder="e.g. Need personalized chocolate boxes, customized sweets, or custom party hampers? Send us your preferences and chat with us directly!"
                className="w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          ✕ {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800 animate-in fade-in duration-200">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-md transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:opacity-60 active:scale-[0.99]"
      >
        {submitting ? "Saving Storefront Details…" : "Save Storefront Details"}
      </button>
    </form>
  );
}

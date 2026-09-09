"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createProductAction } from "../actions";
import { createCategoryAction } from "../categories-actions";
import { createSectionAction } from "../sections-actions";

interface VariantItem {
  id: string;
  name: string;
  size: string;
  color: string;
  price: number;
  available: boolean;
}

export function ProductForm({
  categories,
  sections = [],
}: {
  categories: { id: string; name: string }[];
  sections?: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category states
  const [catList, setCatList] = useState(categories);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catLoading, setCatLoading] = useState(false);

  // Multi-Category & Occasions states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCatInput, setCustomCatInput] = useState("");
  const [primaryCategoryId, setPrimaryCategoryId] = useState("");

  // Section states
  const [secList, setSecList] = useState(sections);
  const [showNewSecInput, setShowNewSecInput] = useState(false);
  const [newSecName, setNewSecName] = useState("");
  const [secLoading, setSecLoading] = useState(false);
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  const OCCASION_PRESETS = [
    { label: "🎂 Birthday", value: "Birthday" },
    { label: "💍 Marriage / Wedding", value: "Marriage" },
    { label: "🎉 Anniversary", value: "Anniversary" },
    { label: "✨ Festival (Eid/Diwali)", value: "Festival" },
    { label: "🎁 Gift & Hamper", value: "Gift" },
    { label: "🍰 Cakes & Pastry", value: "Cakes" },
    { label: "🍬 Sweets & Mithai", value: "Sweets" },
    { label: "👜 Bags & Totes", value: "Bags" },
    { label: "✨ Fancy Items", value: "Fancy" },
    { label: "🍫 Chocolates", value: "Chocolates" },
  ];

  function toggleCategory(catName: string) {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  }

  function addCustomCategory() {
    const trimmed = customCatInput.trim();
    if (!trimmed) return;
    if (!selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
    }
    setCustomCatInput("");
  }

  function toggleSection(secId: string) {
    setSelectedSectionIds((prev) =>
      prev.includes(secId) ? prev.filter((id) => id !== secId) : [...prev, secId]
    );
  }

  // Multi-image states (up to 5)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Variants state (Sizes, Colors, and Price per variant)
  const [hasVariants, setHasVariants] = useState(false);
  const [basePrice, setBasePrice] = useState<string>("");
  const [variants, setVariants] = useState<VariantItem[]>([
    { id: "v-1", name: "Standard", size: "500g", color: "", price: 0, available: true },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = 5 - selectedFiles.length;
    if (remainingSlots <= 0) {
      setError("Maximum 5 photos allowed per product.");
      return;
    }

    const validNewFiles: File[] = [];
    for (const f of files.slice(0, remainingSlots)) {
      if (f.size > 5 * 1024 * 1024) {
        setError(`"${f.name}" exceeds the 5MB size limit.`);
        continue;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        setError(`"${f.name}" must be JPG, PNG, or WebP.`);
        continue;
      }
      validNewFiles.push(f);
    }

    if (validNewFiles.length) {
      const combined = [...selectedFiles, ...validNewFiles].slice(0, 5);
      setSelectedFiles(combined);

      // Generate object URLs for previews
      const newPreviews: string[] = [];
      combined.forEach((file) => {
        newPreviews.push(URL.createObjectURL(file));
      });
      setImagePreviews(newPreviews);
      setError(null);
    }

    // Reset native input so user can pick again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    const updatedPreviews = imagePreviews.filter((_, i) => i !== index);
    setImagePreviews(updatedPreviews);
  }

  // Quick Category creation
  async function handleCreateCategory() {
    if (!newCatName.trim()) return;
    setCatLoading(true);
    setError(null);

    const fd = new FormData();
    fd.set("name", newCatName.trim());
    const res = await createCategoryAction(fd);
    setCatLoading(false);

    if (res?.error) {
      setError(res.error);
    } else if (res?.category) {
      setCatList((prev) => [...prev, res.category]);
      setNewCatName("");
      setShowNewCatInput(false);
      setSuccess(`Category "${res.category.name}" added!`);
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  // Quick Section creation
  async function handleCreateSection() {
    if (!newSecName.trim()) return;
    setSecLoading(true);
    setError(null);

    const fd = new FormData();
    fd.set("name", newSecName.trim());
    const res = await createSectionAction(fd);
    setSecLoading(false);

    if (res?.error) {
      setError(res.error);
    } else if (res?.section) {
      setSecList((prev) => [...prev, res.section]);
      setNewSecName("");
      setShowNewSecInput(false);
      setSuccess(`Section "${res.section.name}" created!`);
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  // Variant Helpers
  function addVariantRow() {
    const defaultP = Number(basePrice) > 0 ? Number(basePrice) : 0;
    setVariants((prev) => [
      ...prev,
      {
        id: `v-${Date.now()}`,
        name: "",
        size: "",
        color: "",
        price: defaultP,
        available: true,
      },
    ]);
  }

  function removeVariantRow(id: string) {
    if (variants.length <= 1) return;
    setVariants((prev) => prev.filter((v) => v.id !== id));
  }

  function updateVariantField(id: string, field: keyof VariantItem, value: any) {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v))
    );
  }

  function applyPreset(presetType: "cake" | "bag" | "sweet") {
    const baseP = Number(basePrice) > 0 ? Number(basePrice) : 500;
    if (presetType === "cake") {
      setVariants([
        { id: "v-1", name: "Half Kg", size: "500g", color: "", price: baseP, available: true },
        { id: "v-2", name: "1 Kg", size: "1kg", color: "", price: Math.round(baseP * 1.8), available: true },
        { id: "v-3", name: "2 Kg", size: "2kg", color: "", price: Math.round(baseP * 3.4), available: true },
      ]);
    } else if (presetType === "bag") {
      setVariants([
        { id: "v-1", name: "Standard", size: "Small", color: "Pastel Pink", price: baseP, available: true },
        { id: "v-2", name: "Standard", size: "Medium", color: "Rose Gold", price: Math.round(baseP * 1.3), available: true },
        { id: "v-3", name: "Standard", size: "Large", color: "Emerald Gold", price: Math.round(baseP * 1.6), available: true },
      ]);
    } else if (presetType === "sweet") {
      setVariants([
        { id: "v-1", name: "Box", size: "250g", color: "", price: Math.round(baseP * 0.5), available: true },
        { id: "v-2", name: "Box", size: "500g", color: "", price: baseP, available: true },
        { id: "v-3", name: "Festive Pack", size: "1kg", color: "Gift Box", price: Math.round(baseP * 1.9), available: true },
      ]);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);

    // Append all selected files under "images"
    formData.delete("image");
    formData.delete("images");
    selectedFiles.forEach((file) => {
      formData.append("images", file);
    });

    // Variants payload
    formData.set("hasVariants", hasVariants ? "true" : "false");
    if (hasVariants) {
      formData.set("variants", JSON.stringify(variants));
    }

    try {
      const result = await createProductAction(formData);
      if (result?.error) {
        setError(typeof result.error === "string" ? result.error : "Could not create product.");
      } else {
        setSuccess("Product added successfully with all photos and variants!");
        formRef.current?.reset();
        setSelectedFiles([]);
        setImagePreviews([]);
        setHasVariants(false);
        setBasePrice("");
        setVariants([
          { id: "v-1", name: "Standard", size: "500g", color: "", price: 0, available: true },
        ]);
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || "";
      if (msg.includes("441") || msg.includes("Minified")) {
        setSuccess("Product added! Refreshing products list…");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setError(msg || "An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-brand-900">Add New Product</h2>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        {/* Title and Base Price */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-800">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              placeholder="e.g. Belgian Truffle Cake, Fancy Gift Bag, Laddu Box"
              required
              className="w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-brand-800">
              Base Price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              name="price"
              type="number"
              min="0"
              step="1"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="e.g. 499"
              required
              className="w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        {/* Multi-Category & Occasions Selector */}
        <div className="rounded-2xl border border-brand-200/80 bg-brand-50/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <label className="block text-sm font-semibold text-brand-900">
                Categories &amp; Occasions (Select Multiple)
              </label>
              <p className="text-xs text-brand-600">
                Tag this product for multiple occasions so buyers can find it everywhere (e.g. Birthday, Marriage, Cakes, Gifts).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewCatInput((prev) => !prev)}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 self-start sm:self-auto"
            >
              {showNewCatInput ? "Cancel" : "+ New Category"}
            </button>
          </div>

          {showNewCatInput && (
            <div className="flex gap-2 rounded-xl border border-brand-200 bg-white p-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Birthday Cakes, Engagement, Hampers"
                className="flex-1 rounded-lg border border-brand-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                disabled={catLoading || !newCatName.trim()}
                onClick={handleCreateCategory}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {catLoading ? "Saving…" : "Save"}
              </button>
            </div>
          )}

          {/* Quick preset occasions */}
          <div>
            <p className="text-[11px] font-medium text-brand-500 uppercase tracking-wider mb-2">
              Popular Occasions &amp; Categories (Click to select/deselect):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {OCCASION_PRESETS.map((preset) => {
                const active = selectedCategories.includes(preset.value);
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => toggleCategory(preset.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-brand-600 text-white shadow-xs"
                        : "border border-brand-200 bg-white text-brand-700 hover:border-brand-400"
                    }`}
                  >
                    {preset.label} {active && "✓"}
                  </button>
                );
              })}

              {/* Shop custom categories from catList */}
              {catList.map((c) => {
                const active = selectedCategories.includes(c.name);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      toggleCategory(c.name);
                      if (!primaryCategoryId) setPrimaryCategoryId(c.id);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-brand-600 text-white shadow-xs"
                        : "border border-brand-200 bg-white text-brand-700 hover:border-brand-400"
                    }`}
                  >
                    🏷️ {c.name} {active && "✓"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom tag input */}
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={customCatInput}
              onChange={(e) => setCustomCatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomCategory();
                }
              }}
              placeholder="Add another custom occasion / tag (e.g. Wedding Reception, Baby Shower)..."
              className="flex-1 rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <button
              type="button"
              onClick={addCustomCategory}
              disabled={!customCatInput.trim()}
              className="rounded-xl border border-brand-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40"
            >
              + Add Tag
            </button>
          </div>

          {/* Hidden inputs to send to server */}
          <input type="hidden" name="categories" value={JSON.stringify(selectedCategories)} />
          <input
            type="hidden"
            name="categoryId"
            value={primaryCategoryId || (catList.find((c) => selectedCategories.includes(c.name))?.id ?? "")}
          />
        </div>

        {/* Multi-Section Selector */}
        <div className="rounded-2xl border border-brand-200/80 bg-brand-50/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <label className="block text-sm font-semibold text-brand-900">
                Storefront Sections (Select One or More)
              </label>
              <p className="text-xs text-brand-600">
                Place this product into one or more sections (e.g. Best Sellers, Marriage Specials, Today&apos;s Fresh).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewSecInput((prev) => !prev)}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 self-start sm:self-auto"
            >
              {showNewSecInput ? "Cancel" : "+ New Section"}
            </button>
          </div>

          {showNewSecInput && (
            <div className="flex gap-2 rounded-xl border border-brand-200 bg-white p-2">
              <input
                type="text"
                value={newSecName}
                onChange={(e) => setNewSecName(e.target.value)}
                placeholder="e.g. Best Sellers, Festive Specials, Hampers"
                className="flex-1 rounded-lg border border-brand-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <button
                type="button"
                disabled={secLoading || !newSecName.trim()}
                onClick={handleCreateSection}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {secLoading ? "Saving…" : "Save"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1">
            {secList.length === 0 ? (
              <p className="text-xs text-brand-400 italic">No sections created yet. Click &quot;+ New Section&quot; to create one.</p>
            ) : (
              secList.map((s) => {
                const active = selectedSectionIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSection(s.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "border border-brand-200 bg-white text-brand-700 hover:border-brand-400"
                    }`}
                  >
                    📂 {s.name} {active && "✓"}
                  </button>
                );
              })
            )}
          </div>

          <input type="hidden" name="sectionIds" value={JSON.stringify(selectedSectionIds)} />
          <input type="hidden" name="sectionId" value={selectedSectionIds[0] || ""} />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-800">
            Description
          </label>
          <textarea
            name="description"
            rows={2}
            placeholder="Describe flavors, materials, weight, colors, occasions, or packaging..."
            className="w-full rounded-xl border border-brand-200 bg-brand-50/20 px-3.5 py-2.5 text-sm transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Multi-Photo Upload (Up to 5 Photos) */}
        <div className="rounded-xl border border-brand-100 bg-brand-50/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-brand-900">
              Product Photos (Up to 5 photos)
            </label>
            <span className="text-xs text-brand-600">
              {selectedFiles.length} of 5 selected
            </span>
          </div>
          <p className="mb-3 text-xs text-brand-600">
            Upload multiple photos showing closeups, packaging, or different colors (JPG, PNG, or WebP up to 5MB each).
          </p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFilesChange}
            disabled={selectedFiles.length >= 5}
            className="block w-full text-xs text-brand-700 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-100 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-brand-800 hover:file:bg-brand-200 disabled:opacity-50"
          />

          {imagePreviews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {imagePreviews.map((url, idx) => (
                <div
                  key={idx}
                  className="group relative h-20 w-20 overflow-hidden rounded-xl border border-brand-200 bg-white shadow-sm"
                >
                  <Image
                    src={url}
                    alt={`Preview ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white opacity-80 transition hover:opacity-100"
                    title="Remove image"
                  >
                    ×
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {idx === 0 ? "Cover" : `#${idx + 1}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sizes & Colors Variant Section (Can be turned On and Off) */}
        <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-brand-900">
                Product Sizes, Colors &amp; Dynamic Pricing
              </span>
              <p className="text-xs text-brand-600">
                Offer different sizes (e.g. 500g, 1kg, Small, Large) and colors with tailored prices.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
            </label>
          </div>

          {hasVariants && (
            <div className="mt-4 space-y-3 border-t border-brand-100 pt-3">
              {/* Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-brand-600">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPreset("cake")}
                  className="rounded-lg border border-brand-200 bg-brand-50/60 px-2.5 py-1 text-xs text-brand-800 transition hover:bg-brand-100"
                >
                  🎂 Cake Sizes (500g, 1kg, 2kg)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("bag")}
                  className="rounded-lg border border-brand-200 bg-brand-50/60 px-2.5 py-1 text-xs text-brand-800 transition hover:bg-brand-100"
                >
                  👜 Bags / Fancy (S, M, L + Colors)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("sweet")}
                  className="rounded-lg border border-brand-200 bg-brand-50/60 px-2.5 py-1 text-xs text-brand-800 transition hover:bg-brand-100"
                >
                  🍬 Sweet Box Packs (250g, 500g, 1kg)
                </button>
              </div>

              {/* Variants table */}
              <div className="space-y-2">
                {variants.map((v, i) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/20 p-2.5"
                  >
                    <div className="w-24">
                      <label className="block text-[11px] font-medium text-brand-700">Size / Unit</label>
                      <input
                        type="text"
                        value={v.size}
                        onChange={(e) => updateVariantField(v.id, "size", e.target.value)}
                        placeholder="500g / 1kg"
                        className="w-full rounded-lg border border-brand-200 px-2.5 py-1 text-xs"
                      />
                    </div>

                    <div className="w-28">
                      <label className="block text-[11px] font-medium text-brand-700">Color (optional)</label>
                      <input
                        type="text"
                        value={v.color}
                        onChange={(e) => updateVariantField(v.id, "color", e.target.value)}
                        placeholder="Pink / Gold"
                        className="w-full rounded-lg border border-brand-200 px-2.5 py-1 text-xs"
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-[11px] font-medium text-brand-700">Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={v.price || ""}
                        onChange={(e) => updateVariantField(v.id, "price", Number(e.target.value))}
                        placeholder="Price"
                        className="w-full rounded-lg border border-brand-200 px-2.5 py-1 text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                      <label className="flex items-center gap-1 text-xs text-brand-700">
                        <input
                          type="checkbox"
                          checked={v.available}
                          onChange={(e) => updateVariantField(v.id, "available", e.target.checked)}
                          className="h-3.5 w-3.5 rounded text-brand-600"
                        />
                        In Stock
                      </label>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariantRow(v.id)}
                          className="text-xs font-bold text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addVariantRow}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                + Add Another Size/Color Variant
              </button>
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-6 pt-1">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-brand-800">
            <input
              type="checkbox"
              name="available"
              defaultChecked
              className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
            />
            Available for purchase
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-brand-800">
            <input
              type="checkbox"
              name="featured"
              className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
            />
            Feature on Storefront Homepage
          </label>
        </div>

        {/* Status alerts */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {typeof error === "string" ? error : String(error)}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-brand-600 px-5 py-3 font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:opacity-60"
        >
          {submitting ? "Saving Product…" : "Add Product"}
        </button>
      </form>
    </div>
  );
}

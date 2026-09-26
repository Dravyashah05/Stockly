import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Camera,
  Image as ImageIcon,
  Trash2,
  Link as LinkIcon,
  Package,
  Layers,
  Building2,
  Box,
  IndianRupee,
  FileText,
  Loader2,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { uploadProductImage } from "../../api/products";
import { generateProductDescription } from "../../api/ai";
import { useToast } from "../../context/ToastContext";

const COMMON_UNITS = ["pcs", "box", "kg", "g", "ltr", "pack", "m", "pair", "set"];

export default function ProductFormModal({
  open,
  onClose,
  onSubmit,
  editingProduct = null,
  categories = [],
  suppliers = [],
  loading = false,
}) {
  const { push } = useToast();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    quantity: 0,
    unit: "pcs",
    minimumStock: 5,
    image: "",
    price: 0,
    supplier: "",
    customData: {},
  });

  const [imagePreview, setImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Populate form on edit or reset on create
  useEffect(() => {
    if (!open) return;

    if (editingProduct) {
      setForm({
        name: editingProduct.name || "",
        category: editingProduct.category?._id || editingProduct.category || "",
        description: editingProduct.description || "",
        quantity: editingProduct.quantity ?? 0,
        unit: editingProduct.unit || "pcs",
        minimumStock: editingProduct.minimumStock ?? editingProduct.minimumQuantity ?? 5,
        image: editingProduct.image || "",
        price: editingProduct.price ?? 0,
        supplier: editingProduct.supplier?._id || editingProduct.supplier || "",
        customData: editingProduct.customData || {},
      });
      setImagePreview(editingProduct.image || "");
      setShowUrlInput(false);
    } else {
      setForm({
        name: "",
        category: categories[0]?._id || "",
        description: "",
        quantity: 0,
        unit: "pcs",
        minimumStock: 5,
        image: "",
        price: 0,
        supplier: "",
        customData: {},
      });
      setImagePreview("");
      setShowUrlInput(false);
    }
    setValidationErrors({});
  }, [open, editingProduct, categories]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);

    setUploadingImage(true);
    try {
      const res = await uploadProductImage(file);
      if (res.url) {
        setForm((prev) => ({ ...prev, image: res.url }));
        setImagePreview(res.url);
        push("Image uploaded successfully", "success");
      }
    } catch (err) {
      push("Upload failed: " + err.message, "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setForm((prev) => ({ ...prev, image: "" }));
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAiGenerateDesc = async () => {
    if (!form.name.trim()) {
      push("Enter a product name first to generate AI description", "warning");
      return;
    }
    setGeneratingDesc(true);
    try {
      const selectedCat = categories.find((c) => String(c._id) === String(form.category));
      const res = await generateProductDescription({
        name: form.name.trim(),
        category: selectedCat?.name || "General",
        unit: form.unit || "pcs",
        currentDescription: form.description || "",
      });

      if (res?.description) {
        setForm((prev) => ({ ...prev, description: res.description }));
        push("AI generated product description!", "success");
      }
    } catch (err) {
      push(err.message || "Failed to generate AI description", "error");
    } finally {
      setGeneratingDesc(false);
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Product name is required";
    if (!form.category) errors.category = "Category selection is required";
    if (!form.unit.trim()) errors.unit = "Unit of measure is required";
    if (Number(form.quantity) < 0) errors.quantity = "Quantity cannot be negative";
    if (Number(form.minimumStock) < 0) errors.minimumStock = "Min stock cannot be negative";
    if (Number(form.price) < 0) errors.price = "Price cannot be negative";

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!validate()) {
      push("Please fill in all required fields", "error");
      return;
    }
    onSubmit?.(form);
  };

  const selectedCatObj = categories.find(
    (c) => String(c._id) === String(form.category)
  );
  const customFields = selectedCatObj?.customFields || [];

  const handleCustomDataChange = (key, val) => {
    setForm((prev) => ({
      ...prev,
      customData: {
        ...prev.customData,
        [key]: val,
      },
    }));
  };

  const isEditing = Boolean(editingProduct);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-bold tracking-tight">
            {isEditing ? "Edit Product" : "Add New Product"}
          </span>
          <span
            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
              isEditing
                ? "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300"
                : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            {isEditing ? "Editing" : "New SKU"}
          </span>
        </div>
      }
      description={
        isEditing
          ? "Update product specifications, inventory targets, and pricing"
          : "Register a new product in your inventory catalog with specs & alert levels"
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. PRODUCT PHOTO SECTION */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
              <Camera size={14} className="text-zinc-500" />
              Product Photo
            </label>
            <button
              type="button"
              onClick={() => setShowUrlInput((v) => !v)}
              className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition"
            >
              <LinkIcon size={12} />
              {showUrlInput ? "Hide URL" : "Paste URL"}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3.5">
            {/* Image Preview Box */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0 relative group shadow-xs">
              {uploadingImage ? (
                <div className="flex flex-col items-center gap-1 text-zinc-500">
                  <Loader2 size={22} className="animate-spin text-zinc-900 dark:text-white" />
                  <span className="text-[10px] font-medium">Uploading</span>
                </div>
              ) : imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 sm:transition-opacity grid place-items-center text-xs font-semibold"
                    title="Remove Photo"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-zinc-400 dark:text-zinc-500 p-2 text-center">
                  <ImageIcon size={22} />
                  <span className="text-[10px]">No image</span>
                </div>
              )}
            </div>

            {/* Upload Buttons */}
            <div className="flex-1 w-full space-y-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploadingImage}
                  className="hidden"
                  id="product-photo-file-input"
                />
                <label
                  htmlFor="product-photo-file-input"
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition shadow-xs touch-manipulation min-h-[44px] ${
                    uploadingImage
                      ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                      : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 active:scale-[0.98]"
                  }`}
                >
                  <Camera size={15} />
                  {imagePreview ? "Change Photo" : "Take Photo / Choose File"}
                </label>

                {imagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="w-11 h-11 grid place-items-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 transition shrink-0"
                    title="Remove Photo"
                    aria-label="Remove Photo"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {showUrlInput && (
                <div className="animate-fade-in pt-1">
                  <input
                    type="url"
                    value={form.image}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, image: e.target.value }));
                      setImagePreview(e.target.value);
                    }}
                    placeholder="https://example.com/product-image.jpg"
                    className="input-field text-xs h-10"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. GENERAL INFORMATION */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <Package size={14} />
            General Information
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (validationErrors.name) {
                  setValidationErrors((prev) => ({ ...prev, name: null }));
                }
              }}
              placeholder="e.g. Wireless Ergonomic Keyboard"
              className={`input-field h-11 text-sm font-medium ${
                validationErrors.name
                  ? "border-red-500 focus:ring-red-500/20"
                  : ""
              }`}
            />
            {validationErrors.name && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {validationErrors.name}
              </p>
            )}
          </div>

          {/* Category & Supplier Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={form.category}
                  onChange={(e) => {
                    setForm({
                      ...form,
                      category: e.target.value,
                      customData: {},
                    });
                    if (validationErrors.category) {
                      setValidationErrors((prev) => ({ ...prev, category: null }));
                    }
                  }}
                  className={`input-field h-11 text-sm appearance-none pr-8 ${
                    validationErrors.category
                      ? "border-red-500 focus:ring-red-500/20"
                      : ""
                  }`}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.customFields?.length ? `(${c.customFields.length} specs)` : ""}
                    </option>
                  ))}
                </select>
                <Layers
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
              </div>
              {validationErrors.category && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {validationErrors.category}
                </p>
              )}
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Supplier <span className="text-zinc-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <select
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  className="input-field h-11 text-sm appearance-none pr-8"
                >
                  <option value="">No supplier assigned</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <Building2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. INVENTORY, UNITS & PRICING */}
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <Box size={14} />
            Inventory & Commercials
          </div>

          {/* Unit of Measure & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Unit of Measure <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-zinc-400">Quick presets:</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.unit}
                onChange={(e) => {
                  setForm({ ...form, unit: e.target.value });
                  if (validationErrors.unit) {
                    setValidationErrors((prev) => ({ ...prev, unit: null }));
                  }
                }}
                placeholder="pcs, box, kg..."
                className={`input-field h-11 text-sm ${
                  validationErrors.unit ? "border-red-500" : ""
                }`}
              />
            </div>

            {/* Unit quick chips */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {COMMON_UNITS.map((u) => {
                const isSelected = form.unit?.toLowerCase() === u.toLowerCase();
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, unit: u });
                      if (validationErrors.unit) {
                        setValidationErrors((prev) => ({ ...prev, unit: null }));
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition touch-manipulation active:scale-95 ${
                      isSelected
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {u}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantities & Price Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                {isEditing ? "Stock On Hand" : "Initial Quantity"}
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="input-field h-11 text-sm font-semibold text-center"
                />
              </div>
            </div>

            {/* Min Stock Level */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Min Stock Alert
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={form.minimumStock}
                onChange={(e) =>
                  setForm({
                    ...form,
                    minimumStock: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                placeholder="5"
                className="input-field h-11 text-sm font-semibold text-center"
              />
              <span className="text-[10px] text-zinc-400 block mt-1 text-center truncate">
                Triggers warning at ≤ {form.minimumStock}
              </span>
            </div>

            {/* Unit Price */}
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Unit Price (₹)
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: Math.max(0, Number(e.target.value) || 0) })
                  }
                  placeholder="0.00"
                  className="input-field h-11 text-sm font-semibold pl-7"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                  ₹
                </span>
              </div>
              {form.price > 0 && form.quantity > 0 && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-1 text-center font-medium truncate">
                  Total: ₹{(Number(form.price) * Number(form.quantity)).toLocaleString("en-IN")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. DYNAMIC CATEGORY ATTRIBUTES */}
        {customFields.length > 0 && (
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              <Sparkles size={14} className="text-amber-500" />
              <span>{selectedCatObj.name} Specifications</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customFields.map((f) => {
                const val = form.customData?.[f.key] ?? "";
                return (
                  <div key={f.key} className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {f.label}
                      {f.required && <span className="text-red-500"> *</span>}
                      <span className="text-[10px] text-zinc-400 font-normal ml-1">
                        ({f.type})
                      </span>
                    </label>

                    {f.type === "select" ? (
                      <select
                        value={val}
                        onChange={(e) => handleCustomDataChange(f.key, e.target.value)}
                        className="input-field h-10 text-xs"
                      >
                        <option value="">Select {f.label}</option>
                        {f.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "number" ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        value={val}
                        onChange={(e) => handleCustomDataChange(f.key, e.target.value)}
                        className="input-field h-10 text-xs"
                        placeholder={f.label}
                      />
                    ) : f.type === "date" ? (
                      <input
                        type="date"
                        value={val}
                        onChange={(e) => handleCustomDataChange(f.key, e.target.value)}
                        className="input-field h-10 text-xs"
                      />
                    ) : f.type === "checkbox" ? (
                      <label className="flex items-center gap-2.5 h-10 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleCustomDataChange(f.key, e.target.checked)}
                          className="rounded border-zinc-300 w-4 h-4 text-zinc-900 focus:ring-zinc-900"
                        />
                        <span>{f.label}</span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleCustomDataChange(f.key, e.target.value)}
                        className="input-field h-10 text-xs"
                        placeholder={f.label}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. DESCRIPTION */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <FileText size={13} className="text-zinc-500" />
              Description & Notes <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>

            <button
              type="button"
              onClick={handleAiGenerateDesc}
              disabled={generatingDesc}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/25 text-[11px] font-bold active:scale-95 transition disabled:opacity-50"
            >
              <Sparkles size={13} className={generatingDesc ? "animate-spin text-violet-600" : "text-violet-600 dark:text-violet-400"} />
              {generatingDesc ? "AI Writing..." : "AI Auto-Write"}
            </button>
          </div>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder="Product materials, handling instructions, shelf location..."
            className="input-field text-xs sm:text-sm py-2.5 resize-none"
          />
        </div>

        {/* 6. MODAL ACTIONS (Large touch targets for mobile) */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-1/3 min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={uploadingImage}
            className="w-full sm:w-2/3 min-h-[44px]"
          >
            {isEditing ? "Save Changes" : "Create Product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

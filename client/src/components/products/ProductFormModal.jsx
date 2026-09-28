import React, { useState, useEffect, useRef } from "react";
import { Camera, Image as ImageIcon, Trash2, Link as LinkIcon, Loader2, Sparkles } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { Input, Textarea, Select } from "../ui/Input";
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
  const [showMore, setShowMore] = useState(false);
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
      setShowMore(Boolean(editingProduct.description || Object.keys(editingProduct.customData || {}).length));
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
      setShowMore(false);
    }
    setShowUrlInput(false);
    setValidationErrors({});
  }, [open, editingProduct, categories]);

  // Update a field and clear its validation error
  const set = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setValidationErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject oversized/non-image files before FileReader decodes them —
    // large dataURIs previously bloated state and Mongo documents.
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_IMAGE_BYTES) {
      push("Image must be under 5 MB", "error");
      if (e.target) e.target.value = "";
      return;
    }
    if (file.type && !file.type.startsWith("image/")) {
      push("Only image files are allowed", "error");
      if (e.target) e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);

    setUploadingImage(true);
    try {
      const res = await uploadProductImage(file);
      if (res.url) {
        setForm((prev) => ({ ...prev, image: res.url }));
        setImagePreview(res.url);
        push("Image uploaded", "success");
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
      push("Enter a product name first", "warning");
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
        push("Description generated", "success");
      }
    } catch (err) {
      push(err.message || "AI generation failed", "error");
    } finally {
      setGeneratingDesc(false);
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Name is required";
    if (!form.category) errors.category = "Pick a category";
    if (!form.unit.trim()) errors.unit = "Unit is required";
    if (Number(form.quantity) < 0) errors.quantity = "Can't be negative";
    if (Number(form.minimumStock) < 0) errors.minimumStock = "Can't be negative";
    if (Number(form.price) < 0) errors.price = "Can't be negative";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!validate()) {
      push("Please check the highlighted fields", "error");
      return;
    }
    onSubmit?.(form);
  };

  const selectedCatObj = categories.find((c) => String(c._id) === String(form.category));
  const customFields = selectedCatObj?.customFields || [];

  const handleCustomDataChange = (key, val) => {
    setForm((prev) => ({ ...prev, customData: { ...prev.customData, [key]: val } }));
  };

  const isEditing = Boolean(editingProduct);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit product" : "New product"}
      description={isEditing ? "Update details, stock and price" : "Just the essentials — the rest is optional"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo + name */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploadingImage}
            className="hidden"
            id="product-photo-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0 active:scale-95 transition"
            title="Add photo"
          >
            {uploadingImage ? (
              <Loader2 size={20} className="animate-spin text-zinc-500" />
            ) : imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={20} className="text-zinc-400" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <Input
              label="Product name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Wireless Keyboard"
              error={validationErrors.name}
              autoFocus
            />
          </div>
          {imagePreview && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="w-10 h-10 mt-5 grid place-items-center rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition shrink-0"
              title="Remove photo"
              aria-label="Remove photo"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {showUrlInput && (
          <Input
            label="Image URL"
            type="url"
            value={form.image}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, image: e.target.value }));
              setImagePreview(e.target.value);
            }}
            placeholder="https://…"
          />
        )}
        <button
          type="button"
          onClick={() => (imagePreview ? fileInputRef.current?.click() : setShowUrlInput((v) => !v))}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition -mt-2"
        >
          {imagePreview ? (
            <>
              <Camera size={12} /> Change photo
            </>
          ) : (
            <>
              <LinkIcon size={12} /> {showUrlInput ? "Hide URL field" : "Paste image URL instead"}
            </>
          )}
        </button>

        {/* Category + supplier */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => set({ category: e.target.value, customData: {} })}
            error={validationErrors.category}
          >
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Supplier" value={form.supplier} onChange={(e) => set({ supplier: e.target.value })}>
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Quantity + price + min */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label={isEditing ? "In stock" : "Qty"}
            type="number"
            inputMode="numeric"
            min="0"
            value={form.quantity}
            onChange={(e) => set({ quantity: Math.max(0, Number(e.target.value) || 0) })}
            error={validationErrors.quantity}
          />
          <Input
            label="Price ₹"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => set({ price: Math.max(0, Number(e.target.value) || 0) })}
            error={validationErrors.price}
          />
          <Input
            label="Min stock"
            type="number"
            inputMode="numeric"
            min="0"
            value={form.minimumStock}
            onChange={(e) => set({ minimumStock: Math.max(0, Number(e.target.value) || 0) })}
            error={validationErrors.minimumStock}
          />
        </div>

        {/* Unit chips */}
        <div>
          <span className="input-label">Unit{validationErrors.unit ? ` — ${validationErrors.unit}` : ""}</span>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {COMMON_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => set({ unit: u })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition active:scale-95 ${
                  form.unit?.toLowerCase() === u.toLowerCase()
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {u}
              </button>
            ))}
            <input
              value={COMMON_UNITS.includes(form.unit?.toLowerCase()) ? "" : form.unit}
              onChange={(e) => set({ unit: e.target.value })}
              placeholder="Custom"
              className="w-20 px-3 py-1.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-800 outline-none placeholder:text-zinc-400 shrink-0"
            />
          </div>
        </div>

        {/* More options */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="w-full py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
        >
          {showMore ? "Hide extra details" : `More options${customFields.length ? ` (${customFields.length} specs)` : ""}`}
        </button>

        {showMore && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="input-label !mb-0">Description</span>
                <button
                  type="button"
                  onClick={handleAiGenerateDesc}
                  disabled={generatingDesc}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition disabled:opacity-50"
                >
                  <Sparkles size={12} className={generatingDesc ? "animate-spin" : ""} />
                  {generatingDesc ? "Writing…" : "AI write"}
                </button>
              </div>
              <Textarea
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Materials, shelf location, notes…"
              />
            </div>

            {customFields.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {customFields.map((f) => {
                  const val = form.customData?.[f.key] ?? "";
                  const label = `${f.label}${f.required ? " *" : ""}`;
                  if (f.type === "select") {
                    return (
                      <Select key={f.key} label={label} value={val} onChange={(e) => handleCustomDataChange(f.key, e.target.value)}>
                        <option value="">Select…</option>
                        {f.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </Select>
                    );
                  }
                  if (f.type === "checkbox") {
                    return (
                      <label
                        key={f.key}
                        className="flex items-center gap-2.5 px-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm cursor-pointer min-h-[42px]"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleCustomDataChange(f.key, e.target.checked)}
                          className="w-4 h-4 rounded accent-zinc-900 dark:accent-white"
                        />
                        {f.label}
                      </label>
                    );
                  }
                  return (
                    <Input
                      key={f.key}
                      label={label}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={val}
                      onChange={(e) => handleCustomDataChange(f.key, e.target.value)}
                      placeholder={f.label}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={uploadingImage} className="flex-[2]">
            {isEditing ? "Save changes" : "Add product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

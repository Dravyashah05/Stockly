import React, { useEffect, useState } from "react";
import {
  getCategories,
  getCategoryStats,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../api/categories";
import { useToast } from "../context/ToastContext";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import Button from "../components/ui/Button";
import {
  Plus,
  Edit2,
  Trash2,
  FolderKanban,
  Layers,
  Package,
  Coins,
  Settings2,
  X,
  Search,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  MoreVertical,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSearch } from "../context/SearchContext";
import FAB from "../components/ui/FAB";

function FieldRow({ field, onChange, onRemove }) {
  return (
    <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-bold tracking-wider uppercase text-zinc-500 mb-1">
            Field Name *
          </label>
          <input
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            placeholder="e.g. Warranty, Color, Expiry"
            className="input-field h-10 text-xs font-semibold"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="w-10 h-10 mt-4 grid place-items-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 active:scale-95 transition shrink-0"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-zinc-500 mb-1">
            Data Type
          </label>
          <select
            value={field.type}
            onChange={(e) => onChange({ ...field, type: e.target.value })}
            className="input-field h-10 text-xs font-medium"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Dropdown</option>
            <option value="date">Date</option>
            <option value="checkbox">Checkbox</option>
          </select>
        </div>

        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!field.required}
              onChange={(e) => onChange({ ...field, required: e.target.checked })}
              className="w-4 h-4 rounded text-zinc-900 dark:text-white"
            />
            Required
          </label>
        </div>
      </div>

      {field.type === "select" && (
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-zinc-500 mb-1">
            Dropdown Options (comma separated)
          </label>
          <input
            value={(field.options || []).join(", ")}
            onChange={(e) =>
              onChange({
                ...field,
                options: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="Small, Medium, Large"
            className="input-field h-10 text-xs"
          />
        </div>
      )}
    </div>
  );
}

export default function Categories() {
  const { push } = useToast();
  const { search: globalSearch } = useSearch();
  const [localSearch, setLocalSearch] = useState("");
  const [cats, setCats] = useState([]);
  const [statsMap, setStatsMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "active",
    customFields: [],
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [forceTarget, setForceTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const activeSearch = localSearch || globalSearch;

  const load = async () => {
    setLoading(true);
    try {
      const [catRes, statRes] = await Promise.all([
        getCategories(activeSearch),
        getCategoryStats().catch(() => ({ data: [] })),
      ]);
      setCats(catRes.data || catRes || []);
      const m = new Map();
      (statRes.data || []).forEach((s) => m.set(String(s.category._id), s));
      setStatsMap(m);
    } catch (e) {
      push(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeSearch]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", status: "active", customFields: [] });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name,
      description: c.description || "",
      status: c.status || "active",
      customFields: c.customFields ? [...c.customFields] : [],
    });
    setShowModal(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return push("Category name is required", "error");
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        status: form.status,
        customFields: form.customFields,
      };
      if (editing) await updateCategory(editing._id, payload);
      else await createCategory(payload);
      push(editing ? "Category updated" : "Category created", "success");
      setShowModal(false);
      load();
    } catch (e) {
      push(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const del = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteCategory(deleteTarget._id);
      push("Category deleted", "success");
      setDeleteTarget(null);
      load();
    } catch (e) {
      push(e.message, "error");
      if (e.message.toLowerCase().includes("product")) {
        setForceTarget(deleteTarget);
        setDeleteTarget(null);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const forceDel = async () => {
    if (!forceTarget) return;
    setDeleteLoading(true);
    try {
      await deleteCategory(forceTarget._id, true);
      push("Force deleted category", "success");
      setForceTarget(null);
      load();
    } catch (er) {
      push(er.message, "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const fmtCurrency = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 animate-fade-in">
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Categories
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Organize catalog, manage custom attributes, and track inventory value
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold text-xs sm:text-sm shadow-sm hover:bg-zinc-800 active:scale-95 transition min-h-[42px]"
        >
          <Plus size={16} /> New Category
        </button>
      </div>

      {/* 2. SEARCH BAR */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
        />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search categories by name or description..."
          className="input-field pl-10 h-11 text-xs sm:text-sm"
        />
        {localSearch && (
          <button
            onClick={() => setLocalSearch("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* 3. CATEGORIES LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {cats.map((c) => {
          const stat = statsMap.get(String(c._id));
          const productCount = stat?.productCount ?? 0;
          const totalStock = stat?.totalStock ?? 0;
          const totalValue = stat?.totalValue ?? 0;

          return (
            <div
              key={c._id}
              className="card p-0 overflow-hidden border border-zinc-200/80 dark:border-zinc-800 hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="p-4 sm:p-5 space-y-3">
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center font-black text-sm shrink-0 shadow-xs">
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white truncate">
                          {c.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            c.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.status === "active" ? "bg-emerald-500" : "bg-zinc-400"
                            }`}
                          />
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {c.description || "No description specified"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 grid place-items-center active:scale-95 transition"
                      title="Edit Category"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="w-8 h-8 rounded-lg bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 active:scale-95 transition grid place-items-center"
                      title="Delete Category"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Custom Fields tags if any */}
                {c.customFields?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.customFields.map((f) => (
                      <span
                        key={f.key || f.label}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        <Settings2 size={10} className="text-zinc-400" />
                        {f.label}
                        <span className="text-[9px] text-zinc-400 uppercase">({f.type})</span>
                        {f.required && <span className="text-red-500">*</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Metrics bar */}
              <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30">
                <Link
                  to={`/products?category=${c._id}`}
                  className="p-3 text-center hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Products
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                    {productCount}
                  </div>
                </Link>

                <div className="p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Total Units
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                    {totalStock.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Valuation
                  </div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {fmtCurrency(totalValue)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!cats.length && !loading && (
          <div className="col-span-full card py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 grid place-items-center mx-auto text-zinc-400">
              <FolderKanban size={22} />
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white mt-3">
              No categories found
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Create categories to group inventory and configure custom fields.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold"
            >
              + Create First Category
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {!showModal && !deleteTarget && !forceTarget && (
        <FAB onClick={openCreate} label="Add category" />
      )}

      {/* Create / Edit Category Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Category" : "Add New Category"}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Category Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field h-11 text-xs font-semibold"
              placeholder="e.g. Raw Materials, Electronics, Apparel"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="input-field text-xs resize-none"
              placeholder="Brief description of products in this category..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="input-field h-11 text-xs font-medium"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Custom Fields Builder */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Custom Fields ({form.customFields.length})
              </label>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Specialized attributes prompted when adding items to this category (e.g. Serial #, Expiry Date).
            </p>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {form.customFields.map((f, idx) => (
                <FieldRow
                  key={idx}
                  field={f}
                  onChange={(nf) =>
                    setForm({
                      ...form,
                      customFields: form.customFields.map((x, i) => (i === idx ? nf : x)),
                    })
                  }
                  onRemove={() =>
                    setForm({
                      ...form,
                      customFields: form.customFields.filter((_, i) => i !== idx),
                    })
                  }
                />
              ))}

              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    customFields: [
                      ...form.customFields,
                      { label: "", type: "text", options: [], required: false },
                    ],
                  })
                }
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-1.5 min-h-[42px]"
              >
                <Plus size={14} /> Add Custom Field
              </button>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
              className="w-full sm:w-1/3 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              loading={submitting}
              className="w-full sm:w-2/3 min-h-[44px]"
            >
              {editing ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={del}
        loading={deleteLoading}
        title="Delete category?"
        description={
          deleteTarget ? `Delete "${deleteTarget.name}"? This action cannot be undone.` : ""
        }
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Force Delete Confirmation */}
      <ConfirmModal
        open={!!forceTarget}
        onClose={() => !deleteLoading && setForceTarget(null)}
        onConfirm={forceDel}
        loading={deleteLoading}
        title="Force delete category?"
        description={
          forceTarget
            ? `"${forceTarget.name}" still contains products. Products will be uncategorized. Force delete anyway?`
            : ""
        }
        confirmLabel="Force Delete"
        variant="danger"
      />
    </div>
  );
}

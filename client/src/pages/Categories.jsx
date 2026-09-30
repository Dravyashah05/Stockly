import React, { useEffect, useState, memo } from "react";
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
import Badge from "../components/ui/Badge";
import { Input, Textarea, Select, SearchInput } from "../components/ui/Input";
import { TableSkeleton, EmptyState } from "../components/ui/Loader";
import {
  Plus,
  Pencil,
  Trash2,
  FolderKanban,
  Settings2,
  X,
  ChevronRight,
  LayoutGrid,
  List,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useSearch } from "../context/SearchContext";
import FAB from "../components/ui/FAB";

const FieldRow = memo(function FieldRow({ field, onChange, onRemove }) {
  return (
    <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 space-y-2.5">
      <div className="flex items-center gap-2">
        <Input
          label="Field name"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="e.g. Warranty, Color, Expiry"
          className="flex-1"
        />
        <button
          type="button"
          onClick={onRemove}
          className="w-10 h-10 mt-5 grid place-items-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-600 active:scale-95 transition shrink-0"
          aria-label="Remove field"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 items-end">
        <Select label="Type" value={field.type} onChange={(e) => onChange({ ...field, type: e.target.value })}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Dropdown</option>
          <option value="date">Date</option>
          <option value="checkbox">Checkbox</option>
        </Select>
        <label className="flex items-center gap-2 pb-3 text-[13px] font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="w-4 h-4 rounded accent-zinc-900 dark:accent-white"
          />
          Required
        </label>
      </div>

      {field.type === "select" && (
        <Input
          label="Options (comma separated)"
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
        />
      )}
    </div>
  );
});

const Avatar = memo(function Avatar({ name }) {
  return (
    <span className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-sm font-bold shrink-0">
      {(name?.[0] || "?").toUpperCase()}
    </span>
  );
});

const Metrics = memo(function Metrics({ productCount, totalStock, totalValue, categoryId }) {
  return (
    <>
      <Link to={`/products?category=${categoryId}`} className="hover:underline" title="View products">
        <span className="font-bold text-zinc-900 dark:text-white tabular-nums">{productCount}</span>{" "}
        <span className="text-zinc-500">products</span>
      </Link>
      <span className="text-zinc-300 dark:text-zinc-700">•</span>
      <span>
        <span className="font-bold text-zinc-900 dark:text-white tabular-nums">{totalStock.toLocaleString()}</span>{" "}
        <span className="text-zinc-500">units</span>
      </span>
      <span className="text-zinc-300 dark:text-zinc-700">•</span>
      <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
        ₹{Number(totalValue || 0).toLocaleString("en-IN")}
      </span>
    </>
  );
});

export default function Categories() {
  const { push } = useToast();
  const navigate = useNavigate();
  const { search: globalSearch } = useSearch();
  const [localSearch, setLocalSearch] = useState("");
  const [cats, setCats] = useState([]);
  const [statsMap, setStatsMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("stockly_cats_view") || "grid";
    } catch {
      return "grid";
    }
  });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", status: "active", customFields: [] });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [forceTarget, setForceTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const activeSearch = localSearch || globalSearch;

  const setViewMode = (v) => {
    setView(v);
    try {
      localStorage.setItem("stockly_cats_view", v);
    } catch {}
  };

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
      push("Category force deleted", "success");
      setForceTarget(null);
      load();
    } catch (er) {
      push(er.message, "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const statFor = (c) => {
    const s = statsMap.get(String(c._id));
    return {
      productCount: s?.productCount ?? 0,
      totalStock: s?.totalStock ?? 0,
      totalValue: s?.totalValue ?? 0,
    };
  };

  const openProducts = (c) => {
    if (!c?._id) return;
    navigate(`/products?category=${c._id}`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">{cats.length} groups</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="segmented-control">
            <button
              onClick={() => setViewMode("list")}
              className={`segmented-item ${view === "list" ? "segmented-item-active" : "segmented-item-inactive"}`}
              title="List view"
              aria-label="List view"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`segmented-item ${view === "grid" ? "segmented-item-active" : "segmented-item-inactive"}`}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus size={15} /> <span className="hidden sm:inline">New category</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <SearchInput value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} placeholder="Search categories…" />

      {/* Content */}
      {loading ? (
        view === "grid" ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-10 h-10 !rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-1/2" />
                    <div className="skeleton h-3 w-2/3" />
                  </div>
                </div>
                <div className="skeleton h-8" />
              </div>
            ))}
          </div>
        ) : (
          <TableSkeleton rows={5} />
        )
      ) : !cats.length ? (
        <EmptyState
          icon={FolderKanban}
          title="No categories found"
          hint="Group your inventory and add custom fields per category."
          action={
            <Button onClick={openCreate}>
              <Plus size={15} /> Create category
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {cats.map((c, idx) => {
            const s = statFor(c);
            return (
              <div
                key={c._id}
                style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                onClick={() => openProducts(c)}
                title={`View products in ${c.name}`}
                className="stagger-item card card-hover p-4 flex flex-col gap-3 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={c.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold truncate text-zinc-900 dark:text-white">{c.name}</h3>
                      <Badge status={c.status || "active"} size="sm" />
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">
                      {c.description || "No description"}
                      {c.customFields?.length > 0 && ` • ${c.customFields.length} custom field${c.customFields.length > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(c);
                      }}
                      className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition"
                      title="Edit"
                      aria-label="Edit category"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(c);
                      }}
                      className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition"
                      title="Delete"
                      aria-label="Delete category"
                    >
                      <Trash2 size={14} />
                    </button>
                    <span className="w-8 h-8 grid place-items-center rounded-lg text-zinc-300 dark:text-zinc-600">
                      <ChevronRight size={15} />
                    </span>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Metrics productCount={s.productCount} totalStock={s.totalStock} totalValue={s.totalValue} categoryId={c._id} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {cats.map((c, idx) => {
              const s = statFor(c);
              return (
                <div
                  key={c._id}
                  style={{ animationDelay: `${Math.min(idx * 20, 200)}ms` }}
                  onClick={() => openProducts(c)}
                  title={`View products in ${c.name}`}
                  className="stagger-item px-3.5 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100 dark:active:bg-zinc-800/60 transition cursor-pointer"
                >
                  <Avatar name={c.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate text-zinc-900 dark:text-white">{c.name}</span>
                      <Badge status={c.status || "active"} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs min-w-0" onClick={(e) => e.stopPropagation()}>
                      <Metrics productCount={s.productCount} totalStock={s.totalStock} totalValue={s.totalValue} categoryId={c._id} />
                    </div>
                    {c.customFields?.length > 0 && (
                      <p className="flex items-center gap-1 text-[11px] text-zinc-400 mt-1">
                        <Settings2 size={10} /> {c.customFields.length} custom field{c.customFields.length > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(c);
                      }}
                      className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition"
                      title="Edit"
                      aria-label="Edit category"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(c);
                      }}
                      className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition"
                      title="Delete"
                      aria-label="Delete category"
                    >
                      <Trash2 size={14} />
                    </button>
                    <span className="w-8 h-8 grid place-items-center rounded-lg text-zinc-300 dark:text-zinc-600">
                      <ChevronRight size={15} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!showModal && !deleteTarget && !forceTarget && <FAB onClick={openCreate} label="Add category" />}

      {/* Create / edit */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit category" : "New category"}
        description={editing ? "Update group details and custom fields" : "Group products and define custom fields"}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Electronics, Raw materials"
          />
          <Textarea
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What belongs in this group?"
          />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <span className="input-label">Custom fields ({form.customFields.length})</span>
            <p className="text-xs text-zinc-500 mb-3">
              Extra attributes asked when adding products to this category.
            </p>
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-0.5">
              {form.customFields.map((f, idx) => (
                <FieldRow
                  key={idx}
                  field={f}
                  onChange={(nf) =>
                    setForm({ ...form, customFields: form.customFields.map((x, i) => (i === idx ? nf : x)) })
                  }
                  onRemove={() =>
                    setForm({ ...form, customFields: form.customFields.filter((_, i) => i !== idx) })
                  }
                />
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    customFields: [...form.customFields, { label: "", type: "text", options: [], required: false }],
                  })
                }
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 flex items-center justify-center gap-1.5 transition"
              >
                <Plus size={14} /> Add field
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting} className="flex-1">
              {editing ? "Save changes" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={del}
        loading={deleteLoading}
        title="Delete category?"
        description={deleteTarget ? `"${deleteTarget.name}" will be permanently removed.` : ""}
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmModal
        open={!!forceTarget}
        onClose={() => !deleteLoading && setForceTarget(null)}
        onConfirm={forceDel}
        loading={deleteLoading}
        title="Force delete?"
        description={
          forceTarget
            ? `"${forceTarget.name}" still has products. They will become uncategorized. Continue?`
            : ""
        }
        confirmLabel="Force delete"
        variant="danger"
      />
    </div>
  );
}

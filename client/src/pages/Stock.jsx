import React, { useEffect, useState, useMemo } from "react";
import { getProducts } from "../api/products";
import {
  stockIn,
  stockOut,
  getStockHistory,
  updateStockTransaction,
  deleteStockTransaction,
} from "../api/stock";
import { getCategories } from "../api/categories";
import { getSuppliers } from "../api/suppliers";
import { useToast } from "../context/ToastContext";
import Button from "../components/ui/Button";
import ConfirmModal from "../components/ui/ConfirmModal";
import Modal from "../components/ui/Modal";
import FAB from "../components/ui/FAB";
import { TableSkeleton, EmptyState } from "../components/ui/Loader";
import { Input, Select } from "../components/ui/Input";
import {
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Package,
  Filter,
  ChevronDown,
  ScanLine,
  Calendar,
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSearch } from "../context/SearchContext";
import { playStockInSound, playStockOutSound, playErrorSound } from "../utils/sound";
import { hapticSuccess, hapticLight, hapticWarning } from "../utils/haptics";
import { syncInventoryToWidget } from "../utils/nativeWidget";
import BarcodeScannerModal from "../components/products/BarcodeScannerModal";

function dateKeyFromISO(iso) {
  const d = new Date(iso);
  return d.toISOString().split("T")[0];
}

function labelForDate(key) {
  const todayKey = new Date().toISOString().split("T")[0];
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yKey = y.toISOString().split("T")[0];
  if (key === todayKey) return "Today";
  if (key === yKey) return "Yesterday";
  const date = new Date(key + "T12:00:00");
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

const REASONS = ["Purchase", "Sale", "Adjustment", "Return", "Damage", "Other"];

export default function Stock() {
  const navigate = useNavigate();
  const { push } = useToast();
  const { search: globalSearch } = useSearch();
  const [searchParams] = useSearchParams();

  const urlType = searchParams.get("type");
  const urlProduct = searchParams.get("product");
  const urlAction = searchParams.get("action");

  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(urlProduct || "");
  const [type, setType] = useState(urlType === "OUT" ? "OUT" : "IN");
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState(urlType === "OUT" ? "Sale" : "Purchase");
  const [notes, setNotes] = useState("");
  const [supplier, setSupplier] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [tx, setTx] = useState([]);
  const [categories, setCategories] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(urlAction === "scan");
  const [filters, setFilters] = useState({
    product: "",
    category: "",
    type: "",
    search: "",
    page: 1,
    preset: "all",
    startDate: "",
    endDate: "",
  });

  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(!!(urlType || urlProduct));
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: 1, type: "IN", reason: "", notes: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // sync navbar search -> filters.search
  useEffect(() => {
    setFilters((f) => ({ ...f, search: globalSearch, page: 1 }));
  }, [globalSearch]);

  useEffect(() => {
    getProducts()
      .then((r) => {
        setProducts(r.data);
        if (urlProduct) {
          setProductId(urlProduct);
        } else if (r.data[0] && !productId) {
          setProductId(r.data[0]._id);
        }
      })
      .catch(() => {});
  }, [urlProduct]);

  useEffect(() => {
    getCategories()
      .then((r) => setCategories(r.data))
      .catch(() => {});
    getSuppliers()
      .then((r) => setSuppliers(r.data || []))
      .catch(() => {});
  }, []);

  const presets = [
    { id: "all", label: "All" },
    { id: "today", label: "Today" },
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
    { id: "custom", label: "Custom" },
  ];

  const applyPreset = (preset) => {
    if (preset === "all") {
      setFilters((f) => ({ ...f, preset, startDate: "", endDate: "", page: 1 }));
    } else if (preset === "today") {
      const k = new Date().toISOString().split("T")[0];
      setFilters((f) => ({ ...f, preset, startDate: k, endDate: k, page: 1 }));
    } else if (preset === "7d") {
      const end = new Date().toISOString().split("T")[0];
      const startD = new Date();
      startD.setDate(startD.getDate() - 6);
      const start = startD.toISOString().split("T")[0];
      setFilters((f) => ({ ...f, preset, startDate: start, endDate: end, page: 1 }));
    } else if (preset === "30d") {
      const end = new Date().toISOString().split("T")[0];
      const startD = new Date();
      startD.setDate(startD.getDate() - 29);
      const start = startD.toISOString().split("T")[0];
      setFilters((f) => ({ ...f, preset, startDate: start, endDate: end, page: 1 }));
    } else if (preset === "custom") {
      setFilters((f) => ({ ...f, preset, page: 1 }));
    }
  };

  const loadHistory = () => {
    setLoading(true);
    const params = {};
    if (filters.product) params.product = filters.product;
    if (filters.type) params.type = filters.type;
    if (filters.category) params.category = filters.category;
    if (filters.search) params.search = filters.search;
    if (filters.startDate) params.startDate = new Date(filters.startDate + "T00:00:00").toISOString();
    if (filters.endDate) params.endDate = new Date(filters.endDate + "T23:59:59.999").toISOString();
    params.page = filters.page;
    params.limit = 20;
    getStockHistory(params)
      .then((r) => {
        setTx(r.data);
        setPagination(r.pagination);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, [filters.product, filters.type, filters.category, filters.page, filters.startDate, filters.endDate]);

  useEffect(() => {
    const t = setTimeout(loadHistory, 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const selected = products.find((p) => p._id === productId);

  const openForm = (nextType) => {
    hapticLight();
    setType(nextType);
    setReason(nextType === "OUT" ? "Sale" : "Purchase");
    setShowForm(true);
  };

  const submit = async () => {
    if (!productId) {
      hapticWarning();
      playErrorSound();
      return push("Please select a product", "error");
    }
    if (!quantity || quantity <= 0) {
      hapticWarning();
      playErrorSound();
      return push("Quantity must be greater than 0", "error");
    }
    setSubmitting(true);
    try {
      const payload = {
        productId,
        quantity: Number(quantity),
        reason,
        notes,
        supplier: supplier || undefined,
      };
      if (type === "IN") {
        await stockIn(payload);
        playStockInSound();
      } else {
        await stockOut(payload);
        playStockOutSound();
      }
      hapticSuccess();
      push(`Stock ${type} successful!`, "success");

      const r = await getProducts();
      const updatedProducts = r.data || [];
      setProducts(updatedProducts);
      setNotes("");
      setQuantity(0);
      loadHistory();
      setShowForm(false);

      // Sync updated metrics to Android Home Widget
      const lowCount = updatedProducts.filter((p) => p.quantity <= (p.minimumStock ?? 5)).length;
      syncInventoryToWidget({
        totalProducts: updatedProducts.length,
        lowStockCount: lowCount,
      }).catch(() => {});
    } catch (e) {
      hapticWarning();
      playErrorSound();
      push(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (t) => {
    setEditingTx(t);
    setEditForm({ quantity: t.quantity, type: t.type, reason: t.reason, notes: t.notes || "" });
  };

  const handleUpdate = async () => {
    if (!editingTx) return;
    try {
      await updateStockTransaction(editingTx._id, {
        quantity: Number(editForm.quantity),
        type: editForm.type,
        reason: editForm.reason,
        notes: editForm.notes,
      });
      push("Transaction updated", "success");
      setEditingTx(null);
      loadHistory();
      const r = await getProducts();
      setProducts(r.data);
    } catch (e) {
      push(e.message, "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteStockTransaction(deleteTarget._id);
      push("Transaction deleted", "success");
      setDeleteTarget(null);
      loadHistory();
      const r = await getProducts();
      setProducts(r.data);
    } catch (e) {
      push(e.message, "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map();
    tx.forEach((t) => {
      const key = dateKeyFromISO(t.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [tx]);

  const totalIn = tx.filter((t) => t.type === "IN").reduce((a, b) => a + b.quantity, 0);
  const totalOut = tx.filter((t) => t.type === "OUT").reduce((a, b) => a + b.quantity, 0);
  const hasActiveFilters = filters.product || filters.category || filters.type || globalSearch;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Stock ledger</h1>
          <p className="page-subtitle">Audit trail of every movement</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              hapticLight();
              setScannerOpen(true);
            }}
            title="Scan barcode"
          >
            <ScanLine size={15} /> <span className="hidden sm:inline">Scan</span>
          </Button>
          <Button size="sm" variant="success" onClick={() => openForm("IN")}>
            <ArrowUp size={15} /> Stock in
          </Button>
          <Button size="sm" variant="danger" onClick={() => openForm("OUT")}>
            <ArrowDown size={15} /> Stock out
          </Button>
        </div>
      </div>

      {/* Summary + presets */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3.5 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
            <ArrowUp size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Inbound</span>
            <span className="block text-lg font-bold tabular-nums text-zinc-900 dark:text-white leading-tight">
              +{totalIn}
            </span>
          </span>
        </div>
        <div className="card p-3.5 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 grid place-items-center shrink-0">
            <ArrowDown size={16} />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500">Outbound</span>
            <span className="block text-lg font-bold tabular-nums text-zinc-900 dark:text-white leading-tight">
              −{totalOut}
            </span>
          </span>
        </div>
      </div>

      <div className="card p-2.5">
        <div className="segmented-control w-full grid grid-cols-5 gap-1">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`segmented-item ${filters.preset === p.id ? "segmented-item-active" : "segmented-item-inactive"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {filters.preset === "custom" && (
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <Input
              type="date"
              label="From"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
            />
            <Input
              type="date"
              label="To"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
            />
          </div>
        )}
      </div>

      {/* Filter row */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="btn-ghost h-9 min-h-0 px-3.5 text-xs"
        >
          <Filter size={14} className="text-zinc-400" />
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          <ChevronDown size={13} className={`text-zinc-400 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>
        <span className="text-xs text-zinc-500 truncate">
          {tx.length} movements{tx.length === 1 ? "" : "s"}
        </span>
      </div>

      {showFilters && (
        <div className="card p-4 grid sm:grid-cols-3 gap-3 animate-slide-up">
          <Select
            label="Product"
            value={filters.product}
            onChange={(e) => setFilters({ ...filters, product: e.target.value, page: 1 })}
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            label="Category"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div>
            <span className="input-label">Movement</span>
            <div className="segmented-control w-full grid grid-cols-3 gap-1">
              {[
                { id: "", label: "All" },
                { id: "IN", label: "In" },
                { id: "OUT", label: "Out" },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setFilters({ ...filters, type: o.id, page: 1 })}
                  className={`segmented-item ${filters.type === o.id ? "segmented-item-active" : "segmented-item-inactive"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Movements */}
      {loading && tx.length === 0 ? (
        <TableSkeleton rows={6} />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No movements found"
          hint="Try a different date range, or record your first stock movement."
          action={
            <Button variant="success" onClick={() => openForm("IN")}>
              <ArrowUp size={15} /> Record stock in
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([key, items], gi) => {
            const inSum = items.filter((t) => t.type === "IN").reduce((a, b) => a + b.quantity, 0);
            const outSum = items.filter((t) => t.type === "OUT").reduce((a, b) => a + b.quantity, 0);
            return (
              <section key={key} className="stagger-item" style={{ animationDelay: `${Math.min(gi * 40, 240)}ms` }}>
                <div className="flex items-center justify-between px-1 mb-2">
                  <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    <Calendar size={13} />
                    {labelForDate(key)}
                    <span className="font-medium opacity-70">• {items.length}</span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums">
                    {inSum > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{inSum}</span>}
                    {outSum > 0 && <span className="text-red-500">−{outSum}</span>}
                  </div>
                </div>
                <div className="card overflow-hidden">
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {items.map((t) => {
                      const isIN = t.type === "IN";
                      return (
                        <div key={t._id} className="px-3.5 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                          <span className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0">
                            {t.productId?.image ? (
                              <img src={t.productId.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={17} className="text-zinc-400" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13px] font-semibold truncate text-zinc-900 dark:text-white">
                                {t.productId?.name || "Product"}
                              </span>
                              <span
                                className={`text-[13px] font-bold tabular-nums shrink-0 ${
                                  isIN ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {isIN ? "+" : "−"}
                                {t.quantity} <span className="font-medium text-zinc-400">{t.productId?.unit || ""}</span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 mt-0.5">
                              <span className="truncate">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${isIN ? "bg-emerald-500" : "bg-red-500"}`} />
                                {t.reason || (isIN ? "Purchase" : "Sale")}
                                {t.supplier?.name && ` • ${t.supplier.name}`}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => openEdit(t)}
                              className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition"
                              title="Edit"
                              aria-label="Edit movement"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(t)}
                              className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition"
                              title="Delete"
                              aria-label="Delete movement"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}

          {pagination && pagination.pages > 1 && (
            <div className="card p-3 flex items-center justify-between">
              <Button variant="secondary" size="sm" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>
                Prev
              </Button>
              <span className="text-xs text-zinc-500">
                Page <span className="font-bold text-zinc-800 dark:text-zinc-200">{pagination.page}</span> of {pagination.pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page >= pagination.pages}
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {!showForm && !editingTx && !deleteTarget && <FAB onClick={() => openForm("IN")} label="Record movement" />}

      {/* Record movement */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Record movement" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => {
                setType("IN");
                setReason("Purchase");
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition ${
                type === "IN" ? "bg-emerald-600 text-white shadow-sm" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <ArrowUp size={15} /> Stock in
            </button>
            <button
              type="button"
              onClick={() => {
                setType("OUT");
                setReason("Sale");
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition ${
                type === "OUT"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <ArrowDown size={15} /> Stock out
            </button>
          </div>

          <Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} — {p.quantity} {p.unit} in stock
              </option>
            ))}
          </Select>

          {selected && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0">
                {selected.image ? (
                  <img src={selected.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package size={16} className="text-zinc-400" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold truncate text-zinc-900 dark:text-white">{selected.name}</span>
                <span className="block text-xs text-zinc-500">
                  {selected.sku || "No SKU"} • {selected.quantity} {selected.unit} available
                </span>
              </span>
            </div>
          )}

          <div>
            <span className="input-label">Quantity{selected?.unit ? ` (${selected.unit})` : ""}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(0, Number(q) - 1))}
                className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-lg font-bold grid place-items-center active:scale-95 transition shrink-0"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))}
                className="input-field h-12 text-center text-lg font-bold tabular-nums"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Number(q) + 1)}
                className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-lg font-bold grid place-items-center active:scale-95 transition shrink-0"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <div className={`grid gap-3 ${type === "IN" ? "sm:grid-cols-2" : ""}`}>
            <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            {type === "IN" && (
              <Select label="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                <option value="">No supplier</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Invoice no., customer, …" />

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant={type === "IN" ? "success" : "danger"} onClick={submit} loading={submitting} className="flex-[2]">
              Confirm {type} • {quantity}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete movement?"
        description={
          deleteTarget
            ? `${deleteTarget.type} of ${deleteTarget.quantity} units for "${deleteTarget.productId?.name}" will be removed and stock reverted.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
      />

      <Modal open={!!editingTx} onClose={() => setEditingTx(null)} title="Edit movement" size="sm">
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
              <option value="IN">In</option>
              <option value="OUT">Out</option>
            </Select>
            <Input
              label="Quantity"
              type="number"
              inputMode="numeric"
              value={editForm.quantity}
              onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
            />
          </div>
          <Input label="Reason" value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} placeholder="Reason" />
          <Input label="Notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes" />
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setEditingTx(null)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleUpdate} className="flex-1">
              Save changes
            </Button>
          </div>
        </div>
      </Modal>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        products={products}
        onSelectProduct={(p) => {
          setProductId(p._id);
          setShowForm(true);
        }}
        onQuickStockIn={(p) => {
          setProductId(p._id);
          setType("IN");
          setReason("Purchase");
          setShowForm(true);
        }}
        onQuickStockOut={(p) => {
          setProductId(p._id);
          setType("OUT");
          setReason("Sale");
          setShowForm(true);
        }}
        onAddProductWithSku={(sku) => {
          navigate(`/products?action=add&sku=${encodeURIComponent(sku)}`);
        }}
      />
    </div>
  );
}

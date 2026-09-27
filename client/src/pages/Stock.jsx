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
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  Clock,
  Filter,
  ChevronDown,
  X,
  FolderKanban,
  Layers,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Modal from "../components/ui/Modal";
import { useSearch } from "../context/SearchContext";
import FAB from "../components/ui/FAB";
import { playStockInSound, playStockOutSound, playErrorSound, playSuccessSound } from "../utils/sound";
import { hapticSuccess, hapticMedium, hapticLight, hapticWarning } from "../utils/haptics";
import { syncInventoryToWidget } from "../utils/nativeWidget";
import BarcodeScannerModal from "../components/products/BarcodeScannerModal";
import { QrCode, ScanLine } from "lucide-react";

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

function fullDateLabel(key) {
  const date = new Date(key + "T12:00:00");
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const QUICK_ADD_AMOUNTS = [1, 5, 10, 25, 50, 100];

export default function Stock() {
  const navigate = useNavigate();
  const { push } = useToast();
  const { search: globalSearch } = useSearch();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlType = searchParams.get("type");
  const urlProduct = searchParams.get("product");
  const urlAction = searchParams.get("action");

  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(urlProduct || "");
  const [type, setType] = useState(urlType === "OUT" ? "OUT" : "IN");
  const [quantity, setQuantity] = useState(1);
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
  const [editForm, setEditForm] = useState({
    quantity: 1,
    type: "IN",
    reason: "",
    notes: "",
  });
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
    { id: "all", label: "All time" },
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "custom", label: "Custom" },
  ];

  const applyPreset = (preset) => {
    if (preset === "all") {
      setFilters((f) => ({ ...f, preset, startDate: "", endDate: "", page: 1 }));
    } else if (preset === "today") {
      const k = new Date().toISOString().split("T")[0];
      setFilters((f) => ({ ...f, preset, startDate: k, endDate: k, page: 1 }));
    } else if (preset === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const k = d.toISOString().split("T")[0];
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
    if (filters.startDate)
      params.startDate = new Date(filters.startDate + "T00:00:00").toISOString();
    if (filters.endDate)
      params.endDate = new Date(filters.endDate + "T23:59:59.999").toISOString();
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
  }, [
    filters.product,
    filters.type,
    filters.category,
    filters.page,
    filters.startDate,
    filters.endDate,
  ]);

  useEffect(() => {
    const t = setTimeout(loadHistory, 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const selected = products.find((p) => p._id === productId);

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
      setQuantity(1);
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
    setEditForm({
      quantity: t.quantity,
      type: t.type,
      reason: t.reason,
      notes: t.notes || "",
    });
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
      push("Updated", "success");
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
      push("Deleted", "success");
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

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 animate-fade-in">
      {/* 1. HEADER & QUICK ACTION PILLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Stock Ledger
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Real-time audit trail of IN / OUT inventory movements
          </p>
        </div>

        {/* Quick IN / OUT Hero Trigger Buttons */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setScannerOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs sm:text-sm border border-amber-500/20 active:scale-95 transition min-h-[42px]"
            title="Scan Product Barcode"
          >
            <ScanLine size={16} />
            <span>Scan</span>
          </button>

          <button
            onClick={() => {
              hapticLight();
              setType("IN");
              setReason("Purchase");
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-sm hover:bg-emerald-700 active:scale-95 transition min-h-[42px]"
          >
            <ArrowUp size={15} /> Stock IN
          </button>
          <button
            onClick={() => {
              hapticLight();
              setType("OUT");
              setReason("Sale");
              setShowForm(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white font-bold text-xs sm:text-sm shadow-sm hover:bg-zinc-800 active:scale-95 transition min-h-[42px]"
          >
            <ArrowDown size={15} /> Stock OUT
          </button>
        </div>
      </div>

      {/* 2. SUMMARY METRIC PILLS & PRESET CAROUSEL */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
            <ArrowUp size={18} />
          </div>
          <div>
            <div className="text-xs text-zinc-500 font-medium">Inbound</div>
            <div className="text-base font-bold text-zinc-900 dark:text-white">+{totalIn} units</div>
          </div>
        </div>

        <div className="card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 grid place-items-center shrink-0">
            <ArrowDown size={18} />
          </div>
          <div>
            <div className="text-xs text-zinc-500 font-medium">Outbound</div>
            <div className="text-base font-bold text-zinc-900 dark:text-white">-{totalOut} units</div>
          </div>
        </div>

        {/* Date presets horizontal bar */}
        <div className="col-span-2 card p-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                filters.preset === p.id
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. FILTER ACCORDION / TOGGLE */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold shadow-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          <Filter size={14} className="text-zinc-500" />
          <span>Filters</span>
          {(filters.product || filters.category || filters.type || globalSearch) && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
          <ChevronDown
            size={13}
            className={`text-zinc-400 transition-transform ${showFilters ? "rotate-180" : ""}`}
          />
        </button>

        <div className="text-xs text-zinc-500 font-medium truncate">
          {tx.length} transactions {filters.preset !== "all" ? `(${filters.preset})` : ""}
        </div>
      </div>

      {showFilters && (
        <div className="card p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 animate-slide-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Product
              </label>
              <select
                value={filters.product}
                onChange={(e) => setFilters({ ...filters, product: e.target.value, page: 1 })}
                className="input-field h-10 text-xs"
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
                className="input-field h-10 text-xs"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Type
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "", label: "All" },
                  { id: "IN", label: "IN" },
                  { id: "OUT", label: "OUT" },
                ].map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setFilters({ ...filters, type: o.id, page: 1 })}
                    className={`py-2 rounded-lg text-xs font-semibold border ${
                      filters.type === o.id
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. STOCK MOVEMENTS LIST (Grouped by Date) */}
      <div className="space-y-4">
        {grouped.length === 0 && !loading && (
          <div className="card py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 grid place-items-center mx-auto text-zinc-400">
              <Package size={22} />
            </div>
            <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-3">
              No transactions recorded
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Select another date filter or tap Stock IN/OUT to record movement.
            </p>
          </div>
        )}

        {grouped.map(([key, items]) => {
          const inItems = items.filter((t) => t.type === "IN");
          const outItems = items.filter((t) => t.type === "OUT");
          const inSum = inItems.reduce((a, b) => a + b.quantity, 0);
          const outSum = outItems.reduce((a, b) => a + b.quantity, 0);

          return (
            <div key={key} className="card overflow-hidden p-0 border border-zinc-200/80 dark:border-zinc-800">
              {/* Date Section Header */}
              <div className="px-4 py-3 bg-zinc-50/80 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center text-xs font-black">
                    {new Date(key + "T12:00:00").getDate()}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                      {labelForDate(key)}
                    </span>
                    <span className="text-[11px] text-zinc-500 ml-1.5">
                      ({items.length} records)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  {inSum > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                      +{inSum}
                    </span>
                  )}
                  {outSum > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
                      -{outSum}
                    </span>
                  )}
                </div>
              </div>

              {/* Transactions List */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((t) => {
                  const isIN = t.type === "IN";
                  return (
                    <div
                      key={t._id}
                      className="p-3.5 flex items-center gap-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition"
                    >
                      {/* Product Thumbnail */}
                      <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0">
                        {t.productId?.image ? (
                          <img
                            src={t.productId.image}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-base">📦</span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {t.productId?.name || "Product"}
                          </span>
                          <span
                            className={`text-xs font-black shrink-0 ${
                              isIN
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-zinc-900 dark:text-white"
                            }`}
                          >
                            {isIN ? "+" : "-"}{t.quantity} {t.productId?.unit || "units"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 mt-0.5">
                          <span className="truncate">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                                isIN ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />
                            {t.reason || (isIN ? "Purchase" : "Sale")}
                            {t.supplier?.name && ` • ${t.supplier.name}`}
                          </span>
                          <span className="shrink-0">
                            {new Date(t.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Row Actions */}
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          onClick={() => openEdit(t)}
                          className="w-8 h-8 grid place-items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 active:scale-95 transition text-zinc-600 dark:text-zinc-300"
                          title="Edit movement"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="w-8 h-8 grid place-items-center rounded-lg bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 active:scale-95 transition"
                          title="Delete movement"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="py-6 flex justify-center">
            <div className="loader w-5 h-5" />
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="card p-3 flex items-center justify-between text-sm">
            <Button
              variant="secondary"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              Prev
            </Button>
            <span className="text-xs font-medium text-zinc-500">
              Page {pagination.page} of {pagination.pages}
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

      {/* Floating Action Button (FAB) */}
      {!showForm && !editingTx && !deleteTarget && (
        <FAB onClick={() => setShowForm(true)} label="Stock Transaction" />
      )}

      {/* 5. TRANSACTION CREATE MODAL (Mobile-Optimized) */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Record Stock Movement"
        size="md"
      >
        <div className="space-y-4">
          {/* Movement Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setType("IN");
                setReason("Purchase");
              }}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[42px] ${
                type === "IN"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <ArrowUp size={15} /> Stock IN (Receive)
            </button>
            <button
              type="button"
              onClick={() => {
                setType("OUT");
                setReason("Sale");
              }}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[42px] ${
                type === "OUT"
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <ArrowDown size={15} /> Stock OUT (Dispatch)
            </button>
          </div>

          {/* Product Select Card */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Select Product *
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="input-field h-11 text-xs font-semibold"
            >
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — Current: {p.quantity} {p.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Product Snapshot */}
          {selected && (
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0">
                  {selected.image ? (
                    <img src={selected.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>📦</span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white">
                    {selected.name}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    SKU: {selected.sku || "N/A"} • Available: {selected.quantity} {selected.unit}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quantity Stepper & Quick Add Pills */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Quantity ({selected?.unit || "units"}) *
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, Number(q) - 1))}
                className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-lg font-bold grid place-items-center active:scale-95 transition"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="flex-1 h-12 text-center border border-zinc-200 dark:border-zinc-700 rounded-xl font-black text-xl bg-white dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Number(q) + 1)}
                className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-lg font-bold grid place-items-center active:scale-95 transition"
              >
                +
              </button>
            </div>

            {/* Quick quantity chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {QUICK_ADD_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setQuantity(amt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                    Number(quantity) === amt
                      ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Reason & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field h-11 text-xs"
              >
                <option>Purchase</option>
                <option>Sale</option>
                <option>Adjustment</option>
                <option>Return</option>
                <option>Damage</option>
                <option>Other</option>
              </select>
            </div>

            {type === "IN" && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Supplier
                </label>
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="input-field h-11 text-xs"
                >
                  <option value="">No supplier</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Notes (Optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Invoice #1029, customer dispatch..."
              className="input-field h-11 text-xs"
            />
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowForm(false)}
              className="w-full sm:w-1/3 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              loading={submitting}
              className={`w-full sm:w-2/3 min-h-[44px] font-bold ${
                type === "IN"
                  ? "!bg-emerald-600 hover:!bg-emerald-700 !text-white"
                  : "!bg-zinc-900 dark:!bg-white !text-white dark:!text-zinc-900"
              }`}
            >
              Confirm {type} ({quantity} {selected?.unit || "units"})
            </Button>
          </div>
        </div>
      </Modal>

      {/* 6. DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete transaction?"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.type} of ${deleteTarget.quantity} units for "${deleteTarget.productId?.name}"? Stock will be reverted.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
      />

      {/* 7. EDIT TRANSACTION MODAL */}
      <Modal
        open={!!editingTx}
        onClose={() => setEditingTx(null)}
        title="Edit Transaction"
        size="sm"
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Type
              </label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                className="input-field h-11 text-xs"
              >
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Quantity
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                className="input-field h-11 text-xs font-bold"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Reason
            </label>
            <input
              value={editForm.reason}
              onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
              placeholder="Reason"
              className="input-field h-11 text-xs"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              Notes
            </label>
            <input
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Notes"
              className="input-field h-11 text-xs"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setEditingTx(null)}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} className="flex-1 min-h-[44px]">
              Update
            </Button>
          </div>
        </div>
      </Modal>

      {/* 8. BARCODE & SKU SCANNER MODAL */}
      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        products={products}
        onSelectProduct={(p) => {
          setSelected(p);
          setShowForm(true);
        }}
        onQuickStockIn={(p) => {
          setSelected(p);
          setType("IN");
          setReason("Purchase");
          setShowForm(true);
        }}
        onQuickStockOut={(p) => {
          setSelected(p);
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

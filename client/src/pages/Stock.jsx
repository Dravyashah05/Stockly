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
  ChevronLeft,
  ChevronRight,
  ScanLine,
  Calendar,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  X,
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSearch } from "../context/SearchContext";
import { playStockInSound, playStockOutSound, playErrorSound } from "../utils/sound";
import { hapticSuccess, hapticLight, hapticWarning } from "../utils/haptics";
import BarcodeScannerModal from "../components/products/BarcodeScannerModal";

const QUICK_QTYS = [1, 5, 10, 25, 50, 100];

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
const PAGE_SIZES = [20, 50, 100];

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
  const [pageLimit, setPageLimit] = useState(20);
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
  const [detailTx, setDetailTx] = useState(null);
  const historySeq = React.useRef(0);

  const txProductId = (t) =>
    !t ? "" : typeof t.productId === "string" ? t.productId : t.productId?._id || "";
  const txProduct = (t) =>
    t && typeof t.productId === "object" ? t.productId : null;

  const setTypeFilter = (next) => {
    hapticLight();
    setFilters((f) => ({ ...f, type: next, page: 1 }));
  };

  const openProductDetails = (t) => {
    const id = txProductId(t);
    if (!id) {
      push("Product no longer available", "error");
      return;
    }
    hapticLight();
    setDetailTx(null);
    navigate(`/products/${id}`);
  };

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

  const loadHistory = (signal, requestId) => {
    setLoading(true);
    const params = {};
    if (filters.product) params.product = filters.product;
    if (filters.type) params.type = filters.type;
    if (filters.category) params.category = filters.category;
    if (filters.search) params.search = filters.search;
    if (filters.startDate) params.startDate = new Date(filters.startDate + "T00:00:00").toISOString();
    if (filters.endDate) params.endDate = new Date(filters.endDate + "T23:59:59.999").toISOString();
    params.page = filters.page;
    params.limit = pageLimit;
    getStockHistory(params, signal ? { signal } : undefined)
      .then((r) => {
        // Drop stale responses: only the latest request may write state.
        if (requestId !== undefined && requestId !== historySeq.current) return;
        setTx(r.data);
        setPagination(r.pagination);
      })
      .catch(() => {
        // Aborts and transient failures are swallowed here; the retry
        // policy in api/client already handled one retry. Loud toasts
        // on every keystroke race would be noise.
      })
      .finally(() => {
        if (requestId === undefined || requestId === historySeq.current) setLoading(false);
      });
  };

  // Single abortable + debounced effect for all history filters. Previously
  // two effects (immediate + 300ms search debounce) double-fetched on mount
  // and let slower stale responses overwrite newer ones.
  useEffect(() => {
    const seq = ++historySeq.current;
    const controller = new AbortController();
    const t = setTimeout(() => loadHistory(controller.signal, seq), 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [filters.product, filters.type, filters.category, filters.search, filters.page, filters.startDate, filters.endDate, pageLimit]);

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

  const { totalIn, totalOut } = useMemo(() => {
    let tIn = 0;
    let tOut = 0;
    for (const t of tx) {
      if (t.type === "IN") tIn += t.quantity;
      else if (t.type === "OUT") tOut += t.quantity;
    }
    return { totalIn: tIn, totalOut: tOut };
  }, [tx]);
  const hasActiveFilters = filters.product || filters.category || filters.type || globalSearch;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Ledger</h1>
          <p className="page-subtitle">Transaction history</p>
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
            <ArrowUp size={15} /> In
          </Button>
          <Button size="sm" variant="danger" onClick={() => openForm("OUT")}>
            <ArrowDown size={15} /> Out
          </Button>
        </div>
      </div>

      {/* Summary cards — tap to filter: In / Out / All (Net). 3-up on all sizes; compact centered stack on phones, inline on sm+ */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setTypeFilter(filters.type === "IN" ? "" : "IN")}
          aria-pressed={filters.type === "IN"}
          title={filters.type === "IN" ? "Clear IN filter — show all" : "Show inbound only"}
          className={`card min-w-0 overflow-hidden p-2 min-[400px]:p-2.5 sm:p-3.5 flex flex-col items-center text-center gap-1.5 sm:flex-row sm:items-center sm:text-left sm:gap-3 cursor-pointer transition active:scale-[0.98] hover:border-emerald-300 dark:hover:border-emerald-500/40 ${
            filters.type === "IN" ? "ring-2 ring-emerald-500 border-emerald-300 dark:border-emerald-500/50" : ""
          }`}
        >
          <span className="w-7 h-7 min-[400px]:w-8 min-[400px]:h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
            <TrendingUp size={15} />
          </span>
          <span className="min-w-0 w-full sm:w-auto sm:flex-1">
            <span className="block text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 truncate">
              <span className="sm:hidden">In</span>
              <span className="hidden sm:inline">Inbound</span>
            </span>
            <span
              title={`+${totalIn.toLocaleString()}`}
              className="block text-sm min-[400px]:text-base sm:text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight truncate"
            >
              +{totalIn.toLocaleString()}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter(filters.type === "OUT" ? "" : "OUT")}
          aria-pressed={filters.type === "OUT"}
          title={filters.type === "OUT" ? "Clear OUT filter — show all" : "Show outbound only"}
          className={`card min-w-0 overflow-hidden p-2 min-[400px]:p-2.5 sm:p-3.5 flex flex-col items-center text-center gap-1.5 sm:flex-row sm:items-center sm:text-left sm:gap-3 cursor-pointer transition active:scale-[0.98] hover:border-red-300 dark:hover:border-red-500/40 ${
            filters.type === "OUT" ? "ring-2 ring-red-500 border-red-300 dark:border-red-500/50" : ""
          }`}
        >
          <span className="w-7 h-7 min-[400px]:w-8 min-[400px]:h-8 sm:w-9 sm:h-9 rounded-xl bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 grid place-items-center shrink-0">
            <TrendingDown size={15} />
          </span>
          <span className="min-w-0 w-full sm:w-auto sm:flex-1">
            <span className="block text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 truncate">
              <span className="sm:hidden">Out</span>
              <span className="hidden sm:inline">Outbound</span>
            </span>
            <span
              title={`−${totalOut.toLocaleString()}`}
              className="block text-sm min-[400px]:text-base sm:text-lg font-bold tabular-nums text-red-600 dark:text-red-400 leading-tight truncate"
            >
              −{totalOut.toLocaleString()}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTypeFilter("")}
          aria-pressed={!filters.type}
          title="Show all movements"
          className={`card min-w-0 overflow-hidden p-2 min-[400px]:p-2.5 sm:p-3.5 flex flex-col items-center text-center gap-1.5 sm:flex-row sm:items-center sm:text-left sm:gap-3 cursor-pointer transition active:scale-[0.98] ${
            !filters.type ? "ring-2 ring-zinc-400 dark:ring-zinc-500" : ""
          }`}
        >
          <span className={`w-7 h-7 min-[400px]:w-8 min-[400px]:h-8 sm:w-9 sm:h-9 rounded-xl grid place-items-center shrink-0 ${
            totalIn - totalOut >= 0
              ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400"
          }`}>
            {totalIn - totalOut >= 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
          </span>
          <span className="min-w-0 w-full sm:w-auto sm:flex-1">
            <span className="block text-[9px] min-[400px]:text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-zinc-500 truncate">Net</span>
            <span title={String((totalIn - totalOut).toLocaleString())} className={`block text-sm min-[400px]:text-base sm:text-lg font-bold tabular-nums leading-tight truncate ${
              totalIn - totalOut >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}>
              {totalIn - totalOut >= 0 ? "+" : ""}{(totalIn - totalOut).toLocaleString()}
            </span>
          </span>
        </button>
      </div>

      {/* Date presets — swipeable row on phones, even grid on sm+ */}
      <div className="card p-2.5">
        <div className="segmented-control w-full flex overflow-x-auto no-scrollbar gap-1 sm:grid sm:grid-cols-5">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`segmented-item shrink-0 flex-1 whitespace-nowrap ${filters.preset === p.id ? "segmented-item-active" : "segmented-item-inactive"}`}
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

      {/* Filter toggle row */}
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
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={() => setFilters(f => ({ ...f, product: "", category: "", type: "", page: 1 }))}
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
            >
              <X size={12} /> Clear
            </button>
          )}
          <span className="text-xs text-zinc-500">
            {pagination?.total ?? tx.length} movement{(pagination?.total ?? tx.length) !== 1 ? "s" : ""}
          </span>
        </div>
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

      {/* Movements list */}
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
                        <div
                          key={t._id}
                          onClick={() => {
                            hapticLight();
                            setDetailTx(t);
                          }}
                          title="View movement details"
                          className="px-3.5 py-3 flex items-center gap-2.5 sm:gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100 dark:active:bg-zinc-800/60 transition cursor-pointer"
                        >                          {/* Type icon — sm+ only (mobile uses the corner badge on the thumb) */}
                          <span className={`hidden sm:grid w-9 h-9 rounded-xl place-items-center shrink-0 border ${
                            isIN
                              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400"
                          }`}>
                            {isIN ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                          </span>
                          <span className="relative w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-visible grid place-items-center shrink-0">
                            <span className="w-full h-full rounded-[10px] overflow-hidden grid place-items-center">
                              {t.productId?.image ? (
                                <img src={t.productId.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                              ) : (
                                <Package size={15} className="text-zinc-400" />
                              )}
                            </span>
                            <span className={`sm:hidden absolute -bottom-1 -right-1 w-5 h-5 rounded-full grid place-items-center border-2 border-white dark:border-zinc-900 text-white ${
                              isIN ? "bg-emerald-500" : "bg-red-500"
                            }`}>
                              {isIN ? <ArrowUp size={10} strokeWidth={3} /> : <ArrowDown size={10} strokeWidth={3} />}
                            </span>
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
                                {t.quantity} <span className="font-medium text-zinc-400 text-[11px]">{t.productId?.unit || ""}</span>
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
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(t);
                              }}
                              className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition"
                              title="Edit"
                              aria-label="Edit movement"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(t);
                              }}
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

          {/* Pagination — wraps on phones so controls never overflow */}
          {pagination && pagination.pages > 1 && (
            <div className="card p-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-zinc-500">
                Page <span className="font-bold text-zinc-800 dark:text-zinc-200">{pagination.page}</span> of {pagination.pages}
                <span className="hidden sm:inline"> • {pagination.total} items</span>
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={pageLimit}
                  onChange={(e) => { setPageLimit(Number(e.target.value)); setFilters(f => ({ ...f, page: 1 })); }}
                  className="flex-1 sm:flex-none min-h-[36px] text-xs bg-zinc-100 dark:bg-zinc-800 border-0 rounded-lg px-2 py-1.5 text-zinc-600 dark:text-zinc-300 outline-none"
                  aria-label="Items per page"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>{n} / page</option>
                  ))}
                </select>
                <Button variant="secondary" size="sm" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>
                  <ChevronLeft size={14} /> <span className="hidden min-[400px]:inline">Prev</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={filters.page >= pagination.pages}
                  onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                >
                  <span className="hidden min-[400px]:inline">Next</span> <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record movement modal */}
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
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold truncate text-zinc-900 dark:text-white">{selected.name}</span>
                <span className="block text-xs text-zinc-500">
                  {selected.sku || "No SKU"} • {selected.quantity} {selected.unit} available
                </span>
              </span>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                selected.quantity === 0
                  ? "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300"
                  : selected.quantity <= (selected.minimumStock ?? 5)
                  ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              }`}>
                {selected.quantity === 0 ? "Out" : selected.quantity <= (selected.minimumStock ?? 5) ? "Low" : "OK"}
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
            {/* Quick quantity presets */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {QUICK_QTYS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    quantity === q
                      ? type === "IN"
                        ? "bg-emerald-600 text-white"
                        : "bg-red-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {q}
                </button>
              ))}
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

      <Modal
        open={!!detailTx}
        onClose={() => setDetailTx(null)}
        title="Movement details"
        size="sm"
        description={
          detailTx
            ? `${new Date(detailTx.createdAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })} • ${new Date(detailTx.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : ""
        }
      >
        {detailTx && (() => {
          const p = txProduct(detailTx);
          const pid = txProductId(detailTx);
          const isIN = detailTx.type === "IN";
          return (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0">
                  {p?.image ? (
                    <img src={p.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package size={17} className="text-zinc-400" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold truncate text-zinc-900 dark:text-white">
                    {p?.name || "Product"}
                  </span>
                  <span className="block text-xs text-zinc-500 truncate">
                    {[p?.sku, p?.unit].filter(Boolean).join(" • ") || (pid ? `ID: ${String(pid).slice(-6)}` : "")}
                  </span>
                </span>
                <span className={`text-sm font-bold tabular-nums shrink-0 ${isIN ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {isIN ? "+" : "−"}{Number(detailTx.quantity).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-500">Type</div>
                  <div className={`mt-0.5 font-bold inline-flex items-center gap-1 ${isIN ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {isIN ? <ArrowUp size={12} /> : <ArrowDown size={12} />} {detailTx.type}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-500">Reason</div>
                  <div className="mt-0.5 font-semibold text-zinc-900 dark:text-white truncate">{detailTx.reason || (isIN ? "Purchase" : "Sale")}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-500">Supplier</div>
                  <div className="mt-0.5 font-semibold text-zinc-900 dark:text-white truncate">{detailTx.supplier?.name || "—"}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-500">Stock change</div>
                  <div className="mt-0.5 font-semibold font-mono text-zinc-900 dark:text-white">
                    {detailTx.previousQuantity ?? "?"} → {detailTx.newQuantity ?? "?"}
                  </div>
                </div>
              </div>

              {detailTx.notes && (
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-zinc-500">Notes</div>
                  <div className="mt-0.5 text-zinc-700 dark:text-zinc-200 break-words">{detailTx.notes}</div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <Button variant="secondary" onClick={() => openProductDetails(detailTx)} className="w-full" disabled={!pid}>
                  <ExternalLink size={14} /> Open in details
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      const t = detailTx;
                      setDetailTx(null);
                      openEdit(t);
                    }}
                  >
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => {
                      const t = detailTx;
                      setDetailTx(null);
                      setDeleteTarget(t);
                    }}
                  >
                    <Trash2 size={13} /> Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete movement?"
        description={
          deleteTarget
            ? `${deleteTarget.type} of ${deleteTarget.quantity} units for "${
                (typeof deleteTarget.productId === "object" ? deleteTarget.productId?.name : "") || "Product"
              }" will be removed and stock reverted.`
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

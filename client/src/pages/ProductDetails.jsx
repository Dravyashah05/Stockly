import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getProduct, deleteProduct, updateProduct } from "../api/products";
import { stockIn, stockOut, getStockHistoryByProduct } from "../api/stock";
import { getCategories } from "../api/categories";
import { getSuppliers } from "../api/suppliers";
import { openAiCopilot } from "../api/ai";
import { hapticMedium, hapticLight } from "../utils/haptics";
import { useToast } from "../context/ToastContext";
import Badge, { getProductStatus } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import ProductFormModal from "../components/products/ProductFormModal";
import {
  ArrowLeft,
  Trash2,
  ArrowUp,
  ArrowDown,
  Package,
  TrendingUp,
  Calendar,
  Box,
  Printer,
  Barcode,
  Edit2,
  Copy,
  Check,
  Tag,
  Building2,
  Layers,
  Clock,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "../components/ui/Loader";

function BarcodeSVG({ value }) {
  const bars = [];
  const text = value || "STOCKLY-SKU";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bars.push((code % 3) + 1);
    bars.push(1);
    bars.push((code % 2) + 1);
    bars.push(1);
  }

  let currentX = 10;
  return (
    <div className="flex flex-col items-center">
      <svg className="h-16 w-full max-w-[280px]" viewBox="0 0 300 60" preserveAspectRatio="none">
        {bars.map((w, idx) => {
          const x = currentX;
          currentX += w * 2.5 + 1.5;
          if (idx % 2 === 0) {
            return (
              <rect
                key={idx}
                x={x}
                y="0"
                width={w * 2.5}
                height="60"
                fill="currentColor"
              />
            );
          }
          return null;
        })}
      </svg>
      <span className="font-mono text-xs tracking-widest mt-1 font-bold">{text}</span>
    </div>
  );
}

const QUICK_AMOUNTS = [1, 5, 10, 25, 50, 100];

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();

  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [action, setAction] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("Sale");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Print Label Modal
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelCopies, setLabelCopies] = useState(1);
  const labelPrintRef = useRef(null);

  // Edit Product Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, hRes, cRes, sRes] = await Promise.all([
        getProduct(id),
        getStockHistoryByProduct(id),
        getCategories().catch(() => ({ data: [] })),
        getSuppliers().catch(() => ({ data: [] })),
      ]);
      setProduct(pRes.data);
      setHistory(hRes.data || []);
      setCategories(cRes.data || []);
      setSuppliers(sRes.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  async function submitStockMovement() {
    if (!quantity || quantity <= 0) return push("Please enter a valid quantity", "error");
    setSubmittingMovement(true);
    try {
      const payload = { productId: id, quantity: Number(quantity), reason, notes };
      const response = action === "IN" ? await stockIn(payload) : await stockOut(payload);
      setProduct(response.data);
      push(`Stock ${action} successful`, "success");
      setAction(null);
      setQuantity(1);
      setNotes("");
      setError("");
      getStockHistoryByProduct(id).then((r) => setHistory(r.data || []));
    } catch (e) {
      setError(e.message);
      push(e.message, "error");
    } finally {
      setSubmittingMovement(false);
    }
  }

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteProduct(id);
      push("Product deleted", "success");
      navigate("/products");
    } catch (e) {
      push(e.message, "error");
    } finally {
      setDeleteLoading(false);
      setShowDelete(false);
    }
  };

  const handleEditSubmit = async (formData) => {
    setEditLoading(true);
    try {
      const res = await updateProduct(id, formData);
      setProduct(res.data);
      push("Product updated successfully", "success");
      setShowEditModal(false);
    } catch (e) {
      push(e.message || "Failed to update product", "error");
    } finally {
      setEditLoading(false);
    }
  };

  const handlePrintLabel = () => {
    const printContents = labelPrintRef.current?.innerHTML;
    if (!printContents) return;
    const printWindow = window.open("", "_blank", "width=600,height=600");
    if (!printWindow) return push("Popup blocked, please allow popups", "error");
    printWindow.document.write(`
      <html>
        <head>
          <title>Print SKU Label - ${product.sku || product.name}</title>
          <style>
            body { font-family: monospace, sans-serif; text-align: center; padding: 20px; }
            .label-card { border: 2px solid #000; border-radius: 8px; padding: 16px; margin: 0 auto 16px; max-width: 320px; page-break-inside: avoid; }
            .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
            .sku { font-size: 14px; font-weight: bold; margin-top: 8px; }
            .meta { font-size: 11px; color: #555; }
          </style>
        </head>
        <body>
          ${Array(Number(labelCopies) || 1).fill(printContents).join("")}
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copySku = () => {
    if (!product?.sku) return;
    navigator.clipboard.writeText(product.sku);
    setCopiedSku(true);
    push("SKU copied to clipboard", "success");
    setTimeout(() => setCopiedSku(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto pb-6">
        <Skeleton className="h-6 w-24" />
        <div className="card p-6 space-y-4 animate-pulse">
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-1/3 bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 grid place-items-center mx-auto text-zinc-400">
          <Package size={28} />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Product Not Found</h2>
        <p className="text-sm text-zinc-500">{error || "This item may have been deleted."}</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold"
        >
          Return to Products
        </Link>
      </div>
    );
  }

  const status = getProductStatus(product);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-12 animate-fade-in">
      {/* 1. TOP APP BAR / NAVIGATION */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <span className="w-8 h-8 grid place-items-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <ArrowLeft size={14} />
          </span>
          <span>Back</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              hapticMedium();
              openAiCopilot();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800/80 text-xs font-bold shadow-xs active:scale-95 transition"
            title="Ask Stockly AI about this product"
          >
            <Sparkles size={13} className="text-violet-600 dark:text-violet-400" />
            <span className="hidden xs:inline">Ask AI</span>
          </button>
          <button
            onClick={() => {
              hapticLight();
              setShowLabelModal(true);
            }}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 shadow-xs active:scale-95 transition"
            title="Barcode"
          >
            <Barcode size={14} />
            <span className="hidden sm:inline">Barcode</span>
          </button>
          <button
            onClick={() => {
              hapticLight();
              setShowEditModal(true);
            }}
            className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold shadow-xs active:scale-95 transition"
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN HERO PRODUCT CARD */}
      <div className="card p-0 overflow-hidden border border-zinc-200/80 dark:border-zinc-800">
        <div className="h-14 sm:h-20 bg-gradient-to-r from-zinc-100 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-800" />
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 -mt-10 sm:-mt-14 relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white dark:bg-zinc-900 border-4 border-white dark:border-zinc-900 shadow-lg overflow-hidden grid place-items-center shrink-0">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">📦</span>
              )}
            </div>

            <div className="flex-1 min-w-0 sm:pt-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <h1 className="text-lg sm:text-xl font-black tracking-tight text-zinc-900 dark:text-white">
                    {product.name}
                  </h1>
                  <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-zinc-800 dark:text-zinc-200">
                      <Layers size={12} className="text-zinc-400" />
                      {product.category?.name || "General"}
                    </span>
                    <span>•</span>
                    <span className="font-bold">{product.unit}</span>
                    {product.supplier?.name && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                          <Building2 size={12} className="text-zinc-400" />
                          {product.supplier.name}
                        </span>
                      </>
                    )}
                    {product.sku && (
                      <button
                        onClick={copySku}
                        className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 transition"
                      >
                        {copiedSku ? (
                          <Check size={11} className="text-emerald-600" />
                        ) : (
                          <Copy size={11} />
                        )}
                        {product.sku}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 mt-1 sm:mt-0">
                  {product.price > 0 && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                      ₹{Number(product.price).toLocaleString("en-IN")}
                    </span>
                  )}
                  <Badge status={status} size="sm" />
                </div>
              </div>

              {product.description && (
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-3 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 rounded-xl p-3">
                  {product.description}
                </p>
              )}

              {/* Dynamic Custom Data */}
              {product.customData && Object.keys(product.customData).length > 0 && (
                <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(product.customData).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">
                        {key}
                      </span>
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 3. KEY METRIC PILLS */}
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-zinc-500">
                In Stock
              </div>
              <div className="text-lg sm:text-2xl font-black mt-0.5 text-zinc-900 dark:text-white">
                {product.quantity}{" "}
                <span className="text-xs font-normal text-zinc-500">{product.unit}</span>
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-zinc-500">
                Min Safety
              </div>
              <div className="text-lg sm:text-2xl font-black mt-0.5 text-zinc-900 dark:text-white">
                {product.minimumStock ?? product.minimumQuantity ?? 5}
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-zinc-500">
                Valuation
              </div>
              <div className="text-lg sm:text-2xl font-black mt-0.5 text-emerald-600 dark:text-emerald-400">
                ₹{((Number(product.price) || 0) * (Number(product.quantity) || 0)).toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex-wrap">
            <button
              onClick={() => {
                hapticMedium();
                openAiCopilot();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 py-1 px-2.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/30 transition"
            >
              <Sparkles size={13} className="text-violet-600 dark:text-violet-400" />
              <span>Ask Stockly AI for restock & safety analysis</span>
            </button>
            <button
              onClick={() => {
                hapticLight();
                setShowDelete(true);
              }}
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition ml-auto"
            >
              <Trash2 size={13} /> Delete Product
            </button>
          </div>
        </div>
      </div>

      {/* 4. STOCK ADJUSTMENT DOCK */}
      <div className="card p-4 sm:p-5 border border-zinc-200/80 dark:border-zinc-800">
        <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
          <Box size={16} /> Quick Stock Movement
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Atomic inventory adjustment for this SKU
        </p>

        {!action && (
          <div className="grid grid-cols-2 gap-2.5 mt-3.5">
            <button
              onClick={() => {
                setAction("IN");
                setReason("Purchase");
              }}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <ArrowUp size={16} /> Stock IN (+)
            </button>
            <button
              onClick={() => {
                setAction("OUT");
                setReason("Sale");
              }}
              className="py-3 px-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95"
            >
              <ArrowDown size={16} /> Stock OUT (-)
            </button>
          </div>
        )}

        {action && (
          <div className="space-y-3.5 mt-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 animate-slide-up">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  action === "IN"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                }`}
              >
                {action === "IN" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                Adjusting Stock {action}
              </span>
              <span className="text-xs text-zinc-500">
                Projected:{" "}
                <b className="text-zinc-900 dark:text-white">
                  {action === "IN"
                    ? product.quantity + Number(quantity)
                    : product.quantity - Number(quantity)}{" "}
                  {product.unit}
                </b>
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Adjustment Quantity ({product.unit})
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-11 h-11 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-bold text-lg grid place-items-center active:scale-95 transition"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="flex-1 h-11 text-center border border-zinc-200 dark:border-zinc-700 rounded-xl font-black text-lg bg-white dark:bg-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-11 h-11 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-bold text-lg grid place-items-center active:scale-95 transition"
                >
                  +
                </button>
              </div>

              {/* Quick quantity chips */}
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setQuantity(amt)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-semibold border transition ${
                      Number(quantity) === amt
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-field h-10 text-xs"
                >
                  <option>Sale</option>
                  <option>Purchase</option>
                  <option>Adjustment</option>
                  <option>Return</option>
                  <option>Damaged</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Audit Notes (Optional)
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="PO or tracking note..."
                  className="input-field h-10 text-xs"
                />
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-xs border border-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAction(null)}
                className="flex-1 min-h-[42px]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                loading={submittingMovement}
                onClick={submitStockMovement}
                className={`flex-1 min-h-[42px] font-bold ${
                  action === "IN" ? "!bg-emerald-600 hover:!bg-emerald-700" : ""
                }`}
              >
                Confirm {action} ({quantity} {product.unit})
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 5. TRANSACTION HISTORY TIMELINE */}
      <div className="card p-0 overflow-hidden border border-zinc-200/80 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Movement Ledger</h3>
            <p className="text-xs text-zinc-500">Atomic history trail for this product</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {history.length} events
          </span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {history.length ? (
            history.map((t) => (
              <div
                key={t._id}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        t.type === "IN"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                      }`}
                    >
                      {t.type === "IN" ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                      {t.type}
                    </span>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                      {t.type === "IN" ? "+" : "-"}{t.quantity} {product.unit}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-500 mt-1 truncate">
                    {t.reason} {t.notes && `• ${t.notes}`} •{" "}
                    <span className="font-mono">
                      {t.previousQuantity ?? "?"} → {t.newQuantity ?? "?"}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 text-xs text-zinc-400">
                  <div>{new Date(t.createdAt).toLocaleDateString()}</div>
                  <div className="text-[10px]">
                    {new Date(t.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-zinc-400">
              No transactions recorded for this SKU yet.
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={showDelete}
        onClose={() => !deleteLoading && setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete product?"
        description={`This will permanently delete "${product.name}" and remove it from inventory.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Printable SKU Label Modal */}
      <Modal
        open={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        title="Printable Barcode Label"
        size="sm"
      >
        <div className="space-y-4">
          <div
            ref={labelPrintRef}
            className="p-4 bg-white text-zinc-900 rounded-2xl border-2 border-dashed border-zinc-300 text-center space-y-2 max-w-sm mx-auto shadow-sm"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              STOCKLY INVENTORY
            </div>
            <div className="text-sm font-bold tracking-tight">{product.name}</div>
            <div className="text-xs text-zinc-600">
              {product.category?.name || "General"} • {product.unit}{" "}
              {product.price > 0 && `• ₹${Number(product.price).toLocaleString("en-IN")}`}
            </div>
            <div className="py-2 text-zinc-900">
              <BarcodeSVG value={product.sku || `SKU-${product._id.slice(-6).toUpperCase()}`} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-bold uppercase text-zinc-500">Copies to print:</label>
            <input
              type="number"
              min="1"
              max="100"
              inputMode="numeric"
              value={labelCopies}
              onChange={(e) => setLabelCopies(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 input-field text-center h-10 font-bold"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowLabelModal(false)}
              className="flex-1 min-h-[44px]"
            >
              Close
            </Button>
            <Button onClick={handlePrintLabel} className="flex-1 min-h-[44px]">
              <Printer size={15} /> Print Labels
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Product Modal */}
      <ProductFormModal
        open={showEditModal}
        onClose={() => !editLoading && setShowEditModal(false)}
        onSubmit={handleEditSubmit}
        editingProduct={product}
        categories={categories}
        suppliers={suppliers}
        loading={editLoading}
      />
    </div>
  );
}

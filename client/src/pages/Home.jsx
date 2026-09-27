import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  Layers,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  FolderKanban,
  Clock,
  ChevronRight,
  Plus,
  Zap,
  Building2,
  BarChart3,
  LayoutDashboard,
  Shield,
  Settings,
  ArrowRight,
  Sparkles,
  QrCode,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Bot,
  Wand2,
} from "lucide-react";
import { getProducts } from "../api/products";
import { getCategories } from "../api/categories";
import { getRecentTransactions } from "../api/stock";
import { openAiCopilot } from "../api/ai";
import { useAuth } from "../context/AuthContext";
import Badge, { getProductStatus } from "../components/ui/Badge";
import { StatsSkeleton } from "../components/ui/Loader";
import ProductFormModal from "../components/products/ProductFormModal";
import { createProduct } from "../api/products";
import { useToast } from "../context/ToastContext";
import { syncInventoryToWidget } from "../utils/nativeWidget";
import { hapticLight, hapticMedium } from "../utils/haptics";
import BarcodeScannerModal from "../components/products/BarcodeScannerModal";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function Home() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recent, setRecent] = useState([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const loadAll = async () => {
    try {
      const [pRes, cRes, rRes] = await Promise.all([
        getProducts("?limit=100"),
        getCategories().catch(() => ({ data: [] })),
        getRecentTransactions("?limit=10").catch(() => ({ data: [] })),
      ]);
      const pList = pRes.data || pRes || [];
      const cList = cRes.data || cRes || [];
      const rList = Array.isArray(rRes.data || rRes) ? (rRes.data || rRes).slice(0, 6) : [];

      setProducts(pList);
      setCategories(cList);
      setRecent(rList);

      // Sync summary metrics to Android Home Widget
      const lowCount = pList.filter((p) => p.quantity <= (p.minimumStock ?? 5)).length;
      const inMoves = rList.filter((t) => t.type === "IN").reduce((acc, x) => acc + (x.quantity || 1), 0);
      const outMoves = rList.filter((t) => t.type === "OUT").reduce((acc, x) => acc + (x.quantity || 1), 0);
      syncInventoryToWidget({
        totalProducts: pList.length,
        lowStockCount: lowCount,
        todayIn: inMoves,
        todayOut: outMoves,
      }).catch(() => {});
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let m = true;
    setLoading(true);
    loadAll();
    const id = setInterval(loadAll, 60000);
    const onVis = () => {
      if (document.visibilityState === "visible") loadAll();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", loadAll);
    return () => {
      m = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", loadAll);
    };
  }, []);

  const lowStock = products.filter((p) => {
    const min = p.minimumStock ?? p.minimumQuantity ?? 5;
    return p.quantity > 0 && p.quantity <= min;
  });
  const outStock = products.filter((p) => p.quantity === 0);
  const inStock = products.filter((p) => getProductStatus(p) === "In Stock");
  const totalUnits = products.reduce((a, b) => a + (Number(b.quantity) || 0), 0);
  const totalValuation = products.reduce(
    (a, b) => a + (Number(b.quantity) || 0) * (Number(b.price) || 0),
    0
  );

  const handleCreateProduct = async (formData) => {
    setCreateLoading(true);
    try {
      await createProduct(formData);
      push("Product created successfully", "success");
      setShowAddProductModal(false);
      loadAll();
    } catch (err) {
      push(err.message || "Failed to create product", "error");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-6 animate-fade-in">
      {/* 1. MOBILE & DESKTOP USER HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            <span>{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Stock
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mt-0.5">
            {greeting()}, {user?.name?.split(" ")[0] || "there"} 👋
          </h1>
        </div>

        {/* Quick Header Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setScannerOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-extrabold border border-amber-500/20 active:scale-95 transition"
            title="Scan Barcode"
          >
            <QrCode size={15} />
            <span className="hidden sm:inline">Scan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setShowAddProductModal(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold shadow-sm shadow-violet-500/25 active:scale-95 transition"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add Product</span>
          </button>

          <Link
            to="/settings"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80 grid place-items-center font-bold text-xs sm:text-sm shadow-2xs active:scale-95 transition shrink-0"
            title="Settings & Profile"
          >
            {(user?.name?.[0] || "U").toUpperCase()}
          </Link>
        </div>
      </div>

      {/* 2. HERO METRICS CAROUSEL / GRID */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Total Products */}
          <Link
            to="/products"
            className="card p-3.5 sm:p-4 flex flex-col justify-between hover:shadow-md transition active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Catalog</span>
              <Package size={15} />
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                {products.length}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                {totalUnits.toLocaleString()} units on hand
              </div>
            </div>
          </Link>

          {/* Low / Out of Stock Alert */}
          <Link
            to="/products?stockStatus=Low+Stock"
            className={`card p-3.5 sm:p-4 flex flex-col justify-between hover:shadow-md transition active:scale-[0.99] ${
              lowStock.length + outStock.length > 0
                ? "border-amber-300 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/5"
                : ""
            }`}
          >
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Low Stock</span>
              <AlertTriangle size={15} />
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                {lowStock.length + outStock.length}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                {outStock.length ? `${outStock.length} out of stock` : "Needs reorder"}
              </div>
            </div>
          </Link>

          {/* Categories */}
          <Link
            to="/categories"
            className="card p-3.5 sm:p-4 flex flex-col justify-between hover:shadow-md transition active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Categories</span>
              <FolderKanban size={15} />
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                {categories.length}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                Organized groups
              </div>
            </div>
          </Link>

          {/* Valuation */}
          <Link
            to="/dashboard"
            className="card p-3.5 sm:p-4 flex flex-col justify-between hover:shadow-md transition active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Valuation</span>
              <TrendingUp size={15} />
            </div>
            <div className="mt-2">
              <div className="text-xl sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                ₹{totalValuation > 100000 ? `${(totalValuation / 100000).toFixed(1)}L` : totalValuation.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                Total stock value
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* 3. PRIMARY ACTION SUITE (Stock IN / OUT & Add Product) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Stock IN (Receive) */}
        <Link
          to="/stock?type=IN"
          className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-600/20 hover:shadow-lg flex flex-col justify-between min-h-[96px] sm:min-h-[114px] active:scale-[0.96] transition-all duration-150 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-md grid place-items-center shrink-0">
              <ArrowUp size={17} className="text-white group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <ArrowRight size={14} className="text-emerald-200 hidden sm:block group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-base font-extrabold leading-tight">Stock IN</div>
            <div className="text-[10px] sm:text-xs text-emerald-100 font-medium truncate mt-0.5">
              Receive
            </div>
          </div>
        </Link>

        {/* Stock OUT (Dispatch) */}
        <Link
          to="/stock?type=OUT"
          className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-md shadow-rose-600/20 hover:shadow-lg flex flex-col justify-between min-h-[96px] sm:min-h-[114px] active:scale-[0.96] transition-all duration-150 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-md grid place-items-center shrink-0">
              <ArrowDown size={17} className="text-white group-hover:translate-y-0.5 transition-transform" />
            </div>
            <ArrowRight size={14} className="text-rose-200 hidden sm:block group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-base font-extrabold leading-tight">Stock OUT</div>
            <div className="text-[10px] sm:text-xs text-rose-100 font-medium truncate mt-0.5">
              Dispatch
            </div>
          </div>
        </Link>

        {/* Add New Product (Modal) */}
        <button
          type="button"
          onClick={() => setShowAddProductModal(true)}
          className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-md shadow-violet-600/25 hover:shadow-lg flex flex-col justify-between min-h-[96px] sm:min-h-[114px] active:scale-[0.96] transition-all duration-150 group text-left"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-md grid place-items-center shrink-0">
              <Plus size={18} strokeWidth={2.5} className="text-white group-hover:rotate-90 transition-transform duration-200" />
            </div>
            <Sparkles size={14} className="text-violet-200 hidden sm:block" />
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-base font-extrabold leading-tight">Add Product</div>
            <div className="text-[10px] sm:text-xs text-violet-100 font-medium truncate mt-0.5">
              New SKU
            </div>
          </div>
        </button>
      </div>

      {/* 4. LOW STOCK ATTENTION FEED (If Any) */}
      {lowStock.length > 0 && (
        <div className="card p-4 space-y-3 border-amber-200/80 dark:border-amber-500/20 bg-amber-50/20 dark:bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-white grid place-items-center shrink-0">
                <AlertTriangle size={14} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Reorder Required ({lowStock.length})
                </h3>
                <p className="text-xs text-zinc-500">Items below minimum safety stock threshold</p>
              </div>
            </div>
            <Link
              to="/products?stockStatus=Low+Stock"
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-0.5 shrink-0"
            >
              View all <ChevronRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {lowStock.slice(0, 4).map((item) => (
              <div
                key={item._id}
                className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-amber-200/60 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 grid place-items-center shrink-0 overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm">📦</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      to={`/products/${item._id}`}
                      className="text-xs font-semibold text-zinc-900 dark:text-white truncate block hover:underline"
                    >
                      {item.name}
                    </Link>
                    <div className="text-[11px] text-zinc-500">
                      <span className="font-bold text-amber-600 dark:text-amber-400">{item.quantity}</span> / min {item.minimumStock ?? 5} {item.unit}
                    </div>
                  </div>
                </div>

                <Link
                  to={`/stock?product=${item._id}&type=IN`}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 active:scale-95 transition shrink-0 flex items-center gap-1"
                >
                  <ArrowUp size={12} /> Restock
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. QUICK NAVIGATION CHIPS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span>Operations & Modules</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Link
            to="/categories"
            className="card p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-center transition active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 grid place-items-center">
              <FolderKanban size={16} />
            </div>
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Categories</span>
          </Link>

          <Link
            to="/suppliers"
            className="card p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-center transition active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 grid place-items-center">
              <Building2 size={16} />
            </div>
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Suppliers</span>
          </Link>

          <Link
            to="/dashboard"
            className="card p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-center transition active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 grid place-items-center">
              <BarChart3 size={16} />
            </div>
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Insights</span>
          </Link>

          <Link
            to="/audit"
            className="card p-2.5 sm:p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-center transition active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 grid place-items-center">
              <Shield size={16} />
            </div>
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Audit Logs</span>
          </Link>
        </div>
      </div>

      {/* 6. AI COPILOT INTELLIGENCE BANNER */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 text-white shadow-xl shadow-violet-600/15 relative overflow-hidden group">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md grid place-items-center text-white shrink-0 border border-white/20 shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight">Stockly AI Copilot</span>
                <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[9px] font-extrabold uppercase tracking-wider">
                  Live
                </span>
              </div>
              <p className="text-xs text-violet-100 mt-0.5 max-w-md">
                Live inventory-aware assistant powered by Opencode. Ask about low stock, valuations, or catalog metrics.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAiCopilot}
            className="self-start sm:self-center px-3.5 py-2 rounded-xl bg-white text-violet-900 font-bold text-xs hover:bg-violet-50 active:scale-95 transition flex items-center gap-1.5 shadow-md shrink-0"
          >
            <Bot size={14} className="text-violet-700" />
            <span>Open Copilot</span>
            <ArrowRight size={13} className="text-violet-500" />
          </button>
        </div>
      </div>

      {/* 7. RECENT ACTIVITY LEDGER */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Recent Stock Activity</h3>
          </div>
          <Link
            to="/stock"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-0.5"
          >
            View history <ChevronRight size={13} />
          </Link>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {recent.length > 0 ? (
            recent.map((txItem) => {
              const isIN = txItem.type === "IN";
              return (
                <div
                  key={txItem._id}
                  className="p-3.5 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition"
                >
                  <div
                    className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${
                      isIN
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400"
                    }`}
                  >
                    {isIN ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {txItem.productId?.name || "Inventory Item"}
                      </span>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          isIN ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-white"
                        }`}
                      >
                        {isIN ? "+" : "-"}{txItem.quantity} {txItem.productId?.unit || "units"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 mt-0.5">
                      <span className="truncate">
                        {txItem.reason || (isIN ? "Purchase" : "Sale")} {txItem.notes && `• ${txItem.notes}`}
                      </span>
                      <span className="shrink-0">{timeAgo(txItem.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 grid place-items-center mx-auto text-zinc-400">
                <Clock size={18} />
              </div>
              <p className="text-xs text-zinc-500 font-medium">No stock movements recorded yet</p>
              <Link
                to="/stock?type=IN"
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
              >
                Post first stock IN <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Add Product Modal */}
      <ProductFormModal
        open={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSubmit={handleCreateProduct}
        categories={categories}
        loading={createLoading}
      />

      {/* Barcode & SKU Scanner Modal */}
      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        products={products}
        onSelectProduct={(p) => navigate(`/products/${p._id}`)}
        onQuickStockIn={(p) => navigate(`/stock?type=IN&product=${p._id}`)}
        onQuickStockOut={(p) => navigate(`/stock?type=OUT&product=${p._id}`)}
        onAddProductWithSku={(sku) => {
          setShowAddProductModal(true);
        }}
      />
    </div>
  );
}

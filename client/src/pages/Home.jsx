import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  FolderKanban,
  Clock,
  ChevronRight,
  Plus,
  Building2,
  BarChart3,
  Shield,
  ArrowRight,
  Sparkles,
  QrCode,
  TrendingUp,
  Bot,
  FileText,
  Smartphone,
} from "lucide-react";
import { getProducts, createProduct } from "../api/products";
import { getCategories } from "../api/categories";
import { getRecentTransactions } from "../api/stock";
import { openAiCopilot } from "../api/ai";
import { useAuth } from "../context/AuthContext";
import { getProductStatus } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { StatsSkeleton, EmptyState } from "../components/ui/Loader";
import ProductFormModal from "../components/products/ProductFormModal";
import { useToast } from "../context/ToastContext";
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

function formatValue(v) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

const TONES = {
  zinc: "text-zinc-500 dark:text-zinc-400",
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
};

const CHIPS = {
  zinc: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
  amber: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
  emerald: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rose: "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-300",
};

function StatTile({ to, label, value, sub, icon: Icon, tone = "zinc", highlight = false }) {
  return (
    <Link
      to={to}
      className={`card card-hover p-4 flex flex-col justify-between gap-3 min-h-[118px] ${
        highlight ? "border-amber-300 dark:border-amber-500/40" : ""
      }`}
    >
      <div className={`flex items-center justify-between ${TONES[tone]}`}>
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
        <Icon size={15} />
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
          {value}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{sub}</div>
      </div>
    </Link>
  );
}

function ModuleTile({ to, label, icon: Icon }) {
  return (
    <Link
      to={to}
      className="card card-hover p-3 min-h-[88px] flex flex-col items-center justify-center gap-2 text-center"
    >
      <span className={`w-9 h-9 rounded-xl grid place-items-center ${CHIPS.zinc}`}>
        <Icon size={16} />
      </span>
      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{label}</span>
    </Link>
  );
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
  const totalUnits = products.reduce((a, b) => a + (Number(b.quantity) || 0), 0);
  const totalValuation = products.reduce(
    (a, b) => a + (Number(b.quantity) || 0) * (Number(b.price) || 0),
    0
  );
  const alertCount = lowStock.length + outStock.length;

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
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white truncate">
            {greeting()}, {user?.name?.split(" ")[0] || "there"}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setScannerOpen(true);
            }}
            className="w-10 h-10 grid place-items-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white active:scale-95 transition shrink-0"
            title="Scan barcode"
            aria-label="Scan barcode"
          >
            <QrCode size={17} />
          </button>
          <Button size="sm" onClick={() => setShowAddProductModal(true)}>
            <Plus size={15} /> <span className="hidden sm:inline">Add product</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Link
            to="/settings"
            className="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center font-bold text-sm active:scale-95 transition shrink-0"
            title="Settings & profile"
          >
            {(user?.name?.[0] || "U").toUpperCase()}
          </Link>
        </div>
      </div>

      {/* Stock in / out — top, side by side */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/stock?type=IN"
          className="flex items-center gap-3 rounded-2xl p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-[0.98] transition"
        >
          <span className="w-10 h-10 rounded-xl bg-white/20 grid place-items-center shrink-0">
            <ArrowUp size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight">Stock In</span>
            <span className="block text-xs text-emerald-100 font-medium">+ Receive</span>
          </span>
        </Link>
        <Link
          to="/stock?type=OUT"
          className="flex items-center gap-3 rounded-2xl p-3.5 bg-red-600 hover:bg-red-700 text-white shadow-sm active:scale-[0.98] transition"
        >
          <span className="w-10 h-10 rounded-xl bg-white/20 grid place-items-center shrink-0">
            <ArrowDown size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight">Stock Out</span>
            <span className="block text-xs text-red-100 font-medium">− Dispatch</span>
          </span>
        </Link>
      </div>

      {/* Stats */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            to="/products"
            label="Products"
            value={products.length}
            sub={`${totalUnits.toLocaleString()} units`}
            icon={Package}
          />
          <StatTile
            to="/products?filter=low"
            label="Low stock"
            value={alertCount}
            sub={outStock.length ? `${outStock.length} out of stock` : alertCount ? `${alertCount} low` : "All good"}
            icon={AlertTriangle}
            tone={alertCount ? "amber" : "zinc"}
            highlight={alertCount > 0}
          />
          <StatTile
            to="/categories"
            label="Categories"
            value={categories.length}
            sub="Active groups"
            icon={FolderKanban}
          />
          <StatTile
            to="/dashboard"
            label="Valuation"
            value={formatValue(totalValuation)}
            sub="Inventory value"
            icon={TrendingUp}
            tone="emerald"
          />
        </div>
      )}

      {/* Low stock attention */}
      {!loading && lowStock.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="section-title">
              <AlertTriangle size={15} className="text-amber-500" />
              Needs reorder
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                {lowStock.length}
              </span>
            </h3>
            <Link
              to="/products?filter=low"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-0.5 shrink-0"
            >
              View all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {lowStock.slice(0, 4).map((item) => (
              <div
                key={item._id}
                className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5"
              >
                <div className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 grid place-items-center shrink-0 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package size={15} className="text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/products/${item._id}`}
                    className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate block hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    <span className="font-bold text-amber-600 dark:text-amber-400">{item.quantity}</span>
                    {" / "}min {item.minimumStock ?? 5} {item.unit}
                  </p>
                </div>
                <Link
                  to={`/stock?product=${item._id}&type=IN`}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold active:scale-95 transition shrink-0"
                >
                  Restock
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      <div>
        <h3 className="section-title mb-2.5">Modules</h3>
        <div className="grid grid-cols-3 gap-2.5">
          <ModuleTile to="/categories" label="Categories" icon={FolderKanban} />
          <ModuleTile to="/suppliers" label="Suppliers" icon={Building2} />
          <ModuleTile to="/dashboard" label="Insights" icon={BarChart3} />
          <ModuleTile to="/reports" label="Reports" icon={FileText} />
          <ModuleTile to="/audit" label="Audit" icon={Shield} />
          <ModuleTile to="/app-store" label="Mobile App" icon={Smartphone} />
        </div>
      </div>

      {/* AI Copilot */}
      <div className="rounded-2xl bg-zinc-950 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white p-3.5 sm:p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 grid place-items-center shrink-0 border border-violet-500/20">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">Stockly AI Assistant</div>
            <div className="text-xs text-zinc-400 truncate">Inventory intelligence & forecasting</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            hapticMedium();
            openAiCopilot();
          }}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-zinc-900 text-xs font-bold hover:bg-zinc-100 active:scale-95 transition shrink-0"
        >
          <Bot size={14} /> <span>Ask AI</span> <ArrowRight size={12} />
        </button>
      </div>

      {/* Recent activity */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="section-title">
            <Clock size={15} className="text-zinc-400" /> Recent activity
          </h3>
          <Link
            to="/stock"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-0.5"
          >
            History <ChevronRight size={13} />
          </Link>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : recent.length > 0 ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recent.map((tx, idx) => {
              const isIN = tx.type === "IN";
              return (
                <div key={tx._id} style={{ animationDelay: `${Math.min(idx * 30, 150)}ms` }} className="stagger-item px-4 py-3 flex items-center gap-3">
                  <span
                    className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${isIN ? CHIPS.emerald : CHIPS.rose}`}
                  >
                    {isIN ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate">
                        {tx.productId?.name || "Inventory item"}
                      </span>
                      <span
                        className={`text-[13px] font-bold tabular-nums shrink-0 ${
                          isIN ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {isIN ? "+" : "−"}
                        {tx.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 mt-0.5">
                      <span className="truncate">{tx.reason || (isIN ? "Purchase" : "Sale")}</span>
                      <span className="shrink-0">{timeAgo(tx.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={Clock}
              title="No movements yet"
              hint="Record your first stock IN to start the ledger."
              action={
                <Link
                  to="/stock?type=IN"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:underline"
                >
                  Post stock IN <ArrowRight size={13} />
                </Link>
              }
            />
          </div>
        )}
      </div>

      <ProductFormModal
        open={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSubmit={handleCreateProduct}
        categories={categories}
        loading={createLoading}
      />

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        products={products}
        onSelectProduct={(p) => navigate(`/products/${p._id}`)}
        onQuickStockIn={(p) => navigate(`/stock?type=IN&product=${p._id}`)}
        onQuickStockOut={(p) => navigate(`/stock?type=OUT&product=${p._id}`)}
        onAddProductWithSku={() => setShowAddProductModal(true)}
      />
    </div>
  );
}

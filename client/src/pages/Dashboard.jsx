import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package,
  AlertTriangle,
  Layers,
  Coins,
  Calendar,
  Activity,
  Flame,
  PieChart,
  Lightbulb,
  ShieldCheck,
  RefreshCw,
  Target,
  ArrowRight,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { getProducts } from "../api/products";
import { getCategories, getCategoryStats } from "../api/categories";
import { getStockHistory, getRecentTransactions } from "../api/stock";
import { valuationReport, monthlyReport } from "../api/reports";
import Button from "../components/ui/Button";
import Card, { CardHeader, StatCard } from "../components/ui/Card";
import { StatsSkeleton, EmptyState } from "../components/ui/Loader";

const CHIP = {
  primary:
    "bg-primary-50 dark:bg-primary-500/10 border-primary-200/60 dark:border-primary-500/20 text-primary-600 dark:text-primary-400",
  emerald:
    "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  amber:
    "bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20 text-amber-600 dark:text-amber-400",
  red: "bg-red-50 dark:bg-red-500/10 border-red-200/60 dark:border-red-500/20 text-red-600 dark:text-red-400",
  zinc: "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [catStats, setCatStats] = useState([]);
  const [recent, setRecent] = useState([]);
  const [valuation, setValuation] = useState({ data: [], totals: {} });
  const [monthly, setMonthly] = useState({ months: [], totals: {} });
  const [demanded, setDemanded] = useState([]);

  useEffect(() => {
    let m = true;
    async function load() {
      setLoading(true);
      try {
        const [pRes, cRes, sRes, rRes, vRes, moRes, hRes] = await Promise.all([
          getProducts({ limit: 100 }),
          getCategories().catch(() => ({ data: [] })),
          getCategoryStats().catch(() => ({ data: [] })),
          getRecentTransactions().catch(() => ({ data: [] })),
          valuationReport().catch(() => ({ data: [], totals: {} })),
          monthlyReport(String(new Date().getFullYear())).catch(() => ({ data: { months: [] } })),
          getStockHistory({ limit: 100 }).catch(() => ({ data: [] })),
        ]);
        if (!m) return;
        setProducts(pRes.data || []);
        setCats(cRes.data || []);
        setCatStats(sRes.data || sRes || []);
        setRecent((rRes.data || []).slice(0, 5));
        const v = vRes.data !== undefined ? vRes : { data: [] };
        setValuation({ data: v.data || v || [], totals: v.totals || {} });
        const mo = moRes.data !== undefined ? moRes.data : moRes;
        const moData = mo.data || mo;
        setMonthly({ months: moData.months || [], totals: moData.totals || {}, year: moData.year });
        const hist = hRes.data || [];
        const map = new Map();
        (Array.isArray(hist) ? hist : []).forEach((t) => {
          if (t.type !== "OUT") return;
          const pid = String(t.productId?._id || t.productId || "");
          if (!pid) return;
          const cur = map.get(pid) || { product: t.productId, total: 0, count: 0 };
          if (t.productId && typeof t.productId === "object") cur.product = t.productId;
          cur.total += Number(t.quantity || 0);
          cur.count += 1;
          map.set(pid, cur);
        });
        const prodMap = new Map((pRes.data || []).map((p) => [String(p._id), p]));
        const list = Array.from(map.values())
          .map((v) => {
            if (!v.product || typeof v.product === "string") {
              const f = prodMap.get(String(v.product));
              if (f) v.product = f;
            }
            return v;
          })
          .filter((v) => v.product?.name)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        setDemanded(list);
      } catch {}
      finally {
        if (m) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60000);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      m = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const totalUnits = products.reduce((a, b) => a + Number(b.quantity || 0), 0);
  const totalValue = products.reduce((a, b) => a + Number(b.quantity || 0) * Number(b.price || 0), 0);
  const lowStock = products.filter((p) => {
    const min = p.minimumStock ?? p.minimumQuantity ?? 5;
    return p.quantity > 0 && p.quantity <= min;
  });
  const outStock = products.filter((p) => p.quantity === 0);
  const inStockCount = products.length - lowStock.length - outStock.length;
  const healthPct = products.length ? Math.round((inStockCount / products.length) * 100) : 100;
  const turnover = (() => {
    const out30 = demanded.reduce((a, d) => a + d.total, 0) || monthly.months?.slice(-1)[0]?.outQty || 0;
    return out30 ? (out30 / Math.max(1, totalUnits)).toFixed(2) : "0.00";
  })();
  const topCat = valuation.data?.[0];
  const topShare = topCat && totalValue ? Math.round((topCat.value / totalValue) * 100) : 0;
  const reorderList = [...lowStock]
    .sort((a, b) => a.quantity / (a.minimumStock || 5) - b.quantity / (b.minimumStock || 5))
    .slice(0, 4);

  const maxVal = Math.max(...(valuation.data || []).map((d) => d.value || 0), 1);
  const maxMonth = Math.max(...(monthly.months || []).map((m) => Math.max(m.inQty, m.outQty)), 1);

  const insights = [
    topCat
      ? {
          icon: Coins,
          tone: "primary",
          title: `${topCat.category} holds ${topShare}% of value`,
          desc: `₹${topCat.value.toLocaleString("en-IN")} of total stock value`,
        }
      : null,
    {
      icon: ShieldCheck,
      tone: healthPct > 80 ? "emerald" : "amber",
      title: `${healthPct}% healthy • ${turnover}x turnover`,
      desc: `${inStockCount} healthy • ${lowStock.length} low • ${outStock.length} out of stock`,
    },
    demanded[0]
      ? {
          icon: Flame,
          tone: "amber",
          title: `Top seller: ${demanded[0].product.name}`,
          desc: `${demanded[0].total} units in ${demanded[0].count} orders`,
        }
      : { icon: Activity, tone: "zinc", title: "No demand yet", desc: "Stock OUT movements will rank here" },
    {
      icon: Calendar,
      tone: "primary",
      title: `Net ${(monthly.totals.totalIn || 0) - (monthly.totals.totalOut || 0)} units this year`,
      desc: `In ${monthly.totals.totalIn || 0} • Out ${monthly.totals.totalOut || 0} • ${monthly.totals.totalCount || 0} movements`,
    },
  ].filter(Boolean);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-subtitle">Real-time inventory intelligence</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="success" onClick={() => navigate("/stock?type=IN")}>
            <ArrowUpCircle size={14} /> In
          </Button>
          <Button size="sm" variant="danger" onClick={() => navigate("/stock?type=OUT")}>
            <ArrowDownCircle size={14} /> Out
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate("/products")}>
            <Package size={14} /> Catalog
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Units" value={totalUnits.toLocaleString()} sub={`${products.length} products`} icon={Package} tone="zinc" />
          <StatCard
            label="Value"
            value={`₹${(totalValue / 1000).toFixed(0)}k`}
            sub={`${cats.length} categories`}
            icon={Coins}
            tone="emerald"
          />
          <StatCard
            label="Low stock"
            value={lowStock.length}
            sub={lowStock.length ? "Reorder soon" : "All good"}
            icon={AlertTriangle}
            tone={lowStock.length ? "amber" : "zinc"}
          />
          <StatCard
            label="Out of stock"
            value={outStock.length}
            sub={outStock.length ? "Action needed" : "None"}
            icon={Layers}
            tone={outStock.length ? "red" : "zinc"}
          />
        </div>
      )}

      {/* Highlights */}
      <div>
        <h2 className="section-title mb-2.5">
          <Lightbulb size={15} className="text-amber-500" /> Highlights
        </h2>
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-[76px]" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {insights.map((ins, idx) => {
              const Icon = ins.icon;
              return (
                <div key={idx} className="card p-4 flex gap-3">
                  <span className={`w-10 h-10 rounded-xl border grid place-items-center shrink-0 ${CHIP[ins.tone]}`}>
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                      {ins.title}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{ins.desc}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Category valuation" subtitle="Value distribution" />
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-9" />
              ))}
            </div>
          ) : !valuation.data.length ? (
            <EmptyState icon={PieChart} title="No valuation data" hint="Add products with prices to see the breakdown." />
          ) : (
            <div className="space-y-3">
              {valuation.data.slice(0, 5).map((r) => {
                const pct = Math.round((r.value / maxVal) * 100);
                return (
                  <div key={r.category}>
                    <div className="flex justify-between gap-2 text-xs mb-1.5">
                      <span className="font-semibold truncate text-zinc-700 dark:text-zinc-300">{r.category}</span>
                      <span className="font-bold tabular-nums text-zinc-900 dark:text-white shrink-0">
                        ₹{r.value.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-zinc-900 dark:bg-white transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 flex justify-between text-xs text-zinc-500 border-t border-zinc-100 dark:border-zinc-800">
                <span>Total ₹{(valuation.totals.grandValue || totalValue).toLocaleString("en-IN")}</span>
                <span>{valuation.data.length} categories</span>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Monthly flow"
            subtitle={`In vs Out • ${monthly.year || new Date().getFullYear()}`}
          />
          {loading ? (
            <div className="skeleton h-40" />
          ) : (
            <div>
              <div className="flex items-end gap-1.5 h-36">
                {(monthly.months || []).map((m) => {
                  const hIn = Math.max(3, Math.round((m.inQty / maxMonth) * 88));
                  const hOut = Math.max(3, Math.round((m.outQty / maxMonth) * 88));
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                      <div className="flex gap-1 items-end h-24">
                        <div className="w-2.5 rounded-full bg-emerald-500" style={{ height: `${hIn}px` }} title={`In ${m.inQty}`} />
                        <div className="w-2.5 rounded-full bg-red-500" style={{ height: `${hOut}px` }} title={`Out ${m.outQty}`} />
                      </div>
                      <span className="text-[10px] font-medium text-zinc-500">{m.label.slice(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-5 mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> In {monthly.totals.totalIn || 0}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Out {monthly.totals.totalOut || 0}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Health + categories + reorder */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Inventory health" />
          {loading ? (
            <div className="skeleton h-32" />
          ) : (
            <>
              <div className="flex items-center gap-5">
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-zinc-100 dark:stroke-zinc-800" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      strokeWidth="9"
                      strokeLinecap="round"
                      className="stroke-emerald-500"
                      strokeDasharray={`${healthPct * 2.64} 264`}
                    />
                  </svg>
                  <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                      <div className="text-xl font-bold leading-none text-zinc-900 dark:text-white tabular-nums">{healthPct}%</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-0.5">Healthy</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-2 text-xs font-semibold">
                  {[
                    { label: "In stock", value: inStockCount, dot: "bg-emerald-500" },
                    { label: "Low", value: lowStock.length, dot: "bg-amber-500" },
                    { label: "Out", value: outStock.length, dot: "bg-red-500" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                        <span className={`w-2 h-2 rounded-full ${row.dot}`} />
                        {row.label}
                      </span>
                      <span className="font-bold text-zinc-900 dark:text-white tabular-nums">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium">
                  <Target size={13} /> Turnover {turnover}x / 30d
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold ${
                    Number(turnover) > 1 ? CHIP.emerald + " border" : CHIP.zinc + " border"
                  }`}
                >
                  {Number(turnover) > 1 ? "Fast moving" : "Slow moving"}
                </span>
              </div>
            </>
          )}
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="px-4 sm:px-5 pt-4 sm:pt-5">
            <CardHeader title="Categories" subtitle="Value & turnover per group" />
          </div>
          {loading ? (
            <div className="p-4 sm:p-5 pt-0 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-14" />
              ))}
            </div>
          ) : !catStats.length ? (
            <div className="p-4 sm:p-5 pt-0">
              <EmptyState title="No categories" hint="Create categories to group your catalog." />
            </div>
          ) : (
            <div className="px-3 pb-3 space-y-1 max-h-[248px] overflow-y-auto">
              {catStats.slice(0, 6).map((r) => (
                <div key={r.category._id} className="p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/60 flex items-center gap-2.5 transition">
                  <span className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-xs font-bold shrink-0">
                    {r.category.name[0]}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold truncate text-zinc-900 dark:text-white">{r.category.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {r.productCount} products • ₹{Number(r.totalValue).toLocaleString("en-IN")}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Reorder radar"
            action={
              <Link to="/products?filter=low" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                View all
              </Link>
            }
          />
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-14" />
              ))}
            </div>
          ) : reorderList.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nothing to reorder" hint="All stock is above minimum levels." />
          ) : (
            <div className="space-y-2">
              {reorderList.map((p) => {
                const demand = demanded.find((d) => String(d.product._id || d.product?._id) === String(p._id))?.total || 0;
                return (
                  <Link
                    key={p._id}
                    to={`/products/${p._id}`}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5 hover:shadow-sm transition"
                  >
                    <span className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0">
                      {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Package size={15} className="text-zinc-400" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold truncate text-zinc-900 dark:text-white">{p.name}</span>
                      <span className="block text-xs text-zinc-500">
                        {p.quantity}/{p.minimumStock ?? 5} • {demand} sold / 30d
                      </span>
                    </span>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-500 text-white shrink-0">Reorder</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Demanded + recent */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="section-title">
              <Flame size={15} className="text-orange-500" /> Top sellers
            </h3>
            <Link to="/reports" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              Reports
            </Link>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-12" />
              ))}
            </div>
          ) : demanded.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Flame} title="No sales yet" hint="Stock OUT movements will rank your best sellers here." />
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {demanded.map((d, i) => {
                const p = d.product;
                const max = Math.max(...demanded.map((x) => x.total), 1);
                const pct = Math.round((d.total / max) * 100);
                return (
                  <div key={String(p._id || i)} style={{ animationDelay: `${Math.min(i * 30, 150)}ms` }} className="stagger-item px-4 py-3 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 grid place-items-center text-[11px] font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0">
                      {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Package size={15} className="text-zinc-400" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold truncate text-zinc-900 dark:text-white">{p.name}</span>
                      <span className="block h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                        <span className="block h-full bg-zinc-900 dark:bg-white rounded-full" style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-bold tabular-nums text-zinc-900 dark:text-white">{d.total}</span>
                      <span className="block text-[11px] text-zinc-500">{d.count} orders</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">
              <Activity size={15} className="text-zinc-400" /> Recent activity
            </h3>
            <Link
              to="/stock"
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-14" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState icon={Activity} title="No activity yet" hint="Stock IN and OUT movements will appear here." />
          ) : (
            <div className="space-y-4">
              {recent.map((t, ri) => (
                <div key={t._id} style={{ animationDelay: `${Math.min(ri * 30, 150)}ms` }} className="stagger-item flex gap-3">
                  <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden grid place-items-center shrink-0">
                    {t.productId?.image ? (
                      <img src={t.productId.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package size={15} className="text-zinc-400" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold truncate text-zinc-900 dark:text-white">
                        {t.productId?.name || "Product"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                          t.type === "IN"
                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20"
                            : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20"
                        }`}
                      >
                        {t.type === "IN" ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {t.type} • {t.quantity}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 truncate">
                      {t.reason || "—"} • {new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

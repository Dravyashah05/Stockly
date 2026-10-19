import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Boxes,
  ChevronRight,
  CircleCheck,
  PackagePlus,
  PackageX,
  Plus,
  Minus,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { formatMoney } from '@stockly/shared-client/config';
import { stockStatus, useStore } from '@stockly/shared-client/store';
import type { Product } from '@stockly/shared-types';
import { Header, ErrorState, SkeletonRow } from '../components/ui';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen({
  onAddProduct,
  onStockIn,
  onStockOut,
  onStockInProduct,
  onStockOutProduct,
  goProducts,
  goHistory,
}: {
  onAddProduct: () => void;
  onStockIn: () => void;
  onStockOut: () => void;
  onStockInProduct: (p: Product) => void;
  onStockOutProduct: (p: Product) => void;
  goProducts: (filter?: 'low' | 'out') => void;
  goHistory: () => void;
}) {
  const { dashboard, products, transactions, loading, refreshing, error, refresh, online, lastSync, isPending } =
    useStore();

  const stats = useMemo(() => {
    const totalProducts = dashboard?.totalProducts ?? products.length;
    const totalUnits = dashboard?.totalUnits ?? products.reduce((a, p) => a + (p.currentStock || 0), 0);
    const low = products.filter((p) => stockStatus(p) === 'low');
    const out = products.filter((p) => stockStatus(p) === 'out');
    const lowStockCount = dashboard?.lowStockCount ?? low.length;
    const outOfStockCount = dashboard?.outOfStockCount ?? out.length;
    const optimalCount = Math.max(0, totalProducts - lowStockCount - outOfStockCount);
    const cost = dashboard?.inventoryCostValue ?? products.reduce((a, p) => a + (p.currentStock || 0) * (p.costPrice || 0), 0);
    const retail = dashboard?.inventoryRetailValue ?? products.reduce((a, p) => a + (p.currentStock || 0) * (p.sellingPrice || 0), 0);
    const optimalPct = totalProducts > 0 ? Math.round((optimalCount / totalProducts) * 100) : 0;
    const lowPct = totalProducts > 0 ? Math.round((lowStockCount / totalProducts) * 100) : 0;
    const outPct = totalProducts > 0 ? Math.max(0, 100 - optimalPct - lowPct) : 0;

    return {
      totalProducts,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      optimalCount,
      optimalPct,
      lowPct,
      outPct,
      inventoryCostValue: cost,
      inventoryRetailValue: retail,
      recentMovements: (dashboard?.recentMovements?.length ? dashboard.recentMovements : transactions).slice(0, 6),
      lowStockItems: (dashboard?.lowStockItems?.length ? dashboard.lowStockItems : [...out, ...low]).slice(0, 8),
    };
  }, [dashboard, products, transactions]);

  const { today, greet } = useMemo(() => {
    const now = new Date();
    return {
      today: now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      greet: greeting(),
    };
  }, []);

  const quickActions = useMemo(
    () => [
      {
        label: 'Stock In',
        sub: 'Receive goods',
        icon: <ArrowDownToLine size={24} />,
        grad: 'bg-[#151515] dark:bg-[#C7FF4D]',
        iconCls: 'text-[#C7FF4D] dark:text-[#151515]',
        onClick: onStockIn,
      },
      {
        label: 'Stock Out',
        sub: 'Sell / issue goods',
        icon: <ArrowUpFromLine size={24} />,
        grad: 'bg-[#151515] dark:bg-[#C7FF4D]',
        iconCls: 'text-[#C7FF4D] dark:text-[#151515]',
        onClick: onStockOut,
      },
    ],
    [onStockIn, onStockOut],
  );

  const bentoStats = useMemo(
    () => [
      {
        label: 'Products',
        value: String(stats.totalProducts),
        foot: `${stats.totalUnits.toLocaleString('en-IN')} units`,
        icon: <Boxes size={18} />,
        iconCls: 'bg-(--accent-soft) text-(--ink) dark:text-(--accent)',
        ringCls: 'hover:border-(--accent)/40',
        onClick: () => goProducts(),
      },
      {
        label: 'Valuation',
        value: formatMoney(stats.inventoryCostValue),
        foot: `Retail ${formatMoney(stats.inventoryRetailValue)}`,
        icon: <Boxes size={18} />,
        iconCls: 'bg-emerald-500/14 text-emerald-600 dark:text-emerald-300',
        ringCls: 'hover:border-emerald-500/40',
        onClick: undefined,
      },
      {
        label: 'Low stock',
        value: String(stats.lowStockCount),
        foot: 'needs restock',
        icon: <AlertTriangle size={18} />,
        iconCls: 'bg-amber-500/14 text-amber-600 dark:text-amber-300',
        ringCls: 'hover:border-amber-500/40',
        onClick: () => goProducts('low'),
      },
      {
        label: 'Out of stock',
        value: String(stats.outOfStockCount),
        foot: 'urgent',
        icon: <PackageX size={18} />,
        iconCls: 'bg-rose-500/12 text-rose-600 dark:text-rose-300',
        ringCls: 'hover:border-rose-500/40',
        onClick: () => goProducts('out'),
      },
    ],
    [stats, goProducts],
  );

  // Precompute per-row display data once per stats change: stock-bar width
  // and formatted date.
  const attentionRows = useMemo(
    () =>
      stats.lowStockItems.slice(0, 5).map((p) => {
        return {
          p,
          isOut: stockStatus(p) === 'out',
          fillPct:
            p.minimumStock > 0
              ? Math.min(100, (p.currentStock / p.minimumStock) * 100)
              : p.currentStock > 0
                ? 100
                : 0,
          meta: `min ${p.minimumStock}`,
        };
      }),
    [stats],
  );
  const recentRows = useMemo(
    () =>
      stats.recentMovements.slice(0, 5).map((t) => ({
        t,
        isIn: t.type === 'IN',
        when: new Date(t.createdAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        pending: isPending(t.id),
      })),
    [stats, isPending],
  );

  return (
    <div className="app-page-viewport mx-auto max-w-md">
      <Header
        title="Overview"
        subtitle={
          lastSync ? `Synced ${lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Inventory dashboard'
        }
      />

      <div className="dashboard-content mx-auto max-w-md space-y-5 px-4 pt-4">
        {/* Greeting — modern editorial header with Add button */}
        <div className="dashboard-greeting px-1 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#151515] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#F7F7F2] dark:bg-[#C7FF4D] dark:text-[#151515]">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {today}
          </span>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="min-w-0 flex-1 text-[28px] font-extrabold leading-[1.05] tracking-tight text-(--ink) lg:text-[32px]">
              {greet}
              <Sparkles size={24} className="ml-2 inline-block -translate-y-1 text-(--accent)" />
            </h2>
            <button
              type="button"
              onClick={onAddProduct}
              aria-label="Add product"
              title="Add product"
              className="press flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#151515] px-3 text-[13px] font-bold text-white dark:bg-[#C7FF4D] dark:text-[#151515] sm:px-4"
            >
              <PackagePlus size={19} /><span>Add Product</span>
            </button>
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-(--ink-2)">
              Your inventory, at a glance.
          </p>
        </div>

        {/* Stock In / Out — big action buttons */}
        <div className="dashboard-actions grid grid-cols-2 gap-2.5">
          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="glass press group flex min-h-[104px] flex-col items-start justify-between gap-2 rounded-[24px] border border-transparent p-4 text-left transition-colors hover:border-(--accent)/30"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${a.grad} ${a.iconCls} transition-transform group-active:scale-95`}
              >
                {a.icon}
              </span>
              <span>
                <span className="block text-[16px] font-extrabold leading-tight text-(--ink)">{a.label}</span>
                <span className="block text-[12px] font-medium text-(--ink-2)">{a.sub}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Separation line below Stock In / Out */}
        <div aria-hidden="true" className="dashboard-divider mx-1 h-px bg-(--stroke-dim)" />

        {!online ? (
          <div className="dashboard-banner glass flex items-center gap-2 rounded-2xl border-amber-500/25 px-4 py-3 text-[13px] font-medium text-amber-600 dark:text-amber-300">
            <WifiOff size={16} /> Offline — showing last synced data
            {lastSync ? ` from ${lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}.
          </div>
        ) : null}
        {error && products.length === 0 && !loading ? (
          <div className="dashboard-banner">
            <ErrorState message={error} onRetry={() => void refresh()} retrying={refreshing} />
          </div>
        ) : null}
        {error && products.length > 0 ? (
          <div className="dashboard-banner glass flex items-center gap-2 rounded-2xl border-amber-500/25 px-4 py-3 text-[13px] font-medium text-amber-600 dark:text-amber-300">
            <WifiOff size={16} /> Sync failed — showing cached data.
          </div>
        ) : null}

        {loading && products.length === 0 ? (
          <div className="dashboard-banner dashboard-loading space-y-3">
            <SkeletonRow h={190} />
            <div className="grid grid-cols-2 gap-3">
              <SkeletonRow h={110} />
              <SkeletonRow h={110} />
            </div>
            <SkeletonRow h={120} />
          </div>
        ) : (
          <>
            {/* Primary inventory metric */}
            <div className="dashboard-hero relative overflow-hidden rounded-[28px] bg-[#151515] p-5 text-white dark:bg-[#C7FF4D] dark:text-[#151515]">
              <div className="relative flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/60 dark:text-[#151515]/65">
                    Total stock units
                  </p>
                  <p className="tnum mt-2 truncate text-[clamp(2.25rem,7vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.06em]">
                    {stats.totalUnits.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <p className="relative mt-3 border-t border-white/15 pt-3 text-[12px] font-semibold text-white/65 dark:border-[#151515]/15 dark:text-[#151515]/65">Across your catalogue</p>
            </div>

            {/* Health Distribution Meter */}
            <div className="glass rounded-[24px] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-[12px] font-bold">
                <span className="text-(--ink-2) uppercase tracking-wider text-[11px]">Stock Health</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{stats.optimalPct}% Optimal</span>
              </div>
              <div className="h-2 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden flex">
                <div style={{ width: `${stats.optimalPct}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                <div style={{ width: `${stats.lowPct}%` }} className="bg-amber-500 h-full transition-all duration-500" />
                <div style={{ width: `${stats.outPct}%` }} className="bg-rose-500 h-full transition-all duration-500" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-(--ink-2) pt-0.5 font-medium">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {stats.optimalCount} healthy</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> {stats.lowStockCount} low</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> {stats.outOfStockCount} out</span>
              </div>
            </div>

            {/* Uneven metrics give urgent stock levels a faster visual read. */}
            <div className="dashboard-stats-grid grid grid-cols-2 gap-2.5">
              {bentoStats.map((c, index) => (
                <button
                  key={c.label}
                  onClick={c.onClick}
                  disabled={!c.onClick}
                  className={`dashboard-metric dashboard-metric-${index} press text-left transition-colors ${c.ringCls} ${!c.onClick ? 'cursor-default' : ''}`}
                >
                  <span className="dashboard-metric-label">{c.label}{c.onClick ? <ChevronRight size={14} /> : null}</span>
                  <span className="dashboard-metric-value tnum">{c.value}</span>
                  <span className="dashboard-metric-foot">{c.foot}</span>
                </button>
              ))}
            </div>

            {/* Needs attention — modern rows with stock bars */}
            <div className="dashboard-attention">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-(--ink-2)">
                  <span aria-hidden="true" className="h-3 w-1 rounded-full bg-[#C7FF4D]" />
                  Needs attention
                  {stats.lowStockItems.length > 0 ? (
                    <span className="tnum rounded-full bg-rose-500/12 px-2 py-0.5 text-[11px] font-extrabold text-rose-600 dark:text-rose-300">
                      {stats.lowStockItems.length}
                    </span>
                  ) : null}
                </p>
                {stats.lowStockItems.length > 0 ? (
                  <button type="button" onClick={() => goProducts('low')} className="press flex items-center gap-0.5 text-xs font-extrabold text-(--accent)">
                    View all <ArrowRight size={13} />
                  </button>
                ) : undefined}
              </div>
              {stats.lowStockItems.length === 0 ? (
                <div className="glass rounded-[24px] px-4 py-7 text-center">
                  <span className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E7B3C] text-white">
                    <CircleCheck size={24} />
                  </span>
                  <p className="text-[15px] font-extrabold text-(--ink)">All stocked up</p>
                  <p className="mt-0.5 text-[12.5px] text-(--ink-2)">No low-stock items right now.</p>
                </div>
              ) : (
                <div className="dashboard-attention-list">
                  {attentionRows.map(({ p, isOut, fillPct, meta }) => (
                    <div key={p.id} className="dashboard-attention-row">
                      <button type="button" onClick={() => goProducts(isOut ? 'out' : 'low')} className="dashboard-attention-item press">
                        <span className={`dashboard-attention-mark ${isOut ? 'is-out' : 'is-low'}`}>{isOut ? '!' : '↘'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-bold text-(--ink)">{p.name}</span>
                          <span className="block text-[11.5px] text-(--ink-2)">
                            <b className={isOut ? 'font-bold text-(--destructive)' : 'font-bold text-(--warning)'}>{isOut ? 'Out of stock' : 'Low stock'}</b>
                            {' · '}{p.currentStock} on hand · {meta}
                          </span>
                          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-(--stroke-dim)">
                            <span className={`block h-full ${isOut ? 'bg-(--destructive)' : 'bg-(--warning)'}`} style={{ width: `${fillPct}%` }} />
                          </span>
                        </span>
                      </button>
                      <div className="dashboard-attention-actions">
                        <button type="button" onClick={() => onStockInProduct(p)} aria-label={`Stock in ${p.name}`} title="Stock in" className="press"><Plus size={16} /></button>
                        <button type="button" onClick={() => onStockOutProduct(p)} aria-label={`Stock out ${p.name}`} title="Stock out" disabled={p.currentStock <= 0} className="press"><Minus size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity — timeline cards */}
            <div className="dashboard-activity">
              <div className="mb-2.5 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wider text-(--ink-2)">
                  <span aria-hidden="true" className="h-3 w-1 rounded-full bg-[#C7FF4D]" />
                  Recent activity
                </p>
                <button type="button" onClick={goHistory} className="press flex items-center gap-0.5 text-xs font-extrabold text-(--accent)">
                  View all <ArrowRight size={13} />
                </button>
              </div>
              {stats.recentMovements.length === 0 ? (
                <div className="glass rounded-[24px] px-4 py-7 text-center text-[13.5px] text-(--ink-2)">
                  No stock movements yet.
                </div>
              ) : (
                <div className="glass space-y-1 rounded-[24px] p-2">
                  {recentRows.map(({ t, isIn, when, pending }) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-[18px] px-2.5 py-2.5 transition-colors hover:bg-(--accent-soft)/40">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${
                          isIn ? 'bg-[#1E7B3C]' : 'bg-[#C2332D]'
                        }`}
                      >
                        {isIn ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="block truncate text-[14px] font-bold text-(--ink)">{t.productName}</span>
                          {pending ? (
                            <span className="shrink-0 rounded-full bg-(--accent-soft) px-1.5 py-px text-[10px] font-extrabold text-(--accent)">
                              Saving…
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[11.5px] font-medium text-(--ink-2)">
                          {when}
                          {t.reason ? ` · ${t.reason}` : ''}
                        </span>
                      </span>
                      <span
                        className={`tnum shrink-0 rounded-full px-2.5 py-1 text-[13px] font-extrabold ${
                          isIn ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/12 text-rose-600 dark:text-rose-300'
                        }`}
                      >
                        {isIn ? '+' : '−'}
                        {t.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

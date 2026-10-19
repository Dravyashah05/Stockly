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
  RefreshCw,
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
  goSettings,
  updateAvailable,
}: {
  onAddProduct: () => void;
  onStockIn: () => void;
  onStockOut: () => void;
  onStockInProduct: (p: Product) => void;
  onStockOutProduct: (p: Product) => void;
  goProducts: (filter?: 'low' | 'out') => void;
  goHistory: () => void;
  goSettings?: () => void;
  updateAvailable?: string | null;
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
        icon: <ArrowDownToLine size={22} />,
        iconCls: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
        onClick: onStockIn,
      },
      {
        label: 'Stock Out',
        sub: 'Sell / issue goods',
        icon: <ArrowUpFromLine size={22} />,
        iconCls: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
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
        iconCls: 'bg-(--accent-soft) text-(--primary)',
        ringCls: 'hover:border-(--accent)/40',
        onClick: () => goProducts(),
      },
      {
        label: 'Valuation',
        value: formatMoney(stats.inventoryCostValue),
        foot: `Retail ${formatMoney(stats.inventoryRetailValue)}`,
        icon: <Boxes size={18} />,
        iconCls: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
        ringCls: 'hover:border-emerald-500/40',
        onClick: undefined,
      },
      {
        label: 'Low stock',
        value: String(stats.lowStockCount),
        foot: 'needs restock',
        icon: <AlertTriangle size={18} />,
        iconCls: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
        ringCls: 'hover:border-amber-500/40',
        onClick: () => goProducts('low'),
      },
      {
        label: 'Out of stock',
        value: String(stats.outOfStockCount),
        foot: 'urgent',
        icon: <PackageX size={18} />,
        iconCls: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
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
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="press inline-flex items-center gap-1.5 text-[11px] font-semibold text-(--ink-2) hover:text-(--ink)"
            aria-label={refreshing ? 'Syncing inventory' : 'Synced - tap to refresh'}
          >
            <RefreshCw
              size={11}
              className={`shrink-0 ${refreshing ? 'animate-spin text-(--accent)' : online ? 'text-emerald-500' : 'text-amber-500'}`}
            />
            <span>{refreshing ? 'Syncing…' : online ? 'Synced' : 'Offline'}</span>
          </button>
        }
      />

      <div className="dashboard-content mx-auto max-w-md space-y-4 px-4 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        {/* Greeting — header with Add button */}
        <div className="dashboard-greeting px-1 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--field) px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-(--ink-2)">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {today}
          </span>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="min-w-0 flex-1 text-[28px] font-bold leading-tight tracking-tight text-(--ink) lg:text-[32px]">
              {greet}
              <Sparkles size={22} className="ml-2 inline-block -translate-y-0.5 text-(--primary)" />
            </h2>
            <button
              type="button"
              onClick={onAddProduct}
              aria-label="Add product"
              title="Add product"
              className="press flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-(--primary) px-4 text-[13px] font-semibold text-white shadow-sm hover:opacity-95"
            >
              <PackagePlus size={18} /><span>Add Product</span>
            </button>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-(--ink-2)">
            Your inventory, at a glance.
          </p>
        </div>

        {/* In-app update alert banner */}
        {updateAvailable ? (
          <button
            type="button"
            onClick={goSettings}
            className="press glass flex w-full items-center justify-between gap-3 rounded-[20px] p-3.5 border border-[#007AFF]/30 bg-[#007AFF]/10 text-left shadow-sm transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#007AFF] text-white shadow-sm">
                <ArrowDownToLine size={20} />
              </span>
              <div className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-(--ink) truncate">Update available · v{updateAvailable}</span>
                  <span className="rounded-full bg-[#007AFF] px-2 py-0.5 text-[10px] font-bold text-white shrink-0">New</span>
                </span>
                <span className="block text-[12px] font-normal text-(--ink-2) truncate">Tap to view what’s new and install the update</span>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
          </button>
        ) : null}

        {/* Stock In / Out — Inset Action cards */}
        <div className="dashboard-actions grid grid-cols-2 gap-2.5">

          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="glass press group flex min-h-[100px] flex-col items-start justify-between gap-2.5 rounded-[20px] p-4 text-left transition-colors hover:border-(--accent)/30"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-[14px] ${a.iconCls} transition-transform group-active:scale-95`}
              >
                {a.icon}
              </span>
              <span>
                <span className="block text-[15.5px] font-bold leading-tight text-(--ink)">{a.label}</span>
                <span className="block text-[11.5px] font-medium text-(--ink-2)">{a.sub}</span>
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
            <div className="dashboard-hero relative overflow-hidden rounded-[24px] p-5 text-white shadow-sm">
              <div className="relative flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
                    Total stock units
                  </p>
                  <p className="tnum mt-1 truncate text-[clamp(2.25rem,7vw,3.75rem)] font-extrabold leading-[0.95] tracking-tight">
                    {stats.totalUnits.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <p className="relative mt-3 border-t border-white/20 pt-2.5 text-[12px] font-medium text-white/75">Across your catalogue</p>
            </div>

            {/* Health Distribution Meter */}
            <div className="glass rounded-[20px] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-[12px] font-semibold">
                <span className="text-(--ink-2) uppercase tracking-wider text-[11px]">Stock Health</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.optimalPct}% Optimal</span>
              </div>
              <div className="h-2 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden flex">
                <div style={{ width: `${stats.optimalPct}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                <div style={{ width: `${stats.lowPct}%` }} className="bg-amber-500 h-full transition-all duration-500" />
                <div style={{ width: `${stats.outPct}%` }} className="bg-rose-500 h-full transition-all duration-500" />
              </div>
              <div className="flex items-center justify-between text-[11.5px] text-(--ink-2) pt-0.5 font-medium">
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
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-(--ink-2)">
                  Needs attention
                  {stats.lowStockItems.length > 0 ? (
                    <span className="tnum rounded-full bg-rose-500/12 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      {stats.lowStockItems.length}
                    </span>
                  ) : null}
                </p>
                {stats.lowStockItems.length > 0 ? (
                  <button type="button" onClick={() => goProducts('low')} className="press flex items-center gap-0.5 text-xs font-semibold text-(--primary)">
                    View all <ArrowRight size={13} />
                  </button>
                ) : undefined}
              </div>
              {stats.lowStockItems.length === 0 ? (
                <div className="glass rounded-[20px] px-4 py-7 text-center">
                  <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                    <CircleCheck size={22} />
                  </span>
                  <p className="text-[15px] font-semibold text-(--ink)">All stocked up</p>
                  <p className="mt-0.5 text-[12.5px] text-(--ink-2)">No low-stock items right now.</p>
                </div>
              ) : (
                <div className="dashboard-attention-list">
                  {attentionRows.map(({ p, isOut, fillPct, meta }) => (
                    <div key={p.id} className="dashboard-attention-row">
                      <button type="button" onClick={() => goProducts(isOut ? 'out' : 'low')} className="dashboard-attention-item press">
                        <span className={`dashboard-attention-mark ${isOut ? 'is-out' : 'is-low'}`}>{isOut ? '!' : '↘'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-(--ink)">{p.name}</span>
                          <span className="block text-[11.5px] text-(--ink-2)">
                            <b className={isOut ? 'font-semibold text-(--destructive)' : 'font-semibold text-(--warning)'}>{isOut ? 'Out of stock' : 'Low stock'}</b>
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
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-(--ink-2)">
                  Recent activity
                </p>
                <button type="button" onClick={goHistory} className="press flex items-center gap-0.5 text-xs font-semibold text-(--primary)">
                  View all <ArrowRight size={13} />
                </button>
              </div>
              {stats.recentMovements.length === 0 ? (
                <div className="glass rounded-[20px] px-4 py-7 text-center text-[13.5px] text-(--ink-2)">
                  No stock movements yet.
                </div>
              ) : (
                <div className="glass space-y-1 rounded-[20px] p-2">
                  {recentRows.map(({ t, isIn, when, pending }) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-[16px] px-2.5 py-2.5 transition-colors hover:bg-(--accent-soft)/40">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${
                          isIn ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isIn ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="block truncate text-[14px] font-semibold text-(--ink)">{t.productName}</span>
                          {pending ? (
                            <span className="shrink-0 rounded-full bg-(--accent-soft) px-1.5 py-px text-[10px] font-bold text-(--accent)">
                              Saving…
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[11.5px] font-normal text-(--ink-2)">
                          {when}
                          {t.reason ? ` · ${t.reason}` : ''}
                        </span>
                      </span>
                      <span
                        className={`tnum shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold ${
                          isIn ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
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

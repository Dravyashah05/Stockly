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
  Sparkles,
  TrendingUp,
  WifiOff,
} from 'lucide-react';
import { stockStatus, useStore } from '../lib/store';
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
  goProducts,
  goHistory,
}: {
  onAddProduct: () => void;
  onStockIn: () => void;
  onStockOut: () => void;
  goProducts: (filter?: 'low' | 'out') => void;
  goHistory: () => void;
}) {
  const { dashboard, products, transactions, loading, refreshing, error, refresh, online, lastSync, categoryName, isPending } =
    useStore();

  const stats = useMemo(() => {
    if (dashboard) return dashboard;
    const totalProducts = products.length;
    const totalUnits = products.reduce((a, p) => a + (p.currentStock || 0), 0);
    const low = products.filter((p) => stockStatus(p) === 'low');
    const out = products.filter((p) => stockStatus(p) === 'out');
    const cost = products.reduce((a, p) => a + (p.currentStock || 0) * (p.costPrice || 0), 0);
    return {
      totalProducts,
      totalUnits,
      lowStockCount: low.length,
      outOfStockCount: out.length,
      inventoryCostValue: cost,
      inventoryRetailValue: 0,
      recentMovements: transactions.slice(0, 6),
      lowStockItems: [...out, ...low].slice(0, 8),
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
        icon: <ArrowDownToLine size={28} />,
        grad: 'bg-[#151515] dark:bg-[#C7FF4D]',
        iconCls: 'text-[#C7FF4D] dark:text-[#151515]',
        onClick: onStockIn,
      },
      {
        label: 'Stock Out',
        sub: 'Sell / issue goods',
        icon: <ArrowUpFromLine size={28} />,
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
        label: 'Stock units',
        value: stats.totalUnits.toLocaleString('en-IN'),
        foot: 'across catalogue',
        icon: <TrendingUp size={18} />,
        iconCls: 'bg-(--accent-soft) text-(--ink) dark:text-(--accent)',
        ringCls: 'hover:border-(--accent)/40',
        onClick: undefined,
      },
      {
        label: 'Low stock',
        value: String(stats.lowStockCount),
        foot: 'needs restock',
        icon: <AlertTriangle size={18} />,
        iconCls: 'bg-amber-500/14 text-amber-600 dark:text-amber-300',
        ringCls: 'hover:border-amber-500/40',
        dot: stats.lowStockCount > 0 ? 'bg-amber-500' : undefined,
        onClick: () => goProducts('low'),
      },
      {
        label: 'Out of stock',
        value: String(stats.outOfStockCount),
        foot: 'urgent',
        icon: <PackageX size={18} />,
        iconCls: 'bg-rose-500/12 text-rose-600 dark:text-rose-300',
        ringCls: 'hover:border-rose-500/40',
        dot: stats.outOfStockCount > 0 ? 'bg-rose-500' : undefined,
        onClick: () => goProducts('out'),
      },
    ],
    // goProducts is a stable useCallback from App; stats is the only real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats],
  );

  // Precompute per-row display data once per stats change: category label,
  // stock-bar width and formatted date. The old code ran categoryName() +
  // toLocaleString() for every row on every render (incl. toast/sync ticks).
  const attentionRows = useMemo(
    () =>
      stats.lowStockItems.slice(0, 5).map((p) => {
        const rawCat = categoryName(p.categoryId);
        const catLabel = rawCat === '—' ? '' : rawCat.trim();
        return {
          p,
          isOut: stockStatus(p) === 'out',
          fillPct:
            p.minimumStock > 0
              ? Math.min(100, (p.currentStock / p.minimumStock) * 100)
              : p.currentStock > 0
                ? 100
                : 0,
          meta: catLabel ? `${catLabel} · min ${p.minimumStock}` : `min ${p.minimumStock}`,
        };
      }),
    [stats, categoryName],
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
        title="Stockly"
        subtitle={
          lastSync ? `Synced ${lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Inventory dashboard'
        }
      />

      <div className="mx-auto max-w-md space-y-5 px-4 pt-4">
        {/* Greeting — modern editorial header with Add button */}
        <div className="px-1 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#151515] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#F7F7F2] dark:bg-[#C7FF4D] dark:text-[#151515]">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {today}
          </span>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="min-w-0 flex-1 text-[28px] font-extrabold leading-[1.05] tracking-tight text-(--ink)">
              {greet}
              <Sparkles size={24} className="ml-2 inline-block -translate-y-1 text-(--accent)" />
            </h2>
            <button
              type="button"
              onClick={onAddProduct}
              aria-label="Add product"
              title="Add product"
              className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]"
            >
              <PackagePlus size={24} />
            </button>
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-(--ink-2)">
            Here&apos;s your business at a glance.
          </p>
        </div>

        {/* Stock In / Out — big action buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="glass press group flex min-h-[104px] flex-col items-start justify-between gap-2 rounded-[24px] border border-transparent p-4 text-left transition-colors hover:border-(--accent)/30"
            >
              <span
                className={`flex h-13 w-13 items-center justify-center rounded-2xl p-3.5 ${a.grad} ${a.iconCls} transition-transform group-active:scale-95`}
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
        <div aria-hidden="true" className="mx-1 h-px bg-(--stroke-dim)" />

        {!online ? (
          <div className="glass flex items-center gap-2 rounded-2xl border-amber-500/25 px-4 py-3 text-[13px] font-medium text-amber-600 dark:text-amber-300">
            <WifiOff size={16} /> Offline — showing last synced data
            {lastSync ? ` from ${lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}.
          </div>
        ) : null}
        {error && products.length === 0 && !loading ? (
          <ErrorState message={error} onRetry={() => void refresh()} retrying={refreshing} />
        ) : null}
        {error && products.length > 0 ? (
          <div className="glass flex items-center gap-2 rounded-2xl border-amber-500/25 px-4 py-3 text-[13px] font-medium text-amber-600 dark:text-amber-300">
            <WifiOff size={16} /> Sync failed — showing cached data.
          </div>
        ) : null}

        {loading && products.length === 0 ? (
          <div className="space-y-3">
            <SkeletonRow h={190} />
            <div className="grid grid-cols-2 gap-3">
              <SkeletonRow h={110} />
              <SkeletonRow h={110} />
            </div>
            <SkeletonRow h={120} />
          </div>
        ) : (
          <>
            {/* Bento stats */}
            <div className="grid grid-cols-2 gap-2.5">
              {bentoStats.map((c) => (
                <button
                  key={c.label}
                  onClick={c.onClick}
                  disabled={!c.onClick}
                  className={`glass press rounded-[24px] border border-transparent p-4 text-left transition-all hover:-translate-y-0.5 ${c.ringCls} ${!c.onClick ? 'cursor-default' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${c.iconCls}`}>{c.icon}</span>
                    {c.dot ? <span className={`h-2 w-2 rounded-full ${c.dot}`} /> : null}
                    {c.onClick ? <ChevronRight size={16} className="text-(--ink-3)" /> : null}
                  </div>
                  <p className="tnum mt-3 text-[26px] font-extrabold leading-none tracking-tight text-(--ink)">{c.value}</p>
                  <p className="mt-1 text-[12px] font-bold text-(--ink)">{c.label}</p>
                  <p className="text-[11px] font-medium text-(--ink-2)">{c.foot}</p>
                </button>
              ))}
            </div>

            {/* Needs attention — modern rows with stock bars */}
            <div>
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
                <div className="glass space-y-1 rounded-[24px] p-2">
                  {attentionRows.map(({ p, isOut, fillPct, meta }) => (
                    <button
                      key={p.id}
                      onClick={() => goProducts(isOut ? 'out' : 'low')}
                      className="press flex w-full items-center gap-3 rounded-[18px] px-2.5 py-2.5 text-left transition-colors hover:bg-(--accent-soft)/60"
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[16px] font-extrabold text-white ${
                          isOut ? 'bg-[#C2332D]' : 'bg-[#B45309]'
                        }`}
                      >
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-(--ink)">{p.name}</span>
                        <span className="mb-1.5 block text-[11.5px] font-medium text-(--ink-2)">{meta}</span>
                        <span className="block h-1.5 w-full overflow-hidden rounded-full bg-(--stroke-dim)">
                          <span
                            className={`block h-full rounded-full ${isOut ? 'bg-[#C2332D]' : 'bg-[#B45309]'}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </span>
                      </span>
                      <span
                        className={`tnum shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                          isOut
                            ? 'bg-rose-500/14 text-rose-600 dark:text-rose-300'
                            : 'bg-amber-500/16 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {p.currentStock} left
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity — timeline cards */}
            <div>
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

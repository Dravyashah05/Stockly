import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  ChevronRight,
  CircleCheck,
  OctagonX,
  PackagePlus,
  Plus,
  Minus,
  WifiOff,
} from 'lucide-react';
import { stockStatus, useStore } from '../../shared/store';
import type { Product } from '../../shared/types';
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
  const { dashboard, products, transactions, loading, refreshing, error, refresh, online, isPending } =
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
        icon: <ArrowDownToLine size={20} />,
        // Primary intent = filled accent; the inverse action is a tinted
        // surface so the two never compete for attention.
        tileCls: 'bg-(--primary) text-(--primary-foreground)',
        onClick: onStockIn,
      },
      {
        label: 'Stock Out',
        sub: 'Sell / issue goods',
        icon: <ArrowUpFromLine size={20} />,
        tileCls: 'bg-(--accent-soft) text-(--accent)',
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
        ringCls: 'hover:border-(--accent)/40',
        onClick: () => goProducts(),
      },
      {
        label: 'Low stock',
        value: String(stats.lowStockCount),
        foot: 'needs restock',
        ringCls: 'hover:border-(--warning)/40',
        onClick: () => goProducts('low'),
      },
      {
        label: 'Out of stock',
        value: String(stats.outOfStockCount),
        foot: 'urgent',
        ringCls: 'hover:border-(--destructive)/40',
        onClick: () => goProducts('out'),
      },
    ],
    // goProducts is a stable useCallback from App; stats is the only real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats],
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
      <Header title="Overview" />

      <div className="dashboard-content mx-auto max-w-md space-y-5 px-4 pt-4">
        {/* Greeting — the date is a passive chip, so it stays neutral. Accent
            colour is reserved for things the user can actually act on. */}
        <div className="dashboard-greeting px-1 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-(--glass-soft) px-2.5 py-1 text-[length:var(--fs-caption)] font-semibold text-(--ink-2)">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-(--success)' : 'bg-(--warning)'}`} />
            {today}
          </span>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h2 className="min-w-0 flex-1 text-[length:var(--fs-title2)] font-bold leading-[1.15] tracking-[-0.025em] text-(--ink)">
              {greet}
            </h2>
            <button
              type="button"
              onClick={onAddProduct}
              aria-label="Add product"
              title="Add product"
              className="press flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-(--primary) px-3 text-[length:var(--fs-footnote)] font-semibold text-(--primary-foreground) shadow-[0_1px_2px_rgba(0,0,0,0.08)] sm:px-4"
            >
              <PackagePlus size={18} /><span>Add Product</span>
            </button>
          </div>
        </div>

        {/* Stock In / Out — the two daily actions, side by side */}
        <div className="dashboard-actions grid grid-cols-2 gap-2.5">
          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="glass press group flex min-h-[84px] flex-col items-start justify-between gap-2 rounded-[calc(var(--radius-card) - 4px)] p-3.5 text-left transition-colors"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-icon)] transition-transform group-active:scale-95 ${a.tileCls}`}
              >
                {a.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[length:var(--fs-callout)] font-semibold leading-tight text-(--ink)">
                  {a.label}
                </span>
                <span className="block truncate text-[length:var(--fs-caption)] font-normal text-(--ink-2)">
                  {a.sub}
                </span>
              </span>
            </button>
          ))}
        </div>

        {!online ? (
          <div className="dashboard-banner glass flex items-center gap-2 rounded-[var(--radius-row)] border-(--warning)/25 px-4 py-3 text-[length:var(--fs-footnote)] font-medium text-(--warning-ink)">
            <WifiOff size={16} /> Offline — showing last synced data.
          </div>
        ) : null}
        {error && products.length === 0 && !loading ? (
          <div className="dashboard-banner">
            <ErrorState message={error} onRetry={() => void refresh()} retrying={refreshing} />
          </div>
        ) : null}
        {error && products.length > 0 ? (
          <div className="dashboard-banner glass flex items-center gap-2 rounded-[var(--radius-row)] border-(--warning)/25 px-4 py-3 text-[length:var(--fs-footnote)] font-medium text-(--warning-ink)">
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
            {/* Primary inventory metric — the one number that answers
                "how much stock do I have?" */}
            <div className="dashboard-hero relative overflow-hidden rounded-[calc(var(--radius-card) - 4px)] border border-(--stroke-dim) bg-(--bg-elev) p-5 text-(--ink)">
              <div className="relative flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[length:var(--fs-caption)] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">
                    Total stock units
                  </p>
                  <p className="tnum mt-2 truncate text-[clamp(2.25rem,7vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.06em]">
                    {stats.totalUnits.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <p className="relative mt-3 border-t border-(--stroke-dim) pt-3 text-[length:var(--fs-caption)] font-medium text-(--ink-2)">
                Across your catalogue
              </p>
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

            {/* Needs attention — the actionable list, so it comes before the
                passive activity feed. */}
            <div className="dashboard-attention">
              <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
                <p className="flex items-center gap-2 text-[length:var(--fs-caption)] font-semibold uppercase tracking-[0.06em] text-(--ink-3)">
                  Needs attention
                  {stats.lowStockItems.length > 0 ? (
                    <span className="tnum rounded-[var(--radius-chip)] bg-(--destructive)/12 px-2 py-0.5 text-[length:var(--fs-caption)] font-semibold normal-case text-(--destructive-ink)">
                      {stats.lowStockItems.length}
                    </span>
                  ) : null}
                </p>
                {stats.lowStockItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => goProducts('low')}
                    className="press flex items-center gap-0.5 text-[length:var(--fs-footnote)] font-semibold text-(--accent)"
                  >
                    View all <ArrowRight size={13} />
                  </button>
                ) : undefined}
              </div>
              {stats.lowStockItems.length === 0 ? (
                <div className="glass flex flex-col items-center rounded-[calc(var(--radius-card) - 4px)] px-4 py-7 text-center">
                  <span className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-[var(--radius-icon)] bg-(--success)/14 text-(--success-ink)">
                    <CircleCheck size={24} />
                  </span>
                  <p className="text-[length:var(--fs-subhead)] font-semibold text-(--ink)">All stocked up</p>
                  <p className="mt-0.5 text-[length:var(--fs-caption)] text-(--ink-2)">No low-stock items right now.</p>
                </div>
              ) : (
                <div className="dashboard-attention-list">
                  {attentionRows.map(({ p, isOut, fillPct, meta }) => (
                    <div key={p.id} className="dashboard-attention-row">
                      <button type="button" onClick={() => goProducts(isOut ? 'out' : 'low')} className="dashboard-attention-item press">
                        <span className={`dashboard-attention-mark ${isOut ? 'is-out' : 'is-low'}`} aria-hidden="true">{isOut ? <OctagonX size={15} /> : <AlertTriangle size={15} />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[length:var(--fs-subhead)] font-semibold text-(--ink)">{p.name}</span>
                          <span className="block text-[length:var(--fs-caption)] text-(--ink-2)">
                            <b className={isOut ? 'font-semibold text-(--destructive-ink)' : 'font-semibold text-(--warning-ink)'}>{isOut ? 'Out of stock' : 'Low stock'}</b>
                            {' · '}{p.currentStock} on hand · {meta}
                          </span>
                          <span className="mt-1.5 block h-1 overflow-hidden rounded-[calc(var(--radius-chip))] bg-(--stroke-dim)">
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

            {/* Recent activity — the passive feed, after the actionable list */}
            <div className="dashboard-activity">
              <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
                <p className="text-[length:var(--fs-caption)] font-semibold uppercase tracking-[0.06em] text-(--ink-3)">
                  Recent activity
                </p>
                <button
                  type="button"
                  onClick={goHistory}
                  className="press flex items-center gap-0.5 text-[length:var(--fs-footnote)] font-semibold text-(--accent)"
                >
                  View all <ArrowRight size={13} />
                </button>
              </div>
              {stats.recentMovements.length === 0 ? (
                <div className="glass rounded-[var(--radius-card)] px-4 py-7 text-center text-[length:var(--fs-footnote)] text-(--ink-2)">
                  No stock movements yet.
                </div>
              ) : (
                <div className="glass divide-y divide-(--stroke-dim) rounded-[var(--radius-card)] px-1.5">
                  {recentRows.map(({ t, isIn, when, pending }) => (
                    <div key={t.id} className="flex items-center gap-3 px-2 py-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-icon)] ${
                          isIn
                            ? 'bg-(--success)/14 text-(--success-ink)'
                            : 'bg-(--destructive)/12 text-(--destructive-ink)'
                        }`}
                      >
                        {isIn ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="block truncate text-[length:var(--fs-subhead)] font-semibold text-(--ink)">
                            {t.productName}
                          </span>
                          {pending ? (
                            <span className="shrink-0 rounded-[var(--radius-chip)] bg-(--accent-soft) px-1.5 py-px text-[length:var(--fs-caption)] font-semibold text-(--accent)">
                              Saving…
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[length:var(--fs-caption)] font-normal text-(--ink-2)">
                          {when}
                          {t.reason ? ` · ${t.reason}` : ''}
                        </span>
                      </span>
                      <span
                        className={`tnum shrink-0 rounded-[var(--radius-chip)] px-2.5 py-1 text-[length:var(--fs-footnote)] font-semibold ${
                          isIn
                            ? 'bg-(--success)/12 text-(--success-ink)'
                            : 'bg-(--destructive)/12 text-(--destructive-ink)'
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

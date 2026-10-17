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
        // Primary intent = filled primary; the inverse action is tonal so
        // the two never compete for attention.
        btnCls: 'btn btn-filled flex-1',
        onClick: onStockIn,
      },
      {
        label: 'Stock Out',
        sub: 'Sell / issue goods',
        icon: <ArrowUpFromLine size={20} />,
        btnCls: 'btn btn-tonal flex-1',
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
        onClick: () => goProducts(),
      },
      {
        label: 'Low stock',
        value: String(stats.lowStockCount),
        foot: 'needs restock',
        onClick: () => goProducts('low'),
      },
      {
        label: 'Out of stock',
        value: String(stats.outOfStockCount),
        foot: 'urgent',
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
    <div className="screen">
      <Header
        title={greet}
        subtitle={today}
        right={
          <button
            type="button"
            onClick={onAddProduct}
            aria-label="Add product"
            className="btn btn-filled btn-sm shrink-0"
          >
            <PackagePlus size={17} />
            <span className="hidden sm:inline">Add</span>
          </button>
        }
      />

      <div className="screen-body">
        <div className="app-column page-pad animate-screen-in space-y-5 pb-4 pt-3">
          {/* Offline / sync banners sit above everything: they change how
              the numbers below should be read. */}
          {!online ? (
            <div className="badge badge-warning w-full justify-center gap-1.5 py-2 text-[length:var(--fs-body-md)]">
              <WifiOff size={15} /> Offline — showing last synced data.
            </div>
          ) : null}
          {error && products.length === 0 && !loading ? (
            <ErrorState message={error} onRetry={() => void refresh()} retrying={refreshing} />
          ) : null}
          {error && products.length > 0 ? (
            <div className="badge badge-warning w-full justify-center gap-1.5 py-2 text-[length:var(--fs-body-md)]">
              <WifiOff size={15} /> Sync failed — showing cached data.
            </div>
          ) : null}

          {loading && products.length === 0 ? (
            <div className="space-y-3">
              <SkeletonRow h={140} />
              <div className="grid grid-cols-2 gap-3">
                <SkeletonRow h={92} />
                <SkeletonRow h={92} />
              </div>
              <SkeletonRow h={220} />
            </div>
          ) : (
            <>
              {/* Primary inventory metric — the one number that answers
                  "how much stock do I have?" */}
              <div className="card-hero px-5 py-6">
                <p className="text-[length:var(--fs-title-sm)] font-semibold tracking-[0.04em] text-(--on-primary-container)/80 uppercase">
                  Total stock units
                </p>
                <p className="tnum mt-2 truncate text-[length:var(--fs-display)] leading-none font-bold">
                  {stats.totalUnits.toLocaleString('en-IN')}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-(--on-primary-container)/15 pt-3 text-[length:var(--fs-body-sm)] font-medium">
                  <span>Across your catalogue</span>
                  <span className="tnum">{stats.totalProducts} products</span>
                </div>
              </div>

              {/* The two daily actions, large and reachable with one thumb. */}
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((a) => (
                  <button key={a.label} type="button" onClick={a.onClick} className={`${a.btnCls} flex-col !gap-1 py-4`}>
                    {a.icon}
                    <span className="text-[length:var(--fs-label-lg)] font-semibold">{a.label}</span>
                    <span className="text-[length:var(--fs-label-sm)] font-normal opacity-80">{a.sub}</span>
                  </button>
                ))}
              </div>

              {/* Tappable metric tiles: filters into Products. */}
              <div className="grid grid-cols-3 gap-2.5">
                {bentoStats.map((c) => (
                  <button
                    key={c.label}
                    onClick={c.onClick}
                    className="card state-tint flex flex-col items-start gap-0.5 p-3 text-left"
                  >
                    <span className="flex items-center gap-0.5 text-[length:var(--fs-body-sm)] font-medium text-(--on-surface-variant)">
                      {c.label}
                      <ChevronRight size={13} />
                    </span>
                    <span className="tnum text-[length:var(--fs-headline-sm)] leading-tight font-bold text-(--on-surface)">
                      {c.value}
                    </span>
                    <span className="truncate text-[length:var(--fs-label-sm)] text-(--outline)">{c.foot}</span>
                  </button>
                ))}
              </div>

              {/* Needs attention — the actionable list, so it comes before the
                  passive activity feed. */}
              <section>
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <p className="section-label flex items-center gap-2">
                    Needs attention
                    {stats.lowStockItems.length > 0 ? (
                      <span className="badge badge-danger tnum">{stats.lowStockItems.length}</span>
                    ) : null}
                  </p>
                  {stats.lowStockItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => goProducts('low')}
                      className="btn btn-text btn-sm !min-h-8 !px-2"
                    >
                      View all <ArrowRight size={13} />
                    </button>
                  ) : undefined}
                </div>
                {stats.lowStockItems.length === 0 ? (
                  <div className="card-flat flex flex-col items-center px-4 py-7 text-center">
                    <span className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-[var(--shape-md)] bg-(--success-container) text-(--on-success-container)">
                      <CircleCheck size={24} />
                    </span>
                    <p className="text-[length:var(--fs-title-md)] font-semibold text-(--on-surface)">All stocked up</p>
                    <p className="mt-0.5 text-[length:var(--fs-body-sm)] text-(--on-surface-variant)">No low-stock items right now.</p>
                  </div>
                ) : (
                  <div className="group-list">
                    {attentionRows.map(({ p, isOut, fillPct, meta }) => (
                      <div key={p.id} className="group-row !items-stretch !py-2.5">
                        <button
                          type="button"
                          onClick={() => goProducts(isOut ? 'out' : 'low')}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--shape-sm)] ${
                              isOut
                                ? 'bg-(--danger-container) text-(--on-danger-container)'
                                : 'bg-(--warning-container) text-(--on-warning-container)'
                            }`}
                            aria-hidden="true"
                          >
                            {isOut ? <OctagonX size={16} /> : <AlertTriangle size={16} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[length:var(--fs-body-md)] font-semibold text-(--on-surface)">{p.name}</span>
                            <span className="block text-[length:var(--fs-body-sm)] text-(--on-surface-variant)">
                              <b className={isOut ? 'font-semibold text-(--error)' : 'font-semibold text-(--warning)'}>
                                {isOut ? 'Out of stock' : 'Low stock'}
                              </b>
                              {' · '}{p.currentStock} on hand · {meta}
                            </span>
                            <span className="mt-1.5 block h-1 overflow-hidden rounded-[var(--shape-full)] bg-(--surface-container-high)">
                              <span
                                className={`block h-full ${isOut ? 'bg-(--error)' : 'bg-(--warning-strong)'}`}
                                style={{ width: `${fillPct}%` }}
                              />
                            </span>
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onStockInProduct(p)}
                            aria-label={`Stock in ${p.name}`}
                            title="Stock in"
                            className="icon-btn icon-btn-tonal !h-10 !w-10 text-(--success)"
                          >
                            <Plus size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onStockOutProduct(p)}
                            aria-label={`Stock out ${p.name}`}
                            title="Stock out"
                            disabled={p.currentStock <= 0}
                            className="icon-btn icon-btn-tonal !h-10 !w-10 text-(--on-surface-variant) disabled:opacity-40"
                          >
                            <Minus size={17} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Recent activity — the passive feed, after the actionable list */}
              <section>
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <p className="section-label">Recent activity</p>
                  <button
                    type="button"
                    onClick={goHistory}
                    className="btn btn-text btn-sm !min-h-8 !px-2"
                  >
                    View all <ArrowRight size={13} />
                  </button>
                </div>
                {stats.recentMovements.length === 0 ? (
                  <div className="card-flat px-4 py-7 text-center text-[length:var(--fs-body-md)] text-(--on-surface-variant)">
                    No stock movements yet.
                  </div>
                ) : (
                  <div className="group-list">
                    {recentRows.map(({ t, isIn, when, pending }) => (
                      <div key={t.id} className="group-row">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--shape-sm)] ${
                            isIn
                              ? 'bg-(--success-container) text-(--on-success-container)'
                              : 'bg-(--danger-container) text-(--on-danger-container)'
                          }`}
                        >
                          {isIn ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="block truncate text-[length:var(--fs-body-md)] font-semibold text-(--on-surface)">
                              {t.productName}
                            </span>
                            {pending ? (
                              <span className="badge badge-accent shrink-0">Saving…</span>
                            ) : null}
                          </span>
                          <span className="block truncate text-[length:var(--fs-body-sm)] font-normal text-(--on-surface-variant)">
                            {when}
                            {t.reason ? ` · ${t.reason}` : ''}
                          </span>
                        </span>
                        <span
                          className={`tnum badge shrink-0 ${
                            isIn ? 'badge-success' : 'badge-danger'
                          }`}
                        >
                          {isIn ? '+' : '−'}
                          {t.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, ArrowDownUp, ArrowLeft, ArrowUpFromLine, MoreVertical, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
<<<<<<<< HEAD:apps/mobile/src/screens/ProductsScreen.tsx
import { formatMoney } from '@stockly/shared-client/config';
import { stockStatus, useStore } from '@stockly/shared-client/store';
import type { Product } from '@stockly/shared-types';
========
import { formatMoney } from '../../shared/config';
import { stockStatus, useStore } from '../../shared/store';
import type { Product } from '../../shared/types';
>>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d:mobile-app/src/app/screens/ProductsScreen.tsx
import { ActionSheet, Confirm, EmptyState, Header, SearchBar, Segmented, SkeletonRow, StockBadge, useDismissable } from '../components/ui';

type SortKey = 'name' | 'stock' | 'price' | 'updated';
export type ProductFilter = 'all' | 'low' | 'out';

/** Paginated rendering keeps large catalogs smooth (V2 perf). */
const PAGE_SIZE = 50;

export default function ProductsScreen({
  initialFilter = 'all',
  onAdd,
  onEdit,
  onStockIn,
  onStockOut,
}: {
  initialFilter?: ProductFilter;
  onAdd: () => void;
  onEdit: (p: Product) => void;
  onStockIn: (p: Product) => void;
  onStockOut: (p: Product) => void;
}) {
  const { products, categories, removeProduct, loading, isPending, categoryName } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState<ProductFilter>(initialFilter);
  const [sort, setSort] = useState<SortKey>('updated');
  const [del, setDel] = useState<Product | null>(null);
  const [menu, setMenu] = useState<Product | null>(null);
  const [view, setView] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Defer filtering so typing stays at 90Hz — list catches up a frame later.
  const deferredQ = useDeferredValue(q);

  // Stable row callbacks — without these every store update (toasts, sync
  // badges) creates new closures and re-renders all memoized rows.
  const handleView = useCallback((p: Product) => setView(p), []);
  const handleMenu = useCallback((p: Product) => setMenu(p), []);

  // Reset pagination whenever the result set changes.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [deferredQ, cat, status, sort, products.length]);

  const list = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    let rows = products.filter((p) => {
      if (cat === '__none') {
        if ((p.categoryId || '') !== '') return false;
      } else if (cat !== 'all') {
        if ((p.categoryId || '') !== cat) return false;
      }
      if (status === 'low' && stockStatus(p) !== 'low') return false;
      if (status === 'out' && stockStatus(p) !== 'out') return false;
      if (needle) {
        const hay = `${p.name} ${p.sku} ${categoryName(p.categoryId || '')}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'stock') return b.currentStock - a.currentStock;
      if (sort === 'price') return b.sellingPrice - a.sellingPrice;
      return +new Date(b.updatedAt || 0) - +new Date(a.updatedAt || 0);
    });
    return rows;
  }, [products, deferredQ, cat, status, sort, categoryName]);

  const statusTabs: { key: ProductFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'low', label: 'Low' },
    { key: 'out', label: 'Out' },
  ];

  const filtersActive = q !== '' || cat !== 'all' || status !== 'all' || sort !== 'updated';
  const clearFilters = () => {
    setQ('');
    setCat('all');
    setStatus('all');
    setSort('updated');
  };

  return (
    <div className="screen">
      <Header
        title="Products"
        subtitle={
          status !== 'all' || cat !== 'all' || deferredQ.trim()
            ? `${list.length} of ${products.length} items`
            : `${products.length} item${products.length === 1 ? '' : 's'}`
        }
        right={
          <button
            onClick={onAdd}
            aria-label="Add product"
            className="icon-btn bg-(--primary) text-(--on-primary) shadow-[var(--elev-1)] hover:brightness-110"
          >
            <Plus size={20} />
          </button>
        }
      />

      {/* Fixed controls */}
      <div className="app-column page-pad shrink-0 space-y-3 pb-3">
        <SearchBar value={q} onChange={setQ} placeholder="Search name, SKU…" />

        {/* Category chips */}
        {categories.length > 0 ? (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            <Chip active={cat === 'all'} onClick={() => setCat('all')} label="All" />
            {categories.map((c) => (
              <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.name} />
            ))}
            <Chip active={cat === '__none'} onClick={() => setCat('__none')} label="Uncategorized" />
          </div>
        ) : null}

        {/* Status filter + sort */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Segmented<ProductFilter>
              label="Stock status filter"
              options={statusTabs}
              value={status}
              onChange={setStatus}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              setSort((s) => (s === 'updated' ? 'name' : s === 'name' ? 'stock' : s === 'stock' ? 'price' : 'updated'))
            }
            aria-label="Change sorting"
            className="chip shrink-0"
          >
            <ArrowDownUp size={15} />
            {sort === 'updated' ? 'Recent' : sort === 'name' ? 'Name' : sort === 'stock' ? 'Stock' : 'Price'}
          </button>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="chip shrink-0 text-(--error)"
            >
              <X size={15} /> Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* List scrolls under the fixed controls */}
      <div className="app-column scroll-region page-pad">
        {loading && products.length === 0 ? (
          <div className="space-y-2.5 pb-4">
            <SkeletonRow h={76} />
            <SkeletonRow h={76} />
            <SkeletonRow h={76} />
          </div>
        ) : list.length === 0 ? (
          <div className="pb-4">
            <EmptyState
              icon={<Search size={22} />}
              title={filtersActive ? 'No products match' : 'No products yet'}
              hint={filtersActive ? 'Try another search or clear the filters.' : 'Add a product to start tracking stock.'}
            />
            {filtersActive ? (
              <button type="button" onClick={clearFilters} className="btn btn-outline mx-auto flex">
                <X size={16} /> Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <div className="pb-4">
            <div className="group-list">
              {list.slice(0, visible).map((p) => (
                <ProductRow
                  key={p.id}
                  p={p}
                  catLabel={(categoryName(p.categoryId || '') || '').trim()}
                  pending={isPending(p.id)}
                  onView={handleView}
                  onMenu={handleMenu}
                />
              ))}
            </div>
            {list.length > visible ? (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="btn btn-tonal btn-block mt-3"
              >
                Show more ({list.length - visible} remaining)
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Full-screen product detail page */}
      {view ? (
        <DetailPage
          p={view}
          onClose={() => setView(null)}
          onEdit={() => {
            setView(null);
            onEdit(view);
          }}
          onStockIn={() => {
            setView(null);
            onStockIn(view);
          }}
          onStockOut={() => {
            setView(null);
            onStockOut(view);
          }}
          onDelete={() => {
            setView(null);
            setDel(view);
          }}
        />
      ) : null}

      <ActionSheet
        open={!!menu}
        onClose={() => setMenu(null)}
        title={menu?.name || ''}
        actions={[
          { label: 'View details', icon: <Search size={16} />, onClick: () => menu && setView(menu) },
          { label: 'Edit product', icon: <Pencil size={16} />, onClick: () => menu && onEdit(menu) },
          { label: 'Delete product', icon: <Trash2 size={16} />, danger: true, onClick: () => menu && setDel(menu) },
        ]}
      />

      <Confirm
        open={!!del}
        title="Delete product?"
        body={`“${del?.name}” and its details will be removed. Past transactions are kept for records. This cannot be undone.`}
        busy={busy}
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          if (!del) return;
          setBusy(true);
          const ok = await removeProduct(del.id);
          setBusy(false);
          if (ok) setDel(null);
        }}
      />
    </div>
  );
}

/* Memoized row: re-renders only when its own product, pending flag
 * or the stable callbacks change — not on unrelated store updates
 * (toasts, sync banners, other rows' pending badges). */
const ProductRow = memo(function ProductRow({
  p,
  catLabel,
  pending,
  onView,
  onMenu,
}: {
  p: Product;
  catLabel: string;
  pending: boolean;
  onView: (p: Product) => void;
  onMenu: (p: Product) => void;
}) {
  const st = stockStatus(p);
  const sku = (p.sku || '').trim();
  const sub = [sku, catLabel].filter(Boolean).join(' · ');
  return (
    <div
      onClick={() => onView(p)}
      role="button"
      tabIndex={0}
      aria-label={`${p.name}, ${p.currentStock} in stock`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(p); } }}
      className="group-row cursor-pointer !items-center"
    >
      {p.image ? (
        <img
          src={p.image}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-12 w-12 shrink-0 rounded-[var(--shape-md)] object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--shape-md)] bg-(--primary-container) text-[length:var(--fs-title-md)] font-bold text-(--on-primary-container)">
          {p.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[length:var(--fs-body-md)] font-semibold text-(--on-surface)">{p.name}</p>
        {sub ? <p className="tnum truncate text-[length:var(--fs-body-sm)] text-(--on-surface-variant)">{sub}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {pending ? <span className="badge badge-accent">Saving…</span> : null}
          <span
            className={`tnum text-[length:var(--fs-body-sm)] font-semibold ${
              st === 'out'
                ? 'text-(--error)'
                : st === 'low'
                  ? 'text-(--warning)'
                  : 'text-(--success)'
            }`}
          >
            {st === 'out' ? 'Out of stock' : st === 'low' ? `${p.currentStock} · Low` : `${p.currentStock} in stock`}
          </span>
          {p.sellingPrice > 0 ? (
            <span className="tnum text-[length:var(--fs-body-sm)] font-bold text-(--on-surface)">{formatMoney(p.sellingPrice)}</span>
          ) : null}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMenu(p);
        }}
        aria-label={`Actions for ${p.name}`}
        className="icon-btn shrink-0"
      >
        <MoreVertical size={18} />
      </button>
    </div>
  );
});

function DetailPage({
  p,
  onClose,
  onEdit,
  onStockIn,
  onStockOut,
  onDelete,
}: {
  p: Product;
  onClose: () => void;
  onEdit: () => void;
  onStockIn: () => void;
  onStockOut: () => void;
  onDelete: () => void;
}) {
  const st = stockStatus(p);
  const unitPrice = p.sellingPrice > 0 ? p.sellingPrice : p.costPrice;
  const dateFmt = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    // Legacy rows can hold unparseable timestamps — never render "Invalid Date".
    if (Number.isNaN(+d)) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const dateTimeFmt = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(+d)) return '';
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  const { transactions, isPending, categoryName } = useStore();
  const catLabel = (categoryName(p.categoryId || '') || '').trim();
  const history = useMemo(
    () =>
      transactions
        .filter((t) => t.productId === p.id)
        .sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0)),
    [transactions, p.id],
  );
  const totalIn = useMemo(
    () => history.reduce((a, t) => a + (t.type === 'IN' ? t.quantity || 0 : 0), 0),
    [history],
  );
  const totalOut = useMemo(
    () => history.reduce((a, t) => a + (t.type === 'OUT' ? t.quantity || 0 : 0), 0),
    [history],
  );
  // Escape + Android Back dismiss; sits below sheets (z-40) so Confirm/ActionSheet stay on top.
  // Portal to body so no transformed ancestor traps its fixed positioning.
  useDismissable(true, onClose);
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-40 overflow-y-auto bg-(--surface)"
      role="dialog"
      aria-modal="true"
      aria-label={p.name}
    >
      <div className="app-column min-h-dvh pb-6">
        {/* Hero image */}
        <div className="relative">
          {p.image ? (
            <img
              src={p.image}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-64 w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-52 w-full items-center justify-center bg-(--primary-container)">
              <span className="flex h-24 w-24 items-center justify-center rounded-[var(--shape-xl)] bg-(--surface-container-lowest) text-[length:var(--fs-headline-md)] font-bold text-(--on-primary-container)">
                {p.name.slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}
          {/* Floating top buttons */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
            <button
              onClick={onClose}
              aria-label="Back to products"
              className="icon-btn bg-(--surface-container-lowest) text-(--on-surface) shadow-[var(--elev-1)]"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={onEdit}
              aria-label={`Edit ${p.name}`}
              className="btn btn-sm rounded-full bg-(--surface-container-lowest) text-(--on-surface) shadow-[var(--elev-1)]"
            >
              <Pencil size={15} /> Edit
            </button>
          </div>
          {/* Status over image */}
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            <span
              className={`badge tnum ${
                st === 'out' ? 'badge-danger' : st === 'low' ? 'badge-warning' : 'badge-success'
              }`}
            >
              {st === 'out' ? 'Out of stock' : st === 'low' ? `Low stock · ${p.currentStock} left` : `${p.currentStock} in stock`}
            </span>
            {catLabel ? <span className="badge badge-neutral">{catLabel}</span> : null}
          </div>
        </div>

        <div className="page-pad space-y-4 pt-4">
          {/* Title + price */}
          <div>
            {(p.sku || '').trim() ? (
              <p className="tnum text-[length:var(--fs-body-sm)] font-medium tracking-[0.06em] text-(--outline) uppercase">{p.sku}</p>
            ) : null}
            <h2 className="mt-0.5 text-[length:var(--fs-headline-sm)] font-semibold leading-tight text-(--on-surface)">{p.name}</h2>
            {unitPrice > 0 ? (
              <p className="tnum mt-1 text-[length:var(--fs-title-lg)] font-semibold text-(--primary)">{formatMoney(unitPrice)}</p>
            ) : null}
            {dateFmt(p.createdAt) || dateFmt(p.updatedAt) ? (
              <p className="mt-1 text-[length:var(--fs-body-sm)] font-normal text-(--on-surface-variant)">
                {dateFmt(p.createdAt) ? `Added ${dateFmt(p.createdAt)}` : ''}
                {dateFmt(p.createdAt) && dateFmt(p.updatedAt) ? ' · ' : ''}
                {dateFmt(p.updatedAt) ? `Updated ${dateFmt(p.updatedAt)}` : ''}
              </p>
            ) : null}
          </div>

          {/* Stock stats */}
          <div className="card grid grid-cols-3 divide-x divide-(--outline-variant) py-3 text-center">
            <div>
              <p className="tnum text-[length:var(--fs-headline-sm)] font-bold text-(--on-surface)">{p.currentStock}</p>
              <p className="mt-0.5 text-[length:var(--fs-body-sm)] font-medium text-(--on-surface-variant)">In stock</p>
            </div>
            <div>
              <p className="tnum text-[length:var(--fs-headline-sm)] font-bold text-(--on-surface)">{p.minimumStock}</p>
              <p className="mt-0.5 text-[length:var(--fs-body-sm)] font-medium text-(--on-surface-variant)">Minimum</p>
            </div>
            <div>
              <p className="tnum text-[length:var(--fs-headline-sm)] font-bold text-(--primary)">
                {p.currentStock > 0 ? Math.floor((p.currentStock / Math.max(p.minimumStock, 1)) * 100) : 0}%
              </p>
              <p className="mt-0.5 text-[length:var(--fs-body-sm)] font-medium text-(--on-surface-variant)">Of minimum</p>
            </div>
          </div>

          {(p.description || '').trim() ? (
            <div className="card-flat p-4">
              <p className="section-label mb-1.5">Description</p>
              <p className="whitespace-pre-wrap break-words text-[length:var(--fs-body-md)] leading-relaxed text-(--on-surface)">{p.description}</p>
            </div>
          ) : null}

          {/* Stock In / Out history for this product */}
          <div className="card-flat p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="section-label">
                Stock history{history.length > 0 ? ` · ${history.length}` : ''}
              </p>
              {history.length > 0 ? (
                <p className="tnum shrink-0 text-[length:var(--fs-body-sm)] font-semibold">
                  <span className="text-(--success)">+{totalIn} in</span>
                  <span className="text-(--outline)"> · </span>
                  <span className="text-(--error)">−{totalOut} out</span>
                </p>
              ) : null}
            </div>
            {history.length === 0 ? (
              <p className="py-3 text-center text-[length:var(--fs-body-md)] text-(--on-surface-variant)">
                No stock movements yet — use Stock In / Out below.
              </p>
            ) : (
              <div className="divide-y divide-(--outline-variant)">
                {history.slice(0, 20).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-1 py-3">
                    <StockBadge kind={t.type} />
                    {isPending(t.id) ? <span className="badge badge-accent">Saving…</span> : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-[length:var(--fs-body-sm)] leading-relaxed text-(--on-surface-variant)">
                        {dateTimeFmt(t.createdAt)}
                        {t.reason ? ` · ${t.reason}` : ''}
                      </p>
                      {t.note ? (
                        <p className="mt-0.5 line-clamp-2 break-words text-[length:var(--fs-body-sm)] leading-snug text-(--on-surface-variant)">{t.note}</p>
                      ) : null}
                    </div>
                    <span
                      className={`tnum badge shrink-0 ${t.type === 'IN' ? 'badge-success' : 'badge-danger'}`}
                    >
                      {t.type === 'IN' ? '+' : '−'}
                      {t.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {history.length > 20 ? (
              <p className="tnum pt-2 text-center text-[length:var(--fs-body-sm)] font-medium text-(--outline)">
                Showing latest 20 of {history.length} — see History tab for all.
              </p>
            ) : null}
          </div>

          {/* Sticky action bar */}
          <div className="sticky bottom-2">
            <div className="card-outlined grid grid-cols-2 gap-2 p-2">
              <button type="button" onClick={onStockIn} className="btn btn-filled">
                <ArrowDownToLine size={16} /> Stock In
              </button>
              <button type="button" onClick={onStockOut} className="btn btn-tonal">
                <ArrowUpFromLine size={16} /> Stock Out
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              className="btn btn-text mx-auto mt-1 flex text-(--error)"
            >
              <Trash2 size={14} /> Delete product
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const Chip = memo(function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="chip shrink-0">
      {label}
    </button>
  );
});

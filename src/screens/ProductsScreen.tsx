import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, ArrowDownUp, ArrowLeft, ArrowUpFromLine, MoreVertical, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { formatMoney } from '../lib/config';
import { stockStatus, useStore } from '../lib/store';
import type { Product } from '../lib/types';
import { ActionSheet, Confirm, EmptyState, Header, SearchBar, Segmented, SkeletonRow, StockBadge, useDismissable } from '../components/ui';

type SortKey = 'name' | 'stock' | 'price' | 'updated';
export type ProductFilter = 'all' | 'low' | 'out';

/** Pseudo-filter for products with no category assigned. */
const UNCAT = '__none';

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
  const { products, categories, removeProduct, loading, isPending } = useStore();
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

  // O(1) category lookups: the old per-row .find() made every list render
  // O(rows × categories). Map identity is stable until categories change,
  // so the filter memo below doesn't recompute on unrelated store updates.
  const catMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(String(c.id), c.name);
    return m;
  }, [categories]);

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
    // Lookup once: Sheet columns edited by hand sometimes hold the category
    // NAME instead of its id, or ids with stray spaces — match both.
    const selectedName = cat === 'all' || cat === UNCAT
      ? ''
      : (catMap.get(String(cat)) || '').trim().toLowerCase();
    let rows = products.filter((p) => {
      const pid = String(p.categoryId || '').trim();
      if (cat === UNCAT) {
        if (pid !== '') return false;
      } else if (cat !== 'all') {
        if (pid !== String(cat) && (!selectedName || pid.toLowerCase() !== selectedName)) return false;
      }
      if (status === 'low' && stockStatus(p) !== 'low') return false;
      if (status === 'out' && stockStatus(p) !== 'out') return false;
      if (needle) {
        const cn = catMap.get(String(p.categoryId)) || '';
        const hay = `${p.name} ${p.sku} ${cn}`.toLowerCase();
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
  }, [products, deferredQ, cat, status, sort, catMap]);

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
    <div className="app-page-viewport flex flex-col overflow-hidden">
      <Header
        title="Products"
        subtitle={
          cat !== 'all' || status !== 'all' || deferredQ.trim()
            ? `${list.length} of ${products.length} items`
            : `${products.length} item${products.length === 1 ? '' : 's'}`
        }
        right={
          <button
            onClick={onAdd}
            aria-label="Add product"
            className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]"
          >
            <Plus size={20} />
          </button>
        }
      />

      {/* Fixed controls */}
      <div className="products-controls mx-auto w-full max-w-md shrink-0 space-y-3 px-4 pt-3">
        <div className="desktop-products-heading hidden items-center justify-between">
          <p className="text-[13px] font-semibold text-(--ink-2)">{list.length} matching product{list.length === 1 ? '' : 's'}</p>
          <button type="button" onClick={onAdd} className="press flex min-h-11 items-center gap-2 rounded-xl bg-(--primary) px-4 text-[13px] font-bold text-(--primary-foreground)">
            <Plus size={16} /> Add product
          </button>
        </div>
        {/* Floating glass search (header above is already sticky) */}
        <SearchBar value={q} onChange={setQ} placeholder="Search name, SKU, category…" />

        {/* Category chips */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          <Chip active={cat === 'all'} onClick={() => setCat('all')} label="All" />
          {categories.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} label={c.name} />
          ))}
          <Chip active={cat === UNCAT} onClick={() => setCat(UNCAT)} label="Uncategorized" />
        </div>

        {/* Status filter + sort */}
        <div className="products-filter-row flex items-center gap-2">
          <div className="flex-1">
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
            className="glass press flex min-h-[44px] items-center gap-1.5 rounded-2xl px-3 py-2.5 text-[13px] font-bold text-(--ink)"
          >
            <ArrowDownUp size={16} />
            {sort === 'updated' ? 'Recent' : sort === 'name' ? 'Name' : sort === 'stock' ? 'Stock' : 'Price'}
          </button>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="press flex min-h-[44px] shrink-0 items-center gap-1 rounded-2xl bg-rose-500/10 px-3 py-2.5 text-[13px] font-bold text-rose-600 dark:text-rose-400"
            >
              <X size={16} /> Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* List card hugs its content when short; scrolls internally when long */}
      <div className="products-results mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden px-4 pt-3">
        {loading && products.length === 0 ? (
          <div className="sheet-scroll space-y-2.5 overflow-y-auto">
            <SkeletonRow h={84} />
            <SkeletonRow h={84} />
            <SkeletonRow h={84} />
          </div>
        ) : list.length === 0 ? (
          <div className="sheet-scroll overflow-y-auto">
            <EmptyState
              icon={<Search size={22} />}
              title={q || cat !== 'all' || status !== 'all' ? 'No products match' : 'No products yet'}
              hint="Tap + to add your first product."
            />
          </div>
        ) : (
          <div className="glass sheet-scroll min-h-0 flex-1 overflow-auto rounded-[26px] px-1.5 pt-1 pb-4">
            <div className="desktop-product-table">
              <div className="desktop-product-table-head" role="row">
                <span role="columnheader">Product</span><span role="columnheader">SKU</span><span role="columnheader">Category</span><span role="columnheader">Stock</span><span role="columnheader">Minimum</span><span role="columnheader">Price</span><span role="columnheader">Status</span><span role="columnheader" aria-label="Actions" />
              </div>
              <div className="divide-y divide-(--stroke-dim)" role="rowgroup">
              {list.slice(0, visible).map((p) => (
                <ProductRow
                  key={p.id}
                  p={p}
                  catLabel={(() => {
                    const raw = catMap.get(String(p.categoryId));
                    return raw && raw !== '—' ? raw.trim() : '';
                  })()}
                  pending={isPending(p.id)}
                  onView={handleView}
                  onMenu={handleMenu}
                />
              ))}
              </div>
            </div>
            {list.length > visible ? (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="press mt-1 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-(--accent-soft) text-[14px] font-bold text-(--accent)"
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
          categoryName={catMap.get(String(view.categoryId)) || '—'}
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

/* Memoized row: re-renders only when its own product, label, pending flag
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
      role="row"
      tabIndex={0}
      aria-label={`${p.name}, ${p.currentStock} in stock`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(p); } }}
      className="product-list-row press cv-row flex cursor-pointer items-center gap-3 rounded-[20px] px-2.5 py-2.5 hover:bg-(--accent-soft)/50"
    >
      <div className="product-identity" role="cell">
      {p.image ? (
        <img
          src={p.image}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-12 w-12 shrink-0 rounded-2xl border border-(--stroke-dim) object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-[17px] font-bold text-(--ink) dark:text-(--accent)">
          {p.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="product-mobile-details min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-semibold text-(--ink)">{p.name}</p>
        {sub ? <p className="tnum truncate text-xs text-(--ink-2)">{sub}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {pending ? (
            <span className="rounded-full bg-(--accent-soft) px-2 py-0.5 text-[11px] font-extrabold text-(--accent)">
              Saving…
            </span>
          ) : null}
          <span
            className={`tnum text-[12px] font-bold ${
              st === 'out'
                ? 'text-rose-600 dark:text-rose-300'
                : st === 'low'
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'text-emerald-600 dark:text-emerald-300'
            }`}
          >
            {st === 'out' ? 'Out of stock' : st === 'low' ? `${p.currentStock} · Low` : `${p.currentStock} in stock`}
          </span>
          {p.sellingPrice > 0 ? (
            <span className="tnum text-[12.5px] font-bold text-(--ink)">{formatMoney(p.sellingPrice)}</span>
          ) : null}
        </div>
      </div>
      <span className="product-desktop-name hidden">{p.name}</span>
      </div>
      <span className="product-desktop-cell" role="cell">{sku || '—'}</span>
      <span className="product-desktop-cell" role="cell">{catLabel || 'Uncategorized'}</span>
      <span className="product-desktop-cell tnum" role="cell">{p.currentStock}</span>
      <span className="product-desktop-cell tnum" role="cell">{p.minimumStock}</span>
      <span className="product-desktop-cell tnum" role="cell">{p.sellingPrice > 0 ? formatMoney(p.sellingPrice) : '—'}</span>
      <span className={`product-desktop-cell product-desktop-status ${st === 'low' ? 'is-low' : st === 'out' ? 'is-out' : ''}`} role="cell">{st === 'out' ? 'Out of stock' : st === 'low' ? 'Low stock' : 'In stock'}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMenu(p);
        }}
        aria-label={`Actions for ${p.name}`}
        className="product-desktop-actions press glass-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-(--ink-2)"
      >
        <MoreVertical size={16} />
      </button>
    </div>
  );
});

function DetailPage({
  p,
  categoryName,
  onClose,
  onEdit,
  onStockIn,
  onStockOut,
  onDelete,
}: {
  p: Product;
  categoryName: string;
  onClose: () => void;
  onEdit: () => void;
  onStockIn: () => void;
  onStockOut: () => void;
  onDelete: () => void;
}) {
  const st = stockStatus(p);
  const unitPrice = p.sellingPrice > 0 ? p.sellingPrice : p.costPrice;
  const dateFmt = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const { transactions, isPending } = useStore();
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
    <div className="animate-detail-in fixed inset-0 z-40 overflow-y-auto bg-(--bg)" role="dialog" aria-modal="true" aria-label={p.name}>
      <div className="ambient" aria-hidden="true" />
      <div className="relative z-[1] mx-auto min-h-dvh max-w-md pb-6">
        {/* Hero image */}
        <div className="relative">
          {p.image ? (
            <img
              src={p.image}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-72 w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center bg-(--accent-soft)">
              <span className="glass-strong flex h-24 w-24 items-center justify-center rounded-[28px] text-[44px] font-bold text-(--ink) dark:text-(--accent)">
                {p.name.slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-black/25" />
          {/* Floating top buttons */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
            <button
              onClick={onClose}
              aria-label="Back to products"
              className="glass-strong press flex h-11 w-11 items-center justify-center rounded-full text-(--ink)"
            >
              <ArrowLeft size={20} />
            </button>
            <button
              onClick={onEdit}
              aria-label={`Edit ${p.name}`}
              className="glass-strong press flex h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold text-(--ink)"
            >
              <Pencil size={16} /> Edit
            </button>
          </div>
          {/* Status + category over image */}
          <div className="absolute bottom-3 left-4 flex flex-wrap gap-1.5">
            <span
              className={`glass-strong tnum rounded-full px-3 py-1.5 text-[12px] font-bold ${
                st === 'out'
                  ? 'text-rose-600 dark:text-rose-300'
                  : st === 'low'
                    ? 'text-amber-600 dark:text-amber-300'
                    : 'text-emerald-600 dark:text-emerald-300'
              }`}
            >
              {st === 'out' ? 'Out of stock' : st === 'low' ? `Low stock · ${p.currentStock} left` : `${p.currentStock} in stock`}
            </span>
            {categoryName && categoryName !== '—' ? (
              <span className="glass-strong rounded-full px-3 py-1.5 text-[12px] font-bold text-(--ink)">
                {categoryName}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 px-4 pt-3">
          {/* Title + price */}
          <div>
            {(p.sku || '').trim() ? (
              <p className="tnum text-xs font-semibold uppercase tracking-wider text-(--ink-2)">{p.sku}</p>
            ) : null}
            <h2 className="mt-0.5 text-[24px] font-bold leading-tight tracking-tight text-(--ink)">{p.name}</h2>
            {unitPrice > 0 ? (
              <div className="tnum mt-1.5 flex items-baseline gap-2">
                <span className="text-[26px] font-bold text-(--ink)">{formatMoney(unitPrice)}</span>
              </div>
            ) : null}
            {dateFmt(p.createdAt) || dateFmt(p.updatedAt) ? (
              <p className="mt-1 text-[11.5px] font-medium text-(--ink-3)">
                {dateFmt(p.createdAt) ? `Added ${dateFmt(p.createdAt)}` : ''}
                {dateFmt(p.createdAt) && dateFmt(p.updatedAt) ? ' · ' : ''}
                {dateFmt(p.updatedAt) ? `Updated ${dateFmt(p.updatedAt)}` : ''}
              </p>
            ) : null}
          </div>

          {/* Stock stats */}
          <div className="glass grid grid-cols-3 divide-x divide-(--stroke-dim) rounded-[26px] py-3 text-center">
            <div>
              <p className="tnum text-[19px] font-bold text-(--ink)">{p.currentStock}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-(--ink-2)">In stock</p>
            </div>
            <div>
              <p className="tnum text-[19px] font-bold text-(--ink)">{p.minimumStock}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-(--ink-2)">Minimum</p>
            </div>
            <div>
              <p className="tnum text-[19px] font-bold text-(--accent)">
                {p.currentStock > 0 ? Math.floor((p.currentStock / Math.max(p.minimumStock, 1)) * 100) : 0}%
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-(--ink-2)">Of minimum</p>
            </div>
          </div>

          {(p.description || '').trim() ? (
            <div className="glass rounded-[26px] p-4">
              <p className="mb-1 text-[12px] font-bold uppercase tracking-wider text-(--ink-2)">Description</p>
              <p className="text-[14px] leading-relaxed text-(--ink)">{p.description}</p>
            </div>
          ) : null}

          {/* Stock In / Out history for this product */}
          <div className="glass rounded-[26px] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold uppercase tracking-wider text-(--ink-2)">
                Stock history{history.length > 0 ? ` · ${history.length}` : ''}
              </p>
              {history.length > 0 ? (
                <p className="tnum text-[11.5px] font-bold">
                  <span className="text-emerald-600 dark:text-emerald-300">+{totalIn} in</span>
                  <span className="text-(--ink-3)"> · </span>
                  <span className="text-rose-600 dark:text-rose-300">−{totalOut} out</span>
                </p>
              ) : null}
            </div>
            {history.length === 0 ? (
              <p className="py-2 text-center text-[13px] text-(--ink-2)">
                No stock movements yet — use Stock In / Out below.
              </p>
            ) : (
              <div className="divide-y divide-(--stroke-dim)">
                {history.slice(0, 20).map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 py-2.5">
                    <StockBadge kind={t.type} />
                    {isPending(t.id) ? (
                      <span className="rounded-full bg-(--accent-soft) px-2 py-0.5 text-[10.5px] font-extrabold text-(--accent)">
                        Saving…
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-(--ink-2)">
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                        {t.reason ? ` · ${t.reason}` : ''}
                        {t.note ? ` — ${t.note}` : ''}
                      </p>
                    </div>
                    <span
                      className={`tnum shrink-0 text-[15px] font-bold ${
                        t.type === 'IN' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
                      }`}
                    >
                      {t.type === 'IN' ? '+' : '−'}
                      {t.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {history.length > 20 ? (
              <p className="tnum pt-2 text-center text-xs font-medium text-(--ink-3)">
                Showing latest 20 of {history.length} — see History tab for all.
              </p>
            ) : null}
          </div>

          </div>

        {/* Sticky action bar */}
        <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] mx-4 mt-4">
          <div className="glass-strong grid grid-cols-2 gap-2 rounded-[26px] p-2">
            <button
              type="button"
              onClick={onStockIn}
              className="press flex min-h-[48px] items-center justify-center gap-1.5 rounded-[20px] bg-[#151515] py-3.5 text-[14.5px] font-bold text-white dark:bg-[#C7FF4D] dark:text-[#151515]"
            >
              <ArrowDownToLine size={16} /> Stock In
            </button>
            <button
              type="button"
              onClick={onStockOut}
              className="press flex min-h-[48px] items-center justify-center gap-1.5 rounded-[20px] bg-[#151515] py-3.5 text-[14.5px] font-bold text-white dark:bg-[#C7FF4D] dark:text-[#151515]"
            >
              <ArrowUpFromLine size={16} /> Stock Out
            </button>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="press mx-auto mt-1 flex min-h-[44px] items-center gap-1.5 rounded-2xl px-4 py-2.5 text-[13px] font-bold text-rose-600 dark:text-rose-400"
          >
            <Trash2 size={14} /> Delete product
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const Chip = memo(function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`chip-glass min-h-[40px] shrink-0 rounded-full px-4 py-2 text-[13px] font-bold ${
        active ? 'bg-(--primary) text-(--primary-foreground)' : 'glass text-(--ink-2)'
      }`}
    >
      {label}
    </button>
  );
});

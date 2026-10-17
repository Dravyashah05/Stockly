import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  Ellipsis,
  Minus,
  PackageX,
  Plus,
  Search,
  SearchX,
  ShoppingCart,
  Undo2,
} from 'lucide-react';
import { STOCK_OUT_REASONS, formatMoney } from '../../shared/config';
import { useStore } from '../../shared/store';
import { EmptyState, Field, PrimaryBtn, SearchBar, Sheet, inputCls } from '../components/ui';

const QUICK_QTY = [1, 5, 10];

const REASON_ICONS: Record<string, React.ReactNode> = {
  Sale: <ShoppingCart size={15} />,
  Damaged: <PackageX size={15} />,
  Lost: <SearchX size={15} />,
  Return: <Undo2 size={15} />,
  Other: <Ellipsis size={15} />,
};

/* Stock In / Out as a popup (no dedicated page). Opened from Home quick
 * actions and product details; stays open after saving for repeat entries.
 * Flat single-column layout: header → segmented mode → product → quantity
 * → context → sticky footer. Validation, submission, and idempotency are
 * unchanged from the previous card-based layout. */
export default function StockSheet({
  open,
  initialMode,
  productId: presetProductId,
  openKey,
  onClose,
}: {
  open: boolean;
  initialMode: 'IN' | 'OUT';
  productId: string;
  /** Changes every open so the form resets fresh. */
  openKey: number;
  onClose: () => void;
}) {
  const { products, doStockIn, doStockOut } = useStore();
  const [mode, setMode] = useState<'IN' | 'OUT'>(initialMode);
  const [productId, setProductId] = useState(presetProductId);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState<string>('Sale');
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const flashTimer = useRef(0);
  const deferredQ = useDeferredValue(q);

  // Fresh form on every open (mode + preselected product from the caller).
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setProductId(presetProductId);
      setQty('');
      setPrice('');
      setReason('Sale');
      setNote('');
      setQ('');
      setErr(null);
      setSavedMsg(null);
      setBusy(false);
    }
  }, [open, openKey, initialMode, presetProductId]);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) =>
      `${p.name} ${p.sku}`.toLowerCase().includes(needle),
    );
  }, [products, deferredQ]);

  const selected = products.find((p) => p.id === productId);
  const qtyNum = Math.floor(Number(qty) || 0);
  const resulting = selected
    ? mode === 'IN'
      ? selected.currentStock + qtyNum
      : selected.currentStock - qtyNum
    : null;
  const overdraw = mode === 'OUT' && selected != null && qtyNum > selected.currentStock;
  const hitsLow =
    mode === 'OUT' &&
    selected != null &&
    !overdraw &&
    qtyNum > 0 &&
    resulting != null &&
    resulting <= selected.minimumStock;

  const switchMode = (m: 'IN' | 'OUT') => {
    setMode(m);
    setErr(null);
  };

  const bump = (d: number) => {
    const next = Math.max(0, qtyNum + d);
    setQty(next === 0 ? '' : String(next));
  };

  const flashNotice = (msg: string) => {
    window.clearTimeout(flashTimer.current);
    setSavedMsg(msg);
    flashTimer.current = window.setTimeout(() => setSavedMsg(null), 2600);
  };

  const submit = async () => {
    setErr(null);
    const quantity = Math.floor(Number(qty));
    if (!productId) return setErr('Select a product first.');
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(Number(qty)))
      return setErr('Quantity must be a whole number greater than 0.');
    if (mode === 'OUT' && selected && quantity > selected.currentStock)
      return setErr(`Only ${selected.currentStock} in stock — Stock Out cannot exceed available stock.`);
    if (mode === 'IN' && price.trim() !== '' && !(Number(price) >= 0))
      return setErr('Price must be 0 or more, or left blank.');

    setBusy(true);
    let ok = false;
    if (mode === 'IN') {
      ok = await doStockIn({
        productId,
        quantity,
        price: price.trim() === '' ? undefined : Number(price),
        note: note.trim() || undefined,
      });
    } else {
      ok = await doStockOut({ productId, quantity, reason, note: note.trim() || undefined });
    }
    setBusy(false);
    if (ok && selected) {
      // doStockIn/Out acknowledges a durable queued write; the server
      // confirms asynchronously and emits its own success/error toast.
      // Keep this local message explicit that the operation is still syncing.
      flashNotice(`${mode === 'IN' ? 'Stock In' : 'Stock Out'} queued · ${quantity} × ${selected.name} · syncing`);
      setQty('');
      setPrice('');
      setNote('');
      setQ('');
    }
  };

  const isIn = mode === 'IN';
  const confirmLabel = busy ? 'Saving…' : isIn ? 'Add to stock' : 'Remove from stock';

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={isIn ? 'Stock In' : 'Stock Out'}
        subtitle={isIn ? 'Add inventory' : 'Record inventory removal'}
        backdropCls="bg-black/30"
        footer={
          <PrimaryBtn onClick={submit} disabled={busy || overdraw} dense>
            {busy ? 'Saving…' : confirmLabel}
          </PrimaryBtn>
        }
      >
        {/* Mode segmented control */}
        <div
          role="group"
          aria-label="Movement type"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              switchMode(isIn ? 'OUT' : 'IN');
            }
          }}
          className="relative grid grid-cols-2 gap-1 rounded-full bg-(--glass-soft) p-1.5"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] rounded-full transition-transform duration-300 ${
 isIn ? 'translate-x-0' : 'translate-x-full'
 } bg-(--primary) `}
          />
          {(
            [
              { m: 'IN' as const, label: 'Stock In', icon: <ArrowDownToLine size={16} /> },
              { m: 'OUT' as const, label: 'Stock Out', icon: <ArrowUpFromLine size={16} /> },
            ]
          ).map((o) => {
            const active = mode === o.m;
            return (
              <button
                key={o.m}
                type="button"
                aria-pressed={active}
                onClick={() => switchMode(o.m)}
                className={`relative z-[1] flex items-center justify-center gap-2 rounded-full py-2.5 text-[length:var(--fs-footnote)] font-semibold transition-colors ${
 active
 ? 'text-(--primary-foreground)'
 : 'text-(--ink-2) hover:text-(--ink)'
 }`}
              >
                {o.icon}
                {o.label}
              </button>
            );
          })}
        </div>

        {products.length === 0 ? (
          <div className="pt-4">
            <EmptyState
              icon={isIn ? <ArrowDownToLine size={22} /> : <ArrowUpFromLine size={22} />}
              title="No products yet"
              hint="Add a product first, then record stock movements."
            />
          </div>
        ) : (
          <div className="stock-sheet-form mt-4">
            {/* Product selector */}
            <button
              type="button"
              onClick={() => {
                setQ('');
                setPickerOpen(true);
              }}
              aria-haspopup="dialog"
              className="stock-field press flex w-full items-center gap-3 text-left transition-colors hover:bg-(--glass-soft)"
            >
              {selected?.image ? (
                <img src={selected.image} alt="" className="h-11 w-11 shrink-0 rounded-[var(--radius-icon)] object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-icon)] bg-(--accent-soft) text-[length:var(--fs-subhead)] font-semibold text-(--ink) dark:text-(--accent)">
                  {selected ? selected.name.slice(0, 1).toUpperCase() : <Search size={18} aria-hidden="true" />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                {selected ? (
                  <>
                    <span className="block truncate text-[length:var(--fs-headline)] font-semibold text-(--ink)">{selected.name}</span>
                    <span className="tnum mt-0.5 block text-[length:var(--fs-footnote)] text-(--ink-2)">
                      {selected.currentStock} in stock
                      {selected.costPrice > 0 ? ` · ${formatMoney(selected.costPrice)}` : ''}
                    </span>
                  </>
                ) : (
                  <span className="block text-[length:var(--fs-headline)] font-normal text-(--ink-3)">Search products…</span>
                )}
              </span>
              <ChevronRight size={18} className="shrink-0 text-(--ink-3)" aria-hidden="true" />
            </button>

            {/* Quantity */}
            <div className="stock-field stock-field-quantity">
              <div className="flex items-center justify-between gap-3">
                <p id="stock-qty-label" className="text-[length:var(--fs-caption)] font-semibold uppercase tracking-[0.08em] text-(--ink-3)">
                  Quantity
                </p>
                <div className="flex gap-1.5" aria-label="Quick add">
                  {QUICK_QTY.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => bump(n)}
                      aria-label={`Add ${n} to quantity`}
                      className="tnum press rounded-full bg-(--bg) px-2.5 py-1 text-[length:var(--fs-caption)] font-semibold text-(--ink) transition-colors hover:bg-(--accent-soft)"
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => bump(-1)}
                  aria-label="Decrease quantity"
                  disabled={qtyNum <= 0}
                  className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-(--stroke-dim) text-(--ink) transition-colors hover:bg-(--bg) disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Minus size={18} />
                </button>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="0"
                  aria-labelledby="stock-qty-label"
                  className="tnum min-w-0 flex-1 bg-transparent text-center text-[length:var(--fs-headline)] font-black leading-none tracking-tight text-(--ink) outline-none placeholder:text-(--ink-3)"
                />
                <button
                  type="button"
                  onClick={() => bump(1)}
                  aria-label="Increase quantity"
                  className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--primary) transition-transform hover:scale-105 active:scale-95 text-(--primary-foreground)"
                >
                  <Plus size={18} />
                </button>
              </div>
              {/* Reserved space keeps the form stable when hints appear. */}
              <div className="flex min-h-[22px] items-center justify-center pt-1" aria-live="polite">
                {overdraw ? (
                  <p className="text-[length:var(--fs-footnote)] font-medium text-(--destructive-ink)">
                    Only {selected?.currentStock} available.
                  </p>
                ) : hitsLow ? (
                  <p className="text-[length:var(--fs-footnote)] font-medium text-(--warning-ink)">
                    Hits the low-stock level ({selected?.minimumStock}).
                  </p>
                ) : selected && qtyNum > 0 ? (
                  <p className="tnum text-[length:var(--fs-footnote)] font-medium text-(--ink-2)">
                    {selected.currentStock} → {resulting}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Cost (In) / Reason (Out) */}
            {isIn ? (
              <Field label="Cost price" className="stock-field">
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[length:var(--fs-subhead)] font-medium text-(--ink-3)">₹</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    placeholder="120"
                    aria-label="Cost price, optional"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </Field>
            ) : (
              <fieldset className="stock-field">
                <legend className="mb-2 block text-[length:var(--fs-footnote)] font-semibold text-(--ink-2)">Reason</legend>
                <div className="flex flex-wrap gap-2">
                  {STOCK_OUT_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      aria-pressed={reason === r}
                      className={`press flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[length:var(--fs-footnote)] font-medium transition-colors ${
 reason === r
 ? 'bg-(--primary) text-(--primary-foreground)'
 : 'bg-(--glass-soft) text-(--ink-2) hover:text-(--ink)'
 }`}
                    >
                      {REASON_ICONS[r] ?? null}
                      {r}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Note */}
            <Field label="Note" className="stock-field">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Invoice number or reason (optional)"
                className={`${inputCls} resize-none`}
              />
            </Field>

            {/* Reserved space prevents layout shift on error/success. */}
            <div className="flex min-h-[22px] items-center justify-center" aria-live="polite">
              {err ? (
                <p className="text-[length:var(--fs-footnote)] font-medium text-(--destructive-ink)">{err}</p>
              ) : savedMsg ? (
                <p className="text-[length:var(--fs-footnote)] font-medium text-(--ink-2)">{savedMsg}</p>
              ) : null}
            </div>
          </div>
        )}
      </Sheet>

      {/* Product picker sheet (opens on top) */}
      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose product" backdropCls="bg-black/30">
        <div className="mb-3">
          <SearchBar value={q} onChange={setQ} placeholder="Search name, SKU…" />
        </div>
        {filtered.length > 100 ? (
          <p className="tnum px-1 pb-2 text-xs font-medium text-(--ink-2)">
            Showing first 100 of {filtered.length} — refine your search.
          </p>
        ) : null}
        <div className="sheet-scroll max-h-[50dvh] space-y-1 overflow-y-auto pb-2">
          {filtered.slice(0, 100).map((p) => {
            const activeRow = p.id === productId;
            const low = p.currentStock <= p.minimumStock;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProductId(p.id);
                  setErr(null);
                  setPickerOpen(false);
                }}
                className={`press flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left transition-colors ${
 activeRow ? 'bg-(--accent-soft)' : 'hover:bg-(--accent-soft)/50'
 }`}
              >
                {p.image ? (
                  <img src={p.image} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-[var(--radius-icon)] object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-icon)] bg-(--accent-soft) text-[length:var(--fs-footnote)] font-semibold text-(--ink) dark:text-(--accent)">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[length:var(--fs-subhead)] font-medium text-(--ink)">{p.name}</span>
                  <span className={`tnum block text-xs ${low ? 'font-bold text-(--warning-ink)' : 'text-(--ink-2)'}`}>
                    {(p.sku || '').trim()
                      ? `${p.sku} · ${p.currentStock} in stock${low ? ' · low' : ''}`
                      : `${p.currentStock} in stock${low ? ' · low' : ''}`}
                  </span>
                </span>
                {activeRow ? <Check size={18} className="shrink-0 text-(--accent)" /> : null}
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-[length:var(--fs-footnote)] text-(--ink-2)">No products match “{q}”.</p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

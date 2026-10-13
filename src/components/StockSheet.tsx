import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  Minus,
  Plus,
  Search,
} from 'lucide-react';
import { STOCK_OUT_REASONS, formatMoney } from '../lib/config';
import { useStore } from '../lib/store';
import { EmptyState, Field, PrimaryBtn, SearchBar, Sheet, inputCls } from '../components/ui';

const QUICK_QTY = [1, 5, 10, 50];

/* Stock In / Out as a popup (no dedicated page). Opened from Home quick
 * actions and product details; stays open after saving for repeat entries. */
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
  const { products, doStockIn, doStockOut, categoryName } = useStore();
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
      setBusy(false);
    }
  }, [open, openKey, initialMode, presetProductId]);

  const filtered = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) =>
      `${p.name} ${p.sku} ${categoryName(p.categoryId)}`.toLowerCase().includes(needle),
    );
  }, [products, deferredQ, categoryName]);

  const selected = products.find((p) => p.id === productId);
  const qtyNum = Math.floor(Number(qty) || 0);
  const resulting = selected
    ? mode === 'IN'
      ? selected.currentStock + qtyNum
      : selected.currentStock - qtyNum
    : null;
  const overdraw = mode === 'OUT' && selected != null && qtyNum > selected.currentStock;

  const bump = (d: number) => {
    const next = Math.max(0, qtyNum + d);
    setQty(next === 0 ? '' : String(next));
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
    if (ok) {
      setQty('');
      setPrice('');
      setNote('');
      setQ('');
    }
  };

  const isIn = mode === 'IN';

  return (
    <>
      <Sheet open={open} onClose={onClose} title={isIn ? 'Stock In' : 'Stock Out'}>
        {/* Mode toggle */}
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <ModeCard
            active={isIn}
            onClick={() => {
              setMode('IN');
              setErr(null);
            }}
            icon={<ArrowDownToLine size={20} />}
            title="Stock In"
            hint="Receive goods"
            activeCls="bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]"
          />
          <ModeCard
            active={!isIn}
            onClick={() => {
              setMode('OUT');
              setErr(null);
            }}
            icon={<ArrowUpFromLine size={20} />}
            title="Stock Out"
            hint="Issue goods"
            activeCls="bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]"
          />
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon={isIn ? <ArrowDownToLine size={22} /> : <ArrowUpFromLine size={22} />}
            title="No products yet"
            hint="Add a product first, then record stock movements."
          />
        ) : (
          <div className="space-y-3 pb-2">
            {/* Product picker */}
            <button
              onClick={() => {
                setQ('');
                setPickerOpen(true);
              }}
              className="glass press flex w-full items-center gap-3 rounded-[26px] p-3.5 text-left"
            >
              {selected ? (
                <>
                  {selected.image ? (
                    <img
                      src={selected.image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-12 w-12 shrink-0 rounded-2xl border border-(--stroke-dim) object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-[17px] font-bold text-(--ink) dark:text-(--accent)">
                      {selected.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-(--ink)">{selected.name}</span>
                    <span className="tnum block text-xs text-(--ink-2)">
                      {selected.costPrice > 0
                        ? `${selected.currentStock} in stock · ${formatMoney(selected.costPrice)}`
                        : `${selected.currentStock} in stock`}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className="glass-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-(--ink-3)">
                    <Search size={20} />
                  </span>
                  <span className="flex-1 text-[15px] font-semibold text-(--ink-3)">Tap to choose a product…</span>
                </>
              )}
              <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
            </button>

            {/* Quantity */}
            <div className={`glass rounded-[26px] p-5 ${overdraw ? 'border-rose-500/30' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <p className="text-[12px] font-bold uppercase tracking-wider text-(--ink-2)">Quantity</p>
                <div className="flex gap-1.5">
                  {QUICK_QTY.map((n) => (
                    <button
                      key={n}
                      onClick={() => bump(n)}
                      className="chip-glass glass-soft tnum rounded-full px-2.5 py-1 text-[12px] font-bold text-(--ink)"
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-6">
                <button
                  onClick={() => bump(-1)}
                  aria-label="Decrease quantity"
                  className="press glass-soft flex h-13 w-13 items-center justify-center rounded-full p-3.5 text-(--ink)"
                >
                  <Minus size={20} />
                </button>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  inputMode="numeric"
                  placeholder="0"
                  aria-label="Quantity"
                  className="tnum w-28 bg-transparent text-center text-[56px] font-bold leading-none tracking-tight text-(--ink) outline-none placeholder:text-(--ink-3)"
                />
                <button
                  onClick={() => bump(1)}
                  aria-label="Increase quantity"
                  className="press glass-soft flex h-13 w-13 items-center justify-center rounded-full p-3.5 text-(--ink)"
                >
                  <Plus size={20} />
                </button>
              </div>

              {/* Live movement preview */}
              <div
                className={`mt-4 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 ${
                  !selected || qtyNum <= 0
                    ? 'glass-soft text-(--ink-2)'
                    : overdraw
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
                      : isIn
                        ? 'bg-(--accent-soft) text-(--ink)'
                        : 'glass-soft text-(--ink)'
                }`}
              >
                {!selected || qtyNum <= 0 ? (
                  <span className="text-[12.5px] font-medium">
                    {selected
                      ? `${selected.currentStock} currently in stock`
                      : 'Choose a product and quantity'}
                  </span>
                ) : (
                  <span className="tnum flex items-center gap-2 text-[14px] font-bold">
                    {selected.currentStock}
                    <ArrowRight size={16} />
                    {resulting}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                        overdraw ? 'bg-rose-500/15' : 'bg-[#151515] text-[#C7FF4D]'
                      }`}
                    >
                      {isIn ? `+${qtyNum}` : `−${qtyNum}`}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Price / Reason + Note */}
            <div className="glass space-y-3.5 rounded-[26px] p-4">
              {isIn ? (
                <Field label="Price (optional)" hint="Updates the product cost price.">
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    placeholder="e.g. 120"
                    className={inputCls}
                  />
                </Field>
              ) : (
                <Field label="Reason">
                  <div className="flex flex-wrap gap-2">
                    {STOCK_OUT_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReason(r)}
                        className={`chip-glass rounded-full px-3.5 py-2 text-[13px] font-bold ${
                          reason === r ? 'bg-rose-600 text-white' : 'glass-soft text-(--ink-2)'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              <Field label="Note (optional)">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={isIn ? 'Invoice no., batch…' : 'Customer, damage details…'}
                  className={`${inputCls} resize-none`}
                />
              </Field>
            </div>

            {err ? (
              <div className="animate-pop-in rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-[13.5px] font-medium text-rose-600 dark:text-rose-300">
                {err}
              </div>
            ) : null}

            {/* Confirm */}
            <div className="glass-strong rounded-3xl p-2">
              <PrimaryBtn onClick={submit} disabled={busy || overdraw}>
                {busy
                  ? 'Saving…'
                  : selected && qtyNum > 0
                    ? isIn
                      ? `Add ${qtyNum} · stock → ${resulting}`
                      : `Remove ${qtyNum} · stock → ${resulting}`
                    : isIn
                      ? 'Add to stock'
                      : 'Remove from stock'}
              </PrimaryBtn>
            </div>
            <p className="px-2 text-center text-xs leading-relaxed text-(--ink-2)">
              {isIn ? 'Stock In increases inventory.' : 'Stock Out never goes below zero.'} Duplicate taps are
              safely ignored.
            </p>
          </div>
        )}
      </Sheet>

      {/* Product picker sheet (opens on top) */}
      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose product">
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
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProductId(p.id);
                  setErr(null);
                  setPickerOpen(false);
                }}
                className={`press flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                  activeRow ? 'bg-(--accent-soft)' : 'hover:bg-(--accent-soft)/50'
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-[14px] font-bold text-(--ink) dark:text-(--accent)">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-(--ink)">{p.name}</span>
                  <span className="tnum block text-xs text-(--ink-2)">
                    {(p.sku || '').trim()
                      ? `${p.sku} · ${p.currentStock} in stock`
                      : `${p.currentStock} in stock`}
                  </span>
                </span>
                {activeRow ? <Check size={18} className="shrink-0 text-(--accent)" /> : null}
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-[13.5px] text-(--ink-2)">No products match “{q}”.</p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  hint,
  activeCls,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
  activeCls: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`press flex items-center gap-3 rounded-[24px] p-3.5 text-left ${
        active ? activeCls : 'glass text-(--ink)'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          active ? 'bg-white/15 text-inherit' : 'glass-soft text-(--ink-2)'
        }`}
      >
        {icon}
      </span>
      <span>
        <span className="block text-[15px] font-bold leading-tight">{title}</span>
        <span className={`block text-xs ${active ? 'opacity-70' : 'text-(--ink-2)'}`}>{hint}</span>
      </span>
    </button>
  );
}

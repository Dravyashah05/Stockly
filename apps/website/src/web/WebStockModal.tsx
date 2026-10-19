import { useState, useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, AlertCircle } from 'lucide-react';
import type { Product } from '@stockly/shared-types';
import { validateStockQuantity, validateStockAvailability } from '@stockly/shared-validation';
import { CURRENCY_SYMBOL } from '@stockly/shared-client/config';
import { GlassDialog, GlassButton } from '@stockly/ui';

interface WebStockModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  initialProductId?: string;
  initialMode?: 'IN' | 'OUT';
  onStockIn: (args: { productId: string; quantity: number; price?: number; note?: string }) => Promise<boolean>;
  onStockOut: (args: { productId: string; quantity: number; reason: string; note?: string }) => Promise<boolean>;
}

const STOCK_OUT_REASONS = [
  'Customer Sale',
  'Damaged / Expired',
  'Internal Transfer',
  'Inventory Recount / Adjustment',
  'Sample / Promotion',
  'Other',
];

export default function WebStockModal({
  open,
  onClose,
  products,
  initialProductId,
  initialMode = 'IN',
  onStockIn,
  onStockOut,
}: WebStockModalProps) {
  const [mode, setMode] = useState<'IN' | 'OUT'>(initialMode);
  const [selectedId, setSelectedId] = useState(initialProductId ?? products[0]?.id ?? '');
  const [quantity, setQuantity] = useState<string>('1');
  const [price, setPrice] = useState<string>('');
  const [reason, setReason] = useState<string>(STOCK_OUT_REASONS[0]);
  const [note, setNote] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialMode) setMode(initialMode);
    if (initialProductId) setSelectedId(initialProductId);
    else if (products.length > 0 && !selectedId) setSelectedId(products[0].id);
    setQuantity('1');
    setError('');
  }, [open, initialMode, initialProductId, products]);

  const selectedProduct = products.find((p) => p.id === selectedId);
  const currentStock = selectedProduct?.currentStock ?? 0;
  const numQty = parseInt(quantity, 10) || 0;

  const resultingStock = mode === 'IN' ? currentStock + numQty : currentStock - numQty;

  const addPreset = (amount: number) => {
    const cur = parseInt(quantity, 10) || 0;
    const next = Math.max(1, cur + amount);
    if (mode === 'OUT' && next > currentStock) {
      setQuantity(String(Math.max(1, currentStock)));
    } else {
      setQuantity(String(next));
    }
  };

  const setPresetExact = (val: number) => {
    if (mode === 'OUT' && val > currentStock) {
      setQuantity(String(Math.max(1, currentStock)));
    } else {
      setQuantity(String(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setError('Please select a product.');
      return;
    }

    const qErr = validateStockQuantity(numQty);
    if (qErr) {
      setError(qErr);
      return;
    }

    if (mode === 'OUT') {
      const availErr = validateStockAvailability(numQty, currentStock);
      if (availErr) {
        setError(availErr);
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      let success = false;
      if (mode === 'IN') {
        const numPrice = price ? parseFloat(price) : undefined;
        success = await onStockIn({
          productId: selectedProduct.id,
          quantity: numQty,
          price: numPrice && numPrice > 0 ? numPrice : undefined,
          note: note.trim() || undefined,
        });
      } else {
        success = await onStockOut({
          productId: selectedProduct.id,
          quantity: numQty,
          reason,
          note: note.trim() || undefined,
        });
      }
      if (success) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Movement operation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title={mode === 'IN' ? 'Record Stock In' : 'Record Stock Out'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300/40 dark:border-neutral-700/50">
          <button
            type="button"
            onClick={() => { setMode('IN'); setError(''); }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-bold transition-all ${
              mode === 'IN'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownToLine size={15} /> Stock In (Add)
          </button>
          <button
            type="button"
            onClick={() => { setMode('OUT'); setError(''); }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-bold transition-all ${
              mode === 'OUT'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpFromLine size={15} /> Stock Out (Deduct)
          </button>
        </div>

        {/* Product Picker */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
            Target Product
          </label>
          <select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setError(''); }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — {p.currentStock || 0} in stock
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Balance Preview Card */}
        {selectedProduct && (
          <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold block">
                Stock Reconciliation
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-sm text-neutral-500">
                  Current: <b className="text-neutral-900 dark:text-white">{currentStock}</b>
                </span>
                <span className="text-neutral-400 font-bold">→</span>
                <span className={`font-mono text-base font-extrabold ${resultingStock < 0 ? 'text-rose-600' : 'text-neutral-900 dark:text-white'}`}>
                  New: {resultingStock}
                </span>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold ${
                mode === 'IN'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              {mode === 'IN' ? `+${numQty}` : `-${numQty}`} units
            </span>
          </div>
        )}

        {/* Quantity Field & Quick Stepper Presets */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
              Quantity to {mode === 'IN' ? 'Add' : 'Deduct'}
            </label>
            {/* Quick Presets */}
            <div className="flex items-center gap-1">
              {[1, 5, 10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPresetExact(amt)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors"
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => addPreset(-1)}
              className="h-10 w-10 shrink-0 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 font-bold text-base text-neutral-700 dark:text-neutral-300 flex items-center justify-center transition-colors"
            >
              -
            </button>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[15px] font-mono font-bold text-center text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
              required
            />
            <button
              type="button"
              onClick={() => addPreset(1)}
              className="h-10 w-10 shrink-0 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 font-bold text-base text-neutral-700 dark:text-neutral-300 flex items-center justify-center transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Mode-Specific Fields */}
        {mode === 'IN' ? (
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
              Unit Purchase / Inflow Price ({CURRENCY_SYMBOL}) <span className="text-neutral-400 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              placeholder={String(selectedProduct?.costPrice || '0.00')}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
              Disbursement Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            >
              {STOCK_OUT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {/* Note / Audit Remark */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
            Movement Note / Reference <span className="text-neutral-400 font-normal lowercase">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. PO#8492 or Counter sale"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
          />
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-[12px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <GlassButton variant="secondary" size="md" onClick={onClose} disabled={busy}>
            Cancel
          </GlassButton>
          <GlassButton
            variant="primary"
            size="md"
            loading={busy}
            type="submit"
            iconStart={mode === 'IN' ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}
          >
            {mode === 'IN' ? 'Confirm Stock In' : 'Confirm Stock Out'}
          </GlassButton>
        </div>
      </form>
    </GlassDialog>
  );
}

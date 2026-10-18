import { useState, useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, AlertCircle } from 'lucide-react';
import type { Product } from '@stockly/shared-types';
import { validateStockQuantity, validateStockAvailability } from '@stockly/shared-validation';
import { GlassDialog, GlassButton, GlassTextField, Segmented } from '@stockly/ui';

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
  'Sample / Gift',
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

  const handleIncrement = (inc: number) => {
    const cur = parseInt(quantity, 10) || 0;
    const next = Math.max(1, cur + inc);
    if (mode === 'OUT' && next > currentStock) {
      setQuantity(String(Math.max(1, currentStock)));
    } else {
      setQuantity(String(next));
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
      setError(err instanceof Error ? err.message : 'Operation failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {mode === 'IN' ? (
            <ArrowDownToLine className="text-emerald-500" size={22} />
          ) : (
            <ArrowUpFromLine className="text-amber-500" size={22} />
          )}
          <span>{mode === 'IN' ? 'Record Stock In' : 'Record Stock Out'}</span>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* IN / OUT Mode Toggle */}
        <Segmented<'IN' | 'OUT'>
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError('');
          }}
          options={[
            { key: 'IN', label: 'Stock In (Incoming)' },
            { key: 'OUT', label: 'Stock Out (Outgoing)' },
          ]}
        />

        {/* Product Selector */}
        <div>
          <label className="block text-[13px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
            Select Product
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/80 px-3.5 py-2.5 text-[14px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            required
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — {p.currentStock} units on hand
              </option>
            ))}
          </select>
        </div>

        {/* Current & Resulting Stock Banner */}
        {selectedProduct && (
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 p-3.5 flex items-center justify-between text-[13px]">
            <div>
              <span className="text-neutral-500 block text-[11px] font-medium uppercase tracking-wider">Current Stock</span>
              <span className="font-bold text-lg">{currentStock} units</span>
            </div>
            <div className="text-center font-bold text-lg text-neutral-400">→</div>
            <div className="text-right">
              <span className="text-neutral-500 block text-[11px] font-medium uppercase tracking-wider">Resulting Stock</span>
              <span className={`font-bold text-lg ${resultingStock < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                {resultingStock} units
              </span>
            </div>
          </div>
        )}

        {/* Quantity Field & Quick Steppers */}
        <div>
          <GlassTextField
            label="Quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <div className="flex gap-1.5 mt-2">
            {[1, 5, 10, 25, 50, 100].map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => handleIncrement(inc)}
                className="flex-1 py-1 rounded-lg text-[12px] font-bold border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-700/80 transition-colors"
              >
                +{inc}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Specific Inputs */}
        {mode === 'IN' ? (
          <GlassTextField
            label="Unit Cost Price (Optional)"
            type="number"
            min="0"
            step="0.01"
            placeholder={selectedProduct?.costPrice ? String(selectedProduct.costPrice) : '0.00'}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            hint="Leave blank to use default cost price"
          />
        ) : (
          <div>
            <label className="block text-[13px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Reason for Removal
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/80 px-3.5 py-2.5 text-[14px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            >
              {STOCK_OUT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reference / Notes */}
        <GlassTextField
          label="Reference / Notes (Optional)"
          placeholder="PO #10482, Order reference, or shelf notes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {error && (
          <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-[13px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3">
          <GlassButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </GlassButton>
          <GlassButton
            type="submit"
            variant={mode === 'IN' ? 'primary' : 'destructive'}
            loading={busy}
            disabled={busy || numQty <= 0 || (mode === 'OUT' && numQty > currentStock)}
          >
            {mode === 'IN' ? `Confirm Stock In (+${numQty})` : `Confirm Stock Out (-${numQty})`}
          </GlassButton>
        </div>
      </form>
    </GlassDialog>
  );
}

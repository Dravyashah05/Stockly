import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
import type { Category, Product } from '@stockly/shared-types';
import type { ProductFormInput } from '@stockly/shared-client/store';
import { validateProductInput } from '@stockly/shared-validation';
import { CURRENCY_SYMBOL, formatMoney } from '@stockly/shared-client/config';
import { GlassDialog, GlassButton } from '@stockly/ui';

interface WebProductModalProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  editingProduct?: Product | null;
  onSave: (product: ProductFormInput, editingId?: string) => Promise<boolean>;
}

export default function WebProductModal({
  open,
  onClose,
  categories,
  editingProduct,
  onSave,
}: WebProductModalProps) {
  const isNew = !editingProduct;

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [currentStock, setCurrentStock] = useState('0');
  const [minimumStock, setMinimumStock] = useState('5');
  const [costPrice, setCostPrice] = useState('0.00');
  const [sellingPrice, setSellingPrice] = useState('0.00');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name ?? '');
      setSku(editingProduct.sku ?? '');
      setCategoryId(editingProduct.categoryId ?? '');
      setCurrentStock(String(editingProduct.currentStock ?? 0));
      setMinimumStock(String(editingProduct.minimumStock ?? 5));
      setCostPrice(String(editingProduct.costPrice ?? 0));
      setSellingPrice(String(editingProduct.sellingPrice ?? 0));
      setDescription(editingProduct.description ?? '');
    } else {
      setName('');
      setSku('');
      setCategoryId(categories[0]?.id ?? '');
      setCurrentStock('0');
      setMinimumStock('5');
      setCostPrice('0.00');
      setSellingPrice('0.00');
      setDescription('');
    }
    setError('');
  }, [open, editingProduct, categories]);

  const generateAutoSku = () => {
    const prefix = name ? name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() : 'STK';
    const random = Math.floor(1000 + Math.random() * 9000);
    setSku(`${prefix || 'STK'}-${random}`);
  };

  const marginCalculation = useMemo(() => {
    const cost = parseFloat(costPrice) || 0;
    const sell = parseFloat(sellingPrice) || 0;
    if (sell <= 0) return null;
    const profit = sell - cost;
    const margin = Math.round((profit / sell) * 100);
    return { profit, margin };
  }, [costPrice, sellingPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cStock = parseInt(currentStock, 10);
    const mStock = parseInt(minimumStock, 10);
    const cPrice = parseFloat(costPrice);
    const sPrice = parseFloat(sellingPrice);

    const validationErr = validateProductInput(
      {
        name,
        sku,
        costPrice: Number.isFinite(cPrice) ? cPrice : 0,
        sellingPrice: Number.isFinite(sPrice) ? sPrice : 0,
        currentStock: Number.isInteger(cStock) ? cStock : 0,
        minimumStock: Number.isInteger(mStock) ? mStock : 0,
      },
      { isNew },
    );

    if (validationErr) {
      setError(validationErr);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const ok = await onSave(
        {
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          categoryId: categoryId || (categories[0]?.id ?? ''),
          currentStock: cStock,
          minimumStock: mStock,
          costPrice: cPrice || 0,
          sellingPrice: sPrice || 0,
          description: description.trim(),
          image: editingProduct?.image ?? '',
        },
        editingProduct?.id,
      );
      if (ok) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      title={isNew ? 'Create New Product' : 'Edit Product'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Name & SKU row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
              Product Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Wireless Mouse"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
                SKU / Barcode *
              </label>
              {isNew && (
                <button
                  type="button"
                  onClick={generateAutoSku}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles size={11} /> Auto-generate
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g. WM-1001"
              value={sku}
              onChange={(e) => { setSku(e.target.value); setError(''); }}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-mono font-bold text-neutral-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
              required
            />
          </div>
        </div>

        {/* Category Picker */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Cost & Selling Price with Live Margin Badge */}
        <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Cost Price ({CURRENCY_SYMBOL})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Selling Price ({CURRENCY_SYMBOL})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
              />
            </div>
          </div>

          {marginCalculation && (
            <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
              <span className="text-neutral-500">
                Estimated profit: <b className="text-neutral-900 dark:text-white">{formatMoney(marginCalculation.profit)}/unit</b>
              </span>
              <span className={`px-2 py-0.5 rounded-md font-bold ${marginCalculation.margin >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600'}`}>
                {marginCalculation.margin}% Margin
              </span>
            </div>
          )}
        </div>

        {/* Stock Levels */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
              {isNew ? 'Initial Stock' : 'Current Stock'}
            </label>
            <input
              type="number"
              min="0"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
              Low Stock Alert Threshold
            </label>
            <input
              type="number"
              min="0"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[13px] font-mono font-bold text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">
            Description / Specifications <span className="text-neutral-400 font-normal lowercase">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Key product attributes, supplier codes, or warehouse shelf location..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <GlassButton variant="secondary" size="md" onClick={onClose} disabled={busy}>
            Cancel
          </GlassButton>
          <GlassButton variant="primary" size="md" loading={busy} type="submit">
            {isNew ? 'Create Product' : 'Save Changes'}
          </GlassButton>
        </div>
      </form>
    </GlassDialog>
  );
}

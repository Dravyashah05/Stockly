import { useState, useEffect } from 'react';
import { Package, AlertCircle } from 'lucide-react';
import type { Category, Product } from '@stockly/shared-types';
import type { ProductFormInput } from '@stockly/shared-client/store';
import { validateProductInput } from '@stockly/shared-validation';
import { GlassDialog, GlassButton, GlassTextField } from '@stockly/ui';

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
      title={
        <div className="flex items-center gap-2">
          <Package className="text-[#C7FF4D]" size={22} />
          <span>{isNew ? 'Create New Product' : 'Edit Product'}</span>
        </div>
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassTextField
            label="Product Name"
            placeholder="e.g. Wireless Mouse M350"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <GlassTextField
            label="SKU / Barcode"
            placeholder="e.g. ELEC-MOU-01"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            hint="Unique identifier for stock tracking"
            required
          />
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/80 px-3.5 py-2.5 text-[14px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
          >
            <option value="">General / Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <GlassTextField
            label={isNew ? 'Opening Stock' : 'Current Stock'}
            type="number"
            min="0"
            step="1"
            value={currentStock}
            onChange={(e) => setCurrentStock(e.target.value)}
            required
          />

          <GlassTextField
            label="Min Stock Alert"
            type="number"
            min="0"
            step="1"
            value={minimumStock}
            onChange={(e) => setMinimumStock(e.target.value)}
            hint="Low stock warning"
            required
          />

          <GlassTextField
            label="Cost Price ($)"
            type="number"
            min="0"
            step="0.01"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            required
          />

          <GlassTextField
            label="Selling Price ($)"
            type="number"
            min="0"
            step="0.01"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
            Description / Specifications (Optional)
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional product details, supplier info, or shelf location"
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/80 px-3.5 py-2.5 text-[14px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
          />
        </div>

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
          <GlassButton type="submit" variant="primary" loading={busy} disabled={busy}>
            {isNew ? 'Create Product' : 'Save Changes'}
          </GlassButton>
        </div>
      </form>
    </GlassDialog>
  );
}

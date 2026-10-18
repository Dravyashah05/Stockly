import { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Edit2,
  Trash2,
  Tag,
} from 'lucide-react';
import type { Category, Product } from '@stockly/shared-types';
import { stockStatus } from '@stockly/shared-validation';
import { GlassCard, GlassButton, StatusBadge, GlassDialog } from '@stockly/ui';

interface WebProductsProps {
  products: Product[];
  categories: Category[];
  initialFilter?: string;
  onNewProduct: () => void;
  onEditProduct: (p: Product) => void;
  onDeleteProduct: (id: string) => Promise<boolean>;
  onStockIn: (productId: string) => void;
  onStockOut: (productId: string) => void;
}

export default function WebProducts({
  products,
  categories,
  initialFilter = 'all',
  onNewProduct,
  onEditProduct,
  onDeleteProduct,
  onStockIn,
  onStockOut,
}: WebProductsProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [sortKey, setSortKey] = useState<'name' | 'stock-desc' | 'stock-asc' | 'price-desc' | 'sku'>('name');

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchSku = p.sku.toLowerCase().includes(q);
          const matchDesc = p.description?.toLowerCase().includes(q);
          if (!matchName && !matchSku && !matchDesc) return false;
        }
        // Category
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) {
          return false;
        }
        // Status
        const st = stockStatus(p);
        if (statusFilter === 'in' && st !== 'ok') return false;
        if (statusFilter === 'low' && st !== 'low') return false;
        if (statusFilter === 'out' && st !== 'out') return false;

        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'name') return a.name.localeCompare(b.name);
        if (sortKey === 'sku') return a.sku.localeCompare(b.sku);
        if (sortKey === 'stock-desc') return (b.currentStock || 0) - (a.currentStock || 0);
        if (sortKey === 'stock-asc') return (a.currentStock || 0) - (b.currentStock || 0);
        if (sortKey === 'price-desc') return (b.sellingPrice || 0) - (a.sellingPrice || 0);
        return 0;
      });
  }, [products, search, selectedCategory, statusFilter, sortKey]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const counts = useMemo(() => {
    return {
      all: products.length,
      in: products.filter((p) => stockStatus(p) === 'ok').length,
      low: products.filter((p) => stockStatus(p) === 'low').length,
      out: products.filter((p) => stockStatus(p) === 'out').length,
    };
  }, [products]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await onDeleteProduct(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const formatCurrency = (val?: number) => {
    if (val === undefined || Number.isNaN(val)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header and New Product button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Products & Inventory
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
            Manage your full product catalog, SKU references, and stock levels
          </p>
        </div>

        <GlassButton
          variant="primary"
          size="md"
          onClick={onNewProduct}
          iconStart={<Plus size={16} />}
        >
          Add Product
        </GlassButton>
      </div>

      {/* Control Bar: Search, Category, Status Tabs, Sorting */}
      <GlassCard tone="regular" radius="20px" className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search field */}
          <div className="md:col-span-5 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, SKU, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/80 text-[14px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            />
          </div>

          {/* Category Dropdown */}
          <div className="md:col-span-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/80 text-[14px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="md:col-span-3">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/80 text-[14px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            >
              <option value="name">Sort: Name (A-Z)</option>
              <option value="sku">Sort: SKU</option>
              <option value="stock-desc">Sort: Highest Stock</option>
              <option value="stock-asc">Sort: Lowest Stock</option>
              <option value="price-desc">Sort: Highest Price</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-neutral-200/50 dark:border-neutral-800">
          {[
            { key: 'all', label: 'All Items', count: counts.all, tone: 'neutral' as const },
            { key: 'in', label: 'In Stock', count: counts.in, tone: 'success' as const },
            { key: 'low', label: 'Low Stock', count: counts.low, tone: 'warning' as const },
            { key: 'out', label: 'Out of Stock', count: counts.out, tone: 'danger' as const },
          ].map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[13px] font-bold transition-all ${
                  active
                    ? 'bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515] shadow-sm'
                    : 'bg-white/40 dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/60 dark:hover:bg-neutral-700/60'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono ${
                    active
                      ? 'bg-white/20 dark:bg-black/20 text-inherit'
                      : 'bg-neutral-200/60 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Main Inventory Data Table */}
      <GlassCard tone="regular" radius="24px" className="p-0 overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-200/50 dark:bg-neutral-800 text-neutral-500">
              <Boxes size={28} />
            </div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-white">No products found</h3>
            <p className="text-[13px] text-neutral-500 max-w-sm mx-auto">
              {search || statusFilter !== 'all' || selectedCategory !== 'all'
                ? 'Try clearing your filters or search term to see more items.'
                : 'Your catalog is empty. Click "+ Add Product" to create your first item.'}
            </p>
            {(!search && statusFilter === 'all' && selectedCategory === 'all') && (
              <GlassButton variant="primary" onClick={onNewProduct} iconStart={<Plus size={16} />}>
                Create First Product
              </GlassButton>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200/60 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-800/40 text-neutral-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">SKU</th>
                  <th className="py-3.5 px-4">Product Name & Category</th>
                  <th className="py-3.5 px-4">Stock Level</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3 text-right">Cost Price</th>
                  <th className="py-3.5 px-3 text-right">Selling Price</th>
                  <th className="py-3.5 px-3 text-right">Margin</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800">
                {filteredProducts.map((p) => {
                  const status = stockStatus(p);
                  const isOut = status === 'out';
                  const isLow = status === 'low';
                  const catName = p.categoryId ? categoryMap.get(p.categoryId) ?? 'General' : 'General';
                  const marginPct =
                    p.sellingPrice && p.costPrice
                      ? (((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(0)
                      : null;

                  const maxRef = Math.max(p.minimumStock * 2, 20);
                  const fillRatio = Math.min(100, Math.round((p.currentStock / maxRef) * 100));

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      {/* SKU */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[12px] text-neutral-700 dark:text-neutral-300">
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700">
                          {p.sku}
                        </span>
                      </td>

                      {/* Name & Category */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-neutral-900 dark:text-white text-[14px]">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                          <Tag size={11} /> {catName}
                        </div>
                      </td>

                      {/* Stock Level */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-black text-[15px] ${
                              isOut
                                ? 'text-rose-600 dark:text-rose-400'
                                : isLow
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-neutral-900 dark:text-white'
                            }`}
                          >
                            {p.currentStock}
                          </span>
                          <span className="text-[12px] text-neutral-500 font-medium">
                            units
                          </span>
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full ${
                              isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${isOut ? 0 : Math.max(6, fillRatio)}%` }}
                          />
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-3">
                        <StatusBadge
                          tone={isOut ? 'danger' : isLow ? 'warning' : 'success'}
                          size="sm"
                          dot
                        >
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                        </StatusBadge>
                      </td>

                      {/* Cost Price */}
                      <td className="py-3.5 px-3 text-right font-medium text-neutral-600 dark:text-neutral-400">
                        {formatCurrency(p.costPrice)}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3.5 px-3 text-right font-bold text-neutral-900 dark:text-white">
                        {formatCurrency(p.sellingPrice)}
                      </td>

                      {/* Margin % */}
                      <td className="py-3.5 px-3 text-right">
                        {marginPct !== null ? (
                          <span className={`font-mono text-[12px] font-bold ${Number(marginPct) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'}`}>
                            {marginPct}%
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Stock In (+)"
                            onClick={() => onStockIn(p.id)}
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 transition-colors"
                          >
                            <ArrowDownToLine size={15} />
                          </button>
                          <button
                            type="button"
                            title="Stock Out (-)"
                            onClick={() => onStockOut(p.id)}
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-amber-500/10 hover:border-amber-500/40 text-amber-600 dark:text-amber-400 transition-colors"
                          >
                            <ArrowUpFromLine size={15} />
                          </button>
                          <button
                            type="button"
                            title="Edit Product"
                            onClick={() => onEditProduct(p)}
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            title="Delete Product"
                            onClick={() => setDeleteTarget(p)}
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-rose-500/10 hover:border-rose-500/40 text-rose-600 dark:text-rose-400 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Delete Confirmation Dialog */}
      <GlassDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete Product"
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-[14px] text-neutral-600 dark:text-neutral-300">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.sku})?
          </p>
          <p className="text-[12px] text-rose-600 dark:text-rose-400 font-medium">
            This will permanently remove the item from your Google Sheet catalog.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <GlassButton variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="destructive"
              loading={deleteBusy}
              onClick={() => void handleDeleteConfirm()}
            >
              Confirm Delete
            </GlassButton>
          </div>
        </div>
      </GlassDialog>
    </div>
  );
}

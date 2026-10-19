import { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Edit2,
  Trash2,
  LayoutGrid,
  List,
  X,
} from 'lucide-react';
import type { Category, Product } from '@stockly/shared-types';
import { stockStatus } from '@stockly/shared-validation';
import { formatMoney } from '@stockly/shared-client/config';
import { GlassCard, GlassButton, GlassDialog } from '@stockly/ui';

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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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

  const getStatusInfo = (p: Product) => {
    const st = stockStatus(p);
    if (st === 'out') {
      return { label: 'Out of Stock', tone: 'danger' as const, dotColor: 'bg-rose-500', textColor: 'text-rose-600 dark:text-rose-400' };
    }
    if (st === 'low') {
      return { label: 'Low Stock', tone: 'warning' as const, dotColor: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' };
    }
    return { label: 'Optimal', tone: 'success' as const, dotColor: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' };
  };

  return (
    <div className="space-y-6">
      {/* Header & New Product CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Catalog & Inventory
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
            {products.length} products tracked • Real-time stock movements & pricing
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center p-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300/50 dark:border-neutral-700/50">
            <button
              type="button"
              title="Grid Cards View"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-black text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              title="Dense Table View"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-black text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <List size={16} />
            </button>
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
      </div>

      {/* Control Bar: Search, Category, Sort */}
      <GlassCard tone="regular" radius="20px" className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search input with clear button */}
          <div className="md:col-span-5 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, SKU, or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 text-[13px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="md:col-span-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 text-[13px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="md:col-span-3">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 text-[13px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            >
              <option value="name">Name (A-Z)</option>
              <option value="sku">SKU</option>
              <option value="stock-desc">Highest Stock</option>
              <option value="stock-asc">Lowest Stock</option>
              <option value="price-desc">Highest Price</option>
            </select>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-black/[0.04] dark:divide-white/[0.04]">
          {[
            { key: 'all', label: 'All Items', count: counts.all, dot: 'bg-neutral-400' },
            { key: 'in', label: 'Optimal', count: counts.in, dot: 'bg-emerald-500' },
            { key: 'low', label: 'Low Stock', count: counts.low, dot: 'bg-amber-500' },
            { key: 'out', label: 'Depleted', count: counts.out, dot: 'bg-rose-500' },
          ].map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                  active
                    ? 'bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515] shadow-xs'
                    : 'bg-white/40 dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/60 dark:hover:bg-neutral-700/60'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tab.dot}`} />
                <span>{tab.label}</span>
                <span className="font-mono text-[11px] opacity-75">({tab.count})</span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Main Content: Grid vs Table */}
      {filteredProducts.length === 0 ? (
        <GlassCard tone="regular" radius="20px" className="p-12 text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-white/5 text-neutral-400">
            <Boxes size={24} />
          </div>
          <h3 className="font-bold text-base text-neutral-900 dark:text-white">No products match your filter</h3>
          <p className="text-[12px] text-neutral-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all' || selectedCategory !== 'all'
              ? 'Try adjusting your search query, status chip, or category filter.'
              : 'Your inventory catalog is currently empty. Click Add Product to get started.'}
          </p>
          {!search && statusFilter === 'all' && selectedCategory === 'all' && (
            <GlassButton variant="primary" size="sm" onClick={onNewProduct} iconStart={<Plus size={15} />}>
              Create First Product
            </GlassButton>
          )}
        </GlassCard>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((p) => {
            const status = getStatusInfo(p);
            const stock = p.currentStock || 0;
            const minStock = p.minimumStock || 5;
            const stockPct = Math.min(100, Math.round((stock / Math.max(minStock * 2, stock, 1)) * 100));
            const margin = p.sellingPrice && p.costPrice
              ? Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100)
              : null;

            return (
              <GlassCard
                key={p.id}
                tone="regular"
                radius="20px"
                className="p-4 flex flex-col justify-between hover:border-black/20 dark:hover:border-white/20 transition-all group"
              >
                <div>
                  {/* Card Header: Category & Status */}
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-semibold text-neutral-400 uppercase tracking-wider truncate">
                      {categoryMap.get(p.categoryId) || 'General'}
                    </span>
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor}`} />
                      <span className={status.textColor}>{status.label}</span>
                    </span>
                  </div>

                  {/* Product Title & SKU */}
                  <div className="mt-2.5">
                    <h3 className="font-extrabold text-[15px] text-neutral-900 dark:text-white tracking-tight line-clamp-1" title={p.name}>
                      {p.name}
                    </h3>
                    <span className="font-mono text-[11px] font-semibold text-neutral-400">
                      {p.sku}
                    </span>
                  </div>

                  {/* Stock Gauge Meter */}
                  <div className="mt-4 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.04]">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] text-neutral-500 font-medium">In Stock</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black font-mono text-neutral-900 dark:text-white">
                          {stock}
                        </span>
                        <span className="text-[11px] text-neutral-400 font-mono">/ min {minStock}</span>
                      </div>
                    </div>
                    {/* Micro bar */}
                    <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full mt-2 overflow-hidden">
                      <div
                        style={{ width: `${stockPct}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${status.dotColor}`}
                      />
                    </div>
                  </div>

                  {/* Pricing info */}
                  <div className="mt-3 flex items-center justify-between text-[12px] font-mono">
                    <span className="text-neutral-500">
                      Cost: <b className="text-neutral-700 dark:text-neutral-300">{formatMoney(p.costPrice || 0)}</b>
                    </span>
                    <span className="font-bold text-neutral-900 dark:text-white">
                      Sell: {formatMoney(p.sellingPrice || 0)}
                    </span>
                  </div>

                  {margin !== null && (
                    <div className="mt-1 text-right">
                      <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{margin}% margin
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions: Quick Stock In/Out + Edit/Delete */}
                <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Quick Stock In (+)"
                      onClick={() => onStockIn(p.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center gap-1 border border-emerald-500/20"
                    >
                      <ArrowDownToLine size={13} /> +In
                    </button>
                    <button
                      type="button"
                      title="Quick Stock Out (-)"
                      onClick={() => onStockOut(p.id)}
                      disabled={stock <= 0}
                      className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all flex items-center gap-1 border border-amber-500/20 disabled:opacity-40"
                    >
                      <ArrowUpFromLine size={13} /> -Out
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Edit Product"
                      onClick={() => onEditProduct(p)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      title="Delete Product"
                      onClick={() => setDeleteTarget(p)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <GlassCard tone="regular" radius="20px" className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-neutral-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-center">Stock</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Cost</th>
                  <th className="py-3 px-3 text-right">Selling</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filteredProducts.map((p) => {
                  const status = getStatusInfo(p);
                  return (
                    <tr key={p.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-neutral-500 text-[12px]">
                        {p.sku}
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                        {p.name}
                      </td>
                      <td className="py-3 px-3 text-neutral-500 text-[12px]">
                        {categoryMap.get(p.categoryId) || 'General'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-neutral-900 dark:text-white">
                        {p.currentStock || 0}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 font-bold text-[12px]">
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor}`} />
                          <span className={status.textColor}>{status.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                        {formatMoney(p.costPrice || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-neutral-900 dark:text-white">
                        {formatMoney(p.sellingPrice || 0)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="Stock In (+)"
                            onClick={() => onStockIn(p.id)}
                            className="p-1 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          >
                            <ArrowDownToLine size={15} />
                          </button>
                          <button
                            type="button"
                            title="Stock Out (-)"
                            onClick={() => onStockOut(p.id)}
                            disabled={(p.currentStock || 0) <= 0}
                            className="p-1 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                          >
                            <ArrowUpFromLine size={15} />
                          </button>
                          <button
                            type="button"
                            title="Edit Product"
                            onClick={() => onEditProduct(p)}
                            className="p-1 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            title="Delete Product"
                            onClick={() => setDeleteTarget(p)}
                            className="p-1 rounded-md text-neutral-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
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
        </GlassCard>
      )}

      {/* Delete Confirmation Dialog */}
      <GlassDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <p className="text-[13.5px] text-neutral-700 dark:text-neutral-300">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong> (<span className="font-mono text-xs">{deleteTarget?.sku}</span>)?
          </p>
          <p className="text-[12px] text-rose-600 dark:text-rose-400 font-medium">
            This permanently removes the product and its history link from your Google Sheet.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <GlassButton variant="secondary" size="md" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="destructive"
              size="md"
              loading={deleteBusy}
              onClick={() => void handleDeleteConfirm()}
            >
              Delete Product
            </GlassButton>
          </div>
        </div>
      </GlassDialog>
    </div>
  );
}

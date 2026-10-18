import { useMemo } from 'react';
import {
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  PackageX,
  DollarSign,
  TrendingUp,
  PackagePlus,
  RefreshCw,
  Clock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import type { Product, StockTransaction } from '@stockly/shared-types';
import { stockStatus } from '@stockly/shared-validation';
import { GlassCard, GlassButton, StatusBadge } from '@stockly/ui';

interface WebDashboardProps {
  products: Product[];
  transactions: StockTransaction[];
  refreshing: boolean;
  lastSync: Date | null;
  onRefresh: () => void;
  onStockIn: (productId?: string) => void;
  onStockOut: (productId?: string) => void;
  onNewProduct: () => void;
  onNavigateTab: (tab: string, filter?: string) => void;
}

export default function WebDashboard({
  products,
  transactions,
  refreshing,
  lastSync,
  onRefresh,
  onStockIn,
  onStockOut,
  onNewProduct,
  onNavigateTab,
}: WebDashboardProps) {
  const metrics = useMemo(() => {
    const totalProducts = products.length;
    const totalUnits = products.reduce((acc, p) => acc + (p.currentStock || 0), 0);
    const lowStock = products.filter((p) => stockStatus(p) === 'low');
    const outOfStock = products.filter((p) => stockStatus(p) === 'out');
    const totalValue = products.reduce(
      (acc, p) => acc + (p.currentStock || 0) * (p.costPrice || 0),
      0,
    );
    return {
      totalProducts,
      totalUnits,
      lowStock,
      outOfStock,
      totalValue,
    };
  }, [products]);

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 8);
  }, [transactions]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Inventory Dashboard
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 flex items-center gap-2 mt-1">
            <span>Real-time Google Sheets sync</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> Last synced: {lastSync ? lastSync.toLocaleTimeString() : 'Just now'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <GlassButton
            variant="ghost"
            size="md"
            onClick={onRefresh}
            loading={refreshing}
            iconStart={<RefreshCw size={16} />}
          >
            Sync Now
          </GlassButton>
          <GlassButton
            variant="secondary"
            size="md"
            onClick={() => onStockIn()}
            iconStart={<ArrowDownToLine size={16} className="text-emerald-500" />}
          >
            Stock In
          </GlassButton>
          <GlassButton
            variant="secondary"
            size="md"
            onClick={() => onStockOut()}
            iconStart={<ArrowUpFromLine size={16} className="text-amber-500" />}
          >
            Stock Out
          </GlassButton>
          <GlassButton
            variant="primary"
            size="md"
            onClick={onNewProduct}
            iconStart={<PackagePlus size={16} />}
          >
            New Product
          </GlassButton>
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <GlassCard tone="regular" radius="20px" className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-[12px] font-bold uppercase tracking-wider">Total Products</span>
            <Boxes size={18} className="text-neutral-400" />
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-neutral-900 dark:text-white">
            {metrics.totalProducts}
          </div>
          <div className="mt-2 text-[12px] text-neutral-500">
            In catalog
          </div>
        </GlassCard>

        <GlassCard tone="regular" radius="20px" className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-[12px] font-bold uppercase tracking-wider">Total Units</span>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-neutral-900 dark:text-white">
            {metrics.totalUnits}
          </div>
          <div className="mt-2 text-[12px] text-neutral-500">
            Across all categories
          </div>
        </GlassCard>

        <GlassCard
          tone="regular"
          radius="20px"
          className="p-4 relative overflow-hidden cursor-pointer hover:border-amber-500/40 transition-colors"
          onClick={() => onNavigateTab('products', 'low')}
        >
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-[12px] font-bold uppercase tracking-wider">Low Stock</span>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
            {metrics.lowStock.length}
          </div>
          <div className="mt-2 text-[12px] text-amber-700/80 dark:text-amber-300/80 font-medium flex items-center justify-between">
            <span>Needs replenishment</span>
            <ChevronRight size={14} />
          </div>
        </GlassCard>

        <GlassCard
          tone="regular"
          radius="20px"
          className="p-4 relative overflow-hidden cursor-pointer hover:border-rose-500/40 transition-colors"
          onClick={() => onNavigateTab('products', 'out')}
        >
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-[12px] font-bold uppercase tracking-wider">Out of Stock</span>
            <PackageX size={18} className="text-rose-500" />
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-rose-600 dark:text-rose-400">
            {metrics.outOfStock.length}
          </div>
          <div className="mt-2 text-[12px] text-rose-700/80 dark:text-rose-300/80 font-medium flex items-center justify-between">
            <span>Depleted units</span>
            <ChevronRight size={14} />
          </div>
        </GlassCard>

        <GlassCard tone="regular" radius="20px" className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-[12px] font-bold uppercase tracking-wider">Asset Value</span>
            <DollarSign size={18} className="text-[#151515] dark:text-[#C7FF4D]" />
          </div>
          <div className="mt-2 text-2xl lg:text-3xl font-extrabold text-neutral-900 dark:text-white">
            {formatCurrency(metrics.totalValue)}
          </div>
          <div className="mt-2 text-[12px] text-neutral-500">
            At cost price
          </div>
        </GlassCard>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                Replenishment Priority
              </h2>
              {metrics.lowStock.length > 0 && (
                <StatusBadge tone="warning" size="sm">
                  {metrics.lowStock.length} Items Low
                </StatusBadge>
              )}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('products', 'low')}
              className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
            >
              View all products →
            </button>
          </div>

          <GlassCard tone="regular" radius="24px" className="p-0 overflow-hidden">
            {metrics.lowStock.length === 0 && metrics.outOfStock.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="font-bold text-neutral-900 dark:text-white">All Stock Levels Healthy</h3>
                <p className="text-[13px] text-neutral-500 max-w-sm mx-auto">
                  No products are currently under their minimum stock thresholds. Everything is well stocked!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-neutral-200/60 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-800/40 text-neutral-500 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-3">SKU</th>
                      <th className="py-3 px-3 text-right">Current Stock</th>
                      <th className="py-3 px-3 text-right">Min Required</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/40 dark:divide-neutral-800">
                    {[...metrics.outOfStock, ...metrics.lowStock].slice(0, 6).map((p) => {
                      const isOut = p.currentStock <= 0;
                      return (
                        <tr key={p.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-white">
                            {p.name}
                          </td>
                          <td className="py-3 px-3 font-mono text-neutral-500 text-[12px]">
                            {p.sku}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className={`font-bold ${isOut ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                              {p.currentStock} units
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-neutral-500">
                            {p.minimumStock} units
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => onStockIn(p.id)}
                              className="px-2.5 py-1 rounded-lg text-[12px] font-bold bg-[#C7FF4D] text-[#151515] hover:opacity-90 transition-opacity"
                            >
                              + Reorder / In
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('history')}
              className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
            >
              Full History →
            </button>
          </div>

          <GlassCard tone="regular" radius="24px" className="p-4 space-y-3">
            {recentTransactions.length === 0 ? (
              <div className="p-6 text-center text-neutral-500 text-[13px]">
                No transactions recorded yet. Record stock-in or stock-out to build transaction history.
              </div>
            ) : (
              recentTransactions.map((tx) => {
                const isIncoming = tx.type === 'IN';
                return (
                  <div
                    key={tx.id}
                    className="flex items-start justify-between gap-3 p-2.5 rounded-xl hover:bg-neutral-100/60 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
                          isIncoming
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isIncoming ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-[13px] text-neutral-900 dark:text-white truncate">
                          {tx.productName ?? 'Product'}
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          {tx.note ? tx.note : isIncoming ? 'Stock In delivery' : tx.reason ?? 'Stock Out'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-bold text-[13px] ${
                          isIncoming ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isIncoming ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </span>
                      <p className="text-[10px] text-neutral-400">{formatDate(tx.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

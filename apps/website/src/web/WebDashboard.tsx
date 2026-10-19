import { useMemo } from 'react';
import {
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  PackageX,
  TrendingUp,
  PackagePlus,
  RefreshCw,
  Clock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { Product, StockTransaction } from '@stockly/shared-types';
import { stockStatus } from '@stockly/shared-validation';
import { CURRENCY_SYMBOL, formatMoney } from '@stockly/shared-client/config';
import { GlassCard, GlassButton } from '@stockly/ui';

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
    const inStockCount = totalProducts - lowStock.length - outOfStock.length;
    const totalValue = products.reduce(
      (acc, p) => acc + (p.currentStock || 0) * (p.costPrice || 0),
      0,
    );
    const totalRetail = products.reduce(
      (acc, p) => acc + (p.currentStock || 0) * (p.sellingPrice || 0),
      0,
    );
    const healthPercent = totalProducts > 0
      ? Math.round((inStockCount / totalProducts) * 100)
      : 100;

    return {
      totalProducts,
      totalUnits,
      lowStock,
      outOfStock,
      inStockCount,
      totalValue,
      totalRetail,
      healthPercent,
    };
  }, [products]);

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 8);
  }, [transactions]);

  const priorityItems = useMemo(() => {
    return [...metrics.outOfStock, ...metrics.lowStock].slice(0, 5);
  }, [metrics.outOfStock, metrics.lowStock]);

  const formatTimeAgo = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Greeting, Live DB Status & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              Inventory Overview
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Connected
            </span>
          </div>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 flex items-center gap-2 mt-1">
            <span>Synchronized with Google Sheets database</span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-[12px]">
              <Clock size={12} />
              {lastSync ? `Updated ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready'}
            </span>
          </p>
        </div>

        {/* Quick Action Pill Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <GlassButton
            variant="ghost"
            size="md"
            onClick={onRefresh}
            loading={refreshing}
            iconStart={<RefreshCw size={15} />}
          >
            Sync
          </GlassButton>
          <GlassButton
            variant="secondary"
            size="md"
            onClick={() => onStockIn()}
            iconStart={<ArrowDownToLine size={15} className="text-emerald-600 dark:text-emerald-400" />}
          >
            Stock In
          </GlassButton>
          <GlassButton
            variant="secondary"
            size="md"
            onClick={() => onStockOut()}
            iconStart={<ArrowUpFromLine size={15} className="text-amber-600 dark:text-amber-400" />}
          >
            Stock Out
          </GlassButton>
          <GlassButton
            variant="primary"
            size="md"
            onClick={onNewProduct}
            iconStart={<PackagePlus size={15} />}
          >
            New Product
          </GlassButton>
        </div>
      </div>

      {/* Bento Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Asset Valuation */}
        <GlassCard tone="regular" radius="20px" className="p-5 relative overflow-hidden group hover:border-black/20 dark:hover:border-white/20 transition-all">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Asset Valuation</span>
            <span className="h-8 w-8 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center font-bold text-xs text-neutral-700 dark:text-neutral-300">
              {CURRENCY_SYMBOL}
            </span>
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-extrabold text-neutral-900 dark:text-white font-mono tracking-tight">
            {formatMoney(metrics.totalValue)}
          </div>
          <div className="mt-2 text-[12px] text-neutral-500 flex items-center justify-between">
            <span>At cost basis</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
              Retail: {formatMoney(metrics.totalRetail)}
            </span>
          </div>
        </GlassCard>

        {/* Card 2: Units in Stock */}
        <GlassCard tone="regular" radius="20px" className="p-5 relative overflow-hidden group hover:border-black/20 dark:hover:border-white/20 transition-all">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Units</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-extrabold text-neutral-900 dark:text-white font-mono tracking-tight">
            {metrics.totalUnits.toLocaleString()}
          </div>
          <div className="mt-2 text-[12px] text-neutral-500 flex items-center justify-between">
            <span>Across all items</span>
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {metrics.totalProducts} products
            </span>
          </div>
        </GlassCard>

        {/* Card 3: Stock Health */}
        <GlassCard
          tone="regular"
          radius="20px"
          className="p-5 relative overflow-hidden cursor-pointer group hover:border-amber-500/30 transition-all"
          onClick={() => onNavigateTab('products', 'low')}
        >
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Attention Needed</span>
            <AlertTriangle size={16} className={metrics.lowStock.length > 0 ? 'text-amber-500' : 'text-neutral-400'} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl lg:text-3xl font-extrabold font-mono tracking-tight ${metrics.lowStock.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-900 dark:text-white'}`}>
              {metrics.lowStock.length}
            </span>
            <span className="text-[12px] text-neutral-500 font-semibold">items low</span>
          </div>
          <div className="mt-2 text-[12px] text-neutral-500 flex items-center justify-between">
            <span>Needs replenishment</span>
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </GlassCard>

        {/* Card 4: Depleted / Out of Stock */}
        <GlassCard
          tone="regular"
          radius="20px"
          className="p-5 relative overflow-hidden cursor-pointer group hover:border-rose-500/30 transition-all"
          onClick={() => onNavigateTab('products', 'out')}
        >
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Depleted Stock</span>
            <PackageX size={16} className={metrics.outOfStock.length > 0 ? 'text-rose-500' : 'text-neutral-400'} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl lg:text-3xl font-extrabold font-mono tracking-tight ${metrics.outOfStock.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-900 dark:text-white'}`}>
              {metrics.outOfStock.length}
            </span>
            <span className="text-[12px] text-neutral-500 font-semibold">zero balance</span>
          </div>
          <div className="mt-2 text-[12px] text-neutral-500 flex items-center justify-between">
            <span>Catalog health: {metrics.healthPercent}%</span>
            <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </GlassCard>
      </div>

      {/* Visual Stock Distribution Bar */}
      <GlassCard tone="regular" radius="20px" className="p-4 space-y-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
            <Sparkles size={14} className="text-[#C7FF4D] dark:text-[#C7FF4D]" /> Inventory Distribution
          </span>
          <span className="font-mono text-neutral-500 font-semibold">
            {metrics.healthPercent}% in good standing
          </span>
        </div>

        {/* Multi-segment progress bar */}
        <div className="h-3 w-full rounded-full bg-neutral-200/60 dark:bg-neutral-800 flex overflow-hidden p-0.5">
          {metrics.totalProducts > 0 ? (
            <>
              <div
                style={{ width: `${(metrics.inStockCount / metrics.totalProducts) * 100}%` }}
                className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
                title={`In Stock: ${metrics.inStockCount}`}
              />
              <div
                style={{ width: `${(metrics.lowStock.length / metrics.totalProducts) * 100}%` }}
                className="bg-amber-500 h-full transition-all duration-500"
                title={`Low Stock: ${metrics.lowStock.length}`}
              />
              <div
                style={{ width: `${(metrics.outOfStock.length / metrics.totalProducts) * 100}%` }}
                className="bg-rose-500 h-full rounded-r-full transition-all duration-500"
                title={`Out of Stock: ${metrics.outOfStock.length}`}
              />
            </>
          ) : (
            <div className="w-full bg-neutral-300 dark:bg-neutral-700 h-full rounded-full" />
          )}
        </div>

        {/* Legend buttons */}
        <div className="flex flex-wrap items-center gap-4 pt-1 text-[12px]">
          <button
            type="button"
            onClick={() => onNavigateTab('products', 'in')}
            className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Optimal: <b className="text-neutral-900 dark:text-white font-mono">{metrics.inStockCount}</b></span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('products', 'low')}
            className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Low Stock: <b className="text-amber-600 dark:text-amber-400 font-mono">{metrics.lowStock.length}</b></span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('products', 'out')}
            className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Out of Stock: <b className="text-rose-600 dark:text-rose-400 font-mono">{metrics.outOfStock.length}</b></span>
          </button>
        </div>
      </GlassCard>

      {/* Two Column Layout: Restock Priority & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Replenishment Priority (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" /> Restock Priority
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('products', 'low')}
              className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              All products →
            </button>
          </div>

          <GlassCard tone="regular" radius="20px" className="p-0 overflow-hidden divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {priorityItems.length === 0 ? (
              <div className="p-8 text-center space-y-2.5">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={22} />
                </div>
                <h3 className="font-bold text-[14px] text-neutral-900 dark:text-white">All Stock Healthy</h3>
                <p className="text-[12px] text-neutral-500 max-w-xs mx-auto">
                  Every product is currently above its minimum threshold.
                </p>
              </div>
            ) : (
              priorityItems.map((p) => {
                const isOut = (p.currentStock || 0) <= 0;
                return (
                  <div key={p.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[13px] text-neutral-900 dark:text-white truncate">
                          {p.name}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400 font-semibold">
                          {p.sku}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                        <span className={`font-mono font-bold ${isOut ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {p.currentStock || 0} in stock
                        </span>
                        <span>•</span>
                        <span>Min: {p.minimumStock || 5}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onStockIn(p.id)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-bold bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515] hover:opacity-90 active:scale-95 transition-all shadow-sm"
                    >
                      <ArrowDownToLine size={13} /> Restock
                    </button>
                  </div>
                );
              })
            )}
          </GlassCard>
        </div>

        {/* Right Column: Recent Movement Activity (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Boxes size={16} /> Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('history')}
              className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Full ledger →
            </button>
          </div>

          <GlassCard tone="regular" radius="20px" className="p-0 overflow-hidden divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {recentTransactions.length === 0 ? (
              <div className="p-8 text-center space-y-2.5">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-white/5 text-neutral-400">
                  <Boxes size={22} />
                </div>
                <h3 className="font-bold text-[14px] text-neutral-900 dark:text-white">No Transactions Yet</h3>
                <p className="text-[12px] text-neutral-500 max-w-xs mx-auto">
                  Movements will appear here once you record your first Stock In or Stock Out.
                </p>
                <div className="pt-1">
                  <GlassButton size="sm" variant="secondary" onClick={() => onStockIn()}>
                    Record Stock In
                  </GlassButton>
                </div>
              </div>
            ) : (
              recentTransactions.map((tx) => {
                const isIn = tx.type === 'IN';
                return (
                  <div key={tx.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
                          isIn
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isIn ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                      </span>

                      <div className="min-w-0">
                        <p className="font-bold text-[13px] text-neutral-900 dark:text-white truncate">
                          {tx.productName || 'Inventory Movement'}
                        </p>
                        <p className="text-[11px] text-neutral-500 truncate">
                          {tx.reason || (isIn ? 'Stock Inflow' : 'Stock Outflow')}
                          {tx.note ? ` • "${tx.note}"` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono text-[13px] font-extrabold block ${
                          isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-white'
                        }`}
                      >
                        {isIn ? `+${tx.quantity}` : `-${tx.quantity}`}
                      </span>
                      <span className="font-mono text-[10px] text-neutral-400 block">
                        {formatTimeAgo(tx.createdAt)}
                      </span>
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

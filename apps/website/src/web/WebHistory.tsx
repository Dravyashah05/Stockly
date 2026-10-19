import { useState, useMemo } from 'react';
import {
  History,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  X,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import type { StockTransaction } from '@stockly/shared-types';
import { formatMoney } from '@stockly/shared-client/config';
import { GlassCard, GlassButton } from '@stockly/ui';

interface WebHistoryProps {
  transactions: StockTransaction[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export default function WebHistory({
  transactions,
  onLoadMore,
  hasMore,
  loadingMore,
}: WebHistoryProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const stats = useMemo(() => {
    let totalInUnits = 0;
    let totalOutUnits = 0;
    transactions.forEach((t) => {
      if (t.type === 'IN') totalInUnits += t.quantity;
      if (t.type === 'OUT') totalOutUnits += t.quantity;
    });
    return {
      totalInUnits,
      totalOutUnits,
      netDelta: totalInUnits - totalOutUnits,
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const mProd = (tx.productName || '').toLowerCase().includes(q);
        const mNote = (tx.note || '').toLowerCase().includes(q);
        const mReason = (tx.reason || '').toLowerCase().includes(q);
        if (!mProd && !mNote && !mReason) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, search]);

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ['Date', 'Type', 'Product', 'Quantity', 'Price', 'Reason', 'Note'];
    const rows = filtered.map((t) => [
      t.createdAt,
      t.type,
      `"${(t.productName || '').replace(/"/g, '""')}"`,
      t.quantity,
      t.price ?? '',
      `"${(t.reason || '').replace(/"/g, '""')}"`,
      `"${(t.note || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `stockly-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Audit Ledger
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
            Complete transaction history and movement log recorded in Google Sheets
          </p>
        </div>

        <GlassButton
          variant="secondary"
          size="md"
          onClick={handleExportCsv}
          iconStart={<Download size={15} />}
          disabled={filtered.length === 0}
        >
          Export CSV ({filtered.length})
        </GlassButton>
      </div>

      {/* Metric Mini-Strip: Total In, Total Out, Net Units */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard tone="regular" radius="16px" className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">Total Inflow</span>
            <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              +{stats.totalInUnits.toLocaleString()} units
            </span>
          </div>
          <span className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ArrowDownToLine size={16} />
          </span>
        </GlassCard>

        <GlassCard tone="regular" radius="16px" className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">Total Outflow</span>
            <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
              -{stats.totalOutUnits.toLocaleString()} units
            </span>
          </div>
          <span className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ArrowUpFromLine size={16} />
          </span>
        </GlassCard>

        <GlassCard tone="regular" radius="16px" className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">Net Inventory Delta</span>
            <span className={`text-xl font-black font-mono ${stats.netDelta >= 0 ? 'text-neutral-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
              {stats.netDelta >= 0 ? `+${stats.netDelta.toLocaleString()}` : stats.netDelta.toLocaleString()} units
            </span>
          </div>
          <span className="h-8 w-8 rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-500 flex items-center justify-center">
            <TrendingUp size={16} />
          </span>
        </GlassCard>
      </div>

      {/* Filter & Search Bar */}
      <GlassCard tone="regular" radius="20px" className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Type tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 border border-neutral-300/40 dark:border-neutral-700/50 w-full sm:w-auto">
          {[
            { key: 'ALL' as const, label: 'All Operations' },
            { key: 'IN' as const, label: 'Stock In (+)' },
            { key: 'OUT' as const, label: 'Stock Out (-)' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTypeFilter(t.key)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                typeFilter === t.key
                  ? 'bg-white dark:bg-black text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by item, note, reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 text-[12.5px] font-medium text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </GlassCard>

      {/* Ledger Table */}
      <GlassCard tone="regular" radius="20px" className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-white/5 text-neutral-400">
              <History size={22} />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">No transactions found</h3>
            <p className="text-[12px] text-neutral-500 max-w-sm mx-auto">
              {search || typeFilter !== 'ALL'
                ? 'Try broadening your search term or clearing the type filter.'
                : 'No stock movements recorded in your database yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] text-neutral-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4 text-center">Movement</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filtered.map((tx) => {
                  const isIn = tx.type === 'IN';
                  return (
                    <tr key={tx.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono text-neutral-500 text-[11.5px] whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isIn
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isIn ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
                          <span>{isIn ? 'Stock In' : 'Stock Out'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                        {tx.productName || 'Unnamed Item'}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-extrabold text-[13px]">
                        <span className={isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-900 dark:text-white'}>
                          {isIn ? `+${tx.quantity}` : `-${tx.quantity}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-600 dark:text-neutral-400 text-[12px]">
                        {tx.price ? formatMoney(tx.price) : '—'}
                      </td>
                      <td className="py-3 px-4 text-[12px] text-neutral-500 max-w-xs truncate">
                        {tx.reason || ''}
                        {tx.note ? (tx.reason ? ` • ${tx.note}` : tx.note) : !tx.reason ? '—' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Load More Pagination Trigger */}
        {hasMore && (
          <div className="p-4 text-center border-t border-black/[0.04] dark:border-white/[0.04]">
            <GlassButton
              variant="secondary"
              size="sm"
              loading={loadingMore}
              onClick={onLoadMore}
              iconStart={<RefreshCw size={13} />}
            >
              Load More Movements
            </GlassButton>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

import { useState, useMemo } from 'react';
import {
  History,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
} from 'lucide-react';
import type { StockTransaction } from '@stockly/shared-types';
import { GlassCard, GlassButton, StatusBadge } from '@stockly/ui';

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Transaction History
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
            Audit trail of all incoming and outgoing inventory movements
          </p>
        </div>

        <GlassButton
          variant="secondary"
          size="md"
          onClick={handleExportCsv}
          iconStart={<Download size={16} />}
          disabled={filtered.length === 0}
        >
          Export CSV ({filtered.length})
        </GlassButton>
      </div>

      {/* Filter Controls */}
      <GlassCard tone="regular" radius="20px" className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:w-96 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by product, note, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-neutral-800/80 text-[14px] font-medium text-neutral-900 dark:text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-[#151515] dark:focus:ring-[#C7FF4D]"
            />
          </div>

          <div className="flex items-center gap-2">
            {[
              { key: 'ALL' as const, label: 'All Movements' },
              { key: 'IN' as const, label: 'Stock In' },
              { key: 'OUT' as const, label: 'Stock Out' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTypeFilter(t.key)}
                className={`px-3 py-1.5 rounded-xl text-[13px] font-bold transition-all ${
                  typeFilter === t.key
                    ? 'bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]'
                    : 'bg-white/40 dark:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Main History Table */}
      <GlassCard tone="regular" radius="24px" className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-200/50 dark:bg-neutral-800 text-neutral-500">
              <History size={28} />
            </div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-white">No transactions recorded</h3>
            <p className="text-[13px] text-neutral-500 max-w-sm mx-auto">
              {search || typeFilter !== 'ALL'
                ? 'No transactions matched your search or filter.'
                : 'Stock movements will appear here once you record incoming or outgoing inventory.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-neutral-200/60 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-800/40 text-neutral-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Movement Type</th>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-3 text-right">Quantity</th>
                  <th className="py-3.5 px-4">Reference / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800">
                {filtered.map((tx) => {
                  const isIncoming = tx.type === 'IN';
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-neutral-500 font-mono text-[12px] whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge
                          tone={isIncoming ? 'success' : 'warning'}
                          size="sm"
                          icon={
                            isIncoming ? (
                              <ArrowDownToLine size={13} />
                            ) : (
                              <ArrowUpFromLine size={13} />
                            )
                          }
                        >
                          {isIncoming ? 'STOCK IN' : 'STOCK OUT'}
                        </StatusBadge>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-neutral-900 dark:text-white text-[14px]">
                          {tx.productName ?? 'Product'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <span
                          className={`font-mono font-black text-[15px] ${
                            isIncoming
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isIncoming ? `+${tx.quantity}` : `-${tx.quantity}`}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-300">
                        {tx.note ? (
                          <div>
                            <span className="font-medium text-neutral-900 dark:text-white">{tx.note}</span>
                            {tx.reason && <span className="text-[11px] text-neutral-400 block">{tx.reason}</span>}
                          </div>
                        ) : (
                          <span className="text-neutral-500">{tx.reason ?? 'Normal stock movement'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && onLoadMore && (
          <div className="p-4 border-t border-neutral-200/50 dark:border-neutral-800 text-center">
            <GlassButton
              variant="secondary"
              size="sm"
              loading={loadingMore}
              onClick={onLoadMore}
            >
              Load Older Transactions
            </GlassButton>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

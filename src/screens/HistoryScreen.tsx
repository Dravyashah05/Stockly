import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, History as HistoryIcon } from 'lucide-react';
import { formatMoney } from '../lib/config';
import { useStore } from '../lib/store';
import type { StockTransaction } from '../lib/types';
import { EmptyState, Header, SearchBar, Segmented, SkeletonRow, StockBadge, useDismissable } from '../components/ui';

/** Rendered rows per page — full history stays server-side, screen pages locally. */
const PAGE_SIZE = 100;

export default function HistoryScreen() {
  const { transactions, loading, loadMoreTransactions, txLoadingMore, txExhausted, isPending } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const deferredQ = useDeferredValue(q);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [deferredQ, type, transactions.length]);

  const list = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    return transactions
      .filter((t) => (type === 'ALL' ? true : t.type === type))
      .filter((t) =>
        needle ? `${t.productName} ${t.reason} ${t.note}`.toLowerCase().includes(needle) : true,
      );
  }, [transactions, deferredQ, type]);

  // Format dates once per result set — toLocaleString × 100 rows on every
  // keystroke/render was a measurable main-thread cost while typing.
  const rows = useMemo(
    () =>
      list.slice(0, visible).map((t) => ({
        t,
        when: t.createdAt
          ? new Date(t.createdAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
      })),
    [list, visible],
  );

  const showMore = useCallback(() => setVisible((v) => v + PAGE_SIZE), []);
  const loadOlder = useCallback(() => {
    void loadMoreTransactions(visible + PAGE_SIZE).then(() => setVisible((v) => v + PAGE_SIZE));
  }, [loadMoreTransactions, visible]);

  // Detail page selection (stable id — survives filter/sync changes).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openTx = useCallback((id: string) => setSelectedId(id), []);
  const closeTx = useCallback(() => setSelectedId(null), []);
  const selected = useMemo(
    () => (selectedId ? (transactions.find((t) => t.id === selectedId) ?? null) : null),
    [selectedId, transactions],
  );

  return (
    <div className="app-page-viewport flex flex-col overflow-hidden">
      <Header
        title="History"
        subtitle={
          txExhausted
            ? `${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`
            : `Recent ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`
        }
      />
      {/* Fixed controls */}
      <div className="history-controls mx-auto w-full max-w-md shrink-0 space-y-3 px-4 pt-3">
        <SearchBar value={q} onChange={setQ} placeholder="Search product, reason, note…" />

        <Segmented<'ALL' | 'IN' | 'OUT'>
          label="Transaction type filter"
          value={type}
          onChange={setType}
          options={[
            { key: 'ALL', label: 'All' },
            { key: 'IN', label: 'Stock In' },
            { key: 'OUT', label: 'Stock Out' },
          ]}
        />
      </div>

      {/* List card hugs its content when short; scrolls internally when long */}
      <div className="history-results mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden px-4 pt-3">
        {loading && transactions.length === 0 ? (
          <div className="sheet-scroll space-y-2.5 overflow-y-auto">
            <SkeletonRow h={72} />
            <SkeletonRow h={72} />
            <SkeletonRow h={72} />
          </div>
        ) : list.length === 0 ? (
          <div className="sheet-scroll overflow-y-auto">
            <EmptyState
              icon={<HistoryIcon size={22} />}
              title="No transactions"
              hint="Stock In and Stock Out entries will appear here."
            />
          </div>
        ) : (
          <div className="glass sheet-scroll min-h-0 flex-1 overflow-y-auto rounded-[26px] px-1.5 pt-1 pb-4">
            <div className="history-table-head"><span>Type</span><span>Product</span><span>Details</span><span>Quantity</span></div>
            <div className="divide-y divide-(--stroke-dim)">
              {rows.map(({ t, when }) => (
                <TxRow key={t.id} t={t} when={when} pending={isPending(t.id)} onOpen={openTx} />
              ))}
            </div>
            {list.length > visible ? (
              <button
                type="button"
                onClick={showMore}
                className="press mt-1 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-(--accent-soft) text-[14px] font-bold text-(--accent)"
              >
                Show more ({list.length - visible} remaining)
              </button>
            ) : !txExhausted && list.length > 0 ? (
              <button
                type="button"
                disabled={txLoadingMore}
                onClick={loadOlder}
                className="press mt-1 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-(--accent-soft) text-[14px] font-bold text-(--accent) disabled:opacity-50"
              >
                {txLoadingMore ? 'Loading…' : 'Load older history'}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Full-screen transaction detail page (ledger is immutable — view only) */}
      {selected ? <TxDetailPage t={selected} onClose={closeTx} onSelect={openTx} /> : null}
    </div>
  );
}

/* Memoized row: date is preformatted by the parent so renders are cheap,
 * and rows skip re-render unless their own transaction changes. */
const TxRow = memo(function TxRow({
  t,
  when,
  pending,
  onOpen,
}: {
  t: StockTransaction;
  when: string;
  pending: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(t.id)}
      className="history-row press cv-row block w-full rounded-[20px] px-2.5 py-2.5 text-left hover:bg-(--accent-soft)/50"
    >
      <div className="history-row-main flex items-center gap-2.5">
        <span className="history-type"><StockBadge kind={t.type} />{pending ? (
          <span className="history-pending rounded-full bg-(--accent-soft) px-2 py-0.5 text-[10.5px] font-extrabold text-(--accent)">
            Saving…
          </span>
        ) : null}</span>
        <p className="history-product min-w-0 flex-1 truncate text-[14px] font-semibold text-(--ink)">{t.productName}</p>
        <span
          className={`history-quantity tnum text-[15px] font-bold ${
            t.type === 'IN' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
          }`}
        >
          {t.type === 'IN' ? '+' : '−'}
          {t.quantity}
        </span>
      </div>
      <p className="history-row-meta mt-1 text-xs leading-relaxed text-(--ink-2)">
        {when}
        {t.reason ? ` · ${t.reason}` : ''}
        {t.note ? ` — ${t.note}` : ''}
      </p>
    </button>
  );
});

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <span className="shrink-0 text-[12px] font-bold uppercase tracking-wider text-(--ink-2)">{label}</span>
      <span className="min-w-0 flex-1 break-words text-right text-[14px] font-semibold text-(--ink)">{value}</span>
    </div>
  );
}

/* Full-screen transaction detail. Portal to body so no transformed ancestor
 * traps its fixed positioning. Read-only: history entries are never edited. */
function TxDetailPage({ t, onClose, onSelect }: { t: StockTransaction; onClose: () => void; onSelect: (id: string) => void }) {
  const { transactions, products, isPending } = useStore();
  const pending = isPending(t.id);
  const isIn = t.type === 'IN';
  // Escape + Android Back dismiss; sits below sheets (z-40) so any popup stays on top.
  useDismissable(true, onClose);
  const liveStock = useMemo(
    () => products.find((p) => p.id === t.productId)?.currentStock ?? null,
    [products, t.productId],
  );
  const whenFull = t.createdAt
    ? new Date(t.createdAt).toLocaleString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
  const related = useMemo(
    () =>
      transactions
        .filter((x) => x.productId === t.productId && x.id !== t.id)
        .slice(0, 5)
        .map((x) => ({
          x,
          when: x.createdAt
            ? new Date(x.createdAt).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '',
        })),
    [transactions, t.productId, t.id],
  );
  return createPortal(
    <div
      className="history-detail-overlay animate-detail-in fixed inset-0 z-40 overflow-y-auto bg-(--bg)"
      role="dialog"
      aria-modal="true"
      aria-label={`${isIn ? 'Stock in' : 'Stock out'} — ${t.productName}`}
    >
      <div className="ambient" aria-hidden="true" />
      <div className="relative z-[1] mx-auto min-h-dvh max-w-md pb-10 lg:max-w-4xl lg:px-8">
        <div className="safe-top flex items-center justify-between px-4 pt-4 lg:px-0 lg:pt-6">
          <button
            onClick={onClose}
            aria-label="Back to history"
            className="glass-strong press flex h-11 w-11 items-center justify-center rounded-full text-(--ink) lg:w-auto lg:gap-1.5 lg:px-4"
          >
            <ArrowLeft size={20} />
            <span className="hidden text-[14px] font-bold lg:inline">Back</span>
          </button>
          <StockBadge kind={t.type} />
        </div>

        <div className="px-4 pt-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:px-0 lg:pt-6">
          {/* Hero: type-tinted card with status icon, quantity, product */}
          <div
            className={`rounded-[26px] border p-6 text-center ${
              isIn ? 'border-emerald-500/25 bg-emerald-500/[0.07]' : 'border-rose-500/25 bg-rose-500/[0.07]'
            }`}
          >
            <span
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white ${
                isIn ? 'bg-[#1E7B3C]' : 'bg-[#C2332D]'
              }`}
            >
              {isIn ? <ArrowDownToLine size={24} /> : <ArrowUpFromLine size={24} />}
            </span>
            <p
              className={`tnum mt-3 text-[52px] font-extrabold leading-none tracking-tight ${
                isIn ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
              }`}
            >
              {isIn ? '+' : '−'}
              {t.quantity}
            </p>
            <p className="mt-2 truncate text-[17px] font-bold text-(--ink)">{t.productName}</p>
            {liveStock != null ? (
              <p className="tnum mt-1 text-[12.5px] font-semibold text-(--ink-2)">{liveStock} in stock now</p>
            ) : null}
            {pending ? (
              <span className="mt-2.5 inline-block rounded-full bg-(--accent-soft) px-2.5 py-1 text-[11px] font-extrabold text-(--accent)">
                Saving…
              </span>
            ) : null}
          </div>

          {/* Facts */}
          <div className="glass mt-3 divide-y divide-(--stroke-dim) rounded-[26px] px-4 py-1 lg:mt-0">
            <DetailRow label="Date" value={whenFull} />
            {t.reason ? <DetailRow label="Reason" value={t.reason} /> : null}
            {t.note ? <DetailRow label="Note" value={t.note} /> : null}
            {t.price > 0 ? <DetailRow label="Price" value={formatMoney(t.price)} /> : null}
            <DetailRow label="Status" value={pending ? 'Saving — not yet confirmed' : 'Synced'} />
            {t.idempotencyKey ? (
              <DetailRow label="Reference" value={t.idempotencyKey.slice(0, 8)} />
            ) : null}
          </div>

          {/* Same product, recent first — tap to jump between entries */}
          {related.length > 0 ? (
            <div className="mt-3 lg:col-span-2 lg:mt-0">
              <p className="mb-2 flex items-center gap-2 px-1 text-[13px] font-extrabold uppercase tracking-wider text-(--ink-2)">
                <span aria-hidden="true" className="h-3 w-1 rounded-full bg-[#C7FF4D]" />
                More for this product
              </p>
              <div className="glass divide-y divide-(--stroke-dim) rounded-[26px] px-1.5 py-1">
                {related.map(({ x, when }) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => onSelect(x.id)}
                    className="press cv-row flex w-full items-center gap-2.5 rounded-[20px] px-2.5 py-2.5 text-left hover:bg-(--accent-soft)/50"
                  >
                    <StockBadge kind={x.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-(--ink)">
                        {x.reason || (x.type === 'IN' ? 'Stock in' : 'Stock out')}
                      </span>
                      <span className="block truncate text-[11.5px] font-medium text-(--ink-2)">{when}</span>
                    </span>
                    <span
                      className={`tnum shrink-0 text-[15px] font-bold ${
                        x.type === 'IN' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
                      }`}
                    >
                      {x.type === 'IN' ? '+' : '−'}
                      {x.quantity}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

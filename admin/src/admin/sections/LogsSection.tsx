/* Stockly owner console — section module (code-split, loaded on demand). */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  ScrollText} from 'lucide-react';
import {
  adminApi,
  type AdminLogEntry} from '../../shared/admin-api';
import {
  EmptyState,
  SearchBar,
  SkeletonRow} from '../../components/ui';
import {
  PageHeader,
  RefreshButton,
  errMsg,
  fmtDateTime,
  timeAgo,
  TONE_TILE,
  type Tone} from '../widgets';

/* ---------------------------------- logs ---------------------------------- */

function logTone(action: string): Tone {
  if (action.startsWith('auth.')) return 'green';
  if (action.startsWith('device.')) return 'sky';
  if (action.startsWith('sheet.')) return 'amber';
  if (action.startsWith('admin.')) return 'violet';
  if (action.startsWith('user.')) return 'amber';
  return 'ink';
}

export default function LogsSection({ notify }: { notify: (t: string, k?: 'success' | 'error' | 'info') => void }) {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.listLogs(200);
      setLogs(r.logs);
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);
  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      `${l.action} ${l.targetUserId} ${l.adminId} ${l.newValue} ${l.previousValue}`.toLowerCase().includes(q),
    );
  }, [logs, filter]);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Audit logs"
        blurb="Newest first — who changed what, and when. Filter by action, user, or value."
        actions={<RefreshButton onClick={() => void load()} busy={loading} />}
      />
      <div className="admin-card mb-4 p-4">
        <SearchBar value={filter} onChange={setFilter} placeholder="Filter logs — e.g. suspend, usr_…, device" />
      </div>
      {loading ? (
        <div className="space-y-2.5"><SkeletonRow h={72} /><SkeletonRow h={72} /><SkeletonRow h={72} /></div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<ScrollText size={20} />} title={logs.length === 0 ? 'No audit entries yet' : 'No matching entries'} hint={logs.length === 0 ? 'Admin actions will appear here as they happen.' : 'Try a different filter.'} />
      ) : (
        <div className="admin-card divide-y divide-(--stroke-dim)">
          {visible.map((l) => (
            <div key={l.logId} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_TILE[logTone(l.action)]}`}>
                <ScrollText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="tnum rounded-lg bg-(--glass-soft) px-2 py-0.5 text-[12px] font-extrabold text-(--ink)">{l.action}</span>
                  {l.targetUserId ? <span className="tnum max-w-56 truncate text-[11.5px] font-medium text-(--ink-3)" title={l.targetUserId}>{l.targetUserId}</span> : null}
                </p>
                {(l.previousValue || l.newValue) ? (
                  <p className="mt-1 break-words text-[12.5px] leading-relaxed text-(--ink-2)">
                    {l.previousValue ? <span className="tnum">{l.previousValue} → </span> : ''}<span className="tnum font-semibold text-(--ink)">{l.newValue}</span>
                  </p>
                ) : null}
              </div>
              <span className="tnum flex shrink-0 items-center gap-1 whitespace-nowrap text-[11.5px] font-medium text-(--ink-3)" title={fmtDateTime(l.timestamp)}>
                <Clock size={12} />
                {timeAgo(l.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
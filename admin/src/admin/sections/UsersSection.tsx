/* Stockly owner console — section module (code-split, loaded on demand). */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
  X} from 'lucide-react';
import {
  adminApi,
  getAdminToken,
  type RegistryUser,
  type UserStats} from '../../shared/admin-api';
import { devicesApi } from '../../shared/devices';
import {
  Confirm,
  EmptyState,
  ErrorState,
  SearchBar,
  Segmented,
  SkeletonRow} from '../../components/ui';
import {
  StatusPill,
  SheetPill,
  StatCard,
  PageHeader,
  RefreshButton,
  errMsg,
  fmtDate,
  fmtDateTime,
  initials,
  type Tone} from '../widgets';

/* --------------------------------- users --------------------------------- */

function UserDetail({
  user,
  deviceCount,
  onClose,
  onAction,
}: {
  user: RegistryUser;
  deviceCount?: number;
  onClose?: () => void;
  onAction: (user: RegistryUser, next: 'active' | 'suspended' | 'deactivated') => void;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Status', value: <StatusPill status={user.accountStatus} /> },
    { label: 'Sign-in', value: user.providers && user.providers.length > 0 ? user.providers.join(' + ') : '—' },
    {
      label: 'Sheet',
      value: (
        <span className="flex items-center justify-end gap-1.5">
          <SheetPill status={user.sheetStatus} />
          {user.sheetVerifiedAt ? <span className="text-(--ink-3)">· {fmtDate(user.sheetVerifiedAt)}</span> : null}
        </span>
      ),
    },
    { label: 'Devices', value: deviceCount ? `${deviceCount} linked` : 'none' },
    { label: 'Registered', value: fmtDateTime(user.registeredAt) },
    { label: 'Last login', value: fmtDateTime(user.lastLoginAt) },
    { label: 'User ID', value: <span className="max-w-[16rem] truncate" title={user.userId}>{user.userId}</span> },
  ];
  return (
    <div className="admin-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-[18px] font-extrabold text-(--ink)">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-extrabold tracking-tight text-(--ink)">{user.name}</p>
          <p className="truncate text-[12.5px] text-(--ink-2)">{user.email}</p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close details" className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--glass-soft) text-(--ink-2)">
            <X size={16} />
          </button>
        ) : null}
      </div>
      <dl className="tnum mt-4 space-y-2 border-t border-(--stroke-dim) pt-3 text-[12.5px] text-(--ink-2)">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="shrink-0 font-semibold">{r.label}</dt>
            <dd className="min-w-0 text-right font-medium text-(--ink)">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {user.accountStatus !== 'suspended' ? (
          <button type="button" onClick={() => onAction(user, 'suspended')} className="press flex min-h-[48px] items-center justify-center gap-1 rounded-2xl bg-amber-500/15 px-1 text-[13px] font-extrabold text-amber-700 dark:text-amber-300">
            <Ban size={14} /> Suspend
          </button>
        ) : null}
        {user.accountStatus !== 'active' ? (
          <button type="button" onClick={() => onAction(user, 'active')} className="press flex min-h-[48px] items-center justify-center gap-1 rounded-2xl bg-emerald-600 px-1 text-[13px] font-extrabold text-white">
            <UserCheck size={14} /> Activate
          </button>
        ) : null}
        {user.accountStatus !== 'deactivated' ? (
          <button type="button" onClick={() => onAction(user, 'deactivated')} className="press flex min-h-[48px] items-center justify-center gap-1 rounded-2xl bg-rose-500/12 px-1 text-[13px] font-extrabold text-rose-600 dark:text-rose-300">
            <UserX size={14} /> Offboard
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function UsersSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [users, setUsers] = useState<RegistryUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<RegistryUser | null>(null);
  const [pending, setPending] = useState<{ user: RegistryUser; next: 'active' | 'suspended' | 'deactivated' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceCounts, setDeviceCounts] = useState<Record<string, number>>({});

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await adminApi.listUsers({ search, status, limit: 100 });
      setUsers(res.users);
      setStats(res.stats);
      setTotal(res.total);
      if (detail) {
        const stillThere = res.users.find((u) => u.userId === detail.userId) ?? null;
        setDetail(stillThere);
      }
      const token = getAdminToken();
      if (token) {
        try {
          const ds = await devicesApi.adminDeviceStats(token);
          const map: Record<string, number> = {};
          for (const p of ds.perUser) map[p.userId] = p.count;
          setDeviceCounts(map);
        } catch {
          /* device stats are additive — never break the user list */
        }
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, status, detail]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const applyStatus = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await adminApi.setUserStatus({ userId: pending.user.userId, accountStatus: pending.next });
      setUsers((list) => list.map((u) => (u.userId === res.user.userId ? res.user : u)));
      setDetail(res.user);
      setPending(null);
      notify(res.replayed ? 'Already applied — duplicate ignored.' : 'Account status updated.', 'success');
      void load(true);
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(
    () => [
      { label: 'Total users', value: stats?.total ?? 0, icon: <Users size={19} />, tone: 'ink' as Tone },
      { label: 'Active', value: stats?.active ?? 0, icon: <UserCheck size={19} />, tone: 'green' as Tone },
      { label: 'Suspended', value: stats?.suspended ?? 0, icon: <Ban size={19} />, tone: 'amber' as Tone },
      { label: 'Deactivated', value: stats?.deactivated ?? 0, icon: <UserX size={19} />, tone: 'rose' as Tone },
    ],
    [stats],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        blurb="Registrations, account status, and sheet connections. Status changes are enforced by the backend and audit-logged."
        actions={<RefreshButton onClick={() => void load(true)} busy={refreshing} />}
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {counts.map((c) => (
          <StatCard key={c.label} icon={c.icon} value={c.value} label={c.label} tone={c.tone} />
        ))}
      </div>

      <div className="admin-card mt-4 p-4">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search name, email, or user ID" /></div>
          <div className="md:w-80"><Segmented<string> value={status} onChange={setStatus} label="Account status filter" options={[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'suspended', label: 'Suspended' },
            { key: 'deactivated', label: 'Off' },
          ]} /></div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2.5">
          <SkeletonRow h={64} /><SkeletonRow h={64} /><SkeletonRow h={64} />
        </div>
      ) : error ? (
        <div className="mt-4"><ErrorState message={error} onRetry={() => void load()} /></div>
      ) : users.length === 0 ? (
        <div className="mt-4"><EmptyState icon={<ShieldCheck size={20} />} title="No users found" hint="New registrations sync here automatically. Adjust the search or filter." /></div>
      ) : (
        <div className="mt-4 xl:grid xl:grid-cols-5 xl:items-start xl:gap-5">
          <div className="min-w-0 xl:col-span-3">
            <p className="tnum mb-2 px-1 text-[11.5px] font-bold text-(--ink-2)">Showing {users.length} of {total}</p>
            {/* Desktop table */}
            <div className="admin-card hidden overflow-x-auto lg:block">
              <table className="admin-table">
                <thead>
                  <tr><th>User</th><th>Sign-in</th><th>Devices</th><th>Sheet</th><th>Status</th><th>Registered</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId} onClick={() => setDetail(u)} className={`cursor-pointer ${detail?.userId === u.userId ? 'is-selected' : ''}`}>
                      <td>
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-[13px] font-extrabold text-(--ink)">{initials(u.name)}</span>
                          <span className="min-w-0">
                            <span className="block max-w-44 truncate text-[13.5px] font-bold text-(--ink)">{u.name}</span>
                            <span className="block max-w-44 truncate text-[11.5px] text-(--ink-2)">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-[12.5px] text-(--ink-2)">{u.providers && u.providers.length > 0 ? u.providers.join(' + ') : '—'}</td>
                      <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{deviceCounts[u.userId] ?? 0}</td>
                      <td><SheetPill status={u.sheetStatus} /></td>
                      <td><StatusPill status={u.accountStatus} /></td>
                      <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{fmtDate(u.registeredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-2 lg:hidden">
              {users.map((u) => (
                <button key={u.userId} type="button" onClick={() => setDetail(u)} className="press admin-card flex w-full items-center gap-3 p-3 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-[15px] font-extrabold text-(--ink)">
                    {initials(u.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-(--ink)">{u.name}</span>
                    <span className="block truncate text-[11.5px] font-medium text-(--ink-2)">
                      {u.email}{deviceCounts[u.userId] ? ` · ${deviceCounts[u.userId]} device${deviceCounts[u.userId] === 1 ? '' : 's'}` : ''}
                    </span>
                  </span>
                  <StatusPill status={u.accountStatus} />
                  <ChevronRight size={16} className="shrink-0 text-(--ink-3)" />
                </button>
              ))}
            </div>
          </div>
          {/* Desktop side panel */}
          <div className="hidden min-w-0 xl:col-span-2 xl:block">
            <div className="sticky top-5">
              {detail ? (
                <UserDetail user={detail} deviceCount={deviceCounts[detail.userId]} onAction={(u, next) => setPending({ user: u, next })} />
              ) : (
                <div className="admin-card flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <span className="glass-soft flex h-12 w-12 items-center justify-center rounded-2xl text-(--ink-2)"><Users size={20} /></span>
                  <p className="text-[14px] font-bold text-(--ink)">Select a user</p>
                  <p className="max-w-[26ch] text-[12.5px] leading-relaxed text-(--ink-2)">Account details and suspend / reactivate controls appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile detail overlay */}
      {detail ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-(--bg) xl:hidden">
          <div className="mx-auto max-w-md px-4 pb-16 pt-4">
            <button type="button" onClick={() => setDetail(null)} className="press mb-3 flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-(--glass-soft) px-4 text-[13.5px] font-extrabold text-(--ink)">
              <ArrowLeft size={16} /> Back to users
            </button>
            <UserDetail user={detail} deviceCount={deviceCounts[detail.userId]} onAction={(u, next) => setPending({ user: u, next })} />
          </div>
        </div>
      ) : null}

      <Confirm
        open={pending !== null}
        title={pending?.next === 'active' ? 'Reactivate account?' : pending?.next === 'suspended' ? 'Suspend account?' : 'Deactivate account?'}
        body={pending ? `${pending.user.name} (${pending.user.email}) will be set to ${pending.next}. Suspended and deactivated accounts are blocked by the backend, not just hidden in the UI. This is audit-logged.` : ''}
        confirmLabel={pending?.next === 'active' ? 'Reactivate' : pending?.next === 'suspended' ? 'Suspend' : 'Deactivate'}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => void applyStatus()}
      />
    </div>
  );
}
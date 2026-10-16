/* Stockly owner console — section module (code-split, loaded on demand). */

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Smartphone,
  Users} from 'lucide-react';
import {
  getAdminToken} from '../../shared/admin-api';
import { devicesApi, type DeviceInfo } from '../../shared/devices';
import {
  Confirm,
  EmptyState,
  Field,
  inputCls} from '../../components/ui';
import {
  StatusPill,
  StatCard,
  PageHeader,
  RefreshButton,
  deviceErrMsg,
  fmtDate,
  timeAgo} from '../widgets';

/* --------------------------------- devices -------------------------------- */

export default function DevicesSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [stats, setStats] = useState<{ totalActive: number; usersWithDevices: number } | null>(null);
  const [userId, setUserId] = useState('');
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<DeviceInfo | null>(null);

  const loadStats = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    try {
      const s = await devicesApi.adminDeviceStats(token);
      setStats({ totalActive: s.totalActive, usersWithDevices: s.usersWithDevices });
    } catch (e) {
      notify(deviceErrMsg(e), 'error');
    } finally {
      setLoadingStats(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const lookup = async () => {
    const token = getAdminToken();
    if (!token || !userId.trim()) return;
    setBusy(true);
    try {
      const res = await devicesApi.adminListDevices(token, userId.trim());
      setDevices(res.devices);
    } catch (e) {
      notify(deviceErrMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async () => {
    const token = getAdminToken();
    if (!token || !revokeTarget) return;
    setBusy(true);
    try {
      await devicesApi.adminRevokeDevice(token, revokeTarget.deviceId);
      setRevokeTarget(null);
      notify('Device access revoked.', 'success');
      void lookup();
      void loadStats();
    } catch (e) {
      notify(deviceErrMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Linked devices"
        blurb="Per-user device sessions. Revoked devices fail closed on their next backend call."
        actions={<RefreshButton onClick={() => void loadStats()} busy={loadingStats} />}
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={<Smartphone size={19} />} value={stats?.totalActive ?? '—'} label="Active devices" tone="sky" />
        <StatCard icon={<Users size={19} />} value={stats?.usersWithDevices ?? '—'} label="Users w/ devices" tone="violet" />
      </div>
      <div className="grid gap-4 xl:grid-cols-5 xl:items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
          className="admin-card mt-4 space-y-3 p-5 xl:col-span-2 xl:mt-0"
        >
          <p className="text-[14px] font-extrabold tracking-tight text-(--ink)">Look up a user&apos;s devices</p>
          <Field label="User ID">
            <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="usr_…" autoCapitalize="off" autoCorrect="off" className={inputCls} />
          </Field>
          <button type="submit" disabled={busy || !userId.trim()} className="press flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#151515] text-[14px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Loading…' : 'Look up devices'}
          </button>
        </form>
        <div className="mt-4 min-w-0 xl:col-span-3 xl:mt-0">
          {devices === null ? (
            <EmptyState icon={<Smartphone size={20} />} title="No lookup yet" hint="Enter a user ID to list every device linked to that account." />
          ) : devices.length === 0 ? (
            <EmptyState icon={<Smartphone size={20} />} title="No devices" hint="This user has no linked devices." />
          ) : (
            <>
              <div className="admin-card hidden overflow-x-auto lg:block">
                <table className="admin-table">
                  <thead><tr><th>Device</th><th>Platform</th><th>Status</th><th>Linked</th><th>Last active</th><th><span className="sr-only">Action</span></th></tr></thead>
                  <tbody>
                    {devices.map((d) => (
                      <tr key={d.deviceId}>
                        <td>
                          <span className="block max-w-48 truncate font-bold text-(--ink)">{d.name}</span>
                          <span className="tnum block max-w-48 truncate text-[11px] text-(--ink-3)">{d.deviceId}</span>
                        </td>
                        <td className="whitespace-nowrap text-[12.5px] text-(--ink-2)">{d.platform}</td>
                        <td><StatusPill status={d.status} /></td>
                        <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{fmtDate(d.linkedAt)}</td>
                        <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{timeAgo(d.lastActiveAt)}</td>
                        <td className="text-right">
                          {d.status === 'active' ? (
                            <button type="button" onClick={() => setRevokeTarget(d)} className="press whitespace-nowrap rounded-xl bg-rose-500/12 px-3 py-2 text-[12.5px] font-extrabold text-rose-600 dark:text-rose-300">
                              Revoke
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 lg:hidden">
                {devices.map((d) => (
                  <div key={d.deviceId} className="admin-card px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-(--ink)">{d.name}</p>
                      <StatusPill status={d.status} />
                    </div>
                    <p className="tnum mt-1 truncate text-[11.5px] text-(--ink-2)">
                      {d.platform} · linked {fmtDate(d.linkedAt)} · active {timeAgo(d.lastActiveAt)}
                    </p>
                    {d.status === 'active' ? (
                      <button type="button" onClick={() => setRevokeTarget(d)} className="press mt-2.5 min-h-[44px] w-full rounded-2xl bg-rose-500/12 text-[13.5px] font-extrabold text-rose-600 dark:text-rose-300">
                        Revoke access
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <Confirm
        open={revokeTarget !== null}
        title="Revoke this device?"
        body={revokeTarget ? `${revokeTarget.name} (${revokeTarget.userId}) loses access immediately on its next backend call. This is audit-logged.` : ''}
        confirmLabel="Revoke access"
        busy={busy}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => void doRevoke()}
      />
    </div>
  );
}
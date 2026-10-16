/* Stockly owner console — section module (code-split, loaded on demand). */

import { useCallback, useEffect, useState } from 'react';
import {
  Crown,
  KeyRound} from 'lucide-react';
import {
  adminApi} from '../../shared/admin-api';
import {
  EmptyState,
  ErrorState,
  SkeletonRow} from '../../components/ui';
import {
  StatusPill,
  PageHeader,
  RefreshButton,
  errMsg} from '../widgets';

/* --------------------------------- roles --------------------------------- */

export default function RolesSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [admins, setAdmins] = useState<{ adminId: string; email: string; role: string; status: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listAdmins();
      setAdmins(res.admins);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const changeRole = async (adminId: string, role: string) => {
    try {
      await adminApi.setAdminRole({ adminId, role });
      notify('Role updated.', 'success');
      void load();
    } catch (e) {
      notify(errMsg(e), 'error');
    }
  };
  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Roles & access"
        blurb="Owner (full control, can manage roles) and admin (can manage users and settings). Only the owner can change roles."
        actions={<RefreshButton onClick={() => void load()} busy={loading} />}
      />
      {loading ? (
        <div className="space-y-2.5"><SkeletonRow h={64} /><SkeletonRow h={64} /></div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : admins.length === 0 ? (
        <EmptyState icon={<KeyRound size={20} />} title="No administrators" hint="Complete first setup to create the owner account." />
      ) : (
        <div className="admin-card divide-y divide-(--stroke-dim)">
          {admins.map((a) => (
            <div key={a.adminId} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${a.role === 'owner' ? 'bg-[#151515] text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515]' : 'bg-(--accent-soft) text-(--ink)'}`}>
                {a.role === 'owner' ? <Crown size={17} /> : <KeyRound size={17} />}
              </span>
              <span className="min-w-0 flex-1 basis-40">
                <span className="block truncate text-[14px] font-bold text-(--ink)">{a.email}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-medium text-(--ink-2)">
                  <StatusPill status={a.status} />
                </span>
              </span>
              <label className="flex items-center gap-2 text-[12px] font-bold text-(--ink-2)">
                Role
                <select
                  aria-label={`Role for ${a.email}`}
                  value={a.role}
                  onChange={(e) => void changeRole(a.adminId, e.target.value)}
                  className="min-h-[44px] rounded-xl border border-(--stroke-dim) bg-(--field) px-3 text-[13px] font-bold text-(--ink) outline-none focus:border-(--accent)"
                >
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
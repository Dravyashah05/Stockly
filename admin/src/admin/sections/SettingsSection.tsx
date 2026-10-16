/* Stockly owner console — section module (code-split, loaded on demand). */

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Settings as SettingsIcon} from 'lucide-react';
import {
  adminApi} from '../../shared/admin-api';
import {
  EmptyState,
  Field,
  SkeletonRow,
  inputCls} from '../../components/ui';
import {
  PageHeader,
  RefreshButton,
  errMsg,
  fmtDateTime} from '../widgets';

/* -------------------------------- settings ------------------------------- */

export default function SettingsSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [settings, setSettings] = useState<{ key: string; value: string; updatedAt: string }[]>([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSettings();
      setSettings(res.settings);
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async () => {
    if (!key.trim()) return;
    setBusy(true);
    try {
      await adminApi.setSetting(key.trim(), value);
      setKey('');
      setValue('');
      notify('Setting saved.', 'success');
      void load();
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="App settings"
        blurb="Key-value configuration for the backend. Every write is audit-logged with its previous value."
        actions={<RefreshButton onClick={() => void load()} busy={loading} />}
      />
      <div className="grid gap-4 xl:grid-cols-5 xl:items-start">
        <form
          className="admin-card space-y-3 p-5 xl:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="text-[14px] font-extrabold tracking-tight text-(--ink)">New setting</p>
          <Field label="Key">
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. shopName" autoCapitalize="off" autoCorrect="off" className={inputCls} />
          </Field>
          <Field label="Value">
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className={inputCls} />
          </Field>
          <button type="submit" disabled={busy || !key.trim()} className="press flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-(--primary) text-[14px] font-extrabold text-white disabled:opacity-50 dark:bg-(--primary) dark:text-[#151515]">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Saving…' : 'Save setting'}
          </button>
        </form>
        <div className="xl:col-span-3">
          {loading ? (
            <div className="space-y-2.5"><SkeletonRow h={60} /><SkeletonRow h={60} /></div>
          ) : settings.length === 0 ? (
            <EmptyState icon={<SettingsIcon size={20} />} title="No settings yet" hint="Add the first key-value setting with the form." />
          ) : (
            <div className="admin-card hidden overflow-x-auto lg:block">
              <table className="admin-table">
                <thead><tr><th>Key</th><th>Value</th><th>Updated</th></tr></thead>
                <tbody>
                  {settings.map((s) => (
                    <tr key={s.key}>
                      <td className="whitespace-nowrap font-bold text-(--ink)">{s.key}</td>
                      <td className="max-w-72 break-words text-(--ink-2)">{s.value || '—'}</td>
                      <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{fmtDateTime(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {settings.length > 0 ? (
            <div className="space-y-2 lg:hidden">
              {settings.map((s) => (
                <div key={s.key} className="admin-card px-4 py-3">
                  <p className="text-[13.5px] font-bold text-(--ink)">{s.key}</p>
                  <p className="mt-0.5 break-words text-[12.5px] text-(--ink-2)">{s.value || '—'}</p>
                  <p className="tnum mt-1 text-[11px] text-(--ink-3)">Updated {fmtDateTime(s.updatedAt)}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import {
  Database,
  Moon,
  Sun,
  LogOut,
  RefreshCw,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { sheetsApi, type SheetConnection } from '@stockly/shared-client/connection';
import { getApiUrl, setApiUrl } from '@stockly/shared-client/config';
import { GlassCard, GlassButton, StatusBadge } from '@stockly/ui';

interface WebSettingsProps {
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (t: 'light' | 'dark' | 'system') => void;
  onReconnectSheet: () => void;
  onForceSync: () => void;
}

export default function WebSettings({
  theme,
  onThemeChange,
  onReconnectSheet,
  onForceSync,
}: WebSettingsProps) {
  const [conn, setConn] = useState<SheetConnection | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    void sheetsApi.getConnection().then(setConn).catch(() => setConn(null));
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await sheetsApi.reverify();
      setTestResult({
        ok: true,
        message: `Verified! Spreadsheet ID: ${res.spreadsheetId ?? 'Connected'}`,
      });
      setConn(res);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection test failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = () => {
    if (window.confirm('Disconnect Google Sheet database and clear local cache? Your Google Sheet data remains untouched.')) {
      setApiUrl('');
      try {
        localStorage.removeItem('stockly.apiUrl');
        localStorage.removeItem('stockly.cache.v1');
      } catch {
        /* storage unavailable */
      }
      window.location.reload();
    }
  };

  const rawUrl = getApiUrl();
  const maskedUrl = rawUrl
    ? `${rawUrl.slice(0, 32)}…${rawUrl.slice(-12)}`
    : 'Not configured';

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          Workspace Settings
        </h1>
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
          Configure your database connection, display theme, and workspace preferences
        </p>
      </div>

      {/* Google Sheets Connection Card */}
      <GlassCard tone="regular" radius="24px" className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Database size={20} />
            </span>
            <div>
              <h3 className="font-bold text-[16px] text-neutral-900 dark:text-white">
                Google Sheets Database
              </h3>
              <p className="text-[12px] text-neutral-500">
                Primary private datastore for products, stock balances, and logs
              </p>
            </div>
          </div>

          <StatusBadge tone={conn?.connected ? 'success' : 'danger'} size="sm" dot>
            {conn?.connected ? 'Connected & Verified' : 'Disconnected'}
          </StatusBadge>
        </div>

        <div className="rounded-2xl border border-neutral-200/60 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-800/40 p-4 space-y-3 text-[13px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-neutral-500 font-medium">Apps Script Endpoint:</span>
            <span className="font-mono text-neutral-700 dark:text-neutral-300 text-[12px] truncate max-w-sm">
              {maskedUrl}
            </span>
          </div>
          {conn?.spreadsheetId && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-neutral-500 font-medium">Spreadsheet ID:</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300 text-[12px]">
                {conn.spreadsheetId}
              </span>
            </div>
          )}
        </div>

        {testResult && (
          <div
            role="status"
            className={`p-3.5 rounded-xl border text-[13px] font-semibold flex items-center gap-2 ${
              testResult.ok
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
            }`}
          >
            {testResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <GlassButton
            variant="secondary"
            size="md"
            loading={testing}
            onClick={handleTestConnection}
            iconStart={<RefreshCw size={15} />}
          >
            Test Connection
          </GlassButton>
          <GlassButton
            variant="secondary"
            size="md"
            onClick={onReconnectSheet}
          >
            Change / Reconnect Sheet
          </GlassButton>
          <GlassButton
            variant="ghost"
            size="md"
            onClick={onForceSync}
          >
            Force Re-sync
          </GlassButton>
          <GlassButton
            variant="destructive"
            size="md"
            onClick={handleDisconnect}
            iconStart={<LogOut size={15} />}
          >
            Disconnect Database
          </GlassButton>
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300 hover:underline ml-auto"
          >
            {showGuide ? 'Hide Setup Instructions' : 'View Setup Guide →'}
          </button>
        </div>

        {showGuide && (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-black/20 p-4 space-y-3 text-[13px]">
            <h4 className="font-bold flex items-center gap-1.5 text-neutral-900 dark:text-white">
              <HelpCircle size={15} /> How to configure your Google Sheets backend:
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-neutral-600 dark:text-neutral-300">
              <li>Open your Google Sheet (with tabs for <em>Products</em>, <em>Transactions</em>, <em>Categories</em>).</li>
              <li>Go to <strong>Extensions → Apps Script</strong> and ensure the Stockly Web App script is saved.</li>
              <li>Click <strong>Deploy → Manage deployments</strong> to confirm access is set to <em>Anyone</em>.</li>
              <li>Copy the Web App URL (ending in <code>/exec</code>) and click &quot;Change / Reconnect Sheet&quot; above.</li>
            </ol>
          </div>
        )}
      </GlassCard>

      {/* Display Theme Card */}
      <GlassCard tone="regular" radius="24px" className="p-6 space-y-4">
        <h3 className="font-bold text-[16px] text-neutral-900 dark:text-white flex items-center gap-2">
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />} Appearance Theme
        </h3>
        <p className="text-[13px] text-neutral-500">
          Switch between Liquid Glass light theme, dark theme, or match your operating system setting.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          {[
            { key: 'light' as const, label: 'Light Theme', icon: <Sun size={16} /> },
            { key: 'dark' as const, label: 'Dark Theme', icon: <Moon size={16} /> },
            { key: 'system' as const, label: 'System Default', icon: <RefreshCw size={16} /> },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onThemeChange(t.key)}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-[13px] font-bold transition-all ${
                theme === t.key
                  ? 'border-[#151515] bg-[#151515] text-white dark:border-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515] shadow-sm'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white/40 dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Keyboard Shortcuts Cheatsheet */}
      <GlassCard tone="regular" radius="24px" className="p-6 space-y-4">
        <h3 className="font-bold text-[16px] text-neutral-900 dark:text-white flex items-center gap-2">
          <Keyboard size={18} /> Desktop Keyboard Shortcuts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
          <div className="p-2.5 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/50">
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black font-mono font-bold text-xs shadow-sm">Ctrl + K</kbd>
            <p className="text-neutral-500 text-[11px] mt-1">Focus global search</p>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/50">
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black font-mono font-bold text-xs shadow-sm">N</kbd>
            <p className="text-neutral-500 text-[11px] mt-1">New product modal</p>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/50">
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black font-mono font-bold text-xs shadow-sm">I</kbd>
            <p className="text-neutral-500 text-[11px] mt-1">Stock In modal</p>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-100/60 dark:bg-neutral-800/40 border border-neutral-200/50 dark:border-neutral-700/50">
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black font-mono font-bold text-xs shadow-sm">O</kbd>
            <p className="text-neutral-500 text-[11px] mt-1">Stock Out modal</p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

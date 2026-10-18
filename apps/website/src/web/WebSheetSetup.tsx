import { useState } from 'react';
import { Database, Link2, ShieldAlert, ExternalLink, HelpCircle } from 'lucide-react';
import { sheetsApi, SheetsApiError, type SheetConnection } from '@stockly/shared-client/connection';
import { getApiUrl } from '@stockly/shared-client/config';
import { signOutAccount } from '@stockly/shared-client/users';
import { GlassCard, GlassButton, GlassTextField, StatusBadge } from '@stockly/ui';

function errMsg(e: unknown): string {
  return e instanceof SheetsApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong. Try again.';
}

export default function WebSheetSetup({
  mode = 'setup',
  initialMessage,
  onConnected,
}: {
  mode?: 'setup' | 'repair';
  initialMessage?: string;
  onConnected: () => void;
}) {
  const [url, setUrl] = useState(() => {
    try {
      return getApiUrl();
    } catch {
      return '';
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialMessage ?? '');
  const [conn, setConn] = useState<SheetConnection | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const connect = async () => {
    const v = url.trim();
    if (!v) {
      setError('Please paste your Google Apps Script Web App /exec URL.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await sheetsApi.connectSheet(v);
      setConn(res);
      onConnected();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8 bg-(--st-bg) text-(--st-ink)">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-[28px] bg-[#111210] p-6 text-white shadow-xl">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.07] blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#C7FF4D] text-[#151515] shadow-inner">
              <Database size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-extrabold tracking-tight">Connect Your Google Sheet</h1>
                <StatusBadge tone={mode === 'repair' ? 'warning' : 'info'} size="sm">
                  {mode === 'repair' ? 'Needs Attention' : 'Setup'}
                </StatusBadge>
              </div>
              <p className="text-[13px] font-medium text-white/60">
                Stockly securely stores all your products, stock movements, and logs directly in your private spreadsheet.
              </p>
            </div>
          </div>
        </div>

        {/* Card */}
        <GlassCard tone="regular" radius="24px" className="p-6 space-y-5">
          <div className="flex items-center justify-between rounded-xl bg-neutral-100 dark:bg-neutral-800/60 p-3.5">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${conn?.connected ? 'bg-emerald-500' : error ? 'bg-rose-500' : 'bg-neutral-400'}`} />
              <span className="text-[13px] font-bold">
                {conn?.connected ? 'Verified Connection' : error ? 'Verification Failed' : 'Ready to Connect'}
              </span>
            </div>
            {conn?.spreadsheetId && (
              <span className="text-[12px] font-mono font-medium text-neutral-500">
                Sheet: …{conn.spreadsheetId.slice(-8)}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <GlassTextField
              label="Apps Script Web App Executable URL"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              leadingIcon={<Link2 size={16} className="text-neutral-400" />}
              hint="Must end with /exec and be deployed as 'Anyone' access"
              required
            />
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-[13px] font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-2.5">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <GlassButton
              variant="primary"
              size="lg"
              fullWidth
              loading={busy}
              onClick={() => void connect()}
              disabled={!url.trim() || busy}
            >
              Verify & Connect Sheet
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="lg"
              onClick={() => setShowGuide((v) => !v)}
              iconStart={<HelpCircle size={16} />}
            >
              {showGuide ? 'Hide Guide' : 'Setup Guide'}
            </GlassButton>
          </div>

          {/* Setup Guide Accordion */}
          {showGuide && (
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-black/20 p-4 space-y-3 text-[13px]">
              <h3 className="font-bold flex items-center gap-1.5 text-neutral-900 dark:text-neutral-100">
                <ExternalLink size={14} /> 3-Step Google Sheets Setup:
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-neutral-600 dark:text-neutral-300">
                <li>Create a new spreadsheet on Google Sheets (or use your existing Stockly template).</li>
                <li>In Google Sheets, click <strong>Extensions → Apps Script</strong> and paste the Stockly backend script.</li>
                <li>Click <strong>Deploy → New deployment</strong>, select <strong>Web app</strong>, choose <em>Execute as: Me</em> and <em>Who has access: Anyone</em>, then copy the <strong>/exec</strong> URL and paste it above.</li>
              </ol>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between text-[12px] text-neutral-500">
            <button
              type="button"
              onClick={() => signOutAccount()}
              className="text-rose-600 dark:text-rose-400 hover:underline font-semibold"
            >
              Sign out
            </button>
            <a href="#/" className="hover:underline">
              Return to Website
            </a>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

/* Stockly owner console — section module (code-split, loaded on demand). */

import {
  RefreshCw} from 'lucide-react';
import {
  AdminApiError} from '../shared/admin-api';
import { DevicesApiError } from '../shared/devices';

export function deviceErrMsg(e: unknown): string {
  return e instanceof DevicesApiError ? e.message : 'Something went wrong. Try again.';
}

export function errMsg(e: unknown): string {
  return e instanceof AdminApiError ? e.message : 'Something went wrong. Try again.';
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function timeAgo(value?: string | null): string {
  if (!value) return '—';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(value).toLocaleDateString();
}

export function initials(name: string): string {
  const c = name.trim().slice(0, 1).toUpperCase();
  return c || '?';
}

/* ------------------------------ primitives ------------------------------ */

export type Tone = 'ink' | 'green' | 'amber' | 'rose' | 'sky' | 'violet';

export const TONE_TILE: Record<Tone, string> = {
  ink: 'bg-(--primary) text-white dark:bg-(--primary) dark:text-[#151515]',
  green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-300',
  sky: 'bg-sky-500/12 text-sky-600 dark:text-sky-300',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
};

export function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: string | number; label: string; tone: Tone }) {
  return (
    <div className="admin-card flex items-center gap-3 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONE_TILE[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="tnum block text-[22px] font-extrabold leading-none tracking-tight text-(--ink)">{value}</span>
        <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider text-(--ink-2)">{label}</span>
      </span>
    </div>
  );
}

export function PageHeader({ eyebrow, title, blurb, actions }: { eyebrow: string; title: string; blurb: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-(--ink-3)">{eyebrow}</p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-(--ink) lg:text-[30px]">{title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">{blurb}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function RefreshButton({ onClick, busy, label = 'Refresh' }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="press glass-soft flex min-h-[44px] items-center gap-1.5 rounded-2xl px-4 text-[13.5px] font-extrabold text-(--ink) disabled:opacity-50"
    >
      <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
      {busy ? 'Loading…' : label}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
      : status === 'suspended'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
        : 'bg-rose-500/12 text-rose-600 dark:text-rose-300';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${cls}`}>
      {status}
    </span>
  );
}

export function SheetPill({ status }: { status?: string | null }) {
  if (!status) return <span className="text-[12.5px] font-medium text-(--ink-3)">not connected</span>;
  const cls =
    status === 'verified'
      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
      : 'bg-amber-500/15 text-amber-600 dark:text-amber-300';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${cls}`}>
      {status}
    </span>
  );
}
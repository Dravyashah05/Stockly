import React, { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  History,
  Home,
  Info,
  LayoutGrid,
  RefreshCw,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  X,
  XCircle,
} from 'lucide-react';
import type { ToastMsg } from '../../shared/types';

/* ---------- Dismiss plumbing shared by every overlay ----------
 * - Escape key closes the topmost overlay (web / desktop).
 * - Android hardware Back closes the topmost overlay via a single
 *   global Capacitor listener routed through a stack, so nested
 *   sheets (e.g. Confirm over a form) dismiss one at a time.
 * - Body scroll is locked while any overlay is open.
 */
const dismissStack: Array<() => void> = [];
const overlayListeners = new Set<() => void>();
let backListenerInstalled = false;

function notifyOverlayChange() {
  overlayListeners.forEach((l) => l());
}

function installBackListener() {
  if (backListenerInstalled) return;
  backListenerInstalled = true;
  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      await App.addListener('backButton', () => {
        const top = dismissStack[dismissStack.length - 1];
        if (top) top();
      });
    } catch {
      /* web — Escape handler below covers browsers */
    }
  })();
}

/** Register an overlay's close handler for Escape + Android Back + scroll lock. */
export function useDismissable(open: boolean, onClose: () => void) {
  const ref = React.useRef(onClose);
  useEffect(() => {
    ref.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    installBackListener();
    const close = () => ref.current();
    dismissStack.push(close);
    notifyOverlayChange();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissStack[dismissStack.length - 1] === close) close();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      const i = dismissStack.indexOf(close);
      if (i >= 0) dismissStack.splice(i, 1);
      // Restore scroll only when no overlay remains.
      if (dismissStack.length === 0) document.body.style.overflow = prevOverflow;
      notifyOverlayChange();
    };
  }, [open ]);
}

/** True while any Sheet/Confirm/ActionSheet overlay is open. */
export function hasOpenOverlay(): boolean {
  return dismissStack.length > 0;
}

/** Reactive version — re-renders when any overlay opens/closes.
 *  Used to hide the bottom nav under popups so sheet buttons stay reachable. */
export function useOverlayOpen(): boolean {
  const [open, setOpen] = React.useState(hasOpenOverlay);
  useEffect(() => {
    const sync = () => setOpen(hasOpenOverlay());
    overlayListeners.add(sync);
    sync();
    return () => {
      overlayListeners.delete(sync);
    };
  }, []);
  return open;
}

/* ---------- Screen header ---------- */
export const Header = memo(function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="safe-top px-4 pb-1 pt-3">
      <div className="mx-auto flex max-w-md items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="desktop-header-title truncate text-[length:var(--fs-large-title)] font-bold leading-tight tracking-[-0.022em] text-(--ink)">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[length:var(--fs-subhead)] font-normal text-(--ink-2)">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right}
      </div>
    </div>
  );
});

/* ---------- Floating glass bottom navigation ---------- */
export type TabKey = 'home' | 'products' | 'history' | 'settings';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: 'Home', icon: <Home size={20} /> },
  { key: 'products', label: 'Products', icon: <LayoutGrid size={20} /> },
  { key: 'history', label: 'History', icon: <History size={20} /> },
  { key: 'settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
];

export const BottomNav = memo(function BottomNav({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  // Instant highlight: App routes tab switches through a transition so the
  // new screen renders in the background — the nav + sliding pill react now.
  const [fast, setFast] = useState<TabKey>(tab);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => setFast(tab), [tab]);
  useEffect(() => {
    let disposed = false;
    let showListener: { remove: () => Promise<void> } | undefined;
    let hideListener: { remove: () => Promise<void> } | undefined;
    void import('@capacitor/keyboard').then(async ({ Keyboard }) => {
      const show = await Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true));
      const hide = await Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false));
      if (disposed) {
        void show.remove();
        void hide.remove();
      } else {
        showListener = show;
        hideListener = hide;
      }
    }).catch(() => { /* Web builds may not have a native keyboard bridge. */ });
    return () => {
      disposed = true;
      void showListener?.remove();
      void hideListener?.remove();
    };
  }, []);
  const activeIdx = Math.max(
    0,
    TABS.findIndex((t) => t.key === fast),
  );

  // Sliding pill geometry, measured from the real buttons (survives font
  // loading / zoom / rotation via the resize listener).
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState<{ x: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = btnRefs.current[activeIdx];
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth, h: el.offsetHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeIdx]);

  const pick = (t: TabKey) => {
    setFast(t);
    setTab(t);
  };

  return (
    <nav className={`bottom-navigation nav-bottom-offset fixed inset-x-0 z-30 px-4 ${keyboardOpen ? 'is-keyboard-open' : ''}`}>
      <div className="glass-strong relative mx-auto grid max-w-md grid-cols-4 gap-0.5 rounded-[calc(var(--radius-card) - 4px)] p-1">
        {pill ? (
          <span
            aria-hidden="true"
            className="nav-slide-pill absolute left-0 top-1 rounded-[calc(var(--radius-card) - 4px)] bg-(--accent-soft)"
            style={{ width: pill.w, height: pill.h, transform: `translateX(${pill.x}px)` }}
          />
        ) : null}
        {TABS.map((t, i) => {
          const active = fast === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              type="button"
              onClick={() => pick(t.key)}
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
              className={`nav-pill relative z-[1] flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-[calc(var(--radius-card) - 4px)] text-[length:var(--fs-tab)] font-medium tracking-[0.01em] ${
 active ? 'text-(--accent)' : 'text-(--ink-3)'
 }`}
            >
              <span className={active ? 'animate-pop-in' : ''}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
});

/* ---------- Bottom sheet modal (single reusable implementation) ----------
 * Content-driven height: the panel grows with its content up to
 * 86dvh, then the body region scrolls internally. Edge-to-edge,
 * consistent top corners + drag handle, outside-tap + Escape +
 * Android-Back dismiss, safe-area-aware bottom padding.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  label,
  backdropCls,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Small supporting line under the title. */
  subtitle?: string;
  children: React.ReactNode;
  /** Optional actions kept outside the scrollable sheet body. */
  footer?: React.ReactNode;
  /** Accessible name override (defaults to title). */
  label?: string;
  /** Backdrop styling override (defaults to bg-black/45). */
  backdropCls?: string;
}) {
  useDismissable(open, onClose);
  // Swipe-down-to-close: drag ONLY from the header/handle zone (never the
  // scroll body, so list scrolling is untouched). Direct DOM transform for
  // 60-90Hz — no re-renders during the gesture.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef({ active: false, startY: 0, startT: 0, dy: 0 });
  // Handle tap feedback: brief widen + light haptic.
  const [handleTap, setHandleTap] = React.useState(false);
  const handleTapTimer = React.useRef(0);
  const tapHandle = () => {
    window.clearTimeout(handleTapTimer.current);
    setHandleTap(true);
    handleTapTimer.current = window.setTimeout(() => setHandleTap(false), 220);
    void (async () => {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        try {
          navigator.vibrate?.(10);
        } catch {
          /* no haptics — ignore */
        }
      }
    })();
  };
  const setPanelY = (dy: number, animate: boolean) => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.22s cubic-bezier(0.32,0.9,0.35,1)' : 'none';
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
  };
  const dragEnd = () => {
    const d = dragState.current;
    if (!d.active) return;
    d.active = false;
    const velocity = d.dy / Math.max(1, performance.now() - d.startT);
    if (d.dy > 110 || (d.dy > 40 && velocity > 0.6)) {
      // Fling the panel down, then close.
      setPanelY(typeof window !== 'undefined' ? window.innerHeight : 600, true);
      window.setTimeout(onClose, 170);
    } else {
      setPanelY(0, true);
    }
  };
  if (!open) return null;
  // Portal to body: an ancestor with transform/will-change would trap
  // `position: fixed` and collapse the sheet at the content bottom.
  return createPortal(
    <div className="fixed inset-0 z-50" data-sheet-title={title} role="dialog" aria-modal="true" aria-label={label || title}>
      <button aria-label="Close dialog" onClick={onClose} className={`animate-fade-in absolute inset-0 ${backdropCls || 'bg-black/45'}`} />
      <div className="sheet-dialog-position absolute inset-x-0 bottom-0 mx-auto flex max-w-md justify-center">
        <div
          ref={panelRef}
          className="sheet-dialog-panel glass-strong animate-sheet-up flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-[28px] border-b-0 border-x-0"
        >
          <div
            className="shrink-0 cursor-grab touch-none select-none px-5 pb-3 pt-2.5 active:cursor-grabbing"
            onPointerDown={(e) => {
              if (!e.isPrimary) return;
              // The X close button lives inside this drag zone. Capturing the
              // pointer here would retarget pointerup/click to this div, so
              // the button's click would never fire and the sheet wouldn't
              // close. Leave interactive descendants alone.
              if (
                (e.target as HTMLElement | null)?.closest?.(
                  'button, a, input, select, textarea, [contenteditable="true"]',
                )
              ) {
                return;
              }
              e.currentTarget.setPointerCapture?.(e.pointerId);
              dragState.current = { active: true, startY: e.clientY, startT: performance.now(), dy: 0 };
              setPanelY(0, false);
            }}
            onPointerMove={(e) => {
              const d = dragState.current;
              if (!d.active || !e.isPrimary) return;
              d.dy = Math.max(0, e.clientY - d.startY);
              setPanelY(d.dy, false);
            }}
            onPointerUp={dragEnd}
            onPointerCancel={() => {
              dragState.current.active = false;
              setPanelY(0, true);
            }}
          >
            <div
              role="presentation"
              onPointerDown={tapHandle}
              className={`sheet-handle mx-auto mb-3 h-1.5 rounded-full transition-all duration-200 ease-out ${
 handleTap ? 'w-16 bg-(--accent)' : 'w-9 bg-(--ink-3)/35'
 }`}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[length:var(--fs-title3)] font-semibold tracking-[-0.015em] text-(--ink)">{title}</h2>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="press glass-soft -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-(--ink-2)"
              >
                <X size={17} />
              </button>
            </div>
          </div>
          <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-1">
            {children}
          </div>
          {footer ? <div className="shrink-0 border-t border-(--stroke-dim) px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3">{footer}</div> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Form primitives (readability first, minimal blur) ---------- */
export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  /** Extra classes on the wrapper, for grouping inside a field surface. */
  className?: string;
}) {
  return (
    <label className={`block${className ? ` ${className}` : ''}`}>
      <span className="mb-1.5 block text-[length:var(--fs-footnote)] font-semibold tracking-[0.005em] text-(--ink-2)">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[length:var(--fs-caption)] text-(--ink-3)">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  'min-h-[50px] w-full rounded-[var(--radius-control)] border border-(--stroke-dim) bg-(--field) px-4 py-3 text-[length:var(--fs-callout)] text-(--ink) outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-(--ink-3) focus:border-(--accent) focus:ring-[3px] focus:ring-(--accent-soft)';

/* ---------- Shared search bar (single implementation for every list) ---------- */
export const SearchBar = memo(function SearchBar({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label?: string;
}) {
  return (
    <div className="search-field relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--ink-3)"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label || placeholder}
          role="searchbox"
          className="min-h-12 w-full rounded-[var(--radius-control)] border border-(--stroke-dim) bg-(--field) py-2.5 pl-10 pr-4 text-[length:var(--fs-callout)] text-(--ink) outline-none transition-[border-color,box-shadow] duration-150 focus:border-(--accent) focus:ring-[3px] focus:ring-(--accent-soft) placeholder:text-(--ink-3)"
        />
    </div>
  );
});

/* ---------- Shared segmented filter control ---------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-[var(--radius-row)] bg-(--glass-soft) p-0.5"
      role="group"
      aria-label={label}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={`chip-glass press rounded-[var(--radius-icon)] py-2 text-[length:var(--fs-footnote)] transition-colors ${
 active
 ? 'bg-(--bg-elev) font-semibold text-(--ink) shadow-[0_1px_3px_rgba(0,0,0,0.10)]'
 : 'font-medium text-(--ink-2)'
 }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Shared section heading ---------- */
export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <p className="text-[length:var(--fs-caption)] font-semibold uppercase tracking-[0.06em] text-(--ink-3)">
        {title}
      </p>
      {action}
    </div>
  );
}

/* ---------- Error state with retry ---------- */
export function ErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="glass rounded-[calc(var(--radius-card) - 4px)] border-(--destructive)/25 px-4 py-4" role="alert">
      <p className="text-[length:var(--fs-subhead)] font-medium leading-relaxed text-(--destructive-ink)">
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="press glass-soft mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-subhead)] font-semibold text-(--ink) disabled:opacity-50"
        >
          <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      ) : null}
    </div>
  );
}

export function PrimaryBtn({
  children,
  onClick,
  disabled,
  type = 'button',
  dense,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  /** Compact ~48px height for tight modal footers. */
  dense?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`press flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--primary-foreground) shadow-[0_1px_2px_rgba(0,0,0,0.08)] disabled:opacity-50 ${
 dense ? 'min-h-[44px] py-2.5' : 'min-h-[50px] py-3.5'
 }`}
    >
      {children}
    </button>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="glass flex flex-col items-center gap-1.5 rounded-[calc(var(--radius-card) - 4px)] px-6 py-10 text-center">
      <div className="glass-soft mb-2 flex h-14 w-14 items-center justify-center rounded-[var(--radius-row)] text-(--ink-3)">
        {icon}
      </div>
      <p className="text-[length:var(--fs-headline)] font-semibold text-(--ink)">{title}</p>
      {hint ? (
        <p className="max-w-[30ch] text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------- Loading skeletons ---------- */
export const SkeletonRow = memo(function SkeletonRow({ h = 76 }: { h?: number }) {
  return <div className="shimmer rounded-[calc(var(--radius-card) - 4px)] border border-(--stroke-dim)" style={{ height: h }} />;
});

/* ---------- Sync status banner (optimistic writes) ----------
 * Fixed above the bottom nav: shows "Saving…" while unconfirmed writes are
 * in flight, and unsaved changes with an explicit Retry (never auto-retried).
 * Rendered via portal so no ancestor transform can trap it. */
export const SyncStatus = memo(function SyncStatus({
  pending,
  failed,
  onRetry,
  onDismiss,
}: {
  pending: number;
  failed: { key: string; label: string; detail: string }[];
  onRetry: (key: string) => void;
  onDismiss: (key: string) => void;
}) {
  if (pending === 0 && failed.length === 0) return null;
  return createPortal(
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto flex max-w-md flex-col items-center gap-2 px-5">
      {pending > 0 ? (
        <div className="glass-strong animate-toast-in pointer-events-auto flex w-full items-center gap-2.5 rounded-[calc(var(--radius-card) - 4px)] px-4 py-3 text-[length:var(--fs-footnote)] font-medium text-(--ink)">
          <RefreshCw size={16} className="shrink-0 animate-spin text-(--accent)" />
          <span className="flex-1">
            Saving… {pending} change{pending === 1 ? '' : 's'} syncing to Google Sheets
          </span>
        </div>
      ) : null}
      {failed.map((f) => (
        <div
          key={f.key}
          role="alert"
          className="glass-strong animate-toast-in pointer-events-auto w-full rounded-[calc(var(--radius-card) - 4px)] border-(--destructive)/30 px-4 py-3"
        >
          <p className="text-[length:var(--fs-footnote)] font-bold text-(--ink)">Unsaved: {f.label}</p>
          <p className="mt-0.5 truncate text-[length:var(--fs-footnote)] text-(--ink-2)">{f.detail}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onRetry(f.key)}
              className="press flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-footnote)] font-semibold text-(--primary-foreground)"
            >
              <RotateCcw size={16} /> Retry
            </button>
            <button
              type="button"
              onClick={() => onDismiss(f.key)}
              className="press glass-soft min-h-[44px] rounded-[var(--radius-control)] text-[length:var(--fs-footnote)] font-semibold text-(--ink-2)"
            >
              Discard
            </button>
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
});

/* ---------- Toasts ---------- */
export function Toasts({ toasts, onDismiss, lifted }: { toasts: ToastMsg[]; onDismiss: (id: number) => void; lifted?: boolean }) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div className={`safe-bottom pointer-events-none fixed inset-x-0 z-[90] mx-auto flex max-w-md flex-col items-center gap-2 px-5 ${lifted ? 'bottom-40' : 'bottom-28'}`}>
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onDismiss(t.id)}
          className="glass-strong animate-toast-in pointer-events-auto flex w-full items-center gap-2.5 rounded-[calc(var(--radius-card) - 4px)] px-4 py-3 text-left text-[length:var(--fs-footnote)] font-medium text-(--ink)"
        >
          {t.kind === 'success' ? (
            <CheckCircle2 size={18} className="shrink-0 text-(--success)" />
          ) : t.kind === 'error' ? (
            <XCircle size={18} className="shrink-0 text-(--destructive-ink)" />
          ) : (
            <Info size={18} className="shrink-0 text-(--accent)" />
          )}
          <span className="flex-1">{t.text}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

/* ---------- Canonical Stockly mark ----------
 * Stacked inventory bars — the Stockly app mark. Inherits
 * color via currentColor: place on an ink tile for lime, anywhere else
 * for a monochrome mark. Decorative (hidden from screen readers). */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="20" height="6" rx="3" fill="currentColor" />
      <rect x="9" y="13" width="20" height="6" rx="3" fill="currentColor" opacity="0.72" />
      <rect x="3" y="22" width="20" height="6" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/* ---------- Branded startup loader ----------
 * Covers first paint until the initial sync settles (or a min brand moment
 * passes). Fades out via the `fading` flag; the parent unmounts it after
 * the transition. Pure presentational — no data fetching. */
export function AppLoader({ status, fading }: { status: string; fading?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading Stockly"
      aria-hidden={fading || undefined}
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center bg-(--bg) px-8 transition-opacity duration-300 ${
 fading ? 'pointer-events-none opacity-0' : 'opacity-100'
 }`}
    >
      <span className="animate-pop-in flex h-20 w-20 items-center justify-center rounded-[calc(var(--radius-card) - 4px)] bg-(--primary) text-(--primary-foreground) shadow-[0_15px_40px_-14px_rgba(0,122,255,0.55)]">
        <BrandMark size={38} />
      </span>
      <h1 className="mt-5 text-[length:var(--fs-title1)] font-bold tracking-[-0.03em] text-(--ink)">Stockly</h1>
      <p className="mt-1 text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">Small-business inventory</p>
      <div className="mt-7 h-1.5 w-44 overflow-hidden rounded-[var(--radius-chip)] bg-(--stroke-dim)" aria-hidden="true">
        <div className="loader-bar h-full w-2/5 rounded-[var(--radius-chip)] bg-(--primary)" />
      </div>
      <p className="tnum mt-3.5 text-[length:var(--fs-caption)] font-medium text-(--ink-2)">{status}</p>
    </div>
  );
}

/* ---------- Small confirm ---------- */
export function Confirm({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="text-[length:var(--fs-subhead)] leading-relaxed text-(--ink-2)">{body}</p>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="press glass-soft min-h-[48px] rounded-[var(--radius-control)] py-3.5 text-[length:var(--fs-headline)] font-semibold text-(--ink)"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="press min-h-[48px] rounded-[var(--radius-control)] bg-(--destructive) py-3.5 text-[length:var(--fs-headline)] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.10)] disabled:opacity-50"
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

/* ---------- Action menu sheet (e.g. product row •••) ---------- */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  actions: { label: string; icon: React.ReactNode; danger?: boolean; onClick: () => void }[];
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-1.5 pb-2">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              onClose();
              a.onClick();
            }}
            className={`press flex w-full items-center gap-3 rounded-[var(--radius-row)] px-3.5 py-3 text-left text-[length:var(--fs-headline)] font-medium ${
 a.danger ? 'text-(--destructive-ink)' : 'text-(--ink)'
 } hover:bg-(--accent-soft)`}
          >
            <span
              className={`glass-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-icon)] ${
 a.danger ? 'text-(--destructive-ink)' : 'text-(--ink-2)'
 }`}
            >
              {a.icon}
            </span>
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function StockBadge({ kind }: { kind: 'IN' | 'OUT' }) {
  return kind === 'IN' ? (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-chip)] bg-(--success)/12 px-2.5 py-1 text-[length:var(--fs-caption)] font-semibold text-(--success-ink)">
      <ArrowDownToLine size={12} /> IN
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-chip)] bg-(--destructive)/12 px-2.5 py-1 text-[length:var(--fs-caption)] font-semibold text-(--destructive-ink)">
      <ArrowUpFromLine size={12} /> OUT
    </span>
  );
}


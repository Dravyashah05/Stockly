import React, { memo, useEffect, useRef, useState } from 'react';
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

/* ==========================================================================
   Dismiss plumbing shared by every overlay
   --------------------------------------------------------------------------
   - Escape closes the topmost overlay (web / desktop).
   - Android hardware Back closes the topmost overlay through a single global
     Capacitor listener routed via a stack, so a Confirm opened on top of a
     sheet dismisses one surface at a time.
   - Body scroll is locked while any overlay is open.
   ========================================================================== */

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
      /* web — the Escape handler below covers browsers */
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
      const i = dismissStack.indexOf(close);
      if (i >= 0) dismissStack.splice(i, 1);
      // Restore scroll only when no overlay remains.
      if (dismissStack.length === 0) document.body.style.overflow = prevOverflow;
      notifyOverlayChange();
    };
  }, [open]);
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

/* ==========================================================================
   Top app bar
   ========================================================================== */

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
    <header className="topbar">
      <div className="app-column flex w-full items-center gap-3 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="topbar-title truncate">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[length:var(--fs-body-sm)] text-(--on-surface-variant)">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
});

/** Top app bar with a leading back affordance — used by pushed sub-screens. */
export function SubScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="app-column flex w-full items-center gap-1 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="icon-btn -ml-2 shrink-0"
        >
          <BackArrow />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="topbar-title truncate">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[length:var(--fs-body-sm)] text-(--on-surface-variant)">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}

/** Lucide's ArrowLeft, kept local so sub-screen headers share one import. */
function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

/* ==========================================================================
   Bottom navigation bar (MD3)
   ========================================================================== */

export type TabKey = 'home' | 'products' | 'history' | 'settings';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: 'Home', icon: <Home size={22} /> },
  { key: 'products', label: 'Products', icon: <LayoutGrid size={22} /> },
  { key: 'history', label: 'History', icon: <History size={22} /> },
  { key: 'settings', label: 'Settings', icon: <SettingsIcon size={22} /> },
];

export const BottomNav = memo(function BottomNav({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  // Instant highlight: App routes tab switches through a transition so the new
  // screen renders in the background — the nav reacts before that settles.
  const [fast, setFast] = useState<TabKey>(tab);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => setFast(tab), [tab]);
  useEffect(() => {
    let disposed = false;
    let showListener: { remove: () => Promise<void> } | undefined;
    let hideListener: { remove: () => Promise<void> } | undefined;
    void import('@capacitor/keyboard')
      .then(async ({ Keyboard }) => {
        const show = await Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true));
        const hide = await Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false));
        if (disposed) {
          void show.remove();
          void hide.remove();
        } else {
          showListener = show;
          hideListener = hide;
        }
      })
      .catch(() => {
        /* Web builds may not have a native keyboard bridge. */
      });
    return () => {
      disposed = true;
      void showListener?.remove();
      void hideListener?.remove();
    };
  }, []);

  const pick = (t: TabKey) => {
    setFast(t);
    setTab(t);
  };

  return (
    <nav className={`bottom-nav ${keyboardOpen ? 'is-keyboard-open' : ''}`} aria-label="Main">
      <div className="bottom-nav-inner">
        {TABS.map((t) => {
          const active = fast === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => pick(t.key)}
              aria-label={t.label}
              aria-current={active ? 'page' : undefined}
              className="nav-item"
            >
              <span className="nav-indicator">{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
});

/* ==========================================================================
   Bottom sheet
   --------------------------------------------------------------------------
   Content-driven height: the panel grows with its content up to 86dvh, then
   the body scrolls internally. Edge-to-edge, consistent top corners + drag
   handle, outside-tap + Escape + Android-Back dismissal, safe-area aware.
   ========================================================================== */

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  label,
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
}) {
  useDismissable(open, onClose);

  // Swipe-down-to-close: drag ONLY from the header/handle zone (never the
  // scroll body, so list scrolling is untouched). Direct DOM transform for
  // 60-90Hz — no re-renders during the gesture.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef({ active: false, startY: 0, startT: 0, dy: 0 });
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
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={label || title}>
      <button aria-label="Close dialog" onClick={onClose} className="sheet-scrim animate-fade-in" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-md justify-center">
        <div ref={panelRef} className="sheet-panel animate-sheet-up flex max-h-[86dvh] w-full flex-col overflow-hidden">
          <div
            className="shrink-0 cursor-grab touch-none select-none px-5 pb-3 pt-3 active:cursor-grabbing"
            onPointerDown={(e) => {
              if (!e.isPrimary) return;
              // The close button lives inside this drag zone. Capturing the
              // pointer here would retarget pointerup/click to this div, so the
              // button's click would never fire. Leave interactive descendants alone.
              if (
                (e.target as HTMLElement | null)?.closest?.('button, a, input, select, textarea, [contenteditable="true"]')
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
              className={`sheet-handle mx-auto mb-3 ${handleTap ? 'w-10 bg-(--primary)' : ''}`}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[length:var(--fs-title-lg)] font-semibold tracking-[-0.01em] text-(--on-surface)">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 text-[length:var(--fs-body-sm)] text-(--on-surface-variant)">{subtitle}</p>
                ) : null}
              </div>
              <button type="button" onClick={onClose} aria-label="Close dialog" className="icon-btn -mr-2 -mt-2">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-(--outline-variant) px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ==========================================================================
   Dialog (MD3 basic dialog — used for confirmations)
   ========================================================================== */

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
  useDismissable(open, onCancel);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close dialog" onClick={onCancel} className="sheet-scrim animate-fade-in" />
      <div className="dialog-panel animate-dialog-in relative z-[1] w-full max-w-sm p-6">
        <h2 className="text-[length:var(--fs-headline-sm)] font-normal tracking-[-0.01em] text-(--on-surface)">{title}</h2>
        <p className="mt-4 text-[length:var(--fs-body-lg)] leading-relaxed text-(--on-surface-variant)">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn btn-text">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`btn ${confirmLabel === 'Log out' ? 'btn-danger-tonal' : 'btn-filled'}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ==========================================================================
   Action menu (product row •••) — a sheet of list rows
   ========================================================================== */

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
      <div className="group-list">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => {
              onClose();
              a.onClick();
            }}
            className={`group-row ${a.danger ? 'text-(--error)' : ''}`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-(--shape-full) ${
                a.danger ? 'bg-(--danger-container) text-(--on-danger-container)' : 'bg-(--surface-container-high) text-(--on-surface-variant)'
              }`}
            >
              {a.icon}
            </span>
            <span className="group-row-title">{a.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/* ==========================================================================
   Form primitives
   ========================================================================== */

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
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** Base class for every text input/select/textarea. Screens add layout-only
 *  utilities on top (e.g. `pl-11` when an icon is absolutely positioned). */
export const inputCls = 'input';

/* ==========================================================================
   Search
   ========================================================================== */

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
    <div className="search-field">
      <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--outline)" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label || placeholder}
        role="searchbox"
        className="input"
      />
    </div>
  );
});

/* ==========================================================================
   Segmented buttons (MD3)
   ========================================================================== */

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
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className="segmented-btn"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ==========================================================================
   Chips (filters)
   ========================================================================== */

export function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="chip shrink-0">
      {label}
      {typeof count === 'number' ? (
        <span className="tnum ml-0.5 rounded-(--shape-full) bg-(--surface-container-high) px-1.5 text-[length:var(--fs-label-sm)] text-(--on-surface-variant)">
          {count}
        </span>
      ) : null}
    </button>
  );
}

/* ==========================================================================
   Buttons
   ========================================================================== */

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
  /** Compact height for tight modal footers. */
  dense?: boolean;
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`btn btn-filled btn-block ${dense ? 'btn-sm' : ''}`}>
      {children}
    </button>
  );
}

/** Circular floating action button (MD3). */
export function Fab({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="fab">
      {children}
    </button>
  );
}

/* ==========================================================================
   Section heading
   ========================================================================== */

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <p className="section-label">{title}</p>
      {action}
    </div>
  );
}

/* ==========================================================================
   Empty / error / loading states
   ========================================================================== */

export function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="state-block">
      <div className="state-icon">{icon}</div>
      <p className="state-title">{title}</p>
      {hint ? <p className="state-hint">{hint}</p> : null}
    </div>
  );
}

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
    <div className="error-banner flex-col" role="alert">
      <p className="font-medium leading-relaxed">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} disabled={retrying} className="btn btn-text -ml-3 mt-1 self-start">
          <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      ) : null}
    </div>
  );
}

export const SkeletonRow = memo(function SkeletonRow({ h = 76 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} />;
});

/* ==========================================================================
   Sync status banner (optimistic writes)
   --------------------------------------------------------------------------
   Fixed above the bottom nav: shows "Saving…" while unconfirmed writes are in
   flight, and unsaved changes with an explicit Retry (never auto-retried).
   Rendered via portal so no ancestor transform can trap it.
   ========================================================================== */

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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-height)+1rem)] z-30 mx-auto flex max-w-md flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom,0px)]">
      {pending > 0 ? (
        <div className="snackbar animate-toast-in pointer-events-auto">
          <RefreshCw size={16} className="shrink-0 animate-spin text-(--inverse-primary)" />
          <span className="flex-1">
            Saving… {pending} change{pending === 1 ? '' : 's'} syncing to Google Sheets
          </span>
        </div>
      ) : null}
      {failed.map((f) => (
        <div key={f.key} role="alert" className="animate-toast-in pointer-events-auto w-full rounded-(--shape-md) bg-(--danger-container) p-4 text-(--on-danger-container) shadow-(--elev-2)">
          <p className="text-[length:var(--fs-body-md)] font-semibold">Unsaved: {f.label}</p>
          <p className="mt-0.5 truncate text-[length:var(--fs-body-sm)]">{f.detail}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onRetry(f.key)}
              className="btn btn-sm btn-filled"
            >
              <RotateCcw size={15} /> Retry
            </button>
            <button type="button" onClick={() => onDismiss(f.key)} className="btn btn-sm btn-outline">
              Discard
            </button>
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
});

/* ==========================================================================
   Snackbars
   ========================================================================== */

export function Toasts({ toasts, onDismiss, lifted }: { toasts: ToastMsg[]; onDismiss: (id: number) => void; lifted?: boolean }) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div
      className={`pointer-events-none fixed inset-x-0 z-[90] mx-auto flex max-w-md flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom,0px)] ${
        lifted ? 'bottom-[calc(var(--nav-height)+4.5rem)]' : 'bottom-[calc(var(--nav-height)+1rem)]'
      }`}
    >
      {toasts.map((t) => (
        <button key={t.id} type="button" onClick={() => onDismiss(t.id)} className="snackbar animate-toast-in pointer-events-auto">
          {t.kind === 'success' ? (
            <CheckCircle2 size={18} className="shrink-0 text-(--success-strong)" />
          ) : t.kind === 'error' ? (
            <XCircle size={18} className="shrink-0 text-(--inverse-primary)" />
          ) : (
            <Info size={18} className="shrink-0 text-(--inverse-primary)" />
          )}
          <span className="flex-1">{t.text}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

/* ==========================================================================
   Brand
   ========================================================================== */

/** Canonical Stockly mark — stacked inventory bars. Inherits color via
 *  currentColor. Decorative (hidden from screen readers). */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="20" height="6" rx="3" fill="currentColor" />
      <rect x="9" y="13" width="20" height="6" rx="3" fill="currentColor" opacity="0.72" />
      <rect x="3" y="22" width="20" height="6" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Branded startup loader. Covers first paint until the initial sync settles
 *  (or a minimum brand moment passes). Purely presentational. */
export function AppLoader({ status, fading }: { status: string; fading?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading Stockly"
      aria-hidden={fading || undefined}
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center bg-(--surface) px-8 transition-opacity duration-300 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <span className="animate-pop-in flex h-20 w-20 items-center justify-center rounded-(--shape-xl) bg-(--primary-container) text-(--on-primary-container)">
        <BrandMark size={38} />
      </span>
      <h1 className="mt-5 text-[length:var(--fs-headline-sm)] font-semibold tracking-[-0.02em] text-(--on-surface)">Stockly</h1>
      <p className="mt-1 text-[length:var(--fs-body-md)] text-(--on-surface-variant)">Small-business inventory</p>
      <div className="progress-track mt-7 w-44" aria-hidden="true">
        <div className="progress-bar" />
      </div>
      <p className="tnum mt-4 text-[length:var(--fs-body-sm)] text-(--on-surface-variant)">{status}</p>
    </div>
  );
}

/* ==========================================================================
   Stock movement badge
   ========================================================================== */

export function StockBadge({ kind }: { kind: 'IN' | 'OUT' }) {
  const isIn = kind === 'IN';
  return (
    <span className={`badge ${isIn ? 'badge-success' : 'badge-danger'}`}>
      {isIn ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
      {isIn ? 'In' : 'Out'}
    </span>
  );
}

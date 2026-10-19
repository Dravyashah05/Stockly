import React, { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  Cloud,
  History,
  Home,
  Info,
  LayoutGrid,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Settings as SettingsIcon,
  X,
  XCircle,
} from 'lucide-react';
import type { ToastMsg } from '@stockly/shared-types';

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

/* ---------- Floating glass app header (no refresh button — sync lives
 * in Settings > Cloud database and runs automatically) ---------- */
export const Header = memo(function Header({
  title,
  subtitle,
  right,
  indicator = false,
}: {
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  indicator?: boolean;
}) {
  return (
    <header className="safe-top sticky top-0 z-20 px-4 pt-4 pb-2 bg-transparent pointer-events-none">
      <div className="mx-auto flex max-w-md items-center gap-3 pointer-events-auto">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-[22px] font-extrabold leading-tight tracking-tight text-(--ink)">
            {indicator ? (
              <span aria-hidden="true" className="h-[18px] w-[5px] shrink-0 rounded-full bg-[#C7FF4D]" />
            ) : null}
            <span className="min-w-0 truncate">{title}</span>
          </h1>
          {subtitle ? (
            <div className="mt-0.5 truncate text-[11.5px] font-medium text-(--ink-2)">{subtitle}</div>
          ) : null}
        </div>
        {right}
      </div>
    </header>
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
  useEffect(() => setFast(tab), [tab]);
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
    <nav className="bottom-navigation nav-bottom-offset pointer-events-none fixed inset-x-0 z-30 px-4">
      <div className="glass-nav pointer-events-auto relative mx-auto grid max-w-md grid-cols-4 gap-0.5 rounded-[28px] p-1.5">
        {/* Sliding active pill — solid ink (lime in dark mode). */}
        {pill ? (
          <span
            aria-hidden="true"
            className="nav-slide-pill absolute left-0 top-1.5 rounded-[22px] bg-(--primary)"
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
              className={`nav-pill relative z-[1] flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-[22px] text-[10.5px] font-semibold ${
                active ? 'text-(--primary-foreground)' : 'text-(--ink-3)'
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

const SIDE_LINKS: { key: TabKey | 'stock-in' | 'stock-out'; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: 'Dashboard', icon: <Home size={18} /> },
  { key: 'products', label: 'Products', icon: <Boxes size={18} /> },
  { key: 'stock-in', label: 'Stock In', icon: <ArrowDownToLine size={18} /> },
  { key: 'stock-out', label: 'Stock Out', icon: <ArrowUpFromLine size={18} /> },
  { key: 'history', label: 'Transaction History', icon: <History size={18} /> },
  { key: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
];

export function DesktopSidebar({
  tab,
  onNavigate,
  onStock,
  collapsed,
}: {
  tab: TabKey;
  onNavigate: (tab: TabKey) => void;
  onStock: (mode: 'IN' | 'OUT') => void;
  collapsed?: boolean;
}) {
  const renderLinks = (items: typeof SIDE_LINKS) =>
    items.map((item) => {
      const selected = item.key === 'stock-in' || item.key === 'stock-out' ? false : tab === item.key;
      return (
        <button
          key={item.key}
          type="button"
          title={item.label}
          aria-current={selected ? 'page' : undefined}
          onClick={() => {
            if (item.key === 'stock-in') onStock('IN');
            else if (item.key === 'stock-out') onStock('OUT');
            else onNavigate(item.key);
          }}
          className={`desktop-side-link ${selected ? 'is-active' : ''}`}
        >
          {item.icon}
          <span className="desktop-side-label">{item.label}</span>
        </button>
      );
    });
  return (
    <aside
      className={`desktop-sidebar ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Main navigation"
      aria-hidden={collapsed || undefined}
    >
      <div className="desktop-brand">
        <span aria-hidden="true" className="desktop-brand-mark"><BrandMark size={22} /></span>
        <span>Stockly</span>
      </div>
      <p className="desktop-nav-caption">Workspace</p>
      <nav className="desktop-side-links" aria-label="Workspace">
        {renderLinks(SIDE_LINKS.filter((i) => i.key !== 'stock-in' && i.key !== 'stock-out'))}
      </nav>
      <p className="desktop-nav-caption">Actions</p>
      <nav className="desktop-side-links" aria-label="Quick stock actions">
        {renderLinks(SIDE_LINKS.filter((i) => i.key === 'stock-in' || i.key === 'stock-out'))}
      </nav>
      <div className="desktop-sidebar-foot">
        <span className="desktop-sidebar-foot-icon"><PackagePlus size={18} /></span>
        <span><b>Stockly</b><small>Inventory workspace</small></span>
      </div>
    </aside>
  );
}

export function DesktopToolbar({
  title,
  online,
  pending,
  failed,
  lastSync,
  sideCollapsed,
  onToggleSidebar,
}: {
  title: string;
  online: boolean;
  pending: number;
  failed: number;
  lastSync: Date | null;
  sideCollapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  const syncLabel = failed > 0 ? `${failed} sync issue${failed === 1 ? '' : 's'}` : !online ? 'Offline' : pending > 0 ? `${pending} changes syncing` : lastSync ? `Synced ${lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet';
  return (
    <header className="desktop-toolbar">
      {onToggleSidebar ? (
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-expanded={!sideCollapsed}
          aria-label={sideCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          title={sideCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          className="desktop-sidebar-toggle"
        >
          {sideCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      ) : null}
      <div className="desktop-toolbar-heading">
        <span className="desktop-toolbar-eyebrow">Stockly / Workspace</span>
        <h1>{title}</h1>
      </div>
      <div className={`desktop-sync-indicator ${failed ? 'has-error' : !online ? 'is-offline' : ''}`} role="status" aria-live="polite">
        <Cloud size={16} />
        <span className="desktop-sync-dot" />
        <span>{syncLabel}</span>
      </div>
    </header>
  );
}

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
      <button aria-label="Close dialog" onClick={onClose} className={`animate-fade-in absolute inset-0 ${backdropCls || 'bg-black/50 backdrop-blur-md'}`} />
      <div className="sheet-dialog-position absolute inset-x-0 bottom-0 mx-auto flex max-w-md justify-center">
        <div
          ref={panelRef}
          className="sheet-dialog-panel glass-strong animate-sheet-up flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-[28px] border-b-0 border-x-0"
        >
          <div
            className="shrink-0 cursor-grab touch-none select-none px-5 pb-2.5 pt-2.5 active:cursor-grabbing"
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
              className={`sheet-handle mx-auto mb-2 h-1.5 rounded-full transition-all duration-200 ease-out ${
                handleTap ? 'w-16 bg-(--accent)' : 'w-10 bg-(--ink-3)/40'
              }`}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[16px] font-bold tracking-tight text-(--ink)">{title}</h2>
                {subtitle ? (
                  <p className="truncate text-[12.5px] font-medium text-(--ink-2)">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="press glass-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-(--ink-2)"
              >
                <X size={18} />
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
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-(--ink)">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-(--ink-2)">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  'min-h-[48px] w-full rounded-2xl border border-(--stroke-dim) bg-(--field) backdrop-blur-md px-4 py-3 text-[15px] text-(--ink) outline-none transition placeholder:text-(--ink-3) focus:border-(--accent) focus:ring-[3px] focus:ring-(--accent-soft)';

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
          className="min-h-12 w-full rounded-2xl border border-(--stroke-dim) bg-(--field) backdrop-blur-md py-2.5 pl-10 pr-4 text-[16px] text-(--ink) outline-none transition focus:border-(--accent) focus:ring-[3px] focus:ring-(--accent-soft) placeholder:text-(--ink-3)"
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
    <div className="glass-soft grid auto-cols-fr grid-flow-col gap-1 rounded-2xl p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`chip-glass rounded-xl py-2 text-[13px] font-bold ${
            value === o.key ? 'bg-(--accent-soft) text-(--accent)' : 'text-(--ink-2)'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Shared section heading ---------- */
export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <p className="text-[13px] font-bold uppercase tracking-wide text-(--ink-2)">{title}</p>
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
    <div className="glass rounded-2xl border-rose-500/25 px-4 py-4" role="alert">
      <p className="text-[13.5px] font-medium leading-relaxed text-rose-600 dark:text-rose-300">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="press glass-soft mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl text-[14px] font-bold text-(--ink) disabled:opacity-50"
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
      className={`press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-(--primary) text-[15px] font-bold text-(--primary-foreground) disabled:opacity-50 ${dense ? 'py-3' : 'py-4'}`}
    >
      {children}
    </button>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="glass flex flex-col items-center gap-2 rounded-3xl px-6 py-10 text-center">
      <div className="glass-soft mb-1 flex h-13 w-13 items-center justify-center rounded-2xl p-3 text-(--ink-2)">
        {icon}
      </div>
      <p className="text-[15px] font-semibold text-(--ink)">{title}</p>
      {hint ? <p className="max-w-[28ch] text-[13px] leading-relaxed text-(--ink-2)">{hint}</p> : null}
    </div>
  );
}

/* ---------- Loading skeletons ---------- */
export const SkeletonRow = memo(function SkeletonRow({ h = 76 }: { h?: number }) {
  return <div className="shimmer rounded-3xl border border-(--stroke-dim)" style={{ height: h }} />;
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
        <div className="glass-strong animate-toast-in pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-[13px] font-semibold text-(--ink)">
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
          className="glass-strong animate-toast-in pointer-events-auto w-full rounded-2xl border-rose-500/30 px-4 py-3"
        >
          <p className="text-[13px] font-bold text-(--ink)">Unsaved: {f.label}</p>
          <p className="mt-0.5 truncate text-[12px] text-(--ink-2)">{f.detail}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onRetry(f.key)}
              className="press flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl bg-[#151515] text-[13.5px] font-extrabold text-white dark:bg-[#C7FF4D] dark:text-[#151515]"
            >
              <RotateCcw size={16} /> Retry
            </button>
            <button
              type="button"
              onClick={() => onDismiss(f.key)}
              className="press glass-soft min-h-[44px] rounded-2xl text-[13.5px] font-bold text-(--ink-2)"
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
          className="glass-strong animate-toast-in pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-[13.5px] font-medium text-(--ink)"
        >
          {t.kind === 'success' ? (
            <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
          ) : t.kind === 'error' ? (
            <XCircle size={18} className="shrink-0 text-rose-500" />
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
 * Stacked inventory bars — same geometry as the website logo. Inherits
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
      <span className="animate-pop-in flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#151515] text-[#C7FF4D]">
        <BrandMark size={38} />
      </span>
      <h1 className="mt-5 text-[26px] font-extrabold tracking-tight text-(--ink)">Stockly</h1>
      <p className="mt-1 text-[13px] font-medium text-(--ink-2)">Small-business inventory</p>
      <div className="mt-7 h-1.5 w-44 overflow-hidden rounded-full bg-(--stroke-dim)" aria-hidden="true">
        <div className="loader-bar h-full w-2/5 rounded-full bg-[#151515] dark:bg-[#C7FF4D]" />
      </div>
      <p className="tnum mt-3.5 text-[12.5px] font-semibold text-(--ink-2)">{status}</p>
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
      <p className="text-[14px] leading-relaxed text-(--ink-2)">{body}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="press glass-soft min-h-[48px] rounded-2xl py-3.5 text-[15px] font-bold text-(--ink)"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="press min-h-[48px] rounded-2xl bg-[#C2332D] py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
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
            className={`press flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-semibold ${
              a.danger ? 'text-rose-600 dark:text-rose-400' : 'text-(--ink)'
            } hover:bg-(--accent-soft)`}
          >
            <span className="glass-soft flex h-9 w-9 items-center justify-center rounded-xl">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function StockBadge({ kind }: { kind: 'IN' | 'OUT' }) {
  return kind === 'IN' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
      <ArrowDownToLine size={12} /> IN
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-300">
      <ArrowUpFromLine size={12} /> OUT
    </span>
  );
}

/* ---------- Liquid Glass aliases (same components, spec names) ---------- */
export const GlassHeader = Header;
export const GlassBottomNavigation = BottomNav;
export const GlassBottomSheet = Sheet;
export const GlassDialog = Confirm;
export const GlassInputCls = inputCls;
export const GlassSearchBar = SearchBar;
export const GlassToast = Toasts;
export const GlassSyncStatus = SyncStatus;
export const GlassEmptyState = EmptyState;
export const GlassErrorState = ErrorState;
export const GlassSkeleton = SkeletonRow;

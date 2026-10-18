/* Small hooks shared by the Liquid Glass overlays and popovers.
 * Kept in a .ts file (no JSX) so components stay fast-refresh friendly. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/* ========================================================================== *
 * Focus management
 * ========================================================================== */

/** Everything that can receive keyboard focus inside a container. */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function focusableWithin(container: HTMLElement): HTMLElement[] {
  const found = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return found.filter((el) => !el.closest('[aria-hidden="true"]'));
}

export interface FocusTrapOptions {
  /** Element focused when the trap activates (defaults to the container). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Move focus back where it came from on deactivate (default `true`). */
  restoreFocus?: boolean;
}

/**
 * Traps Tab / Shift+Tab inside `containerRef` while `active`, focuses it on
 * activate and restores the previously focused element on deactivate.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options: FocusTrapOptions = {},
): void {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const doc = container.ownerDocument;
    const previouslyFocused = doc.activeElement as HTMLElement | null;

    const frame = requestAnimationFrame(() => {
      const target = optionsRef.current.initialFocusRef?.current ?? container;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const items = focusableWithin(container);
      if (items.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = doc.activeElement as HTMLElement | null;
      const inside = current !== null && container.contains(current);
      if (event.shiftKey) {
        if (!inside || current === first || current === container) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    doc.addEventListener('keydown', onKeyDown, true);
    return () => {
      doc.removeEventListener('keydown', onKeyDown, true);
      cancelAnimationFrame(frame);
      if (optionsRef.current.restoreFocus !== false && previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef]);
}

/* ========================================================================== *
 * Outside interaction
 * ========================================================================== */

/**
 * Calls `onOutside` for a pointer press that lands outside every listed ref.
 * The refs and handler are read from refs, so identity churn never
 * re-subscribes the listener.
 */
export function useClickOutside(
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  onOutside: () => void,
  active = true,
): void {
  const refsRef = useRef(refs);
  const handlerRef = useRef(onOutside);
  useEffect(() => {
    refsRef.current = refs;
    handlerRef.current = onOutside;
  });

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || !target.isConnected) return;
      for (const ref of refsRef.current) {
        const el = ref.current;
        if (el && el.contains(target)) return;
      }
      handlerRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [active]);
}

/* ========================================================================== *
 * Overlay dismiss stack: Escape + body scroll lock
 * ========================================================================== */

interface OverlayEntry {
  close: () => void;
}

/** Topmost-first stack so nested overlays dismiss one at a time. */
const overlayStack: OverlayEntry[] = [];
let scrollLocks = 0;
let previousBodyOverflow = '';

function lockScroll(doc: Document): void {
  if (scrollLocks === 0) {
    previousBodyOverflow = doc.body.style.overflow;
    doc.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
}

function unlockScroll(doc: Document): void {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) doc.body.style.overflow = previousBodyOverflow;
}

/** True while any overlay that used {@link useOverlayDismiss} is open. */
export function hasOpenOverlay(): boolean {
  return overlayStack.length > 0;
}

export interface OverlayDismissOptions {
  /** Handle Escape (default `true`). */
  escape?: boolean;
  /** Lock body scroll while open (default `true`). */
  scrollLock?: boolean;
}

/**
 * Registers an open overlay: Escape closes only the topmost one, and the
 * body scroll lock is reference-counted across stacked overlays.
 *
 * Android hardware Back stays the host app's concern (the apps route
 * Capacitor's `backButton` through their own dismiss stack); this package
 * deliberately has no native dependency.
 */
export function useOverlayDismiss(
  open: boolean,
  onClose: () => void,
  options: OverlayDismissOptions = {},
): void {
  const closeRef = useRef(onClose);
  const optionsRef = useRef(options);
  useEffect(() => {
    closeRef.current = onClose;
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!open) return;
    const entry: OverlayEntry = { close: () => closeRef.current() };
    overlayStack.push(entry);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (optionsRef.current.escape === false) return;
      if (overlayStack[overlayStack.length - 1] !== entry) return;
      event.stopPropagation();
      entry.close();
    };
    document.addEventListener('keydown', onKeyDown);

    if (optionsRef.current.scrollLock !== false) lockScroll(document);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = overlayStack.indexOf(entry);
      if (index >= 0) overlayStack.splice(index, 1);
      if (optionsRef.current.scrollLock !== false) unlockScroll(document);
    };
  }, [open]);
}

/* ========================================================================== *
 * System preferences
 * ========================================================================== */

/** Reactive `prefers-reduced-motion` flag (SSR-safe default: `false`). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

/* ========================================================================== *
 * Portal positioning (popover / menu)
 * ========================================================================== */

export type PortalAlign = 'start' | 'center' | 'end';

export interface PortalPositionOptions {
  /** Gap between the anchor and the panel (default `8`). */
  gap?: number;
  /** Horizontal alignment relative to the anchor (default `'start'`). */
  align?: PortalAlign;
  /** Minimum distance from viewport edges (default `8`). */
  margin?: number;
  /** Flip above the anchor when there is not enough room below (default `true`). */
  flip?: boolean;
}

export interface PortalPosition {
  top: number;
  left: number;
  /** `0` during the measure pass so the panel is focusable but invisible. */
  opacity: 0 | 1;
  placement: 'bottom' | 'top';
}

/**
 * Fixed-position coordinates for a portal panel anchored to `anchorRef`:
 * measures on activate (requestAnimationFrame → single re-render), flips
 * when the viewport is tight, clamps to the viewport, and re-measures on
 * resize / scroll (capture, so nested scrollers count too).
 */
export function usePortalPosition(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
  options: PortalPositionOptions = {},
): PortalPosition {
  const [position, setPosition] = useState<PortalPosition>({
    top: 0,
    left: 0,
    opacity: 0,
    placement: 'bottom',
  });
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const { gap = 8, align = 'start', margin = 8, flip = true } = optionsRef.current;

    const rect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const roomBelow = viewportH - rect.bottom - gap;
    const roomAbove = rect.top - gap;
    const placement: 'bottom' | 'top' =
      flip && height > roomBelow && roomAbove > roomBelow ? 'top' : 'bottom';

    let top = placement === 'bottom' ? rect.bottom + gap : rect.top - height - gap;
    let left: number;
    if (align === 'start') left = rect.left;
    else if (align === 'end') left = rect.right - width;
    else left = rect.left + (rect.width - width) / 2;

    // Horizontal flip + clamp inside the viewport.
    if (left + width > viewportW - margin) left = viewportW - margin - width;
    if (left < margin) left = margin;
    // Vertical clamp (only when the panel simply cannot fit anywhere).
    if (top > viewportH - height - margin) top = Math.max(margin, viewportH - height - margin);
    if (top < margin) top = margin;

    setPosition((prev) =>
      prev.top === top && prev.left === left && prev.opacity === 1 && prev.placement === placement
        ? prev
        : { top, left, opacity: 1, placement },
    );
  }, [anchorRef, panelRef]);

  useLayoutEffect(() => {
    if (!active) return;
    // Synchronous first pass: layout is complete during the commit, and a
    // layout-effect setState is flushed before paint — no stale frame at
    // the previous position (reopen after scrolling, etc.).
    measure();
    let frame = requestAnimationFrame(measure);
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [active, measure]);

  return position;
}

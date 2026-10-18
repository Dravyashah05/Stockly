/* GlassBottomSheet + GlassDialog — portalled overlays with shared a11y:
 * focus trap, Escape (topmost wins), reference-counted body scroll lock,
 * scrim dismissal, and safe-area / dvh sizing handled in styles.css. */

import { useId, useRef } from 'react';
import type { ComponentPropsWithRef, CSSProperties, PointerEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { stkJoin } from './classes.ts';
import { useFocusTrap, useOverlayDismiss, usePrefersReducedMotion } from './hooks.ts';
import { IconButton } from './button.tsx';
import { IconClose } from './icons.tsx';

/* ========================================================================== *
 * GlassBottomSheet
 * ========================================================================== */

export interface GlassBottomSheetProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small supporting line under the title. */
  subtitle?: ReactNode;
  /** Optional actions kept outside the scrollable body. */
  footer?: ReactNode;
  /** Accessible name override (defaults to the title). */
  label?: string;
  /** Panel `max-height` override (default: `86dvh` with a `vh` fallback). */
  maxHeight?: string;
  /** Drag handle above the header (default `true`). */
  showHandle?: boolean;
  /** Round close button in the header (default `true`). */
  showCloseButton?: boolean;
  /** Accessible name of the close affordances (default `"Close dialog"`). */
  closeLabel?: string;
  /** Tap-the-scrim dismissal (default `true`). */
  dismissOnScrimClick?: boolean;
  /** Drag-the-handle-down dismissal with a fling threshold (default `true`). */
  dragToDismiss?: boolean;
  /** Focused when the sheet opens (defaults to the panel). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** `className`/`style` style the panel; `overlay*` style the root. */
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
}

/**
 * Edge-to-edge bottom sheet: content-driven height (grows to `maxHeight`,
 * then the body scrolls), pointer-drag to dismiss, spring entrance that
 * becomes instant under `prefers-reduced-motion`.
 */
export function GlassBottomSheet({
  open,
  onClose,
  title,
  subtitle,
  footer,
  label,
  maxHeight,
  showHandle = true,
  showCloseButton = true,
  closeLabel = 'Close dialog',
  dismissOnScrimClick = true,
  dragToDismiss = true,
  initialFocusRef,
  overlayClassName,
  overlayStyle,
  className,
  style,
  children,
  ...rest
}: GlassBottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startY: 0, startT: 0, dy: 0 });
  const titleId = useId();
  const reducedMotion = usePrefersReducedMotion();

  useOverlayDismiss(open, onClose);
  useFocusTrap(open, panelRef, { initialFocusRef });

  const setPanelY = (dy: number, animate: boolean) => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transition = animate ? 'transform var(--motion-standard) var(--ease-spring)' : 'none';
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
  };

  const dragEnd = () => {
    const state = drag.current;
    if (!state.active) return;
    state.active = false;
    const velocity = state.dy / Math.max(1, performance.now() - state.startT);
    if (state.dy > 110 || (state.dy > 40 && velocity > 0.6)) {
      if (reducedMotion || typeof window === 'undefined') {
        onClose();
        return;
      }
      // Fling the panel out, then close.
      setPanelY(window.innerHeight, true);
      window.setTimeout(onClose, 170);
    } else {
      setPanelY(0, true);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      {...rest}
      className={stkJoin('stk-overlay', overlayClassName)}
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-labelledby={label === undefined ? titleId : undefined}
      data-sheet-title={typeof title === 'string' ? title : undefined}
    >
      <div
        className="stk-scrim"
        aria-hidden="true"
        onClick={dismissOnScrimClick ? onClose : undefined}
      />
      <div className="stk-sheet-position">
        <div
          ref={panelRef}
          tabIndex={-1}
          className={stkJoin('stk-sheet', 'stk-glass', 'stk-glass--strong', className)}
          style={{ maxHeight, ...style }}
        >
          <div
            className="stk-sheet__grab"
            onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
              if (!dragToDismiss || event.button !== 0 || !event.isPrimary) return;
              // Leave interactive descendants (close button, links…) alone —
              // pointer capture here would retarget their click.
              const target = event.target as HTMLElement | null;
              if (target?.closest?.('button, a, input, select, textarea, [contenteditable="true"]')) {
                return;
              }
              event.currentTarget.setPointerCapture?.(event.pointerId);
              drag.current = {
                active: true,
                startY: event.clientY,
                startT: performance.now(),
                dy: 0,
              };
              setPanelY(0, false);
            }}
            onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
              const state = drag.current;
              if (!state.active || !event.isPrimary) return;
              state.dy = Math.max(0, event.clientY - state.startY);
              setPanelY(state.dy, false);
            }}
            onPointerUp={dragEnd}
            onPointerCancel={() => {
              drag.current.active = false;
              setPanelY(0, true);
            }}
          >
            {showHandle ? <div className="stk-sheet__handle" aria-hidden="true" /> : null}
            <div className="stk-sheet__head">
              <div className="stk-sheet__titles">
                <h2 id={titleId} className="stk-sheet__title">
                  {title}
                </h2>
                {subtitle !== undefined && subtitle !== null && subtitle !== false ? (
                  <p className="stk-sheet__subtitle">{subtitle}</p>
                ) : null}
              </div>
              {showCloseButton ? (
                <IconButton
                  label={closeLabel}
                  variant="onSurface"
                  className="stk-sheet__close"
                  onClick={onClose}
                >
                  <IconClose size={18} />
                </IconButton>
              ) : null}
            </div>
          </div>
          <div className="stk-sheet__body stk-scroll">{children}</div>
          {footer !== undefined && footer !== null && footer !== false ? (
            <div className="stk-sheet__footer">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Alias for {@link GlassBottomSheet}. */
export const BottomSheet = GlassBottomSheet;

/* ========================================================================== *
 * GlassDialog
 * ========================================================================== */

export type DialogSize = 'sm' | 'md' | 'lg';

export interface GlassDialogProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Supporting paragraph under the title (wired to `aria-describedby`). */
  description?: ReactNode;
  /** Optional actions pinned to the bottom. */
  footer?: ReactNode;
  /** Accessible name override (defaults to the title). */
  label?: string;
  /** Width class: `sm` 360px, `md` 448px, `lg` 720px (default `md`). */
  size?: DialogSize;
  /** Round close button in the header (default `true`). */
  showCloseButton?: boolean;
  /** Accessible name of the close affordances (default `"Close dialog"`). */
  closeLabel?: string;
  /** Tap-the-scrim dismissal (default `true`). */
  dismissOnScrimClick?: boolean;
  /** Focused when the dialog opens (defaults to the panel). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** `className`/`style` style the panel; `overlay*` style the root. */
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
}

/** Centred glass modal with the same a11y contract as the sheet. */
export function GlassDialog({
  open,
  onClose,
  title,
  description,
  footer,
  label,
  size = 'md',
  showCloseButton = true,
  closeLabel = 'Close dialog',
  dismissOnScrimClick = true,
  initialFocusRef,
  overlayClassName,
  overlayStyle,
  className,
  style,
  children,
  ...rest
}: GlassDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = `stk-dialog-desc-${titleId}`;

  useOverlayDismiss(open, onClose);
  useFocusTrap(open, panelRef, { initialFocusRef });

  if (!open || typeof document === 'undefined') return null;

  const hasDescription = description !== undefined && description !== null && description !== false;

  return createPortal(
    <div
      {...rest}
      className={stkJoin('stk-overlay', overlayClassName)}
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-labelledby={label === undefined ? titleId : undefined}
      aria-describedby={hasDescription ? descriptionId : undefined}
    >
      <div
        className="stk-scrim"
        aria-hidden="true"
        onClick={dismissOnScrimClick ? onClose : undefined}
      />
      <div className="stk-dialog-position">
        <div
          ref={panelRef}
          tabIndex={-1}
          className={stkJoin('stk-dialog', `stk-dialog--${size}`, 'stk-glass', 'stk-glass--strong', className)}
          style={style}
        >
          <div className="stk-dialog__head">
            <div className="stk-dialog__titles">
              <h2 id={titleId} className="stk-dialog__title">
                {title}
              </h2>
              {hasDescription ? (
                <p id={descriptionId} className="stk-dialog__desc">
                  {description}
                </p>
              ) : null}
            </div>
            {showCloseButton ? (
              <IconButton label={closeLabel} variant="ghost" onClick={onClose}>
                <IconClose size={18} />
              </IconButton>
            ) : null}
          </div>
          {children !== undefined && children !== null && children !== false ? (
            <div className="stk-dialog__body stk-scroll">{children}</div>
          ) : null}
          {footer !== undefined && footer !== null && footer !== false ? (
            <div className="stk-dialog__footer">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Alias for {@link GlassDialog}. */
export const Dialog = GlassDialog;

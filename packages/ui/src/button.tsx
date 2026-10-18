/* GlassButton, IconButton — the Liquid Glass control family. */

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { stkJoin } from './classes.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface GlassButtonProps extends ComponentPropsWithRef<'button'> {
  /** Visual emphasis (default `primary`). */
  variant?: ButtonVariant;
  /** Height: `sm` 44px (touch minimum), `md` 48px, `lg` 56px. */
  size?: ButtonSize;
  /** Shows a spinner, marks the button `aria-busy` and blocks clicks. */
  loading?: boolean;
  /** Leading decorative node (icon); hidden from assistive tech. */
  iconStart?: ReactNode;
  /** Trailing decorative node (icon); hidden from assistive tech. */
  iconEnd?: ReactNode;
  /** Stretch to the container width. */
  fullWidth?: boolean;
}

/**
 * Pill-free glass button. `type` defaults to `"button"` (never implicit
 * submit), and `loading` implies `disabled` + `aria-busy`.
 */
export function GlassButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconStart,
  iconEnd,
  fullWidth,
  className,
  style,
  children,
  disabled,
  type,
  onClick,
  ...rest
}: GlassButtonProps) {
  const isDisabled = disabled === true || loading;
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      className={stkJoin(
        'stk-btn',
        `stk-btn--${variant}`,
        `stk-btn--${size}`,
        fullWidth && 'stk-btn--block',
        loading && 'is-loading',
        className,
      )}
      style={style}
      disabled={isDisabled}
      aria-busy={loading ? true : rest['aria-busy']}
      onClick={loading ? undefined : onClick}
    >
      {loading ? (
        <span className="stk-spinner" aria-hidden="true" />
      ) : iconStart !== undefined && iconStart !== null ? (
        <span className="stk-btn__icon" aria-hidden="true">
          {iconStart}
        </span>
      ) : null}
      {children !== undefined && children !== null && children !== false ? (
        <span className="stk-btn__label">{children}</span>
      ) : null}
      {!loading && iconEnd !== undefined && iconEnd !== null ? (
        <span className="stk-btn__icon" aria-hidden="true">
          {iconEnd}
        </span>
      ) : null}
    </button>
  );
}

/** Alias for {@link GlassButton}. */
export const Button = GlassButton;

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'aria-label'> {
  /** Required accessible name — applied as `aria-label` (tooltip text via `title` if you pass it). */
  label: string;
  /** Height/width: `sm` 44px, `md` 48px, `lg` 56px (all ≥ the touch minimum). */
  size?: ButtonSize;
  /** Surface treatment (default `ghost`). */
  variant?: 'ghost' | 'solid' | 'onSurface';
  /** Stretch to the container width (rare — icon only). */
  fullWidth?: boolean;
}

/** Icon-only button: the `label` prop becomes the `aria-label`, so screen
 *  readers announce it exactly like a text button. */
export function IconButton({
  label,
  size = 'sm',
  variant = 'ghost',
  fullWidth,
  className,
  style,
  children,
  disabled,
  type,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      aria-label={label}
      className={stkJoin(
        'stk-icon-btn',
        `stk-icon-btn--${size}`,
        `stk-icon-btn--${variant}`,
        fullWidth && 'stk-btn--block',
        className,
      )}
      style={style}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

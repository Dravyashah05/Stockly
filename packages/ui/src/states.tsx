/* Empty / loading / error presentation states shared by every list view. */

import type { ComponentPropsWithRef, CSSProperties, ReactNode } from 'react';
import { stkJoin, stkSpinner } from './classes.ts';
import { GlassButton } from './button.tsx';
import { IconRefresh } from './icons.tsx';

/* ========================================================================== *
 * EmptyState
 * ========================================================================== */

export interface EmptyStateProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  /** Call-to-action rendered under the hint (e.g. an add-product button). */
  action?: ReactNode;
}

/** Centred "nothing here yet" card. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
  style,
  children,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      {...rest}
      className={stkJoin('stk-empty', 'stk-glass', className)}
      style={style}
    >
      {icon !== undefined && icon !== null ? (
        <div className="stk-empty__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="stk-empty__title">{title}</p>
      {hint !== undefined && hint !== null && hint !== false ? (
        <p className="stk-empty__hint">{hint}</p>
      ) : null}
      {action !== undefined && action !== null && action !== false ? (
        <div className="stk-empty__action">{action}</div>
      ) : null}
      {children}
    </div>
  );
}

/* ========================================================================== *
 * LoadingState
 * ========================================================================== */

export type LoadingVariant = 'skeleton' | 'spinner' | 'overlay';

export interface LoadingStateProps {
  /** `skeleton` rows, a centred `spinner`, or an `overlay` veil over `children`. */
  variant?: LoadingVariant;
  /** Skeleton row count (default `4`). */
  rows?: number;
  /** Skeleton row height in px (default `76`, or `h` if given). */
  height?: number;
  /** Legacy alias for `height` (matches the apps' `SkeletonRow h` prop). */
  h?: number;
  /** Announced label (default `"Loading"`), always visually hidden. */
  label?: string;
  /** Show the label next to the spinner instead of only hiding it. */
  showLabel?: boolean;
  /** Content behind the `overlay` veil. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Loading placeholder with `role="status"`, `aria-busy` and a visually
 * hidden "Loading" text for every variant.
 */
export function LoadingState({
  variant = 'spinner',
  rows = 4,
  height,
  h,
  label = 'Loading',
  showLabel = false,
  children,
  className,
  style,
}: LoadingStateProps) {
  const rowHeight = height ?? h ?? 76;
  const srText = <span className="stk-sr-only">{label}</span>;

  if (variant === 'skeleton') {
    return (
      <div
        className={stkJoin('stk-loading--skeleton', className)}
        style={style}
        role="status"
        aria-busy="true"
        aria-live="polite"
      >
        {srText}
        {Array.from({ length: Math.max(1, rows) }, (_, index) => (
          <div key={index} className="stk-skeleton" style={{ height: rowHeight }} />
        ))}
      </div>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className={stkJoin('stk-loading--overlay', className)} style={style} aria-busy="true">
        {children}
        <div className="stk-loading__veil" role="status" aria-live="polite">
          <span className={stkJoin(stkSpinner, 'stk-spinner--lg')} aria-hidden="true" />
          {srText}
        </div>
      </div>
    );
  }

  return (
    <div
      className={stkJoin('stk-loading', 'stk-loading--block', className)}
      style={style}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className={stkJoin(stkSpinner, 'stk-spinner--lg')} aria-hidden="true" />
      {showLabel ? <span className="stk-loading__label">{label}</span> : null}
      {srText}
    </div>
  );
}

export interface SkeletonRowProps {
  /** Row height in px (default `76`). */
  height?: number;
  /** Legacy alias for `height`. */
  h?: number;
  className?: string;
  style?: CSSProperties;
}

/** Single shimmer placeholder row (drop-in for the apps' `SkeletonRow`). */
export function SkeletonRow({ height, h, className, style }: SkeletonRowProps) {
  return (
    <div
      className={stkJoin('stk-skeleton', className)}
      style={{ height: height ?? h ?? 76, ...style }}
      aria-hidden="true"
    />
  );
}

/* ========================================================================== *
 * ErrorState
 * ========================================================================== */

export interface ErrorStateProps {
  message: ReactNode;
  /** Renders the retry button. */
  onRetry?: () => void;
  /** Disables the retry button and spins its icon. */
  retrying?: boolean;
  retryLabel?: string;
  /** `danger` (default) or `warning` styling. */
  tone?: 'danger' | 'warning';
  icon?: ReactNode;
  /** Extra content under the message (details, secondary actions…). */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** `role="alert"` error card with an optional retry action. */
export function ErrorState({
  message,
  onRetry,
  retrying = false,
  retryLabel = 'Retry',
  tone = 'danger',
  icon,
  children,
  className,
  style,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={stkJoin(
        'stk-error',
        'stk-glass',
        tone === 'warning' && 'stk-error--warning',
        className,
      )}
      style={style}
    >
      <p className="stk-error__text">
        {icon !== undefined && icon !== null ? (
          <span className="stk-badge__icon" aria-hidden="true" style={{ marginRight: 8 }}>
            {icon}
          </span>
        ) : null}
        {message}
      </p>
      {children}
      {onRetry ? (
        <GlassButton
          variant="secondary"
          size="md"
          fullWidth
          loading={retrying}
          className="stk-error__retry"
          iconStart={<IconRefresh size={16} />}
          onClick={onRetry}
        >
          {retrying ? 'Retrying…' : retryLabel}
        </GlassButton>
      ) : null}
    </div>
  );
}

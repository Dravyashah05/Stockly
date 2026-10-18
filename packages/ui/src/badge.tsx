/* StatusBadge — success/warning/danger/info/neutral chips with stock
 * semantics (in → success, out → destructive). */

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { stkJoin } from './classes.ts';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps extends ComponentPropsWithRef<'span'> {
  /** Colour/semantic tone (default: derived from `stock`/`kind`, else `neutral`). */
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Leading status dot. */
  dot?: boolean;
  /** Leading decorative node (e.g. an arrow icon). */
  icon?: ReactNode;
  /** Stock semantics: `'in'` → success, `'out'` → destructive. */
  stock?: 'in' | 'out';
  /** Drop-in IN/OUT label (also forces the tone, like `stock`). */
  kind?: 'IN' | 'OUT';
}

/**
 * Inline status chip. With `stock="in"` and no children it renders `IN`,
 * `stock="out"` renders `OUT`; pass `children` to override the label.
 */
export function StatusBadge({
  tone,
  size = 'md',
  dot = false,
  icon,
  stock,
  kind,
  className,
  style,
  children,
  ...rest
}: StatusBadgeProps) {
  const resolvedTone: BadgeTone =
    tone ??
    (stock === 'in' || kind === 'IN'
      ? 'success'
      : stock === 'out' || kind === 'OUT'
        ? 'danger'
        : 'neutral');
  const label =
    children ?? (stock !== undefined ? stock.toUpperCase() : kind !== undefined ? kind : null);

  return (
    <span
      {...rest}
      className={stkJoin('stk-badge', `stk-badge--${resolvedTone}`, `stk-badge--${size}`, className)}
      style={style}
    >
      {dot ? <span className="stk-badge__dot" aria-hidden="true" /> : null}
      {icon !== undefined && icon !== null ? (
        <span className="stk-badge__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {label}
    </span>
  );
}

/** Alias for {@link StatusBadge}. */
export const Badge = StatusBadge;

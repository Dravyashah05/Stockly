/* Segmented — the shared segmented filter control (matches the apps'
 * existing `Segmented` API: options + value + onChange + label). */

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { stkJoin } from './classes.ts';

export interface SegmentedOption<T extends string = string> {
  key: T;
  label: ReactNode;
  /** Optional leading node (icon) — decorative. */
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string = string>
  extends Omit<ComponentPropsWithRef<'div'>, 'onChange' | 'children'> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible group name (rendered as `aria-label`). */
  label?: string;
  /** Larger type (default compact). */
  size?: 'sm' | 'lg';
  /** Stretch to the container width. */
  block?: boolean;
  /** Extra content after the options (e.g. a clear affordance). */
  children?: ReactNode;
}

/** Pill-track segmented control: `aria-pressed` toggle buttons in a labelled group. */
export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  block,
  className,
  style,
  children,
  role,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div
      {...rest}
      role={role ?? 'group'}
      aria-label={label}
      className={stkJoin(
        'stk-seg',
        size === 'lg' && 'stk-seg--lg',
        block && 'stk-seg--block',
        className,
      )}
      style={style}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className="stk-seg__btn"
          aria-pressed={value === option.key}
          disabled={option.disabled}
          onClick={() => onChange(option.key)}
        >
          {option.icon !== undefined && option.icon !== null ? (
            <span className="stk-btn__icon" aria-hidden="true">
              {option.icon}
            </span>
          ) : null}
          {option.label}
        </button>
      ))}
      {children}
    </div>
  );
}

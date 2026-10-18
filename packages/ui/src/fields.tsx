/* GlassTextField + GlassSearch — form fields and the shared search input. */

import { useId } from 'react';
import type {
  CSSProperties,
  ComponentPropsWithRef,
  InputHTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from 'react';
import { stkJoin } from './classes.ts';
import { IconClose, IconSearch } from './icons.tsx';

export type FieldSize = 'sm' | 'md' | 'lg';

export interface GlassTextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  /** Visible label (always rendered — placeholder is never the only label). */
  label: string;
  /** Helper line under the field. */
  hint?: ReactNode;
  /** Validation message: sets `aria-invalid` and renders the alert line. */
  error?: ReactNode;
  /** Control height: `sm`/`md` = 44/48px, `lg` = 56px. */
  size?: FieldSize;
  /** Decorative node before the input (icon). */
  leadingIcon?: ReactNode;
  /** Decorative node after the input (icon, unit, button…). */
  trailingIcon?: ReactNode;
  /** Show a clear button while the (controlled) value is non-empty. */
  clearable?: boolean;
  /** Clear-button handler; defaults to a native `value` reset + `input` event (works with React controlled inputs). */
  onClear?: () => void;
  /** Accessible name of the clear button (default `"Clear"`). */
  clearLabel?: string;
  /** Applied to the input itself (`className` styles the wrapper). */
  inputClassName?: string;
  /** Applied to the input itself (`style` styles the wrapper). */
  inputStyle?: CSSProperties;
}

/** Labelled glass text field with hint/error plumbing and optional clear. */
export function GlassTextField({
  label,
  hint,
  error,
  size = 'md',
  leadingIcon,
  trailingIcon,
  clearable,
  onClear,
  clearLabel = 'Clear',
  className,
  style,
  inputClassName,
  inputStyle,
  id,
  children,
  'aria-invalid': ariaInvalid,
  ...rest
}: GlassTextFieldProps) {
  const reactId = useId();
  const inputId = id ?? `stk-field-${reactId}`;
  const hintId = `stk-hint-${reactId}`;
  const errorId = `stk-error-${reactId}`;
  const hasHint = hint !== undefined && hint !== null && hint !== false;
  const hasError = error !== undefined && error !== null && error !== false;
  const { ref, onChange, ...inputRest } = rest;

  const showClear = clearable === true && typeof rest.value === 'string' && rest.value.length > 0;

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    if (onClear) {
      onClear();
      return;
    }
    const input = event.currentTarget.closest('.stk-field')?.querySelector('input');
    if (!(input instanceof HTMLInputElement)) return;
    // Reset through the native setter so React's controlled value tracking
    // sees the change, then notify React with a bubbling `input` event.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus({ preventScroll: true });
  };

  return (
    <div
      className={stkJoin(
        'stk-field',
        `stk-field--${size}`,
        hasError && 'stk-field--invalid',
        className,
      )}
      style={style}
    >
      <label className="stk-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="stk-field__box">
        {leadingIcon !== undefined && leadingIcon !== null ? (
          <span className="stk-field__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}
        <input
          {...inputRest}
          ref={ref}
          id={inputId}
          className={stkJoin('stk-field__control', inputClassName)}
          style={inputStyle}
          aria-invalid={hasError ? true : ariaInvalid}
          aria-describedby={stkJoin(hasHint ? hintId : undefined, hasError ? errorId : undefined) || undefined}
          onChange={onChange}
        />
        <span className="stk-field__affix">
          {trailingIcon !== undefined && trailingIcon !== null ? (
            <span className="stk-field__icon" aria-hidden="true">
              {trailingIcon}
            </span>
          ) : null}
          {showClear ? (
            <button
              type="button"
              className="stk-field__clear"
              aria-label={clearLabel}
              onClick={handleClear}
            >
              <IconClose size={14} />
            </button>
          ) : null}
        </span>
      </div>
      {hasHint ? (
        <p className="stk-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p className="stk-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** Alias for {@link GlassTextField}. */
export const TextField = GlassTextField;

export interface GlassSearchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'value' | 'onCancel'> {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name (defaults to the placeholder). */
  label?: string;
  /** Control height (default `md` = 48px). */
  size?: FieldSize;
  /** Leading search icon (defaults to a built-in magnifier). */
  icon?: ReactNode;
  /** Show a clear button while non-empty (default `true`). */
  clearable?: boolean;
  /** Clear-button handler; defaults to `onChange('')`. */
  onClear?: () => void;
  clearLabel?: string;
  /** Renders a cancel affordance (requires `onCancel`). */
  showCancel?: boolean;
  cancelLabel?: string;
  /** Cancel affordance handler (e.g. clear + blur, or navigate back). */
  onCancel?: () => void;
  /** `className` styles the row wrapper; `inputClassName` styles the input. */
  inputClassName?: string;
  inputStyle?: CSSProperties;
  ref?: Ref<HTMLInputElement>;
}

/** Search input: icon + clear + optional cancel, matching the apps' SearchBar. */
export function GlassSearch({
  value,
  onChange,
  label,
  placeholder,
  size = 'md',
  icon,
  clearable = true,
  onClear,
  clearLabel = 'Clear',
  showCancel = true,
  cancelLabel = 'Cancel',
  onCancel,
  className,
  style,
  inputClassName,
  inputStyle,
  ref,
  onKeyDown,
  ...rest
}: GlassSearchProps) {
  const handleClear = () => {
    if (onClear) onClear();
    else onChange('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && value.length > 0) {
      // Escape clears the query first; only an empty field lets the event
      // keep bubbling (so dialogs/menus still close).
      event.stopPropagation();
      handleClear();
    }
  };

  return (
    <div className={stkJoin('stk-search', className)} style={style}>
      <div className={stkJoin('stk-field', `stk-field--${size}`)}>
        <div className="stk-field__box">
          <span className="stk-field__icon" aria-hidden="true">
            {icon ?? <IconSearch size={16} />}
          </span>
          <input
            {...rest}
            ref={ref}
            type="search"
            role="searchbox"
            className={stkJoin('stk-field__control', inputClassName)}
            style={inputStyle}
            value={value}
            placeholder={placeholder}
            aria-label={label ?? placeholder}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="stk-field__affix">
            {clearable && value.length > 0 ? (
              <button
                type="button"
                className="stk-field__clear"
                aria-label={clearLabel}
                onClick={handleClear}
              >
                <IconClose size={14} />
              </button>
            ) : null}
          </span>
        </div>
      </div>
      {onCancel !== undefined && showCancel ? (
        <button type="button" className="stk-search__cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Alias for {@link GlassSearch}. */
export const SearchField = GlassSearch;

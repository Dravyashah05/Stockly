/* GlassMenu — trigger + portal popover with roving focus, flip/clamp
 * positioning, and radio/checkbox item semantics. */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ComponentPropsWithRef, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import { createPortal } from 'react-dom';
import { stkJoin } from './classes.ts';
import { useClickOutside, usePortalPosition, type PortalAlign } from './hooks.ts';
import { IconCheck } from './icons.tsx';

const MENU_ITEM_SELECTOR =
  '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';

/** Props handed to your trigger render function — spread them onto any
 *  button-like element (e.g. `<GlassButton {...props} />`). */
export interface MenuTriggerProps {
  ref: Ref<HTMLButtonElement>;
  id: string;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls'?: string;
}

export interface GlassMenuProps {
  /** Render the trigger; spread the supplied props onto a focusable button. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  /** Menu items (use `MenuItem`, `MenuSeparator`, `MenuGroup`). */
  children?: ReactNode;
  /** Accessible name for `role="menu"` (required). */
  label: string;
  /** Horizontal alignment relative to the trigger (default `'start'`). */
  align?: PortalAlign;
  /** Controlled open state (omit for uncontrolled). */
  open?: boolean;
  /** Initial open state for the uncontrolled mode (default `false`). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Close when an item is chosen (default `true`). */
  closeOnSelect?: boolean;
  /** Prevent opening while keeping close paths alive. */
  disabled?: boolean;
  /** `className`/`style` apply to the popover panel. */
  className?: string;
  style?: CSSProperties;
}

/**
 * Menu popover: Arrow keys / Home / End roving focus, Escape closes and
 * restores focus to the trigger, Tab closes (focus continues naturally),
 * pointer press outside closes, and the panel flips/clamps at viewport
 * edges via {@link usePortalPosition}.
 */
export function GlassMenu({
  trigger,
  children,
  label,
  align = 'start',
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  closeOnSelect = true,
  disabled = false,
  className,
  style,
}: GlassMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<'first' | 'last'>('first');
  const triggerId = useId();
  const menuId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (next && disabled) return;
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [disabled, openProp, onOpenChange],
  );

  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    },
    [setOpen],
  );

  useClickOutside([triggerRef, menuRef], () => setOpen(false), open);
  const position = usePortalPosition(triggerRef, menuRef, open, { align, gap: 8, flip: true });

  const menuItems = (): HTMLElement[] => {
    const root = menuRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)).filter(
      (el) => !el.hasAttribute('disabled'),
    );
  };

  const focusItem = (which: 'first' | 'last' | number) => {
    const items = menuItems();
    if (items.length === 0) {
      menuRef.current?.focus({ preventScroll: true });
      return;
    }
    const target =
      which === 'first'
        ? items[0]
        : which === 'last'
          ? items[items.length - 1]
          : items[which];
    target?.focus({ preventScroll: true });
  };

  // Focus lands on the first (or last, when opened with ArrowUp) item.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const root = menuRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled'),
      );
      const target = pendingFocus.current === 'last' ? items[items.length - 1] : items[0];
      (target ?? root).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const triggerProps: MenuTriggerProps = {
    ref: triggerRef,
    id: triggerId,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: () => setOpen(!open),
    onKeyDown: (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      pendingFocus.current = event.key === 'ArrowDown' ? 'first' : 'last';
      if (!open) setOpen(true);
      else focusItem(pendingFocus.current);
    },
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems();
    const active = document.activeElement as HTMLElement | null;
    const index = active ? items.indexOf(active) : -1;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(index + 1 >= items.length ? 0 : index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(index <= 0 ? items.length - 1 : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation(); // never let the parent overlay close too
        closeMenu(true);
        break;
      case 'Tab':
        // Let the browser move focus on; the menu just gets out of the way.
        closeMenu(false);
        break;
      default:
        break;
    }
  };

  const onMenuClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeOnSelect) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.(MENU_ITEM_SELECTOR)) closeMenu(true);
  };

  return (
    <>
      {trigger(triggerProps)}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              tabIndex={-1}
              className={stkJoin('stk-menu', 'stk-glass', 'stk-glass--strong', className)}
              style={{
                top: position.top,
                left: position.left,
                opacity: position.opacity,
                ...style,
              }}
              onKeyDown={onMenuKeyDown}
              onClick={onMenuClick}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Alias for {@link GlassMenu}. */
export const Menu = GlassMenu;

/* ========================================================================== *
 * Menu building blocks
 * ========================================================================== */

export interface MenuItemProps extends ComponentPropsWithRef<'button'> {
  icon?: ReactNode;
  /** Right-aligned hint (keyboard shortcut, count…). */
  hint?: ReactNode;
  /** Destructive styling (red). */
  destructive?: boolean;
  /** Checked state; presence switches to radio/checkbox semantics. */
  checked?: boolean;
  /** Which checked semantics to use (default `'radio'`). */
  selection?: 'radio' | 'checkbox';
  /** Called when the item is chosen (before the menu closes). */
  onSelect?: () => void;
  children: ReactNode;
}

/** Single menu entry. `checked` promotes it to `menuitemradio` (or
 *  `menuitemcheckbox` with `selection="checkbox"`). */
export function MenuItem({
  icon,
  hint,
  destructive,
  checked,
  selection = 'radio',
  onSelect,
  onClick,
  role,
  disabled,
  className,
  style,
  children,
  ...rest
}: MenuItemProps) {
  const computedRole =
    role ??
    (checked !== undefined
      ? selection === 'checkbox'
        ? 'menuitemcheckbox'
        : 'menuitemradio'
      : 'menuitem');
  return (
    <button
      {...rest}
      type="button"
      role={computedRole}
      aria-checked={checked}
      disabled={disabled}
      className={stkJoin(
        'stk-menu__item',
        destructive && 'stk-menu__item--destructive',
        className,
      )}
      style={style}
      onClick={(event) => {
        onClick?.(event);
        if (disabled) return;
        onSelect?.();
      }}
    >
      {icon !== undefined && icon !== null ? (
        <span className="stk-menu__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="stk-menu__label">{children}</span>
      {hint !== undefined && hint !== null ? <span className="stk-menu__hint">{hint}</span> : null}
      {checked === true ? (
        <span className="stk-menu__check" aria-hidden="true">
          <IconCheck size={16} />
        </span>
      ) : null}
    </button>
  );
}

export interface MenuSeparatorProps {
  className?: string;
  style?: CSSProperties;
}

/** Visual divider between menu sections. */
export function MenuSeparator({ className, style }: MenuSeparatorProps) {
  return <hr className={stkJoin('stk-menu__sep', className)} style={style} />;
}

export interface MenuGroupProps {
  /** Group caption, announced via `aria-labelledby`. */
  label: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Captioned group of menu items. */
export function MenuGroup({ label, children, className, style }: MenuGroupProps) {
  const reactId = useId();
  const labelId = `stk-menu-group-${reactId}`;
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={stkJoin('stk-menu__group', className)}
      style={style}
    >
      <div className="stk-menu__group-label" id={labelId}>
        {label}
      </div>
      {children}
    </div>
  );
}

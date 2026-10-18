/* FloatingTabBar — the floating glass bottom navigation capsule. */

import { useRef } from 'react';
import type { ComponentPropsWithRef, KeyboardEvent, ReactNode } from 'react';
import { stkJoin } from './classes.ts';

export interface TabItem<T extends string = string> {
  key: T;
  label: string;
  icon: ReactNode;
  /** Optional count/flag badge rendered over the icon. */
  badge?: ReactNode;
  disabled?: boolean;
}

export interface FloatingTabBarProps<T extends string = string>
  extends Omit<ComponentPropsWithRef<'nav'>, 'children' | 'onChange'> {
  tabs: ReadonlyArray<TabItem<T>>;
  active: T;
  onChange: (key: T) => void;
  /** Accessible name of the tablist (default `"Primary"`). */
  label?: string;
  /** Hide the bar from the tablet/desktop breakpoint up (mobile chrome). */
  hideOnDesktop?: boolean;
  /** Extra content rendered after the capsule (e.g. a floating action). */
  children?: ReactNode;
}

/**
 * Bottom tab bar with `tablist`/`tab` semantics, a sliding active pill,
 * roving tabindex + arrow/Home/End navigation, safe-area padding and a
 * floating glass capsule.
 */
export function FloatingTabBar<T extends string = string>({
  tabs,
  active,
  onChange,
  label = 'Primary',
  hideOnDesktop,
  className,
  style,
  children,
  ...rest
}: FloatingTabBarProps<T>) {
  const tabRefs = useRef(new Map<T, HTMLButtonElement>());

  const focusableTabs = () => tabs.filter((tab) => !tab.disabled);

  const focusAt = (index: number) => {
    const enabled = focusableTabs();
    if (enabled.length === 0) return;
    const target = enabled[((index % enabled.length) + enabled.length) % enabled.length];
    onChange(target.key);
    tabRefs.current.get(target.key)?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = focusableTabs();
    if (enabled.length === 0) return;
    const currentIndex = enabled.findIndex((tab) => tab.key === active);
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusAt(currentIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusAt(currentIndex === -1 ? 0 : currentIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(enabled.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <nav
      {...rest}
      className={stkJoin('stk-tabbar', className)}
      style={style}
      data-hide-on-desktop={hideOnDesktop ? '' : undefined}
    >
      <div className="stk-tabbar__capsule stk-glass stk-glass--strong" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.key, el);
                else tabRefs.current.delete(tab.key);
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-disabled={tab.disabled ? true : undefined}
              tabIndex={selected ? 0 : -1}
              className={stkJoin('stk-tab', 'stk-press')}
              onClick={() => {
                if (!tab.disabled) onChange(tab.key);
              }}
            >
              <span className="stk-tab__pill" aria-hidden="true" />
              <span className="stk-tab__icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="stk-tab__label">{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== null ? (
                <span className="stk-tabbar__badge">{tab.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {children}
    </nav>
  );
}

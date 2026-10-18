/* Inline SVG icon set used for the package's built-in affordances (clear,
 * close, search, toast glyphs, retry). Everything else is passed in as
 * ReactNode by the consumer — no icon-library dependency. */

import type { ReactNode } from 'react';

export interface IconProps {
  /** Rendered size in CSS pixels (default `20`). */
  size?: number | string;
  className?: string;
  /** Hidden from assistive tech (default `true`) — pass `false` + `title` for meaningful icons. */
  decorative?: boolean;
  title?: string;
}

export interface SvgIconProps extends IconProps {
  children: ReactNode;
}

/** Shared `<svg>` shell: inherits colour via `currentColor`. */
export function SvgIcon({
  size = 20,
  className,
  decorative = true,
  title,
  children,
}: SvgIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      focusable="false"
    >
      {!decorative && title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </SvgIcon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L21 21" />
    </SvgIcon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </SvgIcon>
  );
}

export function IconCheckCircle(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.4l2.7 2.7L16.2 9.4" />
    </SvgIcon>
  );
}

export function IconXCircle(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </SvgIcon>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6h.01" />
    </SvgIcon>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12 4.4l9 15.2H3z" />
      <path d="M12 10v4.4" />
      <path d="M12 17h.01" />
    </SvgIcon>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 3.5V8h-4.5" />
    </SvgIcon>
  );
}

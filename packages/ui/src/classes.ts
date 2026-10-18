/* Shared class-name helpers and small utilities for the Liquid Glass system.
 * Kept in a .ts file (no JSX) so components stay fast-refresh friendly. */

/** Base class applied by every glass surface (see styles.css §2). */
export const glassSurfaceCls = 'stk-glass';

/** Tone → class map for {@link glassSurfaceCls} surfaces. */
export type GlassTone = 'regular' | 'strong' | 'soft';

/** Full class list for a toned glass surface. */
export const glassToneCls: Record<GlassTone, string> = {
  regular: 'stk-glass stk-glass--regular',
  strong: 'stk-glass stk-glass--strong',
  soft: 'stk-glass stk-glass--soft',
};

/** Class that guarantees a visible `:focus-visible` ring. */
export const stkFocusRing = 'stk-focus-ring';

/** Visually hidden, still announced by screen readers. */
export const stkSrOnly = 'stk-sr-only';

/** Subtle press-scale feedback for anything clickable. */
export const stkPressable = 'stk-press';

/** Contained internal scroller with a thin themed scrollbar. */
export const stkScrollable = 'stk-scroll';

/** Spinner + rotate utilities (icon-sized loading indicators). */
export const stkSpinner = 'stk-spinner';
export const stkSpin = 'stk-spin';

/** Joins class fragments, skipping falsy values. */
export function stkJoin(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Radius tokens accepted by surface/card radius props. */
export type RadiusToken =
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'pill'
  | 'card'
  | 'row'
  | 'control';

const RADIUS_TOKENS: ReadonlySet<string> = new Set<RadiusToken>([
  'sm',
  'md',
  'lg',
  'xl',
  'pill',
  'card',
  'row',
  'control',
]);

/** Inline style fragment that overrides the surface radius
 * (`--stk-radius`), accepting a design token name or a raw CSS length. */
export function radiusStyle(radius?: string | number): { '--stk-radius'?: string } | undefined {
  if (radius === undefined || radius === null || radius === '') return undefined;
  if (typeof radius === 'number') return { '--stk-radius': `${radius}px` };
  if (RADIUS_TOKENS.has(radius)) return { '--stk-radius': `var(--radius-${radius})` };
  return { '--stk-radius': radius };
}

/* GlassSurface + GlassCard — the layered-glass building blocks. */

import type { ComponentPropsWithRef, ReactNode } from 'react';
import { glassToneCls, radiusStyle, stkJoin, type GlassTone } from './classes.ts';

export interface GlassSurfaceProps extends ComponentPropsWithRef<'div'> {
  /** Layer strength: translucent (regular), chrome (strong) or quiet (soft). */
  tone?: GlassTone;
  /** Corner radius: a design token name (`sm|md|lg|xl|pill|card|row|control`) or a CSS length. */
  radius?: string | number;
  /** Adds hover/press feedback and a pointer cursor. */
  interactive?: boolean;
}

/**
 * Base "Liquid Glass" container: translucent layered background, backdrop
 * blur with an opaque fallback, the specular top edge, border and shadow.
 */
export function GlassSurface({
  tone = 'regular',
  radius,
  interactive,
  className,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  return (
    <div
      {...rest}
      className={stkJoin(glassToneCls[tone], interactive && 'stk-glass--interactive', className)}
      style={{ ...radiusStyle(radius), ...style }}
    >
      {children}
    </div>
  );
}

export interface GlassCardProps extends Omit<ComponentPropsWithRef<'div'>, 'title'> {
  /** Card heading (rendered as `titleAs`, default `h3`). */
  title?: ReactNode;
  /** Supporting copy under the heading. */
  description?: ReactNode;
  /** Actions/meta pinned below the body with a divider. */
  footer?: ReactNode;
  tone?: GlassTone;
  radius?: string | number;
  /** Element used to render `title`. */
  titleAs?: 'h2' | 'h3' | 'h4' | 'p';
}

/** Glass surface with title / description / body / footer slots. */
export function GlassCard({
  title,
  description,
  footer,
  tone = 'regular',
  radius,
  titleAs,
  className,
  style,
  children,
  ...rest
}: GlassCardProps) {
  const Heading = titleAs ?? 'h3';
  return (
    <GlassSurface
      {...rest}
      tone={tone}
      radius={radius}
      className={stkJoin('stk-card', className)}
      style={style}
    >
      {title !== undefined && title !== null ? (
        <div className="stk-card__head">
          <Heading className="stk-card__title">{title}</Heading>
          {description !== undefined && description !== null ? (
            <p className="stk-card__desc">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children !== undefined && children !== null && children !== false ? (
        <div className="stk-card__body">{children}</div>
      ) : null}
      {footer !== undefined && footer !== null && footer !== false ? (
        <div className="stk-card__footer">{footer}</div>
      ) : null}
    </GlassSurface>
  );
}

/** Alias for {@link GlassCard}. */
export const Card = GlassCard;

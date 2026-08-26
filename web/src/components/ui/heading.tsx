import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Heading — canonical heading component for the admin panel.
 *
 * Replaces ad-hoc `<h1 className="text-2xl font-bold">` and friends.
 * The level → className mapping is the canonical Tailwind scale per
 * `docs/design-system.md` and mirrors the 19-style Flutter typography
 * ladder (headingLarge / headingMedium / headingSmall / titleLarge /
 * titleMedium / titleSmall).
 *
 * PR-27a introduces the component. Screen migration is PR-27b through
 * PR-27g. Do not introduce new raw `text-2xl font-bold` etc. combos
 * — use this component instead.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingProps
  extends Omit<React.HTMLAttributes<HTMLHeadingElement>, 'children'> {
  level?: HeadingLevel;
  children: React.ReactNode;
}

const levelStyles: Record<HeadingLevel, string> = {
  1: 'text-3xl font-bold tracking-tight',
  2: 'text-2xl font-semibold tracking-tight',
  3: 'text-xl font-semibold',
  4: 'text-lg font-medium',
  5: 'text-base font-medium',
  6: 'text-sm font-medium uppercase tracking-wide',
};

function Heading({
  level = 2,
  className,
  children,
  ...props
}: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      data-slot="heading"
      data-level={level}
      className={cn(levelStyles[level], className)}
      {...props}
    >
      {children}
    </Tag>
  );
}

export { Heading };

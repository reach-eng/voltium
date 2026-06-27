'use client';

import { Suspense, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SuspenseBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  height?: string;
  className?: string;
}

/** Renders a skeleton placeholder while the section loads */
function SkeletonSection({ height = 'h-80' }: { height?: string }) {
  return (
    <div className={cn('animate-pulse rounded-2xl overflow-hidden', height)}>
      <Skeleton className={`w-full h-full rounded-2xl`} />
    </div>
  );
}

/** Renders a skeleton for stat cards */
function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

/**
 * A Suspense boundary wrapper for progressively loading data sections.
 * Wraps the children in React.Suspense with a skeleton fallback.
 * Works with TanStack Query's `suspense: true` mode or with lazy-loaded components.
 */
export function SuspenseSection({
  children,
  fallback,
  height,
  className,
}: SuspenseBoundaryProps) {
  return (
    <Suspense
      fallback={
        fallback || (
          <div className={cn('w-full', className)}>
            {height ? (
              <SkeletonSection height={height} />
            ) : (
              <SkeletonCards />
            )}
          </div>
        )
      }
    >
      {children}
    </Suspense>
  );
}

export { SkeletonSection, SkeletonCards };

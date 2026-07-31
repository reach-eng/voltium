import { Skeleton } from '@/components/ui/skeleton';

/**
 * R3 split (FleetMapScreen) — loading skeleton.
 *
 * One header line, four summary cards, then a sidebar + grid
 * placeholder (matches the 1/3 column layout of the real screen).
 */
export function FleetMapSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Skeleton className="h-[600px] rounded-2xl lg:col-span-1" />
        <Skeleton className="h-[600px] rounded-2xl lg:col-span-3" />
      </div>
    </div>
  );
}

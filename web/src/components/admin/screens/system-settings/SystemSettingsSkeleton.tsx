import { Skeleton } from '@/components/ui/skeleton';

/**
 * R3.7k split — Loading skeleton for the system-settings screen.
 *
 * Three placeholders: title, then a tall card, then a slightly taller
 * card. Matches the rough proportions of the real layout.
 */
export function SystemSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

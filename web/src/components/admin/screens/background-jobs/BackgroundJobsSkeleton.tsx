'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * R3 split (BackgroundJobsScreen) — loading skeleton.
 *
 * Six placeholder job cards in a 3-col grid. Each card has a
 * 6w32 header line, two 4-line content placeholders, and a
 * button-shaped footer.
 */
export function BackgroundJobsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="animate-pulse border-indigo-900/10 bg-slate-900/5">
          <CardHeader className="pb-2">
            <div className="h-6 w-32 bg-slate-200 rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-4 w-full bg-slate-100 rounded" />
            <div className="h-4 w-2/3 bg-slate-100 rounded" />
            <div className="h-8 w-24 bg-slate-200 rounded mt-4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

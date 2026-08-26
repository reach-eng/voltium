'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatINR, type Summary } from './types';

interface EarningsSummaryCardsProps {
  summary: Summary;
}

/**
 * R3.7h split — Three summary cards.
 *
 * Total Earnings (emerald), Total Trips (blue), Avg per Entry (amber).
 * Each card uses an `uppercase tracking-widest` label + a 2xl font-black
 * value for the dashboard look. The colour hexes are from the canonical
 * 6-base palette so they match the rest of the admin theme.
 */
export function EarningsSummaryCards({ summary }: EarningsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="bg-emerald-500/5 border-emerald-500/10">
        <CardContent className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Total Earnings
          </p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {formatINR(summary.totalAmount)}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-blue-500/5 border-blue-500/10">
        <CardContent className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Total Trips
          </p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
            {summary.totalTrips.toLocaleString('en-IN')}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-amber-500/5 border-amber-500/10">
        <CardContent className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Avg per Entry
          </p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
            {formatINR(summary.averageAmount)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

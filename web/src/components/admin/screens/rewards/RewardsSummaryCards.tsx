'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Award, TrendingUp, Users } from 'lucide-react';
import type { Summary } from './types';

interface RewardsSummaryCardsProps {
  summary: Summary;
}

/**
 * R3.7l split — Three rewards summary cards.
 *
 * Total Points Awarded (amber, badge-styled), Unique Riders Rewarded
 * (green), and This Month (blue) with both count and points. The
 * "Total Points" card uses a Badge instead of a plain number so the
 * visual weight matches the other two cards.
 */
export function RewardsSummaryCards({ summary }: RewardsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-card rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50">
              <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Points Awarded</p>
              <div className="text-2xl font-bold mt-1">
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-sm px-2 py-0.5">
                  {summary.totalPoints.toLocaleString()} pts
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-50">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unique Riders Rewarded</p>
              <p className="text-2xl font-bold mt-1">{summary.uniqueRiders}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold mt-1">
                {summary.thisMonthCount}{' '}
                <span className="text-sm font-normal text-muted-foreground">rewards</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.thisMonthPoints.toLocaleString()} pts awarded
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

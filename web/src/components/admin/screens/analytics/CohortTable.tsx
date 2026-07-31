'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getMonthLabel, type AnalyticsCohort } from './analyticsTypes';

/**
 * R3.7c — cohort analysis table. Extracted from AnalyticsDashboard.tsx.
 * Shows signup month, total riders, active/suspended breakdown, and a
 * colour-coded retention rate badge.
 */
export function CohortTable({ cohorts }: { cohorts: AnalyticsCohort[] }) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 px-6 pt-5">
        <CardTitle className="text-base font-bold">
          Cohort Analysis — Retention by Signup Month
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="px-6">Signup Month</TableHead>
              <TableHead>Total Riders</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Suspended</TableHead>
              <TableHead className="pr-6 text-right">Retention Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cohorts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  No cohort data available
                </TableCell>
              </TableRow>
            ) : (
              cohorts.map((cohort) => (
                <TableRow key={cohort.month} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium px-6">
                    {getMonthLabel(cohort.month)}
                  </TableCell>
                  <TableCell>{cohort.total}</TableCell>
                  <TableCell className="text-emerald-600 font-semibold">
                    {cohort.active}
                  </TableCell>
                  <TableCell className="text-rose-600 font-semibold">
                    {cohort.suspended}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Badge
                      variant="outline"
                      className={`rounded-md text-xs font-bold ${
                        cohort.retentionRate >= 70
                          ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5'
                          : cohort.retentionRate >= 40
                            ? 'border-amber-500/20 text-amber-600 bg-amber-500/5'
                            : 'border-rose-500/20 text-rose-600 bg-rose-500/5'
                      }`}
                    >
                      {cohort.retentionRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

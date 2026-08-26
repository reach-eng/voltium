'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import { getRiskBadgeClass, getRiskIcon, getScoreColor, PAGE_SIZE, type RiderScore } from './types';

interface ScoresTableProps {
  loading: boolean;
  scores: RiderScore[];
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onOpenDetail: (score: RiderScore) => void;
}

/**
 * R3 split (RiderScoringScreen) — scores table + pagination.
 *
 * Eight columns: Rider, Composite Score, Risk Level (icon +
 * coloured badge), then the four sub-scores (Payment, Compliance,
 * Engagement, Vehicle), then Last Updated. Loading state shows 5
 * skeleton rows; empty state shows "No scores available". Clicking
 * a row opens the breakdown dialog. Pagination only renders when
 * there are multiple pages.
 */
export function ScoresTable({
  loading,
  scores,
  page,
  totalPages,
  total,
  onPageChange,
  onOpenDetail,
}: ScoresTableProps) {
  return (
    <>
      <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="px-6">Rider</TableHead>
                  <TableHead>Composite Score</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="pr-6 text-right">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      No scores available
                    </TableCell>
                  </TableRow>
                ) : (
                  scores.map((s) => {
                    const RiskIcon = getRiskIcon(s.riskLevel);
                    return (
                      <TableRow
                        key={s.id}
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => onOpenDetail(s)}
                      >
                        <TableCell className="font-medium px-6">
                          <div>
                            <p className="text-sm font-semibold">{s.fullName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{s.riderId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-lg font-bold ${getScoreColor(s.compositeScore)}`}>
                            {s.compositeScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-md text-[10px] font-bold uppercase ${getRiskBadgeClass(s.riskLevel)}`}
                          >
                            <RiskIcon className="w-3 h-3 mr-1" />
                            {s.riskLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${getScoreColor(s.paymentScore)}`}>
                            {s.paymentScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${getScoreColor(s.complianceScore)}`}>
                            {s.complianceScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${getScoreColor(s.engagementScore)}`}>
                            {s.engagementScore}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${getScoreColor(s.vehicleScore)}`}>
                            {s.vehicleScore}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateDDMMYYYY(s.lastCalculated)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

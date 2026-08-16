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
import { ChevronLeft, ChevronRight, IndianRupee } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import { EARNINGS_PAGE_SIZE, formatINR, type Earning } from './types';

interface EarningsTableProps {
  loading: boolean;
  earnings: Earning[];
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * R3.7h split — Earnings table + pagination.
 *
 * Nine columns: name, ID, platform badge, ₹ amount (emerald), trips,
 * distance, hours online, date, notes (truncated). Loading state
 * shows 5 skeleton rows. Empty state shows the ₹ icon + "No earnings
 * found". Pagination only renders when totalPages > 1.
 */
export function EarningsTable({
  loading,
  earnings,
  page,
  totalPages,
  total,
  onPageChange,
}: EarningsTableProps) {
  return (
    <>
      <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-muted/30">
                  <TableHead>Rider Name</TableHead>
                  <TableHead>Rider ID</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Trips</TableHead>
                  <TableHead>Distance (km)</TableHead>
                  <TableHead>Hours Online</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-64 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <IndianRupee className="w-8 h-8 opacity-20" />
                        <p>No earnings found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  earnings.map((e) => (
                    <TableRow key={e.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">{e.rider.fullName || '—'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {e.rider.riderId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {e.platform || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatINR(e.amount)}
                      </TableCell>
                      <TableCell>{e.trips}</TableCell>
                      <TableCell>{e.distance ?? '—'}</TableCell>
                      <TableCell>
                        {e.hoursOnline != null ? `${e.hoursOnline.toFixed(1)}h` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateDDMMYYYY(e.date)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {e.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * EARNINGS_PAGE_SIZE + 1}–
            {Math.min(page * EARNINGS_PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
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
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

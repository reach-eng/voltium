'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Reward } from './types';

interface RewardsTableProps {
  loading: boolean;
  rewards: Reward[];
  search: string;
  setSearch: (v: string) => void;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

/**
 * R3.7l split — Rewards search + table + pagination.
 *
 * Search input (debounced 500ms in the data hook) above a 5-column
 * table: rider name, rider ID (mono), title, points (emerald badge
 * with leading +), date. Loading state shows a centred spinner;
 * empty state shows "No rewards found". Pagination only renders
 * when there are multiple pages.
 */
export function RewardsTable({
  loading,
  rewards,
  search,
  setSearch,
  page,
  totalPages,
  totalCount,
  onPageChange,
}: RewardsTableProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search rewards or riders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold">Rider Name</TableHead>
              <TableHead className="font-bold">Rider ID</TableHead>
              <TableHead className="font-bold">Title</TableHead>
              <TableHead className="font-bold">Points</TableHead>
              <TableHead className="font-bold">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading rewards...
                </TableCell>
              </TableRow>
            ) : rewards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No rewards found
                </TableCell>
              </TableRow>
            ) : (
              rewards.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">{r.riderName}</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground uppercase">
                    {r.riderId}
                  </TableCell>
                  <TableCell className="text-foreground">{r.title}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                      +{r.points} pts
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateDDMMYYYY(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Total: {totalCount} records</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-sm font-medium px-2">{page}</span>
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
    </>
  );
}

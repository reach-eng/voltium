'use client';

/**
 * RiderTable — the paginated, sortable table of riders.
 *
 * ━ Ticket #1 refactor ━ extracted from RiderManagement.tsx to keep
 * the parent focused on state coordination. The Card, skeleton loader,
 * table body, and pagination all live here.
 *
 * Pure presentational + handlers — no fetch logic, no state.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { RiderRow } from './RiderRow';
import type { Rider } from '@/lib/types/admin';

const PAGE_SIZE = 20;

export type SortKey = 'fullName' | 'phone' | null;
export type SortDir = 'asc' | 'desc';

export interface RiderTableProps {
  riders: Rider[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  sortKey: SortKey;
  sortDir: SortDir;
  selectedIds: Set<string>;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
  onSort: (key: Exclude<SortKey, null>) => void;
  onPageChange: (page: number) => void;
  onViewDetails: (rider: Rider) => void;
  onDelete: (id: string) => void;
}

export function RiderTable({
  riders,
  loading,
  page,
  totalPages,
  total,
  sortKey,
  sortDir,
  selectedIds,
  onToggleAll,
  onToggleOne,
  onSort,
  onPageChange,
  onViewDetails,
  onDelete,
}: RiderTableProps) {
  return (
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
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.size === riders.length && riders.length > 0}
                    onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
                  />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  aria-sort={
                    sortKey === 'fullName'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onClick={() => onSort('fullName')}
                >
                  <span className="inline-flex items-center gap-1">
                    Name
                    {sortKey === 'fullName' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      )
                    ) : null}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  aria-sort={
                    sortKey === 'phone'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onClick={() => onSort('phone')}
                >
                  <span className="inline-flex items-center gap-1">
                    Phone
                    {sortKey === 'phone' ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      )
                    ) : null}
                  </span>
                </TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Pickup Date</TableHead>
                <TableHead>ID Check</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead className="text-right w-[120px]">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {riders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <AlertTriangle className="w-8 h-8 opacity-20" />
                      <p>No riders found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                riders.map((rider) => (
                  <RiderRow
                    key={rider.id}
                    rider={rider}
                    isSelected={selectedIds.has(rider.id)}
                    onToggleSelect={(checked) => onToggleOne(rider.id, checked)}
                    onViewDetails={() => onViewDetails(rider)}
                    onDelete={() => onDelete(rider.id)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t">
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
    </Card>
  );
}

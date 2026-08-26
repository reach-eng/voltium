'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { VehicleRow } from './VehicleRow';
import type { Vehicle } from './types';

interface VehiclesTableProps {
  loading: boolean;
  filtered: Vehicle[];
  totalCount: number;
  selectedIds: Set<string>;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
  onOpenHistory: (vehicle: Vehicle) => void;
  onOpenEdit: (vehicle: Vehicle) => void;
  onDelete: (id: string) => void;
  search: string;
  statusFilter: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * R3.7e split — Vehicles table.
 *
 * Renders skeleton rows while loading, the data table otherwise. Header
 * row has a "select all" checkbox; empty state shows filter-aware copy.
 * Pagination footer only appears when there are multiple pages.
 */
export function VehiclesTable(props: VehiclesTableProps) {
  const {
    loading,
    filtered,
    selectedIds,
    onToggleAll,
    onToggleOne,
    onOpenHistory,
    onOpenEdit,
    onDelete,
    search,
    statusFilter,
    currentPage,
    totalPages,
    onPageChange,
  } = props;

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm overflow-x-auto border border-border/50">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-muted/30">
            <TableHead className="w-10">
              <Checkbox
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onCheckedChange={(checked) =>
                  onToggleAll(checked as boolean)
                }
              />
            </TableHead>
            <TableHead>Vehicle Info</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Battery</TableHead>
            <TableHead>Latest Return Photo</TableHead>
            <TableHead>Current Rider</TableHead>
            <TableHead>Hub</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                {search || statusFilter !== 'ALL'
                  ? 'No vehicles match your filters'
                  : 'No vehicles in fleet'}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((vehicle) => (
              <VehicleRow
                key={vehicle.id}
                vehicle={vehicle}
                isSelected={selectedIds.has(vehicle.id)}
                onToggleSelect={onToggleOne}
                onOpenHistory={onOpenHistory}
                onOpenEdit={onOpenEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </TableBody>
      </Table>

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4">
          <Button
            variant="outline"
            size="default"
            className="h-10 px-4"
            disabled={currentPage === 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="default"
            className="h-10 px-4"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </Card>
  );
}

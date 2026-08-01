'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { StatusBadge, PriorityBadge } from './helpers';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Ticket } from './types';

export interface TicketTableProps {
  filtered: Ticket[];
  loading: boolean;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  getAssignedName: (adminId: string | null) => string;
  openDetail: (ticket: Ticket) => void;
  page: number;
  setPage: (updater: number | ((prev: number) => number)) => void;
  totalPages: number;
  total: number;
}

export function TicketTable({
  filtered,
  loading,
  selectedIds,
  setSelectedIds,
  getAssignedName,
  openDetail,
  page,
  setPage,
  totalPages,
  total,
}: TicketTableProps) {
  return (
    <div className="space-y-4 mt-4">
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onCheckedChange={(checked) =>
                    setSelectedIds(checked ? new Set(filtered.map((t) => t.id)) : new Set())
                  }
                />
              </TableHead>
              <TableHead>Ticket #</TableHead>
              <TableHead>Rider</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id} className={selectedIds.has(t.id) ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(t.id);
                        else next.delete(t.id);
                        setSelectedIds(next);
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.ticketId}</TableCell>
                  <TableCell className="font-medium text-sm">{t.riderName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={t.priority} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {t.subject}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getAssignedName(t.assignedTo)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateDDMMYYYY(t.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => openDetail(t)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {total} tickets
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="default"
              className="h-10 px-4"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="default"
              className="h-10 px-4"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

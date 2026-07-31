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
import { Eye } from 'lucide-react';
import { StatusBadge, PriorityBadge } from './TicketBadges';
import type { Ticket } from './types';
import { formatDateDDMMYYYY } from '@/lib/date-utils';

interface TicketTableProps {
  tickets: Ticket[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectIdsChange: (ids: Set<string>) => void;
  onOpenDetail: (ticket: Ticket) => void;
  getAssignedName: (adminId: string | null) => string;
}

export function TicketTable({
  tickets,
  loading,
  selectedIds,
  onSelectIdsChange,
  onOpenDetail,
  getAssignedName,
}: TicketTableProps) {
  const formatDate = (d: string) => formatDateDDMMYYYY(d);

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={selectedIds.size === tickets.length && tickets.length > 0}
                onCheckedChange={(checked) =>
                  onSelectIdsChange(checked ? new Set(tickets.map((t) => t.id)) : new Set())
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
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                No tickets found
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((t) => (
              <TableRow key={t.id} className={selectedIds.has(t.id) ? 'bg-primary/5' : ''}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(t.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) next.add(t.id);
                      else next.delete(t.id);
                      onSelectIdsChange(next);
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
                  {formatDate(t.createdAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => onOpenDetail(t)}
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
  );
}

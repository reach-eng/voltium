'use client';

import { Button } from '@/components/ui/button';
import {
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Download,
  X,
  Undo2,
  Loader2,
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Ticket } from './types';

interface BulkActionBarProps {
  selectedIds: Set<string>;
  bulkLoading: boolean;
  lastAction: {
    ids: string[];
    previousStates: Record<string, any>;
    action: string;
  } | null;
  tickets: Ticket[];
  onOpenStatusDialog: () => void;
  onOpenAssignDialog: () => void;
  onOpenPriorityDialog: () => void;
  onBulkCloseResolved: () => void;
  onUndo: () => void;
  onClearSelection: () => void;
  getAssignedName: (adminId: string | null) => string;
}

export function BulkActionBar({
  selectedIds,
  bulkLoading,
  lastAction,
  tickets,
  onOpenStatusDialog,
  onOpenAssignDialog,
  onOpenPriorityDialog,
  onBulkCloseResolved,
  onUndo,
  onClearSelection,
  getAssignedName,
}: BulkActionBarProps) {
  if (selectedIds.size === 0) return null;

  const handleExportSelected = () => {
    const header = 'Ticket #,Rider,Phone,Category,Priority,Subject,Status,Assigned,Created';
    const rows = tickets
      .filter((t) => selectedIds.has(t.id))
      .map((t) =>
        [
          t.ticketId,
          t.riderName,
          t.riderPhone,
          t.category,
          t.priority,
          t.subject,
          t.status,
          getAssignedName(t.assignedTo),
          t.createdAt,
        ].join(',')
      );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tickets-${formatDateDDMMYYYY(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-1 p-2 bg-primary/5 rounded-xl border border-primary/20 mb-4 animate-in fade-in slide-in-from-right-2">
      <span className="text-xs px-2 font-medium text-primary">
        {selectedIds.size} selected
      </span>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
        disabled={bulkLoading}
        onClick={onOpenStatusDialog}
        title="Change Status"
      >
        {bulkLoading ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4 mr-1.5" />
        )}{' '}
        Status
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
        disabled={bulkLoading}
        onClick={onOpenAssignDialog}
        title="Assign To"
      >
        <UserPlus className="w-4 h-4 mr-1.5" /> Assign
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
        disabled={bulkLoading}
        onClick={onOpenPriorityDialog}
        title="Change Priority"
      >
        <AlertTriangle className="w-4 h-4 mr-1.5" /> Priority
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
        disabled={bulkLoading}
        onClick={onBulkCloseResolved}
        title="Close Resolved"
      >
        <Ban className="w-4 h-4 mr-1.5" /> Close Resolved
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-muted-foreground/10 transition-all duration-200"
        onClick={handleExportSelected}
      >
        <Download className="w-4 h-4 mr-1.5" /> Export
      </Button>
      {lastAction && (
        <>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 hover:bg-muted/10 transition-all duration-200"
            disabled={bulkLoading}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3 h-3 mr-1" /> Undo
          </Button>
        </>
      )}
      <div className="w-px h-4 bg-border/50 mx-1" />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-muted-foreground/10"
        onClick={onClearSelection}
        title="Clear selection"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

'use client';

import { Ban, CheckCircle2, Download, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { downloadSelectedRiderCsv } from './exportSelectedRiders';
import type { Rider } from './types';

export interface RiderBulkActionsBarProps {
  selectedCount?: number;
  bulkLoading?: boolean;
  canUndo?: boolean;
  allRiders?: Rider[];
  selectedIds: Set<string>;
  onApprove?: () => void;
  onSuspend?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onClear?: () => void;
}

/**
 * R3.7cc split — bulk action toolbar that appears when at least one
 * row is selected. Provides Approve / Suspend / Delete / Export /
 * Undo + clear-selection.
 */
export function RiderBulkActionsBar({
  selectedCount,
  bulkLoading = false,
  canUndo = false,
  allRiders = [],
  selectedIds,
  onApprove,
  onSuspend,
  onDelete,
  onUndo,
  onClear,
}: RiderBulkActionsBarProps) {
  const count = selectedCount ?? selectedIds.size;
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-1 p-1 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-right-2">
      <span className="text-xs px-2 font-medium text-primary">
        {count} selected
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-10 text-xs px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
        disabled={bulkLoading}
        onClick={onApprove}
        title="Approve selected riders"
      >
        {bulkLoading ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4 mr-1.5" />
        )}{' '}
        Approve
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-10 text-xs px-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        disabled={bulkLoading}
        onClick={onSuspend}
        title="Suspend selected riders"
      >
        {bulkLoading ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <Ban className="w-4 h-4 mr-1.5" />
        )}{' '}
        Suspend
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-10 text-xs px-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        disabled={bulkLoading}
        onClick={onDelete}
      >
        <Trash2 className="w-4 h-4 mr-1.5" /> Delete
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-10 text-xs px-3 hover:bg-muted-foreground/10 transition-all duration-200"
        onClick={() => downloadSelectedRiderCsv(allRiders, selectedIds)}
      >
        <Download className="w-4 h-4 mr-1.5" /> Export
      </Button>
      {canUndo && (
        <>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-10 text-xs px-3 hover:bg-muted/10 transition-all duration-200"
            disabled={bulkLoading}
            onClick={onUndo}
            title="Undo last action"
          >
            <Undo2 className="w-4 h-4 mr-1.5" /> Undo
          </Button>
        </>
      )}
      <div className="w-px h-4 bg-border/50 mx-1" />
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 p-0 hover:bg-muted-foreground/10"
        onClick={onClear}
        title="Clear selection"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

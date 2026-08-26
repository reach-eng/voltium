'use client';

import { Ban, CheckCircle2, Download, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { downloadTeamLeaderCsv } from './exportTeamLeaders';
import type { TeamLeader } from './types';

interface TeamLeaderBulkBarProps {
  selectedCount: number;
  selectedLeaders: TeamLeader[];
  bulkLoading: boolean;
  canUndo: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onExport: () => void;
  onUndo: () => void;
  onClear: () => void;
}

/**
 * R3.7aa split — bulk action toolbar that appears when at least one
 * row is selected. Provides activate / deactivate / delete / export /
 * undo + clear-selection.
 */
export function TeamLeaderBulkBar({
  selectedCount,
  selectedLeaders,
  bulkLoading,
  canUndo,
  onActivate,
  onDeactivate,
  onDelete,
  onExport,
  onUndo,
  onClear,
}: TeamLeaderBulkBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-1 p-1 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-right-2">
      <span className="text-xs px-2 font-medium text-primary">
        {selectedCount} selected
      </span>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
        disabled={bulkLoading}
        onClick={onActivate}
        title="Activate All"
      >
        {bulkLoading ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4 mr-1.5" />
        )}{' '}
        Activate
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        disabled={bulkLoading}
        onClick={onDeactivate}
        title="Deactivate All"
      >
        <Ban className="w-4 h-4 mr-1.5" /> Deactivate
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        disabled={bulkLoading}
        onClick={onDelete}
      >
        <Trash2 className="w-4 h-4 mr-1.5" /> Delete
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-muted-foreground/10 transition-all duration-200"
        onClick={() => downloadTeamLeaderCsv(selectedLeaders)}
      >
        <Download className="w-4 h-4 mr-1.5" /> Export
      </Button>
      {canUndo && (
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
        onClick={onClear}
        title="Clear selection"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

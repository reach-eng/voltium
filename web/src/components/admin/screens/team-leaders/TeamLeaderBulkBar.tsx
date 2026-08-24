'use client';

import { Ban, CheckCircle2, Download, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { hasPermission, type SessionPayload } from '@/lib/permissions';
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
  // ADMIN_TEAM_LEADERS_AUDIT_2026-08-24 P1-2: the parent's session
  // (typed). When the session is null (still loading) or the admin
  // lacks `team_leaders_manage`, the mutation buttons are hidden.
  // Export + Clear stay visible to all roles (export is data-only,
  // clear is a UX affordance).
  session: SessionPayload | null;
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
  session,
}: TeamLeaderBulkBarProps) {
  if (selectedCount === 0) return null;
  // P1-2: derive the canMutate flag once. Falls back to "show" if the
  // session is still loading — the server is the source of truth and
  // will 403 any unauthorised click.
  const canMutate = session
    ? hasPermission(session, 'team_leaders_manage') ||
      hasPermission(session, 'tl_manage')
    : true;

  return (
    <div className="flex items-center gap-1 p-1 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-right-2">
      <span className="text-xs px-2 font-medium text-primary">
        {selectedCount} selected
      </span>
      {canMutate && (
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
      )}
      {canMutate && (
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
      )}
      {canMutate && (
        <Button
          variant="ghost"
          size="default"
          className="h-10 text-sm px-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          disabled={bulkLoading}
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4 mr-1.5" /> Delete
        </Button>
      )}
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

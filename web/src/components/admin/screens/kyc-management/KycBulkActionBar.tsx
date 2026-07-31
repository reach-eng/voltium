'use client';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, Undo2, XCircle } from 'lucide-react';

interface LastAction {
  ids: string[];
  previousStatuses: Record<string, string>;
  action: string;
}

interface KycBulkActionBarProps {
  selectedCount: number;
  bulkLoading: boolean;
  lastAction: LastAction | null;
  showUndoToast: boolean;
  onBulkAction: (action: 'approve' | 'reject' | 'info_required') => void;
  onUndo: () => void;
  onDismissUndo: () => void;
}

export function KycBulkActionBar({
  selectedCount,
  bulkLoading,
  lastAction,
  showUndoToast,
  onBulkAction,
  onUndo,
  onDismissUndo,
}: KycBulkActionBarProps) {
  return (
    <>
      {/* Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary">{selectedCount} selected</span>
          <Button
            size="default"
            onClick={() => onBulkAction('approve')}
            disabled={bulkLoading}
            className="h-10 text-sm px-4 bg-emerald-600 hover:bg-emerald-700 transition-all duration-200"
            title="Approve All (Ctrl+K)"
          >
            {bulkLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4 mr-1.5" />
            )}
            Approve All
          </Button>
          <Button
            size="default"
            variant="outline"
            onClick={() => onBulkAction('info_required')}
            disabled={bulkLoading}
            className="h-10 text-sm px-4 border-orange-500/30 text-orange-600 transition-all duration-200"
            title="Needs Correction"
          >
            {bulkLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShieldAlert className="w-4 h-4 mr-1.5" />
            )}
            Needs Correction
          </Button>
          <Button
            size="default"
            variant="destructive"
            onClick={() => onBulkAction('reject')}
            disabled={bulkLoading}
            className="h-10 text-sm px-4 transition-all duration-200"
            title="Reject All (Ctrl+R)"
          >
            {bulkLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShieldX className="w-4 h-4 mr-1.5" />
            )}
            Reject All
          </Button>
          {lastAction && (
            <>
              <div className="w-px h-4 bg-border/50 mx-1" />
              <Button
                size="default"
                variant="outline"
                onClick={onUndo}
                disabled={bulkLoading}
                className="h-10 text-sm px-4 transition-all duration-200"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4 mr-1.5" /> Undo
              </Button>
            </>
          )}
        </div>
      )}

      {/* Undo Toast */}
      {showUndoToast && lastAction && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-xl shadow-lg animate-in slide-in-from-bottom-2">
          <span className="text-sm">
            {lastAction.ids.length} rider(s) updated to {lastAction.action}
          </span>
          <Button size="sm" variant="secondary" onClick={onUndo} className="h-7 text-xs">
            <Undo2 className="w-3 h-3 mr-1" /> Undo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismissUndo}
            className="h-7 w-7 p-0 text-background/60 hover:text-background"
          >
            <XCircle className="w-3 h-3" />
          </Button>
        </div>
      )}
    </>
  );
}

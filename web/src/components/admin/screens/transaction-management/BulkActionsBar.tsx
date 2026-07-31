import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  XCircle as XCircleIcon,
  Download,
  Undo2,
  X,
  Loader2,
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import { Transaction } from './types';

interface BulkActionsBarProps {
  selectedCount: number;
  bulkLoading: boolean;
  onApprove: () => void;
  onReject: () => void;
  onExport: () => void;
  onClear: () => void;
  hasLastAction: boolean;
  onUndo: () => void;
}

export function BulkActionsBar({
  selectedCount,
  bulkLoading,
  onApprove,
  onReject,
  onExport,
  onClear,
  hasLastAction,
  onUndo,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-1 p-2 bg-primary/5 border-b border-primary/20">
      <span className="text-xs px-2 font-medium text-primary">
        {selectedCount} selected
      </span>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
        disabled={bulkLoading}
        onClick={onApprove}
        title="Approve All"
      >
        {bulkLoading ? (
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4 mr-1.5" />
        )}{' '}
        Approve
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        disabled={bulkLoading}
        onClick={onReject}
        title="Reject All"
      >
        <XCircleIcon className="w-4 h-4 mr-1.5" /> Reject
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-muted-foreground/10 transition-all duration-200"
        onClick={onExport}
      >
        <Download className="w-4 h-4 mr-1.5" /> Export
      </Button>
      {hasLastAction && (
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

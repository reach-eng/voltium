import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Ban, Trash2, Download, Undo2, X } from 'lucide-react';
import { BRAND_DOMAIN } from '@/lib/branding';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Rider } from '@/lib/types/admin';

interface LastAction {
  ids: string[];
  previousStates: Record<string, any>;
  action: string;
}

interface RiderBulkActionsProps {
  selectedIds: Set<string>;
  bulkLoading: boolean;
  handleBulkAction: (action: string, value?: string) => void;
  setBulkDeleteOpen: (open: boolean) => void;
  lastAction: LastAction | null;
  handleUndo: () => void;
  setSelectedIds: (ids: Set<string>) => void;
  riders: Rider[];
}

export function RiderBulkActions({
  selectedIds,
  bulkLoading,
  handleBulkAction,
  setBulkDeleteOpen,
  lastAction,
  handleUndo,
  setSelectedIds,
  riders,
}: RiderBulkActionsProps) {
  if (selectedIds.size === 0) return null;

  return (
    <div className="flex items-center gap-1 p-1 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-right-2">
      <span className="text-xs px-2 font-medium text-primary">
        {selectedIds.size} selected
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-10 text-xs px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
        disabled={bulkLoading}
        onClick={() => handleBulkAction('updateStatus', 'POST_ACTIVE')}
        title="Approve (Ctrl+K)"
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
        onClick={() => handleBulkAction('updateStatus', 'SUSPENDED')}
        title="Suspend (Ctrl+R)"
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
        onClick={() => setBulkDeleteOpen(true)}
      >
        <Trash2 className="w-4 h-4 mr-1.5" /> Delete
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-10 text-xs px-3 hover:bg-muted-foreground/10 transition-all duration-200"
        onClick={() => {
          const header = 'Rider ID,Name,Phone,State,KYC Status';
          const rows = riders
            .filter((r) => selectedIds.has(r.id))
            .map((r) =>
              [r.riderId, `"${r.fullName || ''}"`, r.phone, r.state, r.kycStatus].join(',')
            );
          const csv = [header, ...rows].join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute(
            'download',
            `${BRAND_DOMAIN.split('.')[0]}-riders-${formatDateDDMMYYYY(new Date())}.csv`
          );
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }}
      >
        <Download className="w-4 h-4 mr-1.5" /> Export
      </Button>
      {lastAction && (
        <>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-10 text-xs px-3 hover:bg-muted/10 transition-all duration-200"
            disabled={bulkLoading}
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
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
        onClick={() => setSelectedIds(new Set())}
        title="Clear selection"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

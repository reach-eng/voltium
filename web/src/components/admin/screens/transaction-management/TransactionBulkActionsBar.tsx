'use client';

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
import type { Transaction, LastBulkAction } from './types';

interface TransactionBulkActionsBarProps {
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  transactions: Transaction[];
  bulkLoading: boolean;
  onBulkApprove: () => void;
  onBulkRejectClick: () => void;
  lastAction: LastBulkAction | null;
  onUndo: () => void;
}

export function TransactionBulkActionsBar({
  selectedIds,
  setSelectedIds,
  transactions,
  bulkLoading,
  onBulkApprove,
  onBulkRejectClick,
  lastAction,
  onUndo,
}: TransactionBulkActionsBarProps) {
  if (selectedIds.size === 0) return null;

  return (
    <div className="flex items-center gap-1 p-2 bg-primary/5 border-b border-primary/20">
      <span className="text-xs px-2 font-medium text-primary">
        {selectedIds.size} selected
      </span>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
        disabled={bulkLoading}
        onClick={onBulkApprove}
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
        onClick={onBulkRejectClick}
        title="Reject All"
      >
        <XCircleIcon className="w-4 h-4 mr-1.5" /> Reject
      </Button>
      <Button
        variant="ghost"
        size="default"
        className="h-10 text-sm px-3 hover:bg-muted-foreground/10 transition-all duration-200"
        onClick={() => {
          const header = 'ID,Rider,Phone,Type,Amount,Purpose,Status,Date';
          const escapeCsv = (val: unknown) => {
            const str = String(val ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          };
          const rows = transactions
            .filter((tx) => selectedIds.has(tx.id))
            .map((tx) =>
              [
                escapeCsv(tx.id.substring(0, 8)),
                escapeCsv(tx.rider?.fullName || tx.rider?.name || ''),
                escapeCsv(tx.rider?.phone || ''),
                escapeCsv(tx.type),
                escapeCsv(tx.amount),
                escapeCsv(tx.purpose),
                escapeCsv(tx.status),
                escapeCsv(tx.createdAt),
              ].join(','),
            );
          const csv = [header, ...rows].join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute(
            'download',
            `transactions-${formatDateDDMMYYYY(new Date())}.csv`,
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
        onClick={() => setSelectedIds(new Set())}
        title="Clear selection"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

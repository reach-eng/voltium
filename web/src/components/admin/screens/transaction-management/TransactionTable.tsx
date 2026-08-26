'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  CheckCircle,
  XCircle as XCircleIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Transaction } from './types';
import { formatINR, formatDate, getTransactionColors } from './helpers';
import { TransactionBulkActionsBar } from './TransactionBulkActionsBar';

interface TransactionTableRowProps {
  tx: Transaction;
  isSelected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  onSelectTx: (tx: Transaction) => void;
  onConfirmAction: (action: { tx: Transaction; action: 'approve' | 'reject' }) => void;
}

// Memoized table row to prevent re-rendering all rows on single checkbox toggle
const TransactionTableRow = React.memo(function TransactionTableRow({
  tx,
  isSelected,
  onToggleSelect,
  onSelectTx,
  onConfirmAction,
}: TransactionTableRowProps) {
  const { badgeColor, amountColor, statusBadgeColor, isCredit } = getTransactionColors(tx);

  return (
    <TableRow className={isSelected ? 'bg-primary/5' : ''}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onToggleSelect(tx.id, !!checked)}
        />
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {tx.id.substring(0, 8)}...
      </TableCell>
      <TableCell className="text-sm">
        {tx.rider?.fullName || tx.rider?.name || 'Unknown'}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] font-black uppercase tracking-tight ${badgeColor}`}
        >
          {tx.type}
        </Badge>
      </TableCell>
      <TableCell className={`font-black text-sm ${amountColor}`}>
        {isCredit ? '+' : '-'}
        {formatINR(tx.amount)}
      </TableCell>
      <TableCell className="text-xs">
        <div className="flex flex-col gap-1">
          <span>{(tx.purpose || '').replace('_', ' ')}</span>
          {tx.breakdowns && tx.breakdowns.length > 0 && (
            <div className="text-[10px] text-muted-foreground mt-1 p-1 bg-muted/20 rounded">
              {tx.breakdowns.map((item, idx) => (
                <div key={idx} className="flex justify-between w-32">
                  <span>{item.item}:</span>
                  <span className="font-mono">{formatINR(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{tx.method || '-'}</TableCell>
      <TableCell>
        {tx.proofUrl ? (
          <div
            className="w-8 h-8 rounded border overflow-hidden bg-muted cursor-pointer hover:scale-110 transition-transform"
            onClick={() => onSelectTx(tx)}
          >
            <img
              src={tx.proofUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] font-black uppercase tracking-tight ${statusBadgeColor}`}
        >
          {tx.status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(tx.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onSelectTx(tx)}
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>

          {tx.status === 'PENDING' && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => onConfirmAction({ tx, action: 'approve' })}
                title="Approve"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onConfirmAction({ tx, action: 'reject' })}
                title="Reject"
              >
                <XCircleIcon className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

interface TransactionTableProps {
  loading: boolean;
  sorted: Transaction[];
  transactions: Transaction[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  sortKey: string | null;
  // T-AR-SORT (Step 5): `null` is part of the 3-state cycle
  // (none → desc → asc → none).
  sortDir: 'asc' | 'desc' | null;
  handleSort: (key: string) => void;
  setSelectedTx: (tx: Transaction | null) => void;
  setConfirmAction: (
    action: { tx: Transaction; action: 'approve' | 'reject' } | null,
  ) => void;
  bulkLoading: boolean;
  handleBulkAction: (action: 'approve' | 'reject', reason?: string) => void;
  setBulkRejectDialog: (open: boolean) => void;
  lastAction: any;
  handleUndo: () => void;
  page: number;
  totalPages: number;
  total: number;
  setPage: (page: number | ((p: number) => number)) => void;
}

export function TransactionTable({
  loading,
  sorted,
  transactions,
  selectedIds,
  setSelectedIds,
  sortKey,
  sortDir,
  handleSort,
  setSelectedTx,
  setConfirmAction,
  bulkLoading,
  handleBulkAction,
  setBulkRejectDialog,
  lastAction,
  handleUndo,
  page,
  totalPages,
  total,
  setPage,
}: TransactionTableProps) {
  const handleToggleSelect = React.useCallback(
    (id: string, checked: boolean) => {
      const next = new Set(selectedIds);
      if (checked) next.add(id);
      else next.delete(id);
      setSelectedIds(next);
    },
    [selectedIds, setSelectedIds],
  );

  return (
    <Card className="shadow-xs border-border">
      <CardContent className="p-0">
        <TransactionBulkActionsBar
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          transactions={transactions}
          bulkLoading={bulkLoading}
          onBulkApprove={() => handleBulkAction('approve')}
          onBulkRejectClick={() => setBulkRejectDialog(true)}
          lastAction={lastAction}
          onUndo={handleUndo}
        />

        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
            <ArrowLeftRight className="w-12 h-12 stroke-1 mb-3 text-muted-foreground/50" />
            <p className="font-semibold text-foreground text-base">No transactions found</p>
            <p className="text-xs mt-1">Try adjusting your filters or search criteria.</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          sorted.length > 0 &&
                          sorted.every((tx) => selectedIds.has(tx.id))
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(new Set(sorted.map((t) => t.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('amount')}
                      // T-AR-SORT a11y: announce the sort state to
                      // screen readers. "none" is the ARIA default for
                      // any column that isn't the active sort key
                      // (including the third-click "cleared" state).
                      aria-sort={
                        sortKey === 'amount'
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        Amount
                        {sortKey === 'amount' && sortDir === 'asc' && (
                          <ArrowUp className="h-3.5 w-3.5" />
                        )}
                        {sortKey === 'amount' && sortDir === 'desc' && (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                        {sortKey !== 'amount' && (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Proof</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort('createdAt')}
                      aria-sort={
                        sortKey === 'createdAt'
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        Date
                        {sortKey === 'createdAt' && sortDir === 'asc' && (
                          <ArrowUp className="h-3.5 w-3.5" />
                        )}
                        {sortKey === 'createdAt' && sortDir === 'desc' && (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                        {sortKey !== 'createdAt' && (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </span>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((tx) => (
                    <TransactionTableRow
                      key={tx.id}
                      tx={tx}
                      isSelected={selectedIds.has(tx.id)}
                      onToggleSelect={handleToggleSelect}
                      onSelectTx={setSelectedTx}
                      onConfirmAction={setConfirmAction}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
              <div>
                Showing {sorted.length} of {total} transactions
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium">
                  Page {page} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

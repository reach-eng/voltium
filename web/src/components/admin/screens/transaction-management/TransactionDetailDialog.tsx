'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download } from 'lucide-react';
import type { Transaction } from './types';
import { formatINR, formatDate, getTransactionColors } from './helpers';

export interface TransactionDetailDialogProps {
  selectedTx: Transaction | null;
  onClose: () => void;
}

export function TransactionDetailDialog({
  selectedTx,
  onClose,
}: TransactionDetailDialogProps) {
  return (
    <Dialog open={!!selectedTx} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>
        {selectedTx &&
          (() => {
            const { amountColor, statusBadgeColor, isCredit } =
              getTransactionColors(selectedTx);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Transaction ID
                    </p>
                    <p className="text-sm font-mono">
                      {selectedTx.id.substring(0, 12)}...
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge
                      variant="outline"
                      className={`text-xs font-black uppercase tracking-tight ${statusBadgeColor}`}
                    >
                      {selectedTx.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rider</p>
                    <p className="text-sm font-medium">
                      {selectedTx.rider?.fullName ||
                        selectedTx.rider?.name ||
                        'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTx.rider?.phone}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className={`text-lg font-bold ${amountColor}`}>
                      {isCredit ? '+' : '-'}
                      {formatINR(selectedTx.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="text-sm">{selectedTx.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Purpose</p>
                    <p className="text-sm">
                      {(selectedTx.purpose || '').replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Method</p>
                    <p className="text-sm">{selectedTx.method || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm">{formatDate(selectedTx.createdAt)}</p>
                  </div>
                </div>

                {selectedTx.reason && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Reason</p>
                    <p className="text-sm">{selectedTx.reason}</p>
                  </div>
                )}
                {selectedTx.description && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm">{selectedTx.description}</p>
                  </div>
                )}
                {selectedTx.rejectionReason && (
                  <div className="bg-rose-500/5 rounded-lg p-3 border border-rose-500/20">
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-rose-700 dark:text-rose-400">
                      {selectedTx.rejectionReason}
                    </p>
                  </div>
                )}
                {selectedTx.approvedAt && (
                  <div className="bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/20">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Approved At
                    </p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      {formatDate(selectedTx.approvedAt)}
                    </p>
                  </div>
                )}

                {selectedTx.proofUrl && (
                  <div className="space-y-2 pt-2 border-t mt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Proof of Transaction
                    </p>
                    <div className="aspect-[3/4] w-full rounded-xl border bg-muted/20 overflow-hidden flex items-center justify-center group relative">
                      <img
                        src={selectedTx.proofUrl}
                        alt="Transaction Proof"
                        className="w-full h-full object-contain transition-transform group-hover:scale-105"
                      />
                      <a
                        href={selectedTx.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                      >
                        <Button
                          variant="secondary"
                          size="default"
                          className="h-11 px-5 gap-2"
                        >
                          <Download className="w-5 h-5" />
                          Download Original
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
      </DialogContent>
    </Dialog>
  );
}

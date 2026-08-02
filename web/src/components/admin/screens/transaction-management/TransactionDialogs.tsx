'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Undo2, X, Loader2 } from 'lucide-react';
import RiderSelector from '../../RiderSelector';
import type { ConfirmActionState } from './types';
import { formatINR } from './helpers';

interface ConfirmActionDialogProps {
  confirmAction: ConfirmActionState | null;
  onClose: () => void;
  actionLoading: boolean;
  handleAction: () => void;
  rejectionReason: string;
  setRejectionReason: (reason: string) => void;
  creditWallet: boolean;
  setCreditWallet: (credit: boolean) => void;
  walletCreditAmount: number;
  setWalletCreditAmount: (amount: number) => void;
}

export function ConfirmActionDialog({
  confirmAction,
  onClose,
  actionLoading,
  handleAction,
  rejectionReason,
  setRejectionReason,
  creditWallet,
  setCreditWallet,
  walletCreditAmount,
  setWalletCreditAmount,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={!!confirmAction} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmAction?.action === 'approve'
              ? 'Approve Transaction'
              : 'Reject Transaction'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-muted-foreground text-sm">
              {confirmAction?.action === 'approve' ? (
                <div className="space-y-4">
                  <p>
                    Are you sure you want to approve this transaction for{' '}
                    <strong>{formatINR(confirmAction?.tx.amount || 0)}</strong>?
                  </p>
                  {confirmAction?.tx.purpose === 'SECURITY_DEPOSIT' && (
                    <div className="p-4 border rounded-xl bg-muted/10 space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={creditWallet}
                          onChange={(e) => {
                            setCreditWallet(e.target.checked);
                            if (e.target.checked)
                              setWalletCreditAmount(
                                confirmAction?.tx.amount
                                  ? Math.round(confirmAction.tx.amount / 100)
                                  : 0,
                              );
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">
                          Also add amount to wallet balance?
                        </span>
                      </label>
                      {creditWallet && (
                        <div className="flex items-center gap-2 pl-7">
                          <span className="text-sm font-semibold text-muted-foreground">
                            ₹
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={walletCreditAmount}
                            onChange={(e) =>
                              setWalletCreditAmount(
                                Math.max(1, Number(e.target.value)),
                              )
                            }
                            className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <span className="text-xs text-muted-foreground">
                            will be credited
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to reject this transaction for{' '}
                    <strong>{formatINR(confirmAction?.tx.amount || 0)}</strong>?
                  </p>
                  <textarea
                    className="w-full p-2 border rounded-md text-sm text-foreground bg-background"
                    placeholder="Rejection reason..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={actionLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleAction}
            disabled={actionLoading}
            className={
              confirmAction?.action === 'reject'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }
          >
            {actionLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            {confirmAction?.action === 'approve' ? 'Approve' : 'Reject'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface BulkRejectDialogProps {
  open: boolean;
  onClose: () => void;
  bulkLoading: boolean;
  bulkRejectReason: string;
  setBulkRejectReason: (reason: string) => void;
  onConfirm: () => void;
}

export function BulkRejectDialog({
  open,
  onClose,
  bulkLoading,
  bulkRejectReason,
  setBulkRejectReason,
  onConfirm,
}: BulkRejectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject Selected Transactions</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label className="text-xs font-semibold">
            Rejection Reason (Optional)
          </Label>
          <textarea
            className="w-full p-2.5 border rounded-lg text-sm bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="Enter reason for rejecting selected transactions..."
            value={bulkRejectReason}
            onChange={(e) => setBulkRejectReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={bulkLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={bulkLoading}
          >
            {bulkLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Reject All Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeductWalletModalProps {
  open: boolean;
  onClose: () => void;
  deductRiderId: string;
  setDeductRiderId: (id: string) => void;
  deductAmount: string;
  setDeductAmount: (amount: string) => void;
  deductReason: string;
  setDeductReason: (reason: string) => void;
  deductLoading: boolean;
  onDeduct: () => void;
}

export function DeductWalletModal({
  open,
  onClose,
  deductRiderId,
  setDeductRiderId,
  deductAmount,
  setDeductAmount,
  deductReason,
  setDeductReason,
  deductLoading,
  onDeduct,
}: DeductWalletModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Deduct from Wallet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Select Rider</Label>
            <RiderSelector
              value={deductRiderId}
              onChange={setDeductRiderId}
              placeholder="Search rider by name or phone..."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Deduction Amount (₹)</Label>
            <Input
              type="number"
              min="1"
              placeholder="Enter amount"
              value={deductAmount}
              onChange={(e) => setDeductAmount(e.target.value)}
              className="h-10 rounded-lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reason for Deduction</Label>
            <textarea
              className="w-full p-2.5 border rounded-lg text-sm bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              placeholder="Enter details/reason for this deduction..."
              value={deductReason}
              onChange={(e) => setDeductReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deductLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onDeduct}
            disabled={deductLoading}
          >
            {deductLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Deduct Amount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UndoToastProps {
  show: boolean;
  onUndo: () => void;
  onClose: () => void;
  bulkLoading: boolean;
}

export function UndoToast({
  show,
  onUndo,
  onClose,
  bulkLoading,
}: UndoToastProps) {
  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-4 bg-foreground text-background dark:bg-card dark:text-card-foreground rounded-xl shadow-2xl border border-border animate-in slide-in-from-bottom-5">
      <span className="text-sm font-medium">Bulk action completed.</span>
      <Button
        variant="secondary"
        size="sm"
        className="h-8 text-xs font-semibold px-3"
        disabled={bulkLoading}
        onClick={onUndo}
      >
        <Undo2 className="w-3.5 h-3.5 mr-1.5" /> Undo (Ctrl+Z)
      </Button>
      <button
        onClick={onClose}
        className="p-1 rounded-md hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

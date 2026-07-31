import { Button } from '@/components/ui/button';
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
import { Loader2 } from 'lucide-react';
import { Transaction, formatINR } from './types';

interface ConfirmActionDialogProps {
  confirmAction: { tx: Transaction; action: 'approve' | 'reject' } | null;
  onClose: () => void;
  onConfirm: () => void;
  rejectionReason: string;
  onRejectionReasonChange: (value: string) => void;
  creditWallet: boolean;
  onCreditWalletChange: (value: boolean) => void;
  walletCreditAmount: number;
  onWalletCreditAmountChange: (value: number) => void;
  actionLoading: boolean;
}

export function ConfirmActionDialog({
  confirmAction,
  onClose,
  onConfirm,
  rejectionReason,
  onRejectionReasonChange,
  creditWallet,
  onCreditWalletChange,
  walletCreditAmount,
  onWalletCreditAmountChange,
  actionLoading,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog
      open={!!confirmAction}
      onOpenChange={() => onClose()}
    >
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
                            onCreditWalletChange(e.target.checked);
                            if (e.target.checked)
                              onWalletCreditAmountChange(
                                confirmAction?.tx.amount
                                  ? Math.round(confirmAction.tx.amount / 100)
                                  : 0
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
                              onWalletCreditAmountChange(Math.max(1, Number(e.target.value)))
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
                    className="w-full p-2 border rounded-md text-sm text-foreground"
                    placeholder="Rejection reason..."
                    value={rejectionReason}
                    onChange={(e) => onRejectionReasonChange(e.target.value)}
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={actionLoading}
            className={
              confirmAction?.action === 'reject'
                ? 'bg-destructive text-destructive-foreground'
                : ''
            }
          >
            {actionLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            {confirmAction?.action === 'approve' ? 'Approve' : 'Reject'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

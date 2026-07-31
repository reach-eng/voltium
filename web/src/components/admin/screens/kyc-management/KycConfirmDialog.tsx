'use client';
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
import type { KycRider } from './kyc-types';

interface KycConfirmDialogProps {
  confirmAction: {
    rider: KycRider;
    action: 'approve' | 'reject' | 'info_required';
  } | null;
  onClose: () => void;
  onConfirm: () => void;
  rejectionReason: string;
  onRejectionReasonChange: (reason: string) => void;
  actionLoading: boolean;
}

export function KycConfirmDialog({
  confirmAction,
  onClose,
  onConfirm,
  rejectionReason,
  onRejectionReasonChange,
  actionLoading,
}: KycConfirmDialogProps) {
  return (
    <AlertDialog open={!!confirmAction} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmAction?.action === 'approve'
              ? 'Approve KYC'
              : confirmAction?.action === 'info_required'
                ? 'Request Correction'
                : 'Reject KYC'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to{' '}
            {confirmAction?.action === 'info_required'
              ? 'request corrections for'
              : confirmAction?.action}{' '}
            the KYC verification for <strong>{confirmAction?.rider.fullName}</strong>?
            {(confirmAction?.action === 'reject' ||
              confirmAction?.action === 'info_required') && (
              <textarea
                className="w-full mt-3 p-2 border rounded-md text-sm"
                placeholder={
                  confirmAction?.action === 'info_required'
                    ? 'What needs correction...'
                    : 'Rejection reason...'
                }
                value={rejectionReason}
                onChange={(e) => onRejectionReasonChange(e.target.value)}
              />
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={actionLoading}
            className={
              confirmAction?.action === 'reject'
                ? 'bg-destructive text-destructive-foreground'
                : confirmAction?.action === 'info_required'
                  ? 'bg-orange-500 hover:bg-orange-600'
                  : ''
            }
          >
            {actionLoading
              ? 'Processing...'
              : confirmAction?.action === 'approve'
                ? 'Approve'
                : confirmAction?.action === 'info_required'
                  ? 'Request Correction'
                  : 'Reject'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

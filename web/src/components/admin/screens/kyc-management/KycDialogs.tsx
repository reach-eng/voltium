'use client';

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
import { Undo2, XCircle } from 'lucide-react';
import type { KycConfirmAction, LastKycBulkAction } from './types';

export interface KycDialogsProps {
  confirmAction: KycConfirmAction | null;
  setConfirmAction: (action: KycConfirmAction | null) => void;
  rejectionReason: string;
  setRejectionReason: (reason: string) => void;
  handleKycAction: () => void;
  actionLoading: boolean;

  // Undo Toast
  showUndoToast: boolean;
  setShowUndoToast: (show: boolean) => void;
  lastAction: LastKycBulkAction | null;
  handleUndo: () => void;
}

export function KycDialogs({
  confirmAction,
  setConfirmAction,
  rejectionReason,
  setRejectionReason,
  handleKycAction,
  actionLoading,
  showUndoToast,
  setShowUndoToast,
  lastAction,
  handleUndo,
}: KycDialogsProps) {
  return (
    <>
      {/* Undo Toast */}
      {showUndoToast && lastAction && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-xl shadow-lg animate-in slide-in-from-bottom-2">
          <span className="text-sm">
            {lastAction.ids.length} rider(s) updated to {lastAction.action}
          </span>
          <Button size="sm" variant="secondary" onClick={handleUndo} className="h-7 text-xs">
            <Undo2 className="w-3 h-3 mr-1" /> Undo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowUndoToast(false)}
            className="h-7 w-7 p-0 text-background/60 hover:text-background"
          >
            <XCircle className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Confirm Action Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
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
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKycAction}
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
    </>
  );
}

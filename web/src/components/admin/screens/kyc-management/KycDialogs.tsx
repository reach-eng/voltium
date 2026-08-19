'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Undo2, XCircle, Loader2 } from 'lucide-react';
import type { KycConfirmAction, LastKycBulkAction, KycBulkConfirmAction } from './types';

export interface KycDialogsProps {
  confirmAction: KycConfirmAction | null;
  setConfirmAction: (action: KycConfirmAction | null) => void;
  rejectionReason: string;
  setRejectionReason: (reason: string) => void;
  handleKycAction: () => void;
  actionLoading: boolean;

  // Bulk actions
  selectedCount: number;
  bulkConfirmAction: KycBulkConfirmAction | null;
  setBulkConfirmAction: (action: KycBulkConfirmAction | null) => void;
  bulkRejectionReason: string;
  setBulkRejectionReason: (reason: string) => void;
  handleBulkAction: (action: KycBulkConfirmAction, reason?: string) => void;
  bulkLoading: boolean;

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
  selectedCount,
  bulkConfirmAction,
  setBulkConfirmAction,
  bulkRejectionReason,
  setBulkRejectionReason,
  handleBulkAction,
  bulkLoading,
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
          <span className="text-sm font-medium">
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

      {/* Single-Rider Confirm Action Dialog */}
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
            <AlertDialogDescription className="space-y-3">
              <span>
                Are you sure you want to{' '}
                {confirmAction?.action === 'info_required'
                  ? 'request corrections for'
                  : confirmAction?.action}{' '}
                the KYC verification for <strong>{confirmAction?.rider.fullName}</strong>?
              </span>
              {(confirmAction?.action === 'reject' ||
                confirmAction?.action === 'info_required') && (
                <div className="pt-2">
                  <Label className="text-xs font-semibold text-foreground mb-1 block">
                    {confirmAction?.action === 'info_required'
                      ? 'Correction Details (Min 5 chars)'
                      : 'Rejection Reason (Min 5 chars)'}
                  </Label>
                  <Textarea
                    placeholder={
                      confirmAction?.action === 'info_required'
                        ? 'What needs correction...'
                        : 'Rejection reason...'
                    }
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleKycAction}
              disabled={
                actionLoading ||
                ((confirmAction?.action === 'reject' || confirmAction?.action === 'info_required') &&
                  rejectionReason.trim().length < 5)
              }
              className={
                confirmAction?.action === 'reject'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : confirmAction?.action === 'info_required'
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
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

      {/* Bulk Approve Confirmation Dialog */}
      <AlertDialog
        open={bulkConfirmAction === 'approve'}
        onOpenChange={() => setBulkConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Approve KYC</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve KYC verification for all{' '}
              <strong>{selectedCount}</strong> selected rider(s)? This action will update their KYC status to APPROVED.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkAction('approve')}
              disabled={bulkLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {bulkLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Approving...
                </>
              ) : (
                `Approve ${selectedCount} Rider(s)`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Reject / Correction Dialog */}
      <Dialog
        open={bulkConfirmAction === 'reject' || bulkConfirmAction === 'info_required'}
        onOpenChange={() => setBulkConfirmAction(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkConfirmAction === 'reject'
                ? `Bulk Reject (${selectedCount} Riders)`
                : `Bulk Request Correction (${selectedCount} Riders)`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">
              {bulkConfirmAction === 'reject'
                ? 'Rejection Reason (Required, min 10 chars)'
                : 'Correction Details (Required, min 5 chars)'}
            </Label>
            <Textarea
              placeholder={
                bulkConfirmAction === 'reject'
                  ? 'Enter reason for rejecting selected KYC applications...'
                  : 'Specify what documents/details need correction...'
              }
              value={bulkRejectionReason}
              onChange={(e) => setBulkRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkConfirmAction(null)}
              disabled={bulkLoading}
            >
              Cancel
            </Button>
            <Button
              variant={bulkConfirmAction === 'reject' ? 'destructive' : 'default'}
              className={bulkConfirmAction === 'info_required' ? 'bg-orange-500 hover:bg-orange-600' : ''}
              onClick={() => {
                if (bulkConfirmAction) {
                  handleBulkAction(bulkConfirmAction, bulkRejectionReason);
                }
              }}
              disabled={
                bulkLoading ||
                (bulkConfirmAction === 'reject' && bulkRejectionReason.trim().length < 10) ||
                (bulkConfirmAction === 'info_required' && bulkRejectionReason.trim().length < 5)
              }
            >
              {bulkLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {bulkConfirmAction === 'reject'
                ? `Reject ${selectedCount} Selected`
                : `Request Correction`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

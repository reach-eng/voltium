'use client';

import { X, Undo2 } from 'lucide-react';
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
import type { Rider, ConfirmKycState } from './types';

interface RiderDeleteDialogProps {
  open: boolean;
  riderName?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RiderDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
}: RiderDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the rider
            profile and remove their data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Rider
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RiderKycActionDialogProps {
  state: ConfirmKycState | null;
  reason: string;
  saving: boolean;
  onReasonChange: (v: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RiderKycActionDialog({
  state,
  reason,
  saving,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: RiderKycActionDialogProps) {
  const verb =
    state?.action === 'approve'
      ? 'approve'
      : state?.action === 'info_required'
        ? 'request corrections for'
        : state?.action;
  const title =
    state?.action === 'approve'
      ? 'Approve KYC'
      : state?.action === 'info_required'
        ? 'Request Correction'
        : 'Reject KYC';
  const needsReason =
    state?.action === 'reject' || state?.action === 'info_required';
  const ctaClass =
    state?.action === 'reject'
      ? 'bg-destructive hover:bg-destructive/90'
      : state?.action === 'info_required'
        ? 'bg-orange-500 hover:bg-orange-600'
        : '';
  const ctaLabel =
    state?.action === 'approve'
      ? 'Approve'
      : state?.action === 'info_required'
        ? 'Request Correction'
        : 'Reject';

  return (
    <AlertDialog
      open={!!state}
      onOpenChange={(open) => {
        onOpenChange(open);
      }}
    >
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {verb} the KYC verification for{' '}
            <strong>{state?.rider.fullName}</strong>?
            {needsReason && (
              <textarea
                className="w-full mt-3 p-2 border rounded-lg text-sm"
                placeholder={
                  state?.action === 'info_required'
                    ? 'What needs correction...'
                    : 'Rejection reason...'
                }
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
              />
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={saving || (needsReason && !reason.trim())}
            className={ctaClass}
          >
            {ctaLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RiderDeleteDocDialogProps {
  docKey: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RiderDeleteDocDialog({
  docKey,
  onOpenChange,
  onConfirm,
}: RiderDeleteDocDialogProps) {
  return (
    <AlertDialog
      open={!!docKey}
      onOpenChange={(open) => onOpenChange(open)}
    >
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Document</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this <strong>{docKey}</strong>{' '}
            document? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RiderClearGuarantorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RiderClearGuarantorDialog({
  open,
  onOpenChange,
  onConfirm,
}: RiderClearGuarantorDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Guarantor</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to clear all guarantor information for this
            rider? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear Guarantor
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RiderBulkDeleteDialogProps {
  open: boolean;
  count: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RiderBulkDeleteDialog({
  open,
  count,
  onOpenChange,
  onConfirm,
}: RiderBulkDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} Rider{count !== 1 ? 's' : ''}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the selected rider
            {count !== 1 ? 's' : ''}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RiderUndoToastProps {
  visible: boolean;
  count: number;
  action: string;
  busy: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export function RiderUndoToast({
  visible,
  count,
  action,
  busy,
  onUndo,
  onDismiss,
}: RiderUndoToastProps) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-xl shadow-lg animate-in slide-in-from-bottom-2">
      <span className="text-sm">
        {count} rider(s) updated to {action}
      </span>
      <Button size="sm" variant="secondary" onClick={onUndo} className="h-7 text-xs">
        <Undo2 className="w-3 h-3 mr-1" /> Undo
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDismiss}
        className="h-7 w-7 p-0 text-background/60 hover:text-background"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

// Suppress unused-import warning for Rider (kept for type clarity)
void ({} as Rider);

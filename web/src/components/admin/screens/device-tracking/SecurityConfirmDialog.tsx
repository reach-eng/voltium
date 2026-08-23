'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ConfirmDialogState, SecurityAction } from './types';

// P1-1 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): the high-impact
// actions require a free-text reason. Mirrored from the server's
// `HIGH_IMPACT_ACTIONS` set in the route — keep in sync.
const HIGH_IMPACT_ACTIONS = new Set<string>([
  'FACTORY_RESET',
  'ADMIN_LOCK',
  'SEND_UNLOCK_CODE_SMS',
  'UNLOCK_DEVICE',
  'PERSIST_APP',
  'ENFORCE_LOCATION',
]);

interface SecurityConfirmDialogProps {
  state: ConfirmDialogState;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    action: SecurityAction | '',
    extra: Record<string, unknown>,
    options: { reason?: string }
  ) => void;
}

/**
 * R3.7bb split — generic confirm dialog for any triggered security
 * action. The reason textarea is required for high-impact actions
 * (FACTORY_RESET, ADMIN_LOCK, etc.) and forwarded to the server's
 * audit log so compliance can reconstruct "why" without the admin
 * being available.
 */
export function SecurityConfirmDialog({
  state,
  onOpenChange,
  onConfirm,
}: SecurityConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const requiresReason = state.action ? HIGH_IMPACT_ACTIONS.has(state.action) : false;
  const reasonOk = !requiresReason || reason.trim().length >= 3;
  const canConfirm = reasonOk && !!state.action;

  // Reset the reason each time the dialog opens so a stale value
  // from a prior action doesn't carry over.
  const handleOpenChange = (open: boolean) => {
    if (open) setReason('');
    onOpenChange(open);
  };

  return (
    <AlertDialog open={state.open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="rounded-2xl border-2">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            {state.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-medium text-muted-foreground/80">
            {state.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {requiresReason && (
          <div className="space-y-2 py-2">
            <Label className="text-xs font-semibold">
              Reason (recorded in the audit log)
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. rider reported stolen device, KYC verification, compliance request"
              className="min-h-[80px] text-sm"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              Min 3 characters. Required for {state.action}.
            </p>
          </div>
        )}
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="rounded-xl border-none bg-muted/50 hover:bg-muted font-bold uppercase text-[10px] tracking-widest h-11">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={() =>
              onConfirm(
                state.action,
                state.extraData,
                requiresReason ? { reason: reason.trim() } : {}
              )
            }
            className="rounded-xl bg-primary text-white font-black uppercase text-[10px] tracking-widest h-11 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Confirm Action
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

'use client';

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
import type { ConfirmDialogState, SecurityAction } from './types';

interface SecurityConfirmDialogProps {
  state: ConfirmDialogState;
  onOpenChange: (open: boolean) => void;
  onConfirm: (action: SecurityAction | '', extra: Record<string, unknown>) => void;
}

/**
 * R3.7bb split — generic confirm dialog for any triggered security action.
 */
export function SecurityConfirmDialog({
  state,
  onOpenChange,
  onConfirm,
}: SecurityConfirmDialogProps) {
  return (
    <AlertDialog open={state.open} onOpenChange={onOpenChange}>
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
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="rounded-xl border-none bg-muted/50 hover:bg-muted font-bold uppercase text-[10px] tracking-widest h-11">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(state.action, state.extraData)}
            className="rounded-xl bg-primary text-white font-black uppercase text-[10px] tracking-widest h-11 px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105"
          >
            Confirm Action
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

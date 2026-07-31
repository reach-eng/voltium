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

interface DeleteShiftDialogProps {
  deleteTarget: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * R3.7g split — Delete-shift confirmation dialog.
 *
 * Renders the standard alert dialog when a delete target is set; the
 * parent owns the confirm handler which clears `deleteTarget` when
 * the action completes.
 */
export function DeleteShiftDialog({ deleteTarget, onOpenChange, onConfirm }: DeleteShiftDialogProps) {
  return (
    <AlertDialog
      open={!!deleteTarget}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Shift</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure? Shifts with active leases cannot be deleted until the leases are removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-500 hover:bg-red-600">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

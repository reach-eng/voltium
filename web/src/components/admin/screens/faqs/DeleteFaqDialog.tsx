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

interface DeleteFaqDialogProps {
  deleteTarget: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * R3.7n split — Delete FAQ confirmation dialog.
 *
 * Standard alert dialog. Renders only when `deleteTarget` is set;
 * the parent owns the confirm handler.
 */
export function DeleteFaqDialog({ deleteTarget, onOpenChange, onConfirm }: DeleteFaqDialogProps) {
  return (
    <AlertDialog
      open={!!deleteTarget}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete FAQ</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this FAQ? This action cannot be undone.
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

'use client';

import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UnlockCodeDialogProps {
  code: string | null;
  onClose: () => void;
}

/**
 * R3.7bb split — modal that shows the 12-digit unlock code generated
 * by the ADMIN_LOCK action. The code is shown once and never again.
 */
export function UnlockCodeDialog({ code, onClose }: UnlockCodeDialogProps) {
  return (
    <Dialog
      open={!!code}
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md rounded-3xl p-0 border-none shadow-2xl bg-background overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-4 bg-primary/10 border-b border-primary/20">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
            <ShieldAlert className="w-5 h-5" /> Admin Lock Successful
          </DialogTitle>
          <DialogDescription>
            The device has been locked. Use the code below to unlock it.
          </DialogDescription>
        </DialogHeader>
        <div className="p-8 flex flex-col items-center justify-center space-y-4">
          <div className="bg-muted p-4 rounded-xl border border-primary/20 font-mono text-3xl tracking-widest text-primary font-black select-all text-center break-all">
            {code}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Please write this code down or provide it to the rider. You will not
            be able to view it again.
          </p>
        </div>
        <DialogFooter className="px-8 py-4 bg-muted/30 border-t">
          <Button className="w-full rounded-xl h-12 font-bold" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';
import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface DestructiveConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  expectedPhrase: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
}

export function DestructiveConfirm({
  open,
  onOpenChange,
  title,
  description,
  expectedPhrase,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  onConfirm,
  loading = false,
}: DestructiveConfirmProps) {
  const [typedPhrase, setTypedPhrase] = useState('');

  // Reset typed phrase on open/close
  useEffect(() => {
    if (!open) {
      setTypedPhrase('');
    }
  }, [open]);

  const isMatch = typedPhrase.trim() === expectedPhrase.trim();

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch || loading) return;
    await onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <form onSubmit={handleConfirm}>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <AlertDialogTitle>{title}</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground space-y-2 pt-1">
                <div>{description}</div>
                <div className="pt-2">
                  <Label htmlFor="destructive-confirm-input" className="text-xs font-semibold text-foreground">
                    To proceed, type <span className="font-mono font-bold select-all bg-muted px-1.5 py-0.5 rounded border text-destructive">{expectedPhrase}</span> below:
                  </Label>
                  <Input
                    id="destructive-confirm-input"
                    data-testid="destructive-confirm-input"
                    className="mt-1.5 font-mono text-sm"
                    value={typedPhrase}
                    onChange={(e) => setTypedPhrase(e.target.value)}
                    placeholder={expectedPhrase}
                    autoComplete="off"
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={loading} onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </AlertDialogCancel>
            <Button
              type="submit"
              variant={variant}
              disabled={!isMatch || loading}
              data-testid="destructive-confirm-submit"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

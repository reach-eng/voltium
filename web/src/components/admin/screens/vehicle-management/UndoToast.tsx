'use client';

import { Button } from '@/components/ui/button';
import { Undo2 } from 'lucide-react';

interface UndoToastProps {
  visible: boolean;
  count: number;
  disabled: boolean;
  onUndo: () => void;
}

/**
 * R3.7e split — Undo toast for bulk vehicle actions.
 *
 * Fixed bottom-right pill that shows for 5s after a bulk action. Click
 * Undo to revert via individual PUTs to /api/admin/vehicles.
 */
export function UndoToast({ visible, count, disabled, onUndo }: UndoToastProps) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
      <span className="text-sm">{count} vehicle(s) updated</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs px-2 hover:bg-background/20 text-background"
        disabled={disabled}
        onClick={onUndo}
      >
        <Undo2 className="w-3 h-3 mr-1" /> Undo
      </Button>
    </div>
  );
}

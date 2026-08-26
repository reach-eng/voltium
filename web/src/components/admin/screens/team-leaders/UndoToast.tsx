'use client';

import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UndoToastProps {
  visible: boolean;
  count: number;
  busy: boolean;
  onUndo: () => void;
}

/**
 * R3.7aa split — bottom-right floating undo toast. Auto-hides
 * via the parent (5s timer in the hook).
 */
export function UndoToast({ visible, count, busy, onUndo }: UndoToastProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
      <span className="text-sm">{count} team leader(s) updated</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs px-2 hover:bg-background/20 text-background"
        disabled={busy}
        onClick={onUndo}
      >
        <Undo2 className="w-3 h-3 mr-1" /> Undo
      </Button>
    </div>
  );
}

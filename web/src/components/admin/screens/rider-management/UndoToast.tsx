import { Button } from '@/components/ui/button';
import { Undo2, X } from 'lucide-react';

interface UndoToastProps {
  action: string;
  count: number;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ action, count, onUndo, onDismiss }: UndoToastProps) {
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

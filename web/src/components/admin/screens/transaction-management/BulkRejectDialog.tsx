import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface BulkRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: (reason: string) => void;
}

export function BulkRejectDialog({
  open,
  onOpenChange,
  selectedCount,
  reason,
  onReasonChange,
  onConfirm,
}: BulkRejectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {selectedCount} Transactions</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Rejection Reason</Label>
            <textarea
              className="w-full min-h-[100px] p-3 border rounded-lg text-sm resize-none"
              placeholder="Enter rejection reason..."
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="pt-6">
          <Button
            variant="outline"
            size="default"
            className="h-11"
            onClick={() => {
              onOpenChange(false);
              onReasonChange('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="default"
            className="h-11"
            onClick={() => {
              onConfirm(reason);
              onOpenChange(false);
              onReasonChange('');
            }}
          >
            Reject All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

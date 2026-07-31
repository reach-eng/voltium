import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import RiderSelector from '../../RiderSelector';

interface DeductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riderId: string;
  onRiderIdChange: (value: string) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  loading: boolean;
  onConfirm: () => void;
}

export function DeductDialog({
  open,
  onOpenChange,
  riderId,
  onRiderIdChange,
  amount,
  onAmountChange,
  reason,
  onReasonChange,
  loading,
  onConfirm,
}: DeductDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Deduct from Wallet</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Deduct amount from a rider's wallet for damage, penalty, or missing items.
          </p>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Rider</Label>
            <RiderSelector value={riderId} onChange={onRiderIdChange} />
          </div>
          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason for Deduction</Label>
            <Input
              placeholder="e.g. Vehicle Damage, Helmet missing"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading || !riderId || !amount || !reason}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Confirm Deduction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

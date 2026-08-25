import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/error-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdjustWalletModalProps {
  riderId: string;
  currentBalance: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

export default function AdjustWalletModal({ riderId, currentBalance, isOpen, onClose, onSuccess }: AdjustWalletModalProps) {
  const [type, setType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return toast.error('Please enter a valid amount');
    }
    if (type === 'CREDIT' && !proofUrl) {
      return toast.error('Proof of payment is required for wallet top-up');
    }
    if (type === 'DEBIT') {
      if (!reason || !reason.trim()) {
        return toast.error('Reason is required when deducting from wallet (e.g. Late Fee)');
      }
      if (reason.trim().length < 10) {
        return toast.error('Reason must be at least 10 characters for a debit');
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/riders/${riderId}/wallet-adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          type,
          reason,
          proofUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to adjust wallet');

      toast.success(type === 'CREDIT' ? 'Wallet topped up successfully' : 'Amount deducted successfully');
      onSuccess(data.data.walletBalance);
      onClose();
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Operation failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Wallet Balance</DialogTitle>
          <DialogDescription>
            Add funds (Top-up) or deduct funds (Charges/Late Fees) for the rider.
            Current Balance: ₹{(currentBalance || 0).toLocaleString('en-IN')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Action</Label>
            <RadioGroup defaultValue="CREDIT" value={type} onValueChange={(v: 'CREDIT' | 'DEBIT') => setType(v)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="CREDIT" id="credit" />
                <Label htmlFor="credit" className="text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer">Top Up (+)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="DEBIT" id="debit" />
                <Label htmlFor="debit" className="text-rose-600 dark:text-rose-400 font-semibold cursor-pointer">Deduct (-)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
            />
          </div>

          <div className="space-y-2">
            <Label>Reason / Remarks {type === 'DEBIT' && <span className="text-red-500">*</span>}</Label>
            <Textarea
              placeholder={type === 'DEBIT' ? "e.g. Late fee for scooter #2912" : "e.g. Manual top-up by admin"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {type === 'DEBIT' && (
              <p className="text-[11px] text-muted-foreground">
                Minimum 10 characters required for deductions.
              </p>
            )}
          </div>

          {type === 'CREDIT' && (
            <div className="space-y-2">
              <Label>Payment Proof <span className="text-red-500">*</span></Label>
              <Input
                type="url"
                placeholder="https://example.com/receipt.jpg"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className={type === 'CREDIT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {type === 'CREDIT' ? 'Confirm Top Up' : 'Confirm Deduction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

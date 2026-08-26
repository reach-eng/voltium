'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { RiderOption } from './types';

interface IssueReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  riders: RiderOption[];
  riderSearch: string;
  setRiderSearch: (v: string) => void;
  referrerId: string;
  setReferrerId: (v: string) => void;
  refereeId: string;
  setRefereeId: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * R3.7o split — Issue Manual Referral dialog.
 *
 * Renders a search input + referrer select, then a referee select,
 * then a Process button. The dialog only opens when the user clicks
 * the header's "Issue Referral" button; the data hook handles the
 * rider fetch + submission.
 */
export function IssueReferralDialog({
  open,
  onOpenChange,
  riders,
  riderSearch,
  setRiderSearch,
  referrerId,
  setReferrerId,
  refereeId,
  setRefereeId,
  isSubmitting,
  onSubmit,
}: IssueReferralDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Manual Referral</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Referrer (Who is receiving the bonus?)</Label>
            <Input
              placeholder="Search referrer..."
              value={riderSearch}
              onChange={(e) => setRiderSearch(e.target.value)}
              className="mb-2"
            />
            <Select value={referrerId} onValueChange={setReferrerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Referrer" />
              </SelectTrigger>
              <SelectContent>
                {riders.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.fullName} ({r.riderId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Referee (Who joined?)</Label>
            <Select value={refereeId} onValueChange={setRefereeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select Referee" />
              </SelectTrigger>
              <SelectContent>
                {riders.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.fullName} ({r.riderId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Process Referral
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

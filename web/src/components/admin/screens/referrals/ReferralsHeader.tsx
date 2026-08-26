'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ReferralsHeaderProps {
  onIssueClick: () => void;
}

/**
 * R3.7o split — Referrals tab header.
 *
 * H2 + subtitle on the left, "Issue Referral" button on the right.
 */
export function ReferralsHeader({ onIssueClick }: ReferralsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Referral Intelligence</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Track conversions, payment updates, and earnings distribution.
        </p>
      </div>
      <Button onClick={onIssueClick}>
        <Plus className="mr-2 h-4 w-4" /> Issue Referral
      </Button>
    </div>
  );
}

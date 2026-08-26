'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface RewardsHeaderProps {
  showForm: boolean;
  onToggleForm: () => void;
}

/**
 * R3.7l split — Rewards tab header.
 *
 * H2 + subtitle on the left, Award Points / Cancel button on the
 * right. The button text and label flip based on whether the form
 * is currently shown.
 */
export function RewardsHeader({ showForm, onToggleForm }: RewardsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Rewards</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Track rider rewards and loyalty points
        </p>
      </div>
      <Button
        onClick={onToggleForm}
        className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all active:scale-95"
      >
        {showForm ? (
          'Cancel'
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Award Points
          </>
        )}
      </Button>
    </div>
  );
}

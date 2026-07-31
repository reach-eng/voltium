'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TeamLeaderHeaderProps {
  onAdd: () => void;
}

/**
 * R3.7aa split — page title + Add Team Leader button.
 */
export function TeamLeaderHeader({ onAdd }: TeamLeaderHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Team Leaders</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage field team leaders and supervisors
        </p>
      </div>
      <Button onClick={onAdd} size="default" className="rounded-xl h-11 px-5">
        <Plus className="h-5 w-5 mr-1.5" /> Add Team Leader
      </Button>
    </div>
  );
}

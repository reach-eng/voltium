'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ShiftHeaderProps {
  onAddClick: () => void;
}

/**
 * R3.7g split — Shifts tab header.
 *
 * H2 + subtitle on the left, "Add Shift" trigger button on the right.
 */
export function ShiftHeader({ onAddClick }: ShiftHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Shifts</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage delivery shift slots</p>
      </div>
      <Button onClick={onAddClick} size="sm">
        <Plus className="h-4 w-4 mr-1" /> Add Shift
      </Button>
    </div>
  );
}

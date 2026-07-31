'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import type { Shift } from './types';
import { ShiftCard } from './ShiftCard';

interface ShiftsGridProps {
  loading: boolean;
  shifts: Shift[];
  search: string;
  onToggle: (shift: Shift) => void;
  onEdit: (shift: Shift) => void;
  onDelete: (id: string) => void;
}

/**
 * R3.7g split — Shifts grid.
 *
 * Three states: skeleton (3 cards) while loading, empty state (icon
 * + text) when no shifts match, or the responsive 1/2/3-column grid
 * of ShiftCard components.
 */
export function ShiftsGrid({
  loading,
  shifts,
  search,
  onToggle,
  onEdit,
  onDelete,
}: ShiftsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Clock className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm">
          {search ? 'No shifts match your search' : 'No shifts added yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {shifts.map((shift) => (
        <ShiftCard
          key={shift.id}
          shift={shift}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

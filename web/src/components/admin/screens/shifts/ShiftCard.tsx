'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Pencil, Trash2 } from 'lucide-react';
import type { Shift } from './types';

interface ShiftCardProps {
  shift: Shift;
  onToggle: (shift: Shift) => void;
  onEdit: (shift: Shift) => void;
  onDelete: (id: string) => void;
}

/**
 * R3.7g split — Single shift card.
 *
 * Header row: clock icon (active = blue) + name + Active/Inactive badge.
 * Body: time ranges (multi-part or legacy startTime→endTime), max
 * bookings, active lease count. Footer: Activate/Deactivate + edit + delete.
 */
export function ShiftCard({ shift, onToggle, onEdit, onDelete }: ShiftCardProps) {
  return (
    <Card>
      <CardHeader className="pt-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-full ${shift.isActive ? 'bg-blue-500/10' : 'bg-muted'}`}
            >
              <Clock
                className={`h-6 w-6 ${shift.isActive ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}
              />
            </div>
            <div>
              <CardTitle className="text-base leading-tight pb-1">{shift.name}</CardTitle>
              <Badge
                variant="outline"
                className={`mt-1 text-[10px] font-bold ${
                  shift.isActive
                    ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                    : 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                }`}
              >
                {shift.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <div className="space-y-2 text-sm">
          <ShiftTimes shift={shift} />
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium">Max Bookings:</span>
            <span>{shift.maxBookings}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {shift._count?.leases ?? 0} active lease(s)
          </p>
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant={shift.isActive ? 'outline' : 'default'}
            size="sm"
            onClick={() => onToggle(shift)}
          >
            {shift.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Edit shift"
              onClick={() => onEdit(shift)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              aria-label="Delete shift"
              onClick={() => onDelete(shift.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Renders the time range(s) for a shift card. */
function ShiftTimes({ shift }: { shift: Shift }) {
  if (shift.parts && shift.parts.length > 1) {
    return (
      <div className="space-y-1">
        {shift.parts.map((part, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Part {i + 1}:</span>
            <span className="font-medium">
              {part.startTime} → {part.endTime}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      <span>
        {shift.startTime} → {shift.endTime}
      </span>
    </div>
  );
}

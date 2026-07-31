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
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, X } from 'lucide-react';
import type { ShiftForm } from './types';

interface ShiftFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit: boolean;
  form: ShiftForm;
  setForm: (form: ShiftForm) => void;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onUpdatePart: (index: number, field: 'startTime' | 'endTime', value: string) => void;
  onAddPart: () => void;
  onRemovePart: (index: number) => void;
}

/**
 * R3.7g split — Shift form dialog.
 *
 * Name + dynamic list of (start, end) time parts. Each part row has a
 * delete button (hidden when there's only one part). Save button is
 * disabled until name is non-empty and at least one part has both
 * start and end times.
 */
export function ShiftFormDialog({
  open,
  onOpenChange,
  isEdit,
  form,
  setForm,
  error,
  saving,
  onSave,
  onUpdatePart,
  onAddPart,
  onRemovePart,
}: ShiftFormDialogProps) {
  const validPartCount = form.parts.filter((p) => p.startTime && p.endTime).length;
  const canSave = !!form.name && validPartCount > 0 && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit' : 'Add'} Shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Shift Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Morning Shift"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Time Ranges</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddPart}
                className="h-8 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Range
              </Button>
            </div>
            {form.parts.map((part, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Part {index + 1} Start
                  </Label>
                  <Input
                    type="time"
                    value={part.startTime}
                    onChange={(e) => onUpdatePart(index, 'startTime', e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Part {index + 1} End</Label>
                  <Input
                    type="time"
                    value={part.endTime}
                    onChange={(e) => onUpdatePart(index, 'endTime', e.target.value)}
                  />
                </div>
                {form.parts.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemovePart(index)}
                    className="text-red-500 h-10 w-10 p-0 shrink-0"
                    aria-label={`Remove part ${index + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Max Bookings</Label>
            <Input
              type="number"
              min={1}
              value={form.maxBookings}
              onChange={(e) =>
                setForm({ ...form, maxBookings: parseInt(e.target.value) || 1 })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm({ ...form, isActive: v })}
            />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

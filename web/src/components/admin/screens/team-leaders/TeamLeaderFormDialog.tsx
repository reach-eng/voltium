'use client';

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
import { Button } from '@/components/ui/button';
import type { TeamLeaderFormState } from './types';

interface TeamLeaderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: TeamLeaderFormState;
  onFormChange: (updater: (prev: TeamLeaderFormState) => TeamLeaderFormState) => void;
  saving: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function TeamLeaderFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  saving,
  error,
  onSubmit,
}: TeamLeaderFormDialogProps) {
  const set = (patch: Partial<TeamLeaderFormState>) =>
    onFormChange((prev) => ({ ...prev, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit' : 'Add'} Team Leader</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone <span className="text-[11px] text-muted-foreground font-normal">(10 digits)</span></Label>
            <Input
              value={form.phone}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                set({ phone: cleaned });
              }}
              placeholder="10-digit phone number"
              maxLength={10}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              placeholder="Email (optional)"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => set({ isActive: v })}
            />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!form.name.trim() || form.phone.trim().length !== 10 || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

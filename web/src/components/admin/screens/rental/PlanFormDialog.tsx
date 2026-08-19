'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from '@/components/ui/switch';
import {
  PLAN_TYPE_DURATIONS,
  PLAN_TYPE_OPTIONS,
  type PlanFormState,
  type PlanType,
} from './types';

interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: PlanFormState;
  onFormChange: (updater: (prev: PlanFormState) => PlanFormState) => void;
  saving: boolean;
  onSubmit: () => void;
}

/**
 * R3.7y split — add/edit rental plan dialog.
 */
export function PlanFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  saving,
  onSubmit,
}: PlanFormDialogProps) {
  const set = (patch: Partial<PlanFormState>) =>
    onFormChange((prev) => ({ ...prev, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Plan' : 'Add New Plan'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update rental plan details.' : 'Create a new rental plan.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plan Name *</Label>
            <Input
              placeholder="e.g. Daily Explorer"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select
              value={form.type}
              onValueChange={(v) => set({ type: v as PlanType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price (₹) *</Label>
              <Input
                // PR-48 (FINANCE P1-9): min raised from 0 to 1 so the
                // form rejects a zero-priced plan at the UI layer. The
                // server-side Zod schema (`createPlanSchema` in
                // validators.ts) already enforces positive price via
                // `z.number().positive()` — this is the matching
                // client-side guard.
                type="number"
                min="1"
                placeholder="299"
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Security Deposit (₹) *</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={form.securityDeposit}
                onChange={(e) => set({ securityDeposit: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.isSecurityRefundable}
              onCheckedChange={(v) => set({ isSecurityRefundable: v })}
            />
            <Label>Security is Refundable</Label>
          </div>
          {form.isSecurityRefundable && (
            <div className="space-y-2">
              <Label>Refundable After (Days)</Label>
              <Input
                type="number"
                placeholder="e.g. 30"
                value={form.refundableAfterDays}
                onChange={(e) => set({ refundableAfterDays: e.target.value })}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Duration (Days)</Label>
            <Input
              type="text"
              disabled
              value={String(PLAN_TYPE_DURATIONS[form.type])}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              placeholder="Brief plan description"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Additional Info</Label>
            <Input
              placeholder="Extra details about the plan"
              value={form.additionalInfo}
              onChange={(e) => set({ additionalInfo: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-3">
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
            disabled={!form.name || !form.price || saving}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            {editing ? 'Save Changes' : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

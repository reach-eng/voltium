'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { VehicleFormData, Hub } from './types';

interface VehicleFormDialogProps {
  mode: 'add' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: VehicleFormData;
  setForm: React.Dispatch<React.SetStateAction<VehicleFormData>>;
  hubs: Hub[];
  error: string;
  setError: (error: string) => void;
  onSave: () => void;
  saving?: boolean;
}

export function VehicleFormDialog({
  mode,
  open,
  onOpenChange,
  form,
  setForm,
  hubs,
  error,
  setError,
  onSave,
  saving = false,
}: VehicleFormDialogProps) {
  const isAdd = mode === 'add';
  const title = isAdd ? 'Add New Vehicle' : 'Edit Vehicle';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Vehicle Number</Label>
            <Input
              placeholder={isAdd ? 'e.g. DL 1AB 1234' : undefined}
              value={form.vehicleNumber}
              onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              placeholder={isAdd ? 'e.g. Ather 450X' : undefined}
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Hub</Label>
            <Select value={form.hubId} onValueChange={(v) => setForm({ ...form, hubId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select hub" />
              </SelectTrigger>
              <SelectContent>
                {hubs.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No hubs found</div>
                ) : (
                  hubs.map((hub) => (
                    <SelectItem key={hub.id} value={hub.id}>
                      {hub.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Battery Swapping Partner</Label>
            <Select
              value={form.batteryPartner}
              onValueChange={(v) => setForm({ ...form, batteryPartner: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select partner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Battery Smart">Battery Smart</SelectItem>
                <SelectItem value="Sun Mobility">Sun Mobility</SelectItem>
                <SelectItem value="Gogoro">Gogoro</SelectItem>
                <SelectItem value="Voltup">Voltup</SelectItem>
                <SelectItem value="Bounce Infinity">Bounce Infinity</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
                <SelectItem value="RETIRED">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="pt-6">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setError('');
            }}
          >
            Cancel
          </Button>
          {isAdd ? (
            <Button
              onClick={onSave}
              disabled={!form.vehicleNumber || !form.model || !form.hubId}
            >
              Add Vehicle
            </Button>
          ) : (
            <Button onClick={onSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

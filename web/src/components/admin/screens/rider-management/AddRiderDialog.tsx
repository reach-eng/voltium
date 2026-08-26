import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AddRiderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newRider: { phone: string; fullName: string };
  setNewRider: (
    updater: (prev: { phone: string; fullName: string }) => { phone: string; fullName: string }
  ) => void;
  onAdd: () => void;
  adding: boolean;
}

export function AddRiderDialog({
  open,
  onOpenChange,
  newRider,
  setNewRider,
  onAdd,
  adding,
}: AddRiderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add New Rider</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              placeholder="Rider name"
              value={newRider.fullName}
              onChange={(e) => setNewRider((p) => ({ ...p, fullName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone Number (10 digits)</Label>
            <Input
              placeholder="9876543210"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={newRider.phone}
              onChange={(e) =>
                setNewRider((p) => ({
                  ...p,
                  phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                }))
              }
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onAdd} disabled={adding || newRider.phone.length < 10}>
            {adding ? 'Creating...' : 'Add Rider'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

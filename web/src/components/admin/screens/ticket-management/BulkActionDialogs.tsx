'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BulkDialogProps {
  count: number;
  admins: { id: string; name: string }[];
}

// --- Bulk Status Dialog ---

interface BulkStatusDialogProps extends BulkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  onApply: (value: string) => void;
}

export function BulkStatusDialog({
  open,
  onOpenChange,
  count,
  value,
  onValueChange,
  onApply,
}: BulkStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Status for {count} Tickets</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>New Status</Label>
            <Select value={value} onValueChange={onValueChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="pt-6">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onValueChange('');
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!value}
            onClick={() => {
              onApply(value);
              onOpenChange(false);
              onValueChange('');
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Bulk Priority Dialog ---

interface BulkPriorityDialogProps extends BulkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  onApply: (value: string) => void;
}

export function BulkPriorityDialog({
  open,
  onOpenChange,
  count,
  value,
  onValueChange,
  onApply,
}: BulkPriorityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Priority for {count} Tickets</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>New Priority</Label>
            <Select value={value} onValueChange={onValueChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="pt-6">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onValueChange('');
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!value}
            onClick={() => {
              onApply(value);
              onOpenChange(false);
              onValueChange('');
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Bulk Assign Dialog ---

interface BulkAssignDialogProps extends BulkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  onApply: (value: string) => void;
}

export function BulkAssignDialog({
  open,
  onOpenChange,
  count,
  admins,
  value,
  onValueChange,
  onApply,
}: BulkAssignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {count} Tickets</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Assign To</Label>
            <Select value={value} onValueChange={onValueChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select admin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Unassigned</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="pt-6">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onValueChange('');
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!value}
            onClick={() => {
              onApply(value);
              onOpenChange(false);
              onValueChange('');
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

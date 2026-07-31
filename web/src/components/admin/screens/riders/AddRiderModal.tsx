'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface AddRiderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddRiderModal({ open, onOpenChange, onSuccess }: AddRiderModalProps) {
  const [newRider, setNewRider] = useState({ phone: '', fullName: '' });
  const [addingRider, setAddingRider] = useState(false);

  async function handleAddRider() {
    if (!newRider.phone || newRider.phone.length < 10) return;
    setAddingRider(true);
    try {
      const res = await fetch('/api/admin/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+91' + newRider.phone, fullName: newRider.fullName || '' }),
      });
      if (res.ok) {
        toast.success('Rider added successfully');
        onOpenChange(false);
        setNewRider({ phone: '', fullName: '' });
        onSuccess();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || 'Failed to add rider');
      }
    } catch (err) {
      logger.error('Failed to add rider', { error: err });
      toast.error('Network error. Please try again.');
    } finally {
      setAddingRider(false);
    }
  }

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
          <Button onClick={handleAddRider} disabled={addingRider || newRider.phone.length < 10}>
            {addingRider ? 'Creating...' : 'Add Rider'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

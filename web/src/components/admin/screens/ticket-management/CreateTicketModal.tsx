'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated: () => void;
}

export function CreateTicketModal({
  open,
  onOpenChange,
  onTicketCreated,
}: CreateTicketModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    riderDbId: '',
    category: 'GENERAL',
    priority: 'LOW',
    subject: '',
    message: '',
  });
  const [riders, setRiders] = useState<{ id: string; fullName: string; riderId: string }[]>([]);
  const [riderSearch, setRiderSearch] = useState('');

  const fetchRiders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (riderSearch) params.set('search', riderSearch);
      const res = await fetch(`/api/admin/riders?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setRiders(json.data.riders || []);
      }
    } catch {
      logger.error('Failed to fetch riders');
    }
  }, [riderSearch]);

  useEffect(() => {
    if (open) fetchRiders();
  }, [open, riderSearch, fetchRiders]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.riderDbId || !newTicket.subject || !newTicket.message) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Ticket created successfully');
        onOpenChange(false);
        setNewTicket({ riderDbId: '', category: 'GENERAL', priority: 'LOW', subject: '', message: '' });
        onTicketCreated();
      } else {
        toast.error(json.message || 'Failed to create ticket');
      }
    } catch {
      toast.error('Failed to create ticket');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Manual Support Ticket</DialogTitle>
          <DialogDescription>Create a ticket on behalf of a rider.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateTicket} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Rider</Label>
            <Input
              placeholder="Search riders by name, phone or ID..."
              value={riderSearch}
              onChange={(e) => setRiderSearch(e.target.value)}
              className="mb-2"
            />
            <Select
              value={newTicket.riderDbId}
              onValueChange={(val) => setNewTicket({ ...newTicket, riderDbId: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a rider" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {riders.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.fullName} ({r.riderId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newTicket.category}
                onValueChange={(val) => setNewTicket({ ...newTicket, category: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  <SelectItem value="BILLING">Billing</SelectItem>
                  <SelectItem value="ACCIDENT">Accident</SelectItem>
                  <SelectItem value="APP_ISSUE">App Issue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={newTicket.priority}
                onValueChange={(val) => setNewTicket({ ...newTicket, priority: val })}
              >
                <SelectTrigger>
                  <SelectValue />
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
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={newTicket.subject}
              onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              placeholder="Brief summary of the issue"
            />
          </div>
          <div className="space-y-2">
            <Label>Message / Details</Label>
            <Textarea
              value={newTicket.message}
              onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
              placeholder="Full details about the problem..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter className="mt-4 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

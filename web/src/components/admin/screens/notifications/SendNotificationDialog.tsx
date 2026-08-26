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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import type { NotificationForm, RiderOption } from './types';

interface SendNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: NotificationForm;
  setForm: (form: NotificationForm) => void;
  sendToAll: boolean;
  setSendToAll: (v: boolean) => void;
  riderSearch: string;
  setRiderSearch: (v: string) => void;
  riders: RiderOption[];
  isSubmitting: boolean;
  onSend: () => void;
}

/**
 * R3.7f split — Send Notification dialog.
 *
 * Three-step composition: (1) "send to all" switch, (2) rider picker
 * (hidden when sendToAll is on), (3) title / message / type. The Send
 * button is disabled until title + message are present, and either
 * a rider is picked or "send to all" is enabled.
 */
export function SendNotificationDialog({
  open,
  onOpenChange,
  form,
  setForm,
  sendToAll,
  setSendToAll,
  riderSearch,
  setRiderSearch,
  riders,
  isSubmitting,
  onSend,
}: SendNotificationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Notification</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={sendToAll} onCheckedChange={setSendToAll} />
            <Label>Send to all riders</Label>
          </div>
          {!sendToAll && (
            <div className="space-y-2">
              <Label>Target Rider</Label>
              <Input
                placeholder="Search riders by name/ID..."
                value={riderSearch}
                onChange={(e) => setRiderSearch(e.target.value)}
                className="mb-2 h-9"
              />
              <Select
                value={form.riderId}
                onValueChange={(v) => setForm({ ...form, riderId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a rider" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {riders.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.fullName || 'Unknown'} ({r.riderId})
                    </SelectItem>
                  ))}
                  {riders.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      No riders found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Notification title"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Notification message"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="alert">Alert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={onSend}
            disabled={
              isSubmitting || !form.title || !form.message || (!sendToAll && !form.riderId)
            }
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}{' '}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

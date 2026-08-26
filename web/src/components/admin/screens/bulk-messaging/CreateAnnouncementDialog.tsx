'use client';

import { Loader2, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  AUDIENCE_OPTIONS,
  CHANNEL_OPTIONS,
  RIDER_STATUS_OPTIONS,
  type AnnouncementFormState,
  type HubOption,
} from './types';

interface CreateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: AnnouncementFormState;
  onFormChange: (updater: (prev: AnnouncementFormState) => AnnouncementFormState) => void;
  hubs: HubOption[];
  sending: boolean;
  recipientCount: number;
  onSubmit: () => void;
  onToggleTargetId: (id: string) => void;
  onPlanNamesChange: (csv: string) => void;
}

/**
 * R3.7x split — create announcement dialog.
 *
 * Renders the broadcast form (title, message, channel, target audience,
 * per-audience selector, recipient estimator, schedule toggle) and
 * surfaces the POST submit button. All state lives in the data hook.
 */
export function CreateAnnouncementDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  hubs,
  sending,
  recipientCount,
  onSubmit,
  onToggleTargetId,
  onPlanNamesChange,
}: CreateAnnouncementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Create Announcement
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) =>
                onFormChange((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Announcement title"
            />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={form.message}
              onChange={(e) =>
                onFormChange((prev) => ({ ...prev, message: e.target.value }))
              }
              placeholder="Message content"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Channel</Label>
            <Select
              value={form.channel}
              onValueChange={(v) =>
                onFormChange((prev) => ({ ...prev, channel: v as typeof form.channel }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Select
              value={form.targetAudience}
              onValueChange={(v) =>
                onFormChange((prev) => ({
                  ...prev,
                  targetAudience: v as typeof form.targetAudience,
                  targetIds: [],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_OPTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.targetAudience === 'BY_HUB' && (
            <div className="space-y-2">
              <Label>Select Hubs</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                {hubs.map((hub) => (
                  <div key={hub.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={form.targetIds.includes(hub.name)}
                      onCheckedChange={() => onToggleTargetId(hub.name)}
                    />
                    <span className="text-sm">{hub.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.targetAudience === 'BY_STATUS' && (
            <div className="space-y-2">
              <Label>Select Statuses</Label>
              <div className="grid grid-cols-2 gap-2">
                {RIDER_STATUS_OPTIONS.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <Checkbox
                      checked={form.targetIds.includes(s)}
                      onCheckedChange={() => onToggleTargetId(s)}
                    />
                    <span className="text-sm">{s.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.targetAudience === 'BY_PLAN' && (
            <div className="space-y-2">
              <Label>Select Plans</Label>
              <Input
                placeholder="Enter plan names (comma separated)"
                onChange={(e) => onPlanNamesChange(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Estimated Recipients</span>
            </div>
            <span className="text-lg font-bold text-primary">
              {recipientCount.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">Schedule for later</Label>
            <Switch
              checked={form.schedule}
              onCheckedChange={(v) => onFormChange((prev) => ({ ...prev, schedule: v }))}
            />
          </div>

          {form.schedule && (
            <div className="space-y-2">
              <Label>Schedule Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) =>
                  onFormChange((prev) => ({ ...prev, scheduledAt: e.target.value }))
                }
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={sending || !form.title || !form.message}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {form.schedule ? 'Schedule' : 'Send Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

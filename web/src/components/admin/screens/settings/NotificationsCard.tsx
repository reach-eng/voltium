'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Bell } from 'lucide-react';
import type { Settings, SettingsKey } from './settingsTypes';

interface NotificationsCardProps {
  settings: Settings;
  onBoolChange: (key: SettingsKey, checked: boolean) => void;
}

interface ChannelSpec {
  key: SettingsKey;
  label: string;
  help: string;
}

const CHANNELS: ChannelSpec[] = [
  { key: 'emailNotifications', label: 'Email Notifications', help: 'Send important notifications via email' },
  { key: 'smsNotifications', label: 'SMS Notifications', help: 'Send important notifications via SMS' },
];

/**
 * R3.7d split — Notification channels card.
 *
 * Two boolean toggles (email + SMS) with the same shape: label on the
 * left, switch on the right, separated by a horizontal rule. Adding
 * more channels is just appending to CHANNELS.
 */
export function NotificationsCard({ settings, onBoolChange }: NotificationsCardProps) {
  return (
    <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Notifications</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Delivery channels for system alerts
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {CHANNELS.map((channel, idx) => (
          <div key={channel.key}>
            {idx > 0 && <Separator className="mb-6" />}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{channel.label}</Label>
                <p className="text-xs text-muted-foreground">{channel.help}</p>
              </div>
              <Switch
                checked={settings[channel.key] === 'true'}
                onCheckedChange={(v) => onBoolChange(channel.key, v)}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

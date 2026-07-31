'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone } from 'lucide-react';
import type { Settings, SettingsKey } from './settingsTypes';

interface SupportContactCardProps {
  settings: Settings;
  onChange: (key: SettingsKey, value: string) => void;
}

/**
 * R3.7d split — Support contact card.
 *
 * Two text inputs (email + phone) with placeholders. Email gets
 * `type="email"`, phone gets `type="tel"`. Both share the same
 * h-11 + rounded-xl input style.
 */
export function SupportContactCard({ settings, onChange }: SupportContactCardProps) {
  return (
    <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-500/5">
            <Phone className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <CardTitle className="text-base">Support Contact</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Displayed to riders inside the app
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support Email</Label>
            <Input
              id="supportEmail"
              type="email"
              value={settings.supportEmail}
              onChange={(e) => onChange('supportEmail', e.target.value)}
              placeholder="support@example.com"
              className="h-11 text-base rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Riders use this for email support queries
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportPhone">Support Phone</Label>
            <Input
              id="supportPhone"
              type="tel"
              value={settings.supportPhone}
              onChange={(e) => onChange('supportPhone', e.target.value)}
              placeholder="+91 98765 43210"
              className="h-11 text-base rounded-xl"
            />
            <p className="text-xs text-muted-foreground">WhatsApp / call support number</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

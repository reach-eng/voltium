'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Zap } from 'lucide-react';
import type { Settings, SettingsKey } from './settingsTypes';

interface AutomationCardProps {
  settings: Settings;
  onChange: (key: SettingsKey, value: string) => void;
  onBoolChange: (key: SettingsKey, checked: boolean) => void;
}

/**
 * R3.7d split — Automation card.
 *
 * Three controls: auto-approve KYC (boolean), grace period hours (number),
 * and background GPS sync interval (number). The two numeric inputs each
 * have their own help text + labelled spacing.
 */
export function AutomationCard({ settings, onChange, onBoolChange }: AutomationCardProps) {
  return (
    <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/5">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-base">Automation</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Workflow automation and grace windows
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto-approve KYC</Label>
            <p className="text-xs text-muted-foreground">
              Automatically approve KYC submissions without manual review
            </p>
          </div>
          <Switch
            checked={settings.autoApproveKYC === 'true'}
            onCheckedChange={(v) => onBoolChange('autoApproveKYC', v)}
          />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="gracePeriodHours">Grace Period (Hours)</Label>
          <p className="text-xs text-muted-foreground">
            Hours allowed after plan expiry before penalties apply
          </p>
          <Input
            id="gracePeriodHours"
            type="number"
            value={settings.gracePeriodHours}
            onChange={(e) => onChange('gracePeriodHours', e.target.value)}
            className="w-32 h-11 text-base rounded-xl"
          />
        </div>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="gpsFetchIntervalMins">Background GPS Sync Interval (Mins)</Label>
          <p className="text-xs text-muted-foreground">
            How often rider devices push location updates in the background
          </p>
          <Input
            id="gpsFetchIntervalMins"
            type="number"
            value={settings.gpsFetchIntervalMins ?? '10'}
            onChange={(e) => onChange('gpsFetchIntervalMins', e.target.value)}
            className="w-32 h-11 text-base rounded-xl"
          />
        </div>
      </CardContent>
    </Card>
  );
}

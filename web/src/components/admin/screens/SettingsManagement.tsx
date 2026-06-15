'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Save, IndianRupee, Settings, Bell, Zap } from 'lucide-react';

interface Settings {
  dailyRent: string;
  weeklyRent: string;
  monthlyRent: string;
  securityDeposit: string;
  walletMinTopup: string;
  lateFee: string;
  referralBonus: string;
  autoApproveKYC: string;
  gracePeriodHours: string;
  emailNotifications: string;
  smsNotifications: string;
}

const DEFAULT_SETTINGS: Settings = {
  dailyRent: '299',
  weeklyRent: '1499',
  monthlyRent: '4999',
  securityDeposit: '1500',
  walletMinTopup: '1500',
  lateFee: '100',
  referralBonus: '500',
  autoApproveKYC: 'false',
  gracePeriodHours: '24',
  emailNotifications: 'true',
  smsNotifications: 'true',
};

export default function SettingsManagement() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setSettings({ ...DEFAULT_SETTINGS, ...json.data });
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch {
      /* empty */
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateBool = (key: keyof Settings, checked: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: String(checked) }));
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configure application settings and preferences
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? (
            'Saving...'
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" /> Save Settings
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Pricing Settings */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/5">
                <IndianRupee className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-base">Pricing</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  key: 'dailyRent' as const,
                  label: 'Daily Rent',
                  help: 'Base price for daily rental plan',
                },
                {
                  key: 'weeklyRent' as const,
                  label: 'Weekly Rent',
                  help: 'Base price for weekly rental plan',
                },
                {
                  key: 'monthlyRent' as const,
                  label: 'Monthly Rent',
                  help: 'Base price for monthly rental plan',
                },
                {
                  key: 'securityDeposit' as const,
                  label: 'Security Deposit',
                  help: 'One-time refundable deposit',
                },
                {
                  key: 'walletMinTopup' as const,
                  label: 'Wallet Min Top-up',
                  help: 'Minimum wallet balance to proceed (defaults to security deposit)',
                },
                {
                  key: 'lateFee' as const,
                  label: 'Late Fee',
                  help: 'Fee charged per day for late returns',
                },
                {
                  key: 'referralBonus' as const,
                  label: 'Referral Bonus',
                  help: 'Reward for successful referrals',
                },
              ].map(({ key, label, help }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      ₹
                    </span>
                    <Input
                      id={key}
                      type="number"
                      value={settings[key]}
                      onChange={(e) => updateSetting(key, e.target.value)}
                      className="pl-7"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{help}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Automation Settings */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/5">
                <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-base">Automation</CardTitle>
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
                onCheckedChange={(v) => updateBool('autoApproveKYC', v)}
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
                onChange={(e) => updateSetting('gracePeriodHours', e.target.value)}
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send important notifications via email
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications === 'true'}
                onCheckedChange={(v) => updateBool('emailNotifications', v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMS Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send important notifications via SMS
                </p>
              </div>
              <Switch
                checked={settings.smsNotifications === 'true'}
                onCheckedChange={(v) => updateBool('smsNotifications', v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

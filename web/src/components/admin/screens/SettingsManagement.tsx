'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import FeatureFlagsScreen from './FeatureFlagsScreen';
import MaintenanceModeScreen from './MaintenanceModeScreen';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Save, IndianRupee, Bell, Zap, Phone, ShieldCheck, CheckCircle2 } from 'lucide-react';

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
  maxRentalDays: string;
  penaltyCapDays: string;
  maxWalletBalance: string;
  loyaltyPointsPerRupee: string;
  supportEmail: string;
  supportPhone: string;
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
  maxRentalDays: '30',
  penaltyCapDays: '7',
  maxWalletBalance: '10000',
  loyaltyPointsPerRupee: '1',
  supportEmail: 'support@voltium.in',
  supportPhone: '+91 98765 43210',
};

function BusinessSettingsTab() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [initial, setInitial] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/settings');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        const merged = { ...DEFAULT_SETTINGS, ...json.data };
        setSettings(merged);
        setInitial(merged);
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
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success('Settings saved successfully');
        setInitial(settings);
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Network error — please try again.');
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

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Business Settings</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configure pricing, limits, automation and contact details
          </p>
        </div>
        <Button
          onClick={saveSettings}
          disabled={saving || !isDirty}
          className={!isDirty ? 'opacity-60' : ''}
        >
          {saving ? (
            'Saving...'
          ) : isDirty ? (
            <><Save className="h-4 w-4 mr-1" /> Save Changes</>
          ) : (
            <><CheckCircle2 className="h-4 w-4 mr-1" /> All Saved</>
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
              <div>
                <CardTitle className="text-base">Pricing</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Rental rates and fee structure</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'dailyRent' as const, label: 'Daily Rent', help: 'Base price for daily rental plan' },
                { key: 'weeklyRent' as const, label: 'Weekly Rent', help: 'Base price for weekly rental plan' },
                { key: 'monthlyRent' as const, label: 'Monthly Rent', help: 'Base price for monthly rental plan' },
                { key: 'securityDeposit' as const, label: 'Security Deposit', help: 'One-time refundable deposit' },
                { key: 'walletMinTopup' as const, label: 'Wallet Min Top-up', help: 'Minimum wallet balance to proceed' },
                { key: 'lateFee' as const, label: 'Late Fee / Day', help: 'Fee charged per day for late returns' },
                { key: 'referralBonus' as const, label: 'Referral Bonus', help: 'Reward for successful referrals' },
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
              <div>
                <CardTitle className="text-base">Automation</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Workflow automation and grace windows</p>
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

        {/* Limits & Policies */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-500/5">
                <ShieldCheck className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <CardTitle className="text-base">Limits &amp; Policies</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Rental caps, penalty thresholds and rewards rate</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  key: 'maxRentalDays' as const,
                  label: 'Max Rental Days',
                  help: 'Maximum allowed rental duration',
                  suffix: 'days',
                },
                {
                  key: 'penaltyCapDays' as const,
                  label: 'Penalty Cap',
                  help: 'Stop charging late fee after N days',
                  suffix: 'days',
                },
                {
                  key: 'maxWalletBalance' as const,
                  label: 'Max Wallet Balance',
                  help: 'Wallet top-up ceiling per rider',
                  prefix: '₹',
                },
                {
                  key: 'loyaltyPointsPerRupee' as const,
                  label: 'Loyalty Points / ₹',
                  help: 'Points earned per rupee spent',
                  suffix: 'pts',
                },
              ].map(({ key, label, help, prefix, suffix }) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key}>{label}</Label>
                  <div className="relative">
                    {prefix && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {prefix}
                      </span>
                    )}
                    <Input
                      id={key}
                      type="number"
                      value={settings[key]}
                      onChange={(e) => updateSetting(key, e.target.value)}
                      className={prefix ? 'pl-7' : suffix ? 'pr-14' : ''}
                    />
                    {suffix && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">
                        {suffix}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{help}</p>
                </div>
              ))}
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
              <div>
                <CardTitle className="text-base">Notifications</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Delivery channels for system alerts</p>
              </div>
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

        {/* Support Contact */}
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-sky-500/5">
                <Phone className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <CardTitle className="text-base">Support Contact</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Displayed to riders inside the app</p>
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
                  onChange={(e) => updateSetting('supportEmail', e.target.value)}
                  placeholder="support@example.com"
                />
                <p className="text-xs text-muted-foreground">Riders use this for email support queries</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportPhone">Support Phone</Label>
                <Input
                  id="supportPhone"
                  type="tel"
                  value={settings.supportPhone}
                  onChange={(e) => updateSetting('supportPhone', e.target.value)}
                  placeholder="+91 98765 43210"
                />
                <p className="text-xs text-muted-foreground">WhatsApp / call support number</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



export default function SettingsManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
        <p className="text-muted-foreground text-sm">Business rules, feature toggles, and maintenance controls.</p>
      </div>
      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="business" className="text-xs px-5 font-semibold">Business Settings</TabsTrigger>
          <TabsTrigger value="flags" className="text-xs px-5 font-semibold">Feature Flags</TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs px-5 font-semibold">Maintenance Mode</TabsTrigger>
        </TabsList>
        <TabsContent value="business"><BusinessSettingsTab /></TabsContent>
        <TabsContent value="flags"><FeatureFlagsScreen /></TabsContent>
        <TabsContent value="maintenance"><MaintenanceModeScreen /></TabsContent>
      </Tabs>
    </div>
  );
}

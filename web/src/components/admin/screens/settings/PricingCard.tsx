'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IndianRupee } from 'lucide-react';
import type { Settings, SettingsKey } from './settingsTypes';

interface PricingCardProps {
  settings: Settings;
  onChange: (key: SettingsKey, value: string) => void;
}

const FIELDS: Array<{ key: SettingsKey; label: string; help: string }> = [
  { key: 'walletMinTopup', label: 'Wallet Min Top-up', help: 'Minimum wallet balance to proceed' },
  { key: 'lateFee', label: 'Late Fee / Day', help: 'Fee charged per day for late returns' },
  { key: 'referralBonus', label: 'Referral Bonus', help: 'Reward for successful referrals' },
];

/**
 * R3.7d split — Pricing card.
 *
 * Three ₹ inputs: minimum wallet top-up, late fee per day, referral bonus.
 * Inputs share the ₹ prefix pattern via pl-7 + absolute span.
 */
export function PricingCard({ settings, onChange }: PricingCardProps) {
  return (
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
          {FIELDS.map(({ key, label, help }) => (
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
                  onChange={(e) => onChange(key, e.target.value)}
                  className="pl-7 h-11 text-base rounded-xl"
                />
              </div>
              <p className="text-xs text-muted-foreground">{help}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

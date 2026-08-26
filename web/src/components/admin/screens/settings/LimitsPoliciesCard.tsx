'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-react';
import type { Settings, SettingsKey } from './settingsTypes';

interface LimitsPoliciesCardProps {
  settings: Settings;
  onChange: (key: SettingsKey, value: string) => void;
}

interface FieldSpec {
  key: SettingsKey;
  label: string;
  help: string;
  prefix?: string;
  suffix?: string;
}

const FIELDS: FieldSpec[] = [
  { key: 'maxRentalDays', label: 'Max Rental Days', help: 'Maximum allowed rental duration', suffix: 'days' },
  { key: 'penaltyCapDays', label: 'Penalty Cap', help: 'Stop charging late fee after N days', suffix: 'days' },
  { key: 'maxWalletBalance', label: 'Max Wallet Balance', help: 'Wallet top-up ceiling per rider', prefix: '₹' },
  { key: 'loyaltyPointsPerRupee', label: 'Loyalty Points / ₹', help: 'Points earned per rupee spent', suffix: 'pts' },
];

/**
 * R3.7d split — Limits & Policies card.
 *
 * Four numeric inputs with mixed prefix/suffix decorations: "days", "₹",
 * "pts". The Input's className switches between pl-7 (prefix), pr-14
 * (suffix), or neither to leave room for the absolute-positioned span.
 */
export function LimitsPoliciesCard({ settings, onChange }: LimitsPoliciesCardProps) {
  return (
    <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-rose-500/5">
            <ShieldCheck className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <CardTitle className="text-base">Limits &amp; Policies</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rental caps, penalty thresholds and rewards rate
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FIELDS.map(({ key, label, help, prefix, suffix }) => (
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
                  onChange={(e) => onChange(key, e.target.value)}
                  className={
                    prefix
                      ? 'pl-7 h-11 text-base rounded-xl'
                      : suffix
                        ? 'pr-14 h-11 text-base rounded-xl'
                        : 'h-11 text-base rounded-xl'
                  }
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
  );
}

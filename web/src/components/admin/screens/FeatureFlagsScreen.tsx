'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Save, RefreshCw, AlertTriangle } from 'lucide-react';

interface FlagEntry {
  value: string;
  source: string;
}

const FLAG_LABELS: Record<string, string> = {
  enableReferralSystem: 'Referral System',
  enableRewardsSystem: 'Rewards System',
  enableVehicleAssignment: 'Vehicle Assignment',
  enableKYCVerification: 'KYC Verification',
  enableGuarantorRequirement: 'Guarantor Requirement',
  enableDynamicPricing: 'Dynamic Pricing',
  enableOfflineMode: 'Offline Mode',
  enableChatSupport: 'Chat Support',
  enablePushNotifications: 'Push Notifications',
  maxUploadSizeMb: 'Max Upload Size (MB)',
};

const FLAG_DESCRIPTIONS: Record<string, string> = {
  enableReferralSystem: 'Allow riders to refer others and earn bonuses',
  enableRewardsSystem: 'Enable rewards and points system for riders',
  enableVehicleAssignment: 'Allow admin to assign vehicles to riders',
  enableKYCVerification: 'Require KYC verification for rider onboarding',
  enableGuarantorRequirement: 'Require a guarantor during registration',
  enableDynamicPricing: 'Enable dynamic pricing based on demand',
  enableOfflineMode: 'Allow app to function with limited offline capabilities',
  enableChatSupport: 'Enable in-app chat support for riders',
  enablePushNotifications: 'Send push notifications for important updates',
  maxUploadSizeMb: 'Maximum file upload size in megabytes',
};

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  return res.json();
}

export default function FeatureFlagsScreen() {
  const [flags, setFlags] = useState<Record<string, FlagEntry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/feature-flags');
      if (res.success) {
        setFlags(res.data);
      } else {
        setError('Failed to load feature flags');
      }
    } catch (err) {
      setError('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const toggleFlag = async (key: string, currentValue: string) => {
    setSaving(key);
    setSuccess(null);
    setError(null);
    try {
      const newValue = currentValue === 'true' ? 'false' : 'true';
      const res = await apiFetch('/api/admin/feature-flags', {
        method: 'PUT',
        body: JSON.stringify({ key, value: newValue }),
      });
      if (res.success) {
        setFlags((prev) => ({
          ...prev,
          [key]: { value: newValue, source: 'database' },
        }));
        setSuccess(`${FLAG_LABELS[key]} updated`);
      } else {
        setError(res.message || 'Failed to update flag');
      }
    } catch (err) {
      setError('Failed to update flag');
    } finally {
      setSaving(null);
    }
  };

  const updateNumericFlag = async (key: string, value: string) => {
    setSaving(key);
    setSuccess(null);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/feature-flags', {
        method: 'PUT',
        body: JSON.stringify({ key, value }),
      });
      if (res.success) {
        setFlags((prev) => ({
          ...prev,
          [key]: { value, source: 'database' },
        }));
        setSuccess(`${FLAG_LABELS[key]} updated`);
      } else {
        setError(res.message || 'Failed to update flag');
      }
    } catch (err) {
      setError('Failed to update flag');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Feature Flags</h2>
        </div>
        <Button variant="outline" size="sm" onClick={loadFlags}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Runtime Feature Flags</CardTitle>
          <p className="text-sm text-muted-foreground">
            Toggle features on/off. Database overrides take precedence over environment variables.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(flags).map(([key, entry]) => {
            const isBoolean = key !== 'maxUploadSizeMb';
            const isEnabled = entry.value === 'true';

            return (
              <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{FLAG_LABELS[key] || key}</span>
                    {entry.source === 'database' && (
                      <Badge variant="secondary" className="text-xs">
                        DB
                      </Badge>
                    )}
                    {entry.source === 'runtime' && (
                      <Badge variant="outline" className="text-xs">
                        ENV
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {FLAG_DESCRIPTIONS[key] || ''}
                  </p>
                </div>

                <div className="flex items-center gap-3 ml-4">
                  {isBoolean ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleFlag(key, entry.value)}
                        disabled={saving === key}
                      />
                      <span className="text-sm w-8">
                        {saving === key ? '...' : isEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={entry.value}
                        onChange={(e) => updateNumericFlag(key, e.target.value)}
                        className="w-20"
                        disabled={saving === key}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateNumericFlag(key, entry.value)}
                        disabled={saving === key}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

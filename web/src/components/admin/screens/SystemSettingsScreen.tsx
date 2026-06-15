'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Settings2,
  Save,
  Lock,
  Globe,
  HardDrive,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Loader2,
  Eye,
  EyeOff,
  Server,
  Database,
  Key,
} from 'lucide-react';

interface SystemSettingsData {
  editable: Record<string, {
    value: string;
    valueType: string;
    category: string;
    isSecret: boolean;
    isEditable: boolean;
    description: string | null;
  }>;
  readOnly: Record<string, string>;
}

const categoryLabels: Record<string, string> = {
  APP_URLS: 'Application URLs',
  STORAGE: 'Local Storage',
  BACKUP: 'Backup Configuration',
  SECURITY: 'Security',
  SERVER: 'Server',
};

const categoryIcons: Record<string, React.ReactNode> = {
  APP_URLS: <Globe className="w-4 h-4" />,
  STORAGE: <HardDrive className="w-4 h-4" />,
  BACKUP: <Settings2 className="w-4 h-4" />,
  SECURITY: <Lock className="w-4 h-4" />,
  SERVER: <Server className="w-4 h-4" />,
};

function formatKeyLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SystemSettingsScreen() {
  const [data, setData] = useState<SystemSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system-settings');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          // Initialize edit values
          const values: Record<string, string> = {};
          for (const [key, setting] of Object.entries(json.data.editable)) {
            values[key] = (setting as { value: string }).value;
          }
          setEditValues(values);
        }
      } else {
        toast.error('Failed to load system settings');
      }
    } catch {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (key: string) => {
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/admin/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValues[key] }),
      });
      if (res.ok) {
        toast.success(`${formatKeyLabel(key)} updated`);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update setting');
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Settings2 className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm">Could not load system settings</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={fetchSettings}>
          <RefreshCw className="w-3 h-3 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  // Group editable settings by category
  const grouped: Record<string, [string, typeof data.editable[string]][]> = {};
  for (const [key, setting] of Object.entries(data.editable)) {
    const cat = setting.category || 'SERVER';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push([key, setting]);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">System Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage application configuration. Some settings require a server restart to take effect.
        </p>
      </div>

      {/* Editable Settings by Category */}
      {Object.entries(grouped).map(([category, settings]) => (
        <Card key={category} className="rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                {categoryIcons[category] || <Settings2 className="w-4 h-4 text-primary" />}
              </div>
              <CardTitle className="text-base">
                {categoryLabels[category] || category}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {settings.map(([key, setting]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">{formatKeyLabel(key)}</Label>
                    {setting.isSecret && (
                      <Badge variant="outline" className="text-[8px] border-amber-500/30 text-amber-600">
                        SECRET
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {setting.isSecret ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }))}
                      >
                        {showSecrets[key] ? (
                          <EyeOff className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Eye className="w-3 h-3 text-muted-foreground" />
                        )}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleSave(key)}
                      disabled={saving[key]}
                    >
                      {saving[key] ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3 mr-1" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Input
                    value={
                      setting.isSecret && !showSecrets[key]
                        ? '[CONFIGURED]'
                        : editValues[key] ?? ''
                    }
                    onChange={(e) =>
                      setEditValues((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="text-sm font-mono"
                    placeholder={`Enter ${formatKeyLabel(key).toLowerCase()}`}
                    type={
                      setting.isSecret && !showSecrets[key]
                        ? 'password'
                        : setting.valueType === 'NUMBER'
                          ? 'number'
                          : 'text'
                    }
                    disabled={!setting.isEditable}
                  />
                </div>
                {setting.description && (
                  <p className="text-xs text-muted-foreground">{setting.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Separator />

      {/* Read-Only Status */}
      <Card className="rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-base">Server & Security Status</CardTitle>
            <CardDescription className="ml-2">
              Read-only — configured via environment variables
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(data.readOnly).map(([key, value]) => {
              const isConfigured = value === 'true';
              const isEnabled = value === 'enabled';
              const isDisabled = value === 'disabled';
              const isLocalhost = value === 'localhost';

              let icon = <Server className="w-3.5 h-3.5" />;
              let badgeVariant = 'outline';

              if (key.includes('CONFIGURED')) {
                icon = isConfigured ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> : <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />;
                badgeVariant = isConfigured ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600';
              } else if (key.includes('_OTP') || key.includes('_LOGIN')) {
                icon = isEnabled ? <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />;
              } else if (key === 'DATABASE_HOST') {
                icon = <Database className="w-3.5 h-3.5" />;
              } else if (key.includes('SECRET') || key.includes('JWT')) {
                icon = <Key className="w-3.5 h-3.5" />;
              }

              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border text-sm">
                  <div className="shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{formatKeyLabel(key)}</p>
                    <p className={`text-xs mt-0.5 font-mono ${
                      isConfigured ? 'text-emerald-600 dark:text-emerald-400' :
                      isEnabled ? 'text-amber-600 dark:text-amber-400' :
                      isDisabled ? 'text-muted-foreground' :
                      isLocalhost ? 'text-blue-600 dark:text-blue-400' :
                      'text-foreground'
                    }`}>
                      {value}
                    </p>
                  </div>
                  {badgeVariant !== 'outline' && (
                    <Badge variant="outline" className={`text-[8px] ${badgeVariant}`}>
                      {isConfigured ? 'Configured' : 'Missing'}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={fetchSettings}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>
    </div>
  );
}

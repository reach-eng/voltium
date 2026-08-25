'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { extractErrorMessage } from '@/lib/error-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertOctagon, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { MaintenanceToggleButton } from '@/components/admin/MaintenanceToggleButton';

export default function MaintenanceModeScreen() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState(
    'System is currently under maintenance. Please check back later.'
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch current status
  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/maintenance-mode');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setEnabled(json.data.enabled);
          setMessage(json.data.message);
        }
      } else {
        toast.error('Failed to load maintenance settings');
      }
    } catch {
      toast.error('Failed to load maintenance settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggle = async (nextState?: boolean) => {
    setSaving(true);
    try {
      const targetState = typeof nextState === 'boolean' ? nextState : !enabled;
      const res = await fetch('/api/admin/maintenance-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetState, message }),
      });
      if (res.ok) {
        setEnabled(targetState);
        toast.success(`Maintenance mode ${targetState ? 'enabled' : 'disabled'} successfully`);
      } else {
        const err = await res.json();
        toast.error(extractErrorMessage(err, ''));
      }
    } catch {
      toast.error('Failed to toggle maintenance mode');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMessage = async () => {
    setSaving(true);
    try {
      // PR-2 (2026-08-06 verification, Section 2): PATCH sends ONLY the
      // message — the old PUT echoed `enabled` back, so saving a draft
      // message while maintenance was off silently re-enabled it.
      const res = await fetch('/api/admin/maintenance-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        toast.success('Maintenance banner message updated successfully');
      } else {
        const err = await res.json();
        toast.error(extractErrorMessage(err, ''));
      }
    } catch {
      toast.error('Failed to save message');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading status...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Maintenance Mode</h2>
        <p className="text-muted-foreground">
          Pause rider operations during server upgrades or database restore processes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>System Maintenance Config</CardTitle>
            <CardDescription>
              When enabled, riders will be blocked from API operations with a maintenance message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/30">
              <div className="space-y-0.5">
                <div className="font-semibold text-sm">Status</div>
                <div className="text-xs text-muted-foreground">Toggle global application block</div>
              </div>
              <MaintenanceToggleButton
                enabled={enabled}
                loading={saving}
                onToggle={handleToggle}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">User Banner Message</label>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? 'Edit the banner riders see during maintenance.'
                  : 'Draft the banner riders will see during maintenance. It is saved independently of the maintenance toggle.'}
              </p>
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={saving}
                  placeholder="System is currently under maintenance..."
                />
                <Button
                  variant="outline"
                  onClick={handleSaveMessage}
                  disabled={saving}
                >
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20 text-amber-900">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertOctagon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <CardTitle className="text-base text-amber-800">Pre-requisite</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2 text-amber-700 font-medium">
            <p>Maintenance mode should be active before running any disaster recovery restores.</p>
            <p>Admin users retain read/write access to the dashboard during maintenance.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

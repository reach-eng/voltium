'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertOctagon, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function MaintenanceModeScreen() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('System is currently under maintenance. Please check back later.');
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

  const handleToggle = async () => {
    setSaving(true);
    try {
      const nextState = !enabled;
      const res = await fetch('/api/admin/maintenance-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState, message }),
      });
      if (res.ok) {
        setEnabled(nextState);
        toast.success(`Maintenance mode ${nextState ? 'enabled' : 'disabled'} successfully`);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update maintenance mode');
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
      const res = await fetch('/api/admin/maintenance-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, message }),
      });
      if (res.ok) {
        toast.success('Maintenance banner message updated successfully');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update message');
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
        <p className="text-muted-foreground">Pause rider operations during server upgrades or database restore processes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>System Maintenance Config</CardTitle>
            <CardDescription>When enabled, riders will be blocked from API operations with a maintenance message.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/30">
              <div className="space-y-0.5">
                <div className="font-semibold text-sm">Status</div>
                <div className="text-xs text-muted-foreground">Toggle global application block</div>
              </div>
              <Button
                variant={enabled ? 'destructive' : 'default'}
                disabled={saving}
                onClick={handleToggle}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {enabled ? 'Disable Maintenance' : 'Enable Maintenance'}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">User Banner Message</label>
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={enabled}
                />
                <Button variant="outline" onClick={handleSaveMessage} disabled={saving || enabled}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20 text-amber-900">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0" />
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

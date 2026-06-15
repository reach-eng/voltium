'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertOctagon, HelpCircle, ToggleLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function MaintenanceModeScreen() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('System is currently under maintenance. Please check back later.');
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    // Simulate setting global maintenance mode
    setTimeout(() => {
      setEnabled(!enabled);
      toast.success(`Maintenance mode ${!enabled ? 'enabled' : 'disabled'} successfully`);
      setLoading(false);
    }, 500);
  };

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
                disabled={loading}
                onClick={handleToggle}
              >
                {enabled ? 'Disable Maintenance' : 'Enable Maintenance'}
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">User Banner Message</label>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={enabled}
              />
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

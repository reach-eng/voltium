'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  latencyMs: number;
  detail: string;
}

async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  const apiStart = performance.now();
  try {
    const r = await fetch('/api/admin/dashboard');
    const latency = Math.round(performance.now() - apiStart);
    checks.push({
      name: 'API Server',
      status: r.ok ? (latency > 2000 ? 'warn' : 'ok') : 'error',
      latencyMs: latency,
      detail: r.ok ? `${latency}ms response` : `HTTP ${r.status}`,
    });
  } catch {
    checks.push({ name: 'API Server', status: 'error', latencyMs: 0, detail: 'Unreachable' });
  }

  const dbStart = performance.now();
  try {
    const r = await fetch('/api/admin/tickets?limit=1');
    const latency = Math.round(performance.now() - dbStart);
    checks.push({
      name: 'Database',
      status: r.ok ? (latency > 3000 ? 'warn' : 'ok') : 'error',
      latencyMs: latency,
      detail: r.ok ? `Query in ${latency}ms` : 'Connection failed',
    });
  } catch {
    checks.push({ name: 'Database', status: 'error', latencyMs: 0, detail: 'Unreachable' });
  }

  return checks;
}

interface SystemHealthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SystemHealthDialog({ open, onOpenChange }: SystemHealthDialogProps) {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  const handleOpen = useCallback(async () => {
    onOpenChange(true);
    setHealthLoading(true);
    const checks = await runHealthChecks();
    setHealthChecks(checks);
    setHealthLoading(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (val) handleOpen();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {healthLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : (
            healthChecks.map((check) => {
              const StatusIcon =
                check.status === 'ok'
                  ? CheckCircle2
                  : check.status === 'warn'
                    ? AlertTriangle
                    : XCircle;
              const statusColor =
                check.status === 'ok'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : check.status === 'warn'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400';
              const statusBg =
                check.status === 'ok'
                  ? 'bg-emerald-500/5'
                  : check.status === 'warn'
                    ? 'bg-amber-500/5'
                    : 'bg-rose-500/5';
              return (
                <div
                  key={check.name}
                  className={`flex items-center justify-between rounded-lg border p-3 ${statusBg}`}
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                    <div>
                      <p className="text-sm font-semibold">{check.name}</p>
                      <p className="text-xs text-muted-foreground">{check.detail}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs uppercase ${statusColor}`}>
                    {check.status}
                  </Badge>
                </div>
              );
            })
          )}
          {!healthLoading && healthChecks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleOpen}
            >
              <RefreshCw className="w-3 h-3 mr-2" />
              Re-run Checks
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

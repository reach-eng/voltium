'use client';

import { Activity, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { HealthCheck } from './types';

interface SystemHealthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checks: HealthCheck[];
  loading: boolean;
}

function getStatusStyle(status: HealthCheck['status']): {
  Icon: typeof CheckCircle2;
  color: string;
  bg: string;
} {
  if (status === 'ok') {
    return {
      Icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/5',
    };
  }
  if (status === 'warn') {
    return {
      Icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/5',
    };
  }
  return {
    Icon: XCircle,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/5',
  };
}

/**
 * R3.7z split — System Health dialog (API + DB probes).
 */
export function SystemHealthDialog({
  open,
  onOpenChange,
  checks,
  loading,
}: SystemHealthDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : (
            checks.map((check) => {
              const { Icon, color, bg } = getStatusStyle(check.status);
              return (
                <div
                  key={check.name}
                  className={`flex items-center justify-between rounded-lg border p-3 ${bg}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${color}`} />
                    <div>
                      <p className="text-sm font-semibold">{check.name}</p>
                      <p className="text-xs text-muted-foreground">{check.detail}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs uppercase ${color}`}>
                    {check.status}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    OPEN: {
      label: 'Open',
      color: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    },
    IN_PROGRESS: {
      label: 'In Progress',
      color: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    },
    RESOLVED: {
      label: 'Resolved',
      color: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    },
    CLOSED: {
      label: 'Closed',
      color: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
    },
  };
  const s = map[status] || {
    label: status,
    color: 'border-border text-muted-foreground bg-muted/30',
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-bold uppercase ${s.color}`}>
      {s.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { color: string; pulse?: boolean }> = {
    LOW: { color: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400' },
    MEDIUM: { color: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400' },
    HIGH: { color: 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400' },
    CRITICAL: {
      color: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
      pulse: true,
    },
  };
  const p = map[priority] || { color: 'border-border text-muted-foreground bg-muted/30' };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-bold uppercase tracking-tight ${p.color} ${p.pulse ? 'animate-pulse' : ''}`}
    >
      {priority === 'CRITICAL' && <AlertTriangle className="h-3 w-3 mr-1" />}
      {priority}
    </Badge>
  );
}

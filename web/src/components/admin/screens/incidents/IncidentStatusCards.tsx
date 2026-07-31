'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Search, CheckCircle2, Shield } from 'lucide-react';

interface StatusCounts {
  OPEN: number;
  INVESTIGATING: number;
  RESOLVED: number;
  CLOSED: number;
}

interface Props {
  counts: StatusCounts;
}

/**
 * R3.7b — the 4 status summary cards at the top of the Incident Management
 * screen. Extracted from IncidentManagementScreen.tsx so the table
 * doesn't have to import the 4 icon components.
 */
export function IncidentStatusCards({ counts }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="rounded-2xl border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Open</p>
            <p className="text-2xl font-bold text-blue-600">{counts.OPEN}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Search className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Investigating</p>
            <p className="text-2xl font-bold text-amber-600">{counts.INVESTIGATING}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Resolved</p>
            <p className="text-2xl font-bold text-emerald-600">{counts.RESOLVED}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-slate-500/20 bg-slate-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Closed</p>
            <p className="text-2xl font-bold text-slate-600">{counts.CLOSED}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

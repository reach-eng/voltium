'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, BatteryLow, Navigation, Zap } from 'lucide-react';

interface FleetMapSummaryProps {
  activeCount: number;
  lowBatteryCount: number;
  idleCount: number;
  offlineCount: number;
}

/**
 * R3 split (FleetMapScreen) — four summary cards.
 *
 * Total Active (emerald), Low Battery (rose), Idle (amber), Offline
 * (slate). Each card shows an icon, a label, and a 2xl count.
 */
export function FleetMapSummary({
  activeCount,
  lowBatteryCount,
  idleCount,
  offlineCount,
}: FleetMapSummaryProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Active</p>
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
            <BatteryLow className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Low Battery</p>
            <p className="text-2xl font-bold text-rose-600">{lowBatteryCount}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Idle</p>
            <p className="text-2xl font-bold text-amber-600">{idleCount}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-slate-500/20 bg-slate-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
            <Navigation className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Offline</p>
            <p className="text-2xl font-bold text-slate-600">{offlineCount}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

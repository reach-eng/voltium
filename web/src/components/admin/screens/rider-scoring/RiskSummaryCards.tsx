'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

interface RiskSummaryCardsProps {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

/**
 * R3 split (RiderScoringScreen) — four risk summary cards.
 *
 * Each card has a coloured icon, a label, and a 2xl count.
 * Colours mirror the risk-level badge palette so the visual
 * language stays consistent across the page.
 */
export function RiskSummaryCards({ low, medium, high, critical }: RiskSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">Low Risk</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{low}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">Medium Risk</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{medium}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-orange-500/20 bg-orange-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">High Risk</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{high}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5">
        <CardContent className="p-4 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-rose-600 dark:text-rose-400" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">Critical</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{critical}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

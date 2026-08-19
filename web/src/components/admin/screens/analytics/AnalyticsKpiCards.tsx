'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, DollarSign, Percent } from 'lucide-react';
import { formatINR, type AnalyticsOverview } from './analyticsTypes';

interface KpiSpec {
  label: string;
  value: string;
  change: number;
  icon: typeof Users;
  inverse?: boolean;
}

/**
 * R3.7c — the 4 KPI cards at the top of the Analytics Dashboard.
 * Extracted from AnalyticsDashboard.tsx so the chart components don't
 * have to know about icon mapping.
 */
export function AnalyticsKpiCards({ overview }: { overview: AnalyticsOverview }) {
  const kpiCards: KpiSpec[] = [
    {
      label: 'Monthly Recurring Revenue',
      value: formatINR(overview.currentMRR),
      change: overview.mrrGrowth,
      icon: DollarSign,
    },
    {
      label: 'Churn Rate',
      value: `${overview.churnRate.toFixed(2)}%`,
      change: -overview.churnRate,
      icon: TrendingDown,
      inverse: true,
    },
    {
      label: 'Avg Revenue/Rider',
      value: formatINR(overview.avgRevenuePerRider),
      change: overview.mrrGrowth,
      icon: Users,
    },
    {
      label: 'Collection Efficiency',
      value: `${overview.collectionEfficiency.toFixed(1)}%`,
      change: overview.collectionEfficiency >= 80 ? Math.round(overview.collectionEfficiency - 80) : Math.round(overview.collectionEfficiency - 80),
      icon: Percent,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiCards.map((kpi) => {
        const Icon = kpi.icon;
        const isPositive = kpi.inverse ? kpi.change < 0 : kpi.change > 0;
        return (
          <Card
            key={kpi.label}
            className="rounded-2xl border-border/50 shadow-sm hover:border-primary/30 transition-all"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <h3 className="text-2xl font-bold tracking-tight">{kpi.value}</h3>
                  <div className="flex items-center gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-rose-500" />
                    )}
                    <span
                      className={`text-xs font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}
                    >
                      {Math.abs(kpi.change)}%
                    </span>
                    <span className="text-xs text-muted-foreground">vs last month</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

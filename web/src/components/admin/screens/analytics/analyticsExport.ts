'use client';

import { BRAND_DOMAIN } from '@/lib/branding';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import type { AnalyticsData } from './analyticsTypes';

/**
 * R3.7c — generate and download a CSV report for the current analytics
 * data. Extracted from AnalyticsDashboard.tsx as a pure function (no
 * React state). Triggers a browser download via Blob URL + anchor click.
 */
export function exportAnalyticsCsv(data: AnalyticsData): void {
  const rows = [
    'Voltium Financial Report',
    `Generated: ${formatDateTimeDDMMYYYY(new Date().toISOString())}`,
    '',
    'Key Metrics',
    `MRR,"₹${data.overview.currentMRR.toFixed(2)}"`,
    `MRR Growth,${data.overview.mrrGrowth}%`,
    `Avg Revenue/Rider,"₹${data.overview.avgRevenuePerRider.toFixed(2)}"`,
    `Churn Rate,${data.overview.churnRate}%`,
    `Collection Efficiency,${data.overview.collectionEfficiency}%`,
    `Total Riders,${data.overview.totalRiders}`,
    `Active Riders,${data.overview.activeRiders}`,
    '',
    'Monthly Revenue Trend',
    'Month,Revenue',
    ...data.trend.map((t) => `${t.month},${t.revenue}`),
    '',
    'Cohort Analysis',
    'Signup Month,Total,Active,Suspended,Retention %',
    ...data.cohorts.map(
      (c) => `${c.month},${c.total},${c.active},${c.suspended},${c.retentionRate}`,
    ),
  ].join('\n');
  const blob = new Blob([rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${BRAND_DOMAIN.split('.')[0]}-financial-${formatDateDDMMYYYY(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

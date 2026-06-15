/**
 * Analytics module — Types
 *
 * Provides aggregated analytics data for admin dashboards:
 * revenue, rider metrics, fleet utilization, and trends.
 */

export interface RevenueMetrics {
  mrr: number;
  previousMrr: number;
  mrrGrowth: number;
  pendingPayments: number;
  totalCollected: number;
}

export interface RiderMetrics {
  totalRiders: number;
  activeRiders: number;
  newRidersThisMonth: number;
  churnRate: number;
  averageTenureDays: number;
}

export interface FleetMetrics {
  totalVehicles: number;
  availableVehicles: number;
  activeRentals: number;
  maintenanceVehicles: number;
  utilizationRate: number;
}

export interface AnalyticsDashboard {
  revenue: RevenueMetrics;
  riders: RiderMetrics;
  fleet: FleetMetrics;
  period: {
    start: Date;
    end: Date;
  };
}

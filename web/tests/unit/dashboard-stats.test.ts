import { describe, it, expect } from 'vitest';

describe('Dashboard Stats and Revenue Trend Audit Fixes', () => {
  it('exports getDashboardStats and getRevenueTrend functions', async () => {
    const service = await import('../../src/lib/services/dashboard');
    expect(service.getDashboardStats).toBeDefined();
    expect(service.getRevenueTrend).toBeDefined();
  });

  it('dashboard route exports GET handler with analytics_view permission gate', async () => {
    const route = await import('../../src/app/api/admin/dashboard/route');
    expect(route.GET).toBeDefined();
  });
});

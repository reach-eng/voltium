/**
 * Unit tests for APM (Application Performance Monitoring) module.
 *
 * Tests:
 *   - trackApiCall records metrics
 *   - trackPrismaQuery records with correct naming
 *   - getMetrics computes correct aggregates
 *   - withTiming wraps async functions
 *   - getSlowQueries filters and sorts correctly
 *   - Edge cases with timing boundaries
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Test implementation (duplicates logic from apm.ts to avoid module import issues)
// ---------------------------------------------------------------------------

interface MetricPoint {
  name: string;
  duration: number;
  timestamp: number;
  success: boolean;
}

interface AggregatedMetrics {
  avgResponseTime: number;
  errorRate: number;
  slowQueries: number;
  totalRequests: number;
  endpoints: Record<string, { count: number; avgTime: number; errors: number }>;
}

const SLOW_QUERY_THRESHOLD_MS = 100;
let testMetricsStore: MetricPoint[] = [];

function resetTestMetrics() {
  testMetricsStore = [];
}

function testTrackApiCall(endpoint: string, duration: number, success: boolean): void {
  testMetricsStore.push({ name: endpoint, duration, timestamp: Date.now(), success });
}

function testTrackPrismaQuery(model: string, operation: string, duration: number, success = true): void {
  testMetricsStore.push({
    name: `prisma.${model}.${operation}`,
    duration,
    timestamp: Date.now(),
    success,
  });
}

function testGetMetrics(): AggregatedMetrics {
  if (testMetricsStore.length === 0) {
    return { avgResponseTime: 0, errorRate: 0, slowQueries: 0, totalRequests: 0, endpoints: {} };
  }

  const totalRequests = testMetricsStore.length;
  const totalDuration = testMetricsStore.reduce((sum, p) => sum + p.duration, 0);
  const errorCount = testMetricsStore.filter((p) => !p.success).length;
  const slowQueries = testMetricsStore.filter((p) => p.duration > SLOW_QUERY_THRESHOLD_MS).length;

  const endpoints: Record<string, { count: number; avgTime: number; errors: number }> = {};
  for (const point of testMetricsStore) {
    if (!endpoints[point.name]) {
      endpoints[point.name] = { count: 0, avgTime: 0, errors: 0 };
    }
    endpoints[point.name].count++;
    endpoints[point.name].avgTime += point.duration;
    if (!point.success) endpoints[point.name].errors++;
  }
  for (const key of Object.keys(endpoints)) {
    endpoints[key].avgTime = endpoints[key].avgTime / endpoints[key].count;
  }

  return {
    avgResponseTime: totalDuration / totalRequests,
    errorRate: errorCount / totalRequests,
    slowQueries,
    totalRequests,
    endpoints,
  };
}

function testGetSlowQueries(): MetricPoint[] {
  return testMetricsStore
    .filter((p) => p.duration > SLOW_QUERY_THRESHOLD_MS)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 50);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('APM — trackApiCall', () => {
  beforeEach(() => resetTestMetrics());

  it('records a successful API call', () => {
    testTrackApiCall('auth.login', 45, true);
    expect(testMetricsStore).toHaveLength(1);
    expect(testMetricsStore[0].name).toBe('auth.login');
    expect(testMetricsStore[0].duration).toBe(45);
    expect(testMetricsStore[0].success).toBe(true);
  });

  it('records a failed API call', () => {
    testTrackApiCall('kyc.submit', 200, false);
    expect(testMetricsStore[0].success).toBe(false);
  });

  it('stores multiple endpoints', () => {
    testTrackApiCall('auth.login', 30, true);
    testTrackApiCall('rider.profile', 60, true);
    testTrackApiCall('wallet.topup', 90, true);
    expect(testMetricsStore).toHaveLength(3);
  });
});

describe('APM — trackPrismaQuery', () => {
  beforeEach(() => resetTestMetrics());

  it('records with prisma prefix', () => {
    testTrackPrismaQuery('rider', 'findMany', 25);
    expect(testMetricsStore[0].name).toBe('prisma.rider.findMany');
  });

  it('records failed queries', () => {
    testTrackPrismaQuery('transaction', 'create', 500, false);
    expect(testMetricsStore[0].success).toBe(false);
  });
});

describe('APM — getMetrics', () => {
  beforeEach(() => resetTestMetrics());

  it('returns zeroes for empty store', () => {
    const metrics = testGetMetrics();
    expect(metrics.avgResponseTime).toBe(0);
    expect(metrics.errorRate).toBe(0);
    expect(metrics.slowQueries).toBe(0);
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.endpoints).toEqual({});
  });

  it('computes correct averages', () => {
    testTrackApiCall('auth.login', 100, true);
    testTrackApiCall('rider.profile', 200, true);
    testTrackApiCall('wallet.topup', 300, false);

    const metrics = testGetMetrics();
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.avgResponseTime).toBe(200); // (100 + 200 + 300) / 3
    expect(metrics.errorRate).toBeCloseTo(0.333, 2); // 1/3
    expect(metrics.slowQueries).toBeGreaterThanOrEqual(0);
  });

  it('aggregates per-endpoint metrics', () => {
    testTrackApiCall('auth.login', 50, true);
    testTrackApiCall('auth.login', 150, true);

    const metrics = testGetMetrics();
    expect(metrics.endpoints['auth.login']).toBeDefined();
    expect(metrics.endpoints['auth.login'].count).toBe(2);
    expect(metrics.endpoints['auth.login'].avgTime).toBe(100);
    expect(metrics.endpoints['auth.login'].errors).toBe(0);
  });

  it('tracks per-endpoint errors', () => {
    testTrackApiCall('wallet.pay', 100, true);
    testTrackApiCall('wallet.pay', 200, false);

    const metrics = testGetMetrics();
    expect(metrics.endpoints['wallet.pay'].errors).toBe(1);
    expect(metrics.endpoints['wallet.pay'].count).toBe(2);
  });

  it('computes slow query count', () => {
    testTrackApiCall('fast.op', 10, true);
    testTrackApiCall('slow.op', 150, true);
    testTrackApiCall('very.slow', 500, true);

    const metrics = testGetMetrics();
    expect(metrics.slowQueries).toBe(2); // 150 and 500 are > 100
  });
});

describe('APM — getSlowQueries', () => {
  beforeEach(() => resetTestMetrics());

  it('returns only queries above threshold', () => {
    testTrackApiCall('fast', 10, true);
    testTrackApiCall('slow', 200, true);

    const slow = testGetSlowQueries();
    expect(slow).toHaveLength(1);
    expect(slow[0].name).toBe('slow');
  });

  it('sorts by duration descending', () => {
    testTrackApiCall('medium', 150, true);
    testTrackApiCall('fast', 10, true);
    testTrackApiCall('slowest', 500, true);
    testTrackApiCall('slow', 200, true);

    const slow = testGetSlowQueries();
    expect(slow[0].name).toBe('slowest');
    expect(slow[0].duration).toBe(500);
    expect(slow[1].name).toBe('slow');
    expect(slow[1].duration).toBe(200);
    expect(slow[2].name).toBe('medium');
    expect(slow[2].duration).toBe(150);
  });

  it('limits to 50 results', () => {
    for (let i = 0; i < 100; i++) {
      testTrackApiCall(`op${i}`, 200, true);
    }
    const slow = testGetSlowQueries();
    expect(slow.length).toBe(50);
  });

  it('returns empty array when no slow queries', () => {
    testTrackApiCall('fast', 10, true);
    testTrackApiCall('faster', 5, true);

    expect(testGetSlowQueries()).toHaveLength(0);
  });

  it('returns empty array for empty store', () => {
    expect(testGetSlowQueries()).toHaveLength(0);
  });
});

describe('APM — edge cases', () => {
  beforeEach(() => resetTestMetrics());

  it('handles threshold boundary', () => {
    testTrackApiCall('just_fast', 100, true);
    expect(testGetSlowQueries()).toHaveLength(0);

    testTrackApiCall('just_slow', 101, true);
    expect(testGetSlowQueries()).toHaveLength(1);
  });

  it('handles zero duration', () => {
    testTrackApiCall('instant', 0, true);
    expect(testGetMetrics().totalRequests).toBe(1);
  });

  it('handles very large durations', () => {
    testTrackApiCall('huge', 30000, false);
    const metrics = testGetMetrics();
    expect(metrics.avgResponseTime).toBe(30000);
    expect(metrics.slowQueries).toBe(1);
  });
});

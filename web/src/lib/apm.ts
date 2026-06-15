import { logger } from '@/lib/logger';

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
const metricsStore: MetricPoint[] = [];
const MAX_STORE_SIZE = 10000;

function trimStore() {
  if (metricsStore.length > MAX_STORE_SIZE) {
    metricsStore.splice(0, metricsStore.length - MAX_STORE_SIZE);
  }
}

export async function withTiming<T>(fn: () => Promise<T>, name: string): Promise<T> {
  const start = performance.now();
  let success = true;

  try {
    return await fn();
  } catch (err) {
    success = false;
    throw err;
  } finally {
    const duration = performance.now() - start;
    const point: MetricPoint = {
      name,
      duration,
      timestamp: Date.now(),
      success,
    };
    metricsStore.push(point);
    trimStore();

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      logger.warn(`[APM] Slow operation: ${name} took ${duration.toFixed(1)}ms`);
    }

    if (!success) {
      logger.error(`[APM] Failed operation: ${name}`);
    }
  }
}

export function trackApiCall(endpoint: string, duration: number, success: boolean): void {
  const point: MetricPoint = {
    name: endpoint,
    duration,
    timestamp: Date.now(),
    success,
  };
  metricsStore.push(point);
  trimStore();

  if (duration > SLOW_QUERY_THRESHOLD_MS) {
    logger.warn(`[APM] Slow API: ${endpoint} took ${duration.toFixed(1)}ms`);
  }
}

export function trackPrismaQuery(
  model: string,
  operation: string,
  duration: number,
  success: boolean = true
): void {
  const name = `prisma.${model}.${operation}`;
  const point: MetricPoint = {
    name,
    duration,
    timestamp: Date.now(),
    success,
  };
  metricsStore.push(point);
  trimStore();

  if (duration > SLOW_QUERY_THRESHOLD_MS) {
    logger.warn(`[APM] Slow Prisma query: ${name} took ${duration.toFixed(1)}ms`);
  }
}

export function getMetrics(): AggregatedMetrics {
  if (metricsStore.length === 0) {
    return {
      avgResponseTime: 0,
      errorRate: 0,
      slowQueries: 0,
      totalRequests: 0,
      endpoints: {},
    };
  }

  const now = Date.now();
  const windowedMetrics = metricsStore.filter((p) => now - p.timestamp <= 5 * 60 * 1000);

  const totalRequests = windowedMetrics.length;
  if (totalRequests === 0) {
    return {
      avgResponseTime: 0,
      errorRate: 0,
      slowQueries: 0,
      totalRequests: 0,
      endpoints: {},
    };
  }

  const totalDuration = windowedMetrics.reduce((sum, p) => sum + p.duration, 0);
  const errorCount = windowedMetrics.filter((p) => !p.success).length;
  const slowQueries = windowedMetrics.filter((p) => p.duration > SLOW_QUERY_THRESHOLD_MS).length;

  const endpoints: Record<string, { count: number; avgTime: number; errors: number }> = {};

  for (const point of windowedMetrics) {
    if (!endpoints[point.name]) {
      endpoints[point.name] = { count: 0, avgTime: 0, errors: 0 };
    }
    endpoints[point.name].count++;
    endpoints[point.name].avgTime += point.duration;
    if (!point.success) {
      endpoints[point.name].errors++;
    }
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

export function getSlowQueries(): MetricPoint[] {
  return metricsStore
    .filter((p) => p.duration > SLOW_QUERY_THRESHOLD_MS)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 50);
}

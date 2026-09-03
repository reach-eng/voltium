import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { db } from './db';
import { logger } from './logger';

export const metricsRegistry = new Registry();

// Register Node.js runtime default metrics
collectDefaultMetrics({ register: metricsRegistry });

/**
 * HTTP RED Metrics
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests made to the server',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Outbox Event Queue Metrics
 */
export const outboxProcessedTotal = new Counter({
  name: 'outbox_processed_total',
  help: 'Total number of outbox events processed by worker',
  labelNames: ['status', 'event_type'] as const,
  registers: [metricsRegistry],
});

export const outboxPendingCount = new Gauge({
  name: 'outbox_pending_count',
  help: 'Total number of pending outbox events awaiting processing',
  async collect() {
    try {
      const count = await db.outboxEvent.count({
        where: { status: 'PENDING' },
      });
      outboxPendingCount.set(count);
    } catch (err) {
      logger.warn('[Prometheus] Failed to collect outbox_pending_count', err);
    }
  },
  registers: [metricsRegistry],
});

export const outboxOldestPendingAgeSeconds = new Gauge({
  name: 'outbox_oldest_pending_age_seconds',
  help: 'Age of oldest pending outbox event in seconds',
  async collect() {
    try {
      const oldest = await db.outboxEvent.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      if (oldest && oldest.createdAt) {
        const ageSec = Math.max(0, Math.floor((Date.now() - oldest.createdAt.getTime()) / 1000));
        outboxOldestPendingAgeSeconds.set(ageSec);
      } else {
        outboxOldestPendingAgeSeconds.set(0);
      }
    } catch (err) {
      logger.warn('[Prometheus] Failed to collect outbox_oldest_pending_age_seconds', err);
    }
  },
  registers: [metricsRegistry],
});

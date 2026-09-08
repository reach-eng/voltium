import type { HealthCheck } from './types';

/**
 * R3.7z split — pure health-check probe.
 *
 * Pings /api/admin/dashboard (for the API server) and /api/health/db
 * (a real SELECT 1 database ping). Each probe is wrapped in try/catch
 * and tagged ok / warn / error based on HTTP status + latency.
 */

const HEALTH_CHECK_TIMEOUT_MS = 8000;

async function fetchWithTimeout(input: string, timeoutMs = HEALTH_CHECK_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function runHealthChecks(): Promise<HealthCheck[]> {
  // Probes are independent — run concurrently (was sequential, up to
  // 16s wall on dual timeout).
  const [api, database] = await Promise.all([probeApi(), probeDatabase()]);
  return [api, database];
}

async function probeApi(): Promise<HealthCheck> {
  const apiStart = performance.now();
  try {
    const r = await fetchWithTimeout('/api/admin/dashboard');
    const latency = Math.round(performance.now() - apiStart);
    return {
      name: 'API Server',
      status: r.ok ? (latency > 2000 ? 'warn' : 'ok') : 'error',
      latencyMs: latency,
      detail: r.ok ? `${latency}ms response` : `HTTP ${r.status}`,
    };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError';
    return {
      name: 'API Server',
      status: 'error',
      // 0 previously conflated with instant — report the timeout budget
      // (or -1 for unreachable) so values stay sortable/honest.
      latencyMs: timedOut ? HEALTH_CHECK_TIMEOUT_MS : -1,
      detail: timedOut ? `Timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms` : 'Unreachable',
    };
  }
}

async function probeDatabase(): Promise<HealthCheck> {
  const dbStart = performance.now();
  try {
    // Was GET /api/admin/tickets?limit=1 (and later the cached dashboard
    // endpoint) — neither proves the database is reachable. /api/health/db
    // runs a real SELECT 1 with no response cache.
    const r = await fetchWithTimeout('/api/health/db');
    const latency = Math.round(performance.now() - dbStart);
    return {
      name: 'Database',
      status: r.ok ? (latency > 3000 ? 'warn' : 'ok') : 'error',
      latencyMs: r.ok ? latency : HEALTH_CHECK_TIMEOUT_MS,
      detail: r.ok ? `Query in ${latency}ms` : `Connection failed (HTTP ${r.status})`,
    };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError';
    return {
      name: 'Database',
      status: 'error',
      latencyMs: timedOut ? HEALTH_CHECK_TIMEOUT_MS : -1,
      detail: timedOut ? `Timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms` : 'Unreachable',
    };
  }
}

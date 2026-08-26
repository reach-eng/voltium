import type { HealthCheck } from './types';

/**
 * R3.7z split — pure health-check probe.
 *
 * Pings /api/admin/dashboard (for the API server) and
 * /api/admin/tickets?limit=1 (proxies the database path). Each
 * probe is wrapped in try/catch and tagged ok / warn / error
 * based on HTTP status + latency.
 */
export async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  const apiStart = performance.now();
  try {
    const r = await fetch('/api/admin/dashboard');
    const latency = Math.round(performance.now() - apiStart);
    checks.push({
      name: 'API Server',
      status: r.ok ? (latency > 2000 ? 'warn' : 'ok') : 'error',
      latencyMs: latency,
      detail: r.ok ? `${latency}ms response` : `HTTP ${r.status}`,
    });
  } catch {
    checks.push({
      name: 'API Server',
      status: 'error',
      latencyMs: 0,
      detail: 'Unreachable',
    });
  }

  const dbStart = performance.now();
  try {
    const r = await fetch('/api/admin/tickets?limit=1');
    const latency = Math.round(performance.now() - dbStart);
    checks.push({
      name: 'Database',
      status: r.ok ? (latency > 3000 ? 'warn' : 'ok') : 'error',
      latencyMs: latency,
      detail: r.ok ? `Query in ${latency}ms` : 'Connection failed',
    });
  } catch {
    checks.push({
      name: 'Database',
      status: 'error',
      latencyMs: 0,
      detail: 'Unreachable',
    });
  }

  return checks;
}

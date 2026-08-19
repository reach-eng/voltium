import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { getOrSetResponse } from '@/lib/cache';
import { isProdOrStaging } from '@/lib/device-policy';

interface WorkflowStatus {
  id: string;
  label: string;
  status: 'green' | 'red' | 'yellow';
  detail: string;
}

interface WorkflowCoveragePayload {
  workflows: WorkflowStatus[];
  database: { status: 'green' | 'red'; detail: string };
  workers: { status: 'green' | 'yellow' | 'red'; detail: string };
  timestamp: string;
}

async function checkApi(url: string, cookie: string | null): Promise<boolean> {
  try {
    const res = await fetch(url, {
      // P1-7 (2026-08-05 legal/device audit): 2s timeout instead of 5s — with
      // Promise.all the worst case drops from 50s to ~2s per request.
      signal: AbortSignal.timeout(2000),
      headers: cookie ? { cookie } : undefined,
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function buildPayload(): Promise<WorkflowCoveragePayload> {
  // PR-152: SSRF fix. Previously `new URL(req.url).origin` derived
  // the base URL from the incoming request — an attacker could set
  // the `Host` header to `evil.com` and trick the server into
  // probing internal services via fetch().
  //
  // Now we read from env.INTERNAL_API_URL (or fall back to
  // NEXT_PUBLIC_APP_URL) which is operator-controlled and cannot be
  // influenced by an incoming request. In production, set
  // INTERNAL_API_URL=http://127.0.0.1:8081 so the request never
  // leaves the host.
  const baseUrl = env.INTERNAL_API_URL ?? env.NEXT_PUBLIC_APP_URL;
  // Cookie is no longer forwarded — workflow-coverage is an
  // admin-only check and admin auth is already validated above.
  // Forwarding the cookie widened the SSRF blast radius (an
  // attacker-controlled URL could exfiltrate the admin session).
  const cookie: string | null = null;

  // Check backend API health per workflow group
  const workflowDefs = [
    { id: 'riders', label: 'Riders', url: `${baseUrl}/api/admin/riders?limit=1`, detail: 'GET /api/admin/riders' },
    { id: 'kyc', label: 'KYC', url: `${baseUrl}/api/admin/kyc`, detail: 'GET /api/admin/kyc' },
    { id: 'rentals', label: 'Rentals', url: `${baseUrl}/api/admin/rentals?limit=1`, detail: 'GET /api/admin/rentals' },
    { id: 'vehicles', label: 'Vehicles', url: `${baseUrl}/api/admin/vehicles?limit=1`, detail: 'GET /api/admin/vehicles' },
    { id: 'hubs', label: 'Hubs', url: `${baseUrl}/api/admin/hubs`, detail: 'GET /api/admin/hubs' },
    { id: 'transactions', label: 'Finance', url: `${baseUrl}/api/admin/transactions?limit=1`, detail: 'GET /api/admin/transactions' },
    { id: 'tickets', label: 'Support Tickets', url: `${baseUrl}/api/admin/tickets?limit=1`, detail: 'GET /api/admin/tickets' },
    { id: 'offers', label: 'Offers & Coupons', url: `${baseUrl}/api/admin/offers`, detail: 'GET /api/admin/offers' },
    { id: 'jobs', label: 'Background Jobs', url: `${baseUrl}/api/admin/jobs`, detail: 'GET /api/admin/jobs' },
    { id: 'health', label: 'Server Health', url: `${baseUrl}/api/health/worker`, detail: 'GET /api/health/worker' },
  ] as const;

  // P1-7 (2026-08-05 legal/device audit): run the 10 health probes in
  // parallel instead of sequentially — the worst case drops from 50s to ~2s.
  const workflows = await Promise.all(
    workflowDefs.map(async (def) => ({
      id: def.id,
      label: def.label,
      status: ((await checkApi(def.url, cookie)) ? 'green' : 'red') as 'green' | 'red',
      detail: def.detail,
    }))
  );

  // Check DB connectivity
  let dbStatus: 'green' | 'red' = 'green';
  let dbDetail = 'Database connected';
  try {
    // P2-19 (2026-08-05 legal/device audit): SELECT 1 succeeds even when the
    // pool is exhausted (the query just queues). pg_backend_pid() returns the
    // actual backend session id — a real round-trip through the pool.
    await db.$queryRaw`SELECT pg_backend_pid()`;
  } catch {
    dbStatus = 'red';
    dbDetail = 'Database unreachable';
  }

  // Check worker health (stuck processing count)
  let workerStatus: 'green' | 'yellow' | 'red' = 'green';
  let workerDetail = 'Workers healthy';
  try {
    const stuckCount = await db.outboxEvent.count({
      where: { status: 'PROCESSING', updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
    });
    if (stuckCount > 0) {
      workerStatus = 'yellow';
      workerDetail = `${stuckCount} stuck PROCESSING events`;
    }
  } catch {
    workerStatus = 'red';
    workerDetail = 'Worker health check failed';
  }

  return {
    workflows,
    database: { status: dbStatus, detail: dbDetail },
    workers: { status: workerStatus, detail: workerDetail },
    timestamp: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    // P0-3 (2026-08-05 legal/device audit): the UI is dev-only, but the
    // route shipped to production, exposing DB/worker health to any admin
    // session (READ_ONLY/SUPPORT_AGENT included). The endpoint must not
    // exist outside local dev/CI. isProdOrStaging() (shared with the device
    // seed guard) denies on explicit production/staging AND on any
    // NODE_ENV=production build, while allowing APP_ENV=unset (CI/local)
    // — a bare `APP_ENV !== 'development'` check would 404 in CI where
    // .env is gitignored and APP_ENV is not propagated.
    if (isProdOrStaging()) {
      return errors.notFound('Not found');
    }

    const admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }
    // P0-3: gate the health snapshot behind analytics_view — DB connectivity
    // and stuck-worker counts are operational signals, not for every role.
    if (!hasPermission(admin.adminRole || '', 'analytics_view')) {
      return adminForbidden();
    }

    // P0-3/P1-7: cache the aggregated health check for 30s so repeated
    // operator refreshes don't re-probe 10 internal endpoints per request.
    const payload = await getOrSetResponse<WorkflowCoveragePayload>(
      'admin:workflow-coverage',
      buildPayload,
      30
    );

    return success(payload);
  } catch (err: unknown) {
    return errors.internal(
      `Workflow coverage check failed: ${(err instanceof Error ? err.message : String(err))}`
    );
  }
}

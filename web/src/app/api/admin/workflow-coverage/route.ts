import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin } from '@/lib/rbac';
import { db } from '@/lib/db';

interface WorkflowStatus {
  id: string;
  label: string;
  status: 'green' | 'red' | 'yellow';
  detail: string;
}

async function checkApi(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }

    const baseUrl = new URL(req.url).origin;

    // Check backend API health per workflow group
    const workflowChecks: WorkflowStatus[] = [
      {
        id: 'riders',
        label: 'Riders',
        status: (await checkApi(`${baseUrl}/api/admin/riders?limit=1`)) ? 'green' : 'red',
        detail: 'GET /api/admin/riders',
      },
      {
        id: 'kyc',
        label: 'KYC',
        status: (await checkApi(`${baseUrl}/api/admin/kyc`)) ? 'green' : 'red',
        detail: 'GET /api/admin/kyc',
      },
      {
        id: 'rentals',
        label: 'Rentals',
        status: (await checkApi(`${baseUrl}/api/admin/rentals?limit=1`)) ? 'green' : 'red',
        detail: 'GET /api/admin/rentals',
      },
      {
        id: 'vehicles',
        label: 'Vehicles',
        status: (await checkApi(`${baseUrl}/api/admin/vehicles?limit=1`)) ? 'green' : 'red',
        detail: 'GET /api/admin/vehicles',
      },
      {
        id: 'hubs',
        label: 'Hubs',
        status: (await checkApi(`${baseUrl}/api/admin/hubs`)) ? 'green' : 'red',
        detail: 'GET /api/admin/hubs',
      },
      {
        id: 'transactions',
        label: 'Finance',
        status: (await checkApi(`${baseUrl}/api/admin/transactions?limit=1`)) ? 'green' : 'red',
        detail: 'GET /api/admin/transactions',
      },
      {
        id: 'tickets',
        label: 'Support Tickets',
        status: (await checkApi(`${baseUrl}/api/admin/tickets?limit=1`)) ? 'green' : 'red',
        detail: 'GET /api/admin/tickets',
      },
      {
        id: 'offers',
        label: 'Offers & Coupons',
        status: (await checkApi(`${baseUrl}/api/admin/offers`)) ? 'green' : 'red',
        detail: 'GET /api/admin/offers',
      },
      {
        id: 'jobs',
        label: 'Background Jobs',
        status: (await checkApi(`${baseUrl}/api/admin/jobs`)) ? 'green' : 'red',
        detail: 'GET /api/admin/jobs',
      },
      {
        id: 'health',
        label: 'Server Health',
        status: (await checkApi(`${baseUrl}/api/health/worker`)) ? 'green' : 'red',
        detail: 'GET /api/health/worker',
      },
    ];

    // Check DB connectivity
    let dbStatus: 'green' | 'red' = 'green';
    let dbDetail = 'Database connected';
    try {
      await db.$queryRaw`SELECT 1`;
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

    return success({
      workflows: workflowChecks,
      database: { status: dbStatus, detail: dbDetail },
      workers: { status: workerStatus, detail: workerDetail },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return errors.internal(`Workflow coverage check failed: ${(err instanceof Error ? err.message : String(err))}`);
  }
}

/**
 * GET /api/admin/reconciliation — Run wallet reconciliation and return results.
 *
 * Requires admin session with finance or super-admin permissions.
 * Runs verifyLedgerIntegrity for every wallet and reports drifts.
 *
 * Admin-only endpoint.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import {
  runWalletReconciliation,
  recordReconciliation,
  persistReconciliationReport,
} from '@/server/workers/jobs/wallet-reconciliation.job';
import { formatDateDDMMYYYY } from '@/lib/date-utils';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }

    // P0-4 (financial audit): this used to accept ANY admin (incl.
    // READ_ONLY). Reconciliation is a money-integrity operation — gate it.
    if (!hasPermission(admin.adminRole || '', 'finance_reconcile')) {
      return errors.forbidden('You do not have permission to run wallet reconciliation');
    }

    const result = await runWalletReconciliation();
    // P0-4: attribute the run to the acting admin (SOC2), not 'system'.
    await recordReconciliation(result, { actorId: admin.adminId || 'system' });
    // W6 / M-6: persist the daily report row too. The cron pre-check
    // (`checkReconciliationToday`) reads `reconciliationReport`; without
    // this, an admin-triggered run never satisfied the "already ran
    // today" gate and the Jobs screen's recon history stayed empty.
    await persistReconciliationReport(result, formatDateDDMMYYYY(new Date()));

    return success(result, 'Wallet reconciliation complete');
  } catch (err: unknown) {
    return errors.internal('Reconciliation failed');
  }
}

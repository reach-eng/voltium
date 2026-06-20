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
import { runWalletReconciliation, recordReconciliation } from '@/server/workers/jobs/wallet-reconciliation.job';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }

    const result = await runWalletReconciliation();
    await recordReconciliation(result);

    return success(result, 'Wallet reconciliation complete');
  } catch (err: any) {
    return errors.internal('Reconciliation failed');
  }
}

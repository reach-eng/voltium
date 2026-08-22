import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { toRupeesResponse } from '@/lib/api-money';

// PR-RUPEES-2026-08-08: thresholds are in paise (DB unit). They are
// converted to rupees at the response boundary (the API exposes
// rupee values to admin clients). See `OVERDUE_BALANCE_INR` etc.
const OVERDUE_BALANCE_PAISE = -50000; // -500 INR
const HEALTHY_BALANCE_PAISE = 0;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // We can use riders_view as permission
  if (!hasPermission(session, 'riders_view')) return adminForbidden();

  try {
    const { id } = await context.params;

    // Fetch the team leader to ensure they exist
    const teamLeader = await db.teamLeader.findUnique({
      where: { id },
    });

    if (!teamLeader) {
      return errors.notFound('Team leader not found');
    }

    // Fetch all riders assigned to this team leader
    const riders = await db.rider.findMany({
      where: { teamLeaderId: id },
      select: {
        id: true,
        riderId: true,
        fullName: true,
        phone: true,
        lifecycleStatus: true,
      }
    });

    const riderIds = riders.map((r: { id: string }) => r.id);
    
    const [wallets, rentalLeases] = await Promise.all([
      db.wallet.findMany({
        where: { riderId: { in: riderIds } },
        select: { riderId: true, balanceInPaise: true }
      }),
      db.rentalLease.findMany({
        where: { riderId: { in: riderIds } },
        select: { riderId: true, status: true, nextRentDueAt: true, finalPriceInPaise: true }
      })
    ]);

    let churnedCount = 0;
    let overdueRentCount = 0;
    let timelyRentCount = 0;
    let upcomingRentCount = 0;
    let overdueScooterCount = 0;

    const walletMap = new Map<string, number>();
    wallets.forEach((w: { riderId: string; balanceInPaise: number }) => walletMap.set(w.riderId, w.balanceInPaise));

    const rentalMap = new Map<string, number>();
    rentalLeases.forEach((r: { riderId: string; status: string; nextRentDueAt: Date | null; finalPriceInPaise: number }) => {
      const isOverdue = r.status === 'OVERDUE' || (r.nextRentDueAt != null && r.nextRentDueAt < new Date());
      if (isOverdue) {
        const current = rentalMap.get(r.riderId) || 0;
        rentalMap.set(r.riderId, current + r.finalPriceInPaise);
      }
    });

    const enrichedRiders = riders.map((rider: any) => {
      const balance = walletMap.get(rider.id) || 0;
      const overdueRentalAmount = rentalMap.get(rider.id) || 0;
      
      const isChurned = rider.lifecycleStatus === 'CLOSED' || rider.lifecycleStatus === 'SUSPENDED';
      const isOverdue = balance < OVERDUE_BALANCE_PAISE;
      const isUpcoming = balance >= OVERDUE_BALANCE_PAISE && balance < HEALTHY_BALANCE_PAISE;
      const isTimely = balance >= HEALTHY_BALANCE_PAISE && rider.lifecycleStatus === 'ACTIVE';
      const hasOverdueScooter = overdueRentalAmount > 0;

      if (isChurned) churnedCount++;
      if (isOverdue && !isChurned) overdueRentCount++;
      if (isUpcoming && !isChurned) upcomingRentCount++;
      if (isTimely && !isChurned) timelyRentCount++;
      if (hasOverdueScooter) overdueScooterCount++;

      return {
        ...rider,
        // PR-RUPEES-2026-08-08: `balance` is exposed in rupees to admin
        // clients. Internally `balance` is paise (from the wallet
        // table). The `isOverdue` / `isTimely` flags are still computed
        // against the paise thresholds above.
        balance: balance / 100,
        isChurned,
        isOverdue,
        isTimely,
        hasOverdueScooter
      };
    });

    return success({
      stats: {
        totalRiders: riders.length,
        churned: churnedCount,
        overdueRent: overdueRentCount,
        upcomingRent: upcomingRentCount,
        timelyRent: timelyRentCount,
        overdueScooter: overdueScooterCount,
      },
      riders: enrichedRiders
    });

  } catch (error) {
    logger.error('GET /api/admin/team-leaders/[id]/riders error:', error);
    return errors.internal('Failed to fetch team leader riders');
  }
}


import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // We can use riders_view as permission
  if (!hasPermission(session.adminRole || '', 'riders_view')) return adminForbidden();

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
      where: { teamLeader: id },
      select: {
        id: true,
        riderId: true,
        fullName: true,
        phone: true,
        lifecycleStatus: true,
        hubId: true,
      }
    });

    const riderIds = riders.map((r: { id: string }) => r.id);
    
    const [wallets, rentals] = await Promise.all([
      db.wallet.findMany({
        where: { riderId: { in: riderIds } },
        select: { riderId: true, balance: true }
      }),
      db.rental.findMany({
        where: { riderId: { in: riderIds }, status: 'ACTIVE' },
        select: { riderId: true, overdueAmount: true }
      })
    ]);

    let churnedCount = 0;
    let overdueRentCount = 0;
    let timelyRentCount = 0;
    let upcomingRentCount = 0;
    let overdueScooterCount = 0;

    const walletMap = new Map<string, number>();
    wallets.forEach((w: { riderId: string; balance: number }) => walletMap.set(w.riderId, w.balance));

    const rentalMap = new Map<string, number>();
    rentals.forEach((r: { riderId: string; overdueAmount: number }) => rentalMap.set(r.riderId, r.overdueAmount));

    const enrichedRiders = riders.map((rider: any) => {
      const balance = walletMap.get(rider.id) || 0;
      const overdueRentalAmount = rentalMap.get(rider.id) || 0;
      
      const isChurned = rider.lifecycleStatus === 'CLOSED' || rider.lifecycleStatus === 'SUSPENDED';
      const isOverdue = balance < -10000; // -100 Rs
      const isUpcoming = balance >= -10000 && balance < 50000; // e.g., slightly low balance
      const isTimely = balance >= 50000 && rider.lifecycleStatus === 'ACTIVE'; // good balance
      const hasOverdueScooter = overdueRentalAmount > 0;

      if (isChurned) churnedCount++;
      if (isOverdue && !isChurned) overdueRentCount++;
      if (isUpcoming && !isChurned) upcomingRentCount++;
      if (isTimely && !isChurned) timelyRentCount++;
      if (hasOverdueScooter) overdueScooterCount++;

      return {
        ...rider,
        balance,
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

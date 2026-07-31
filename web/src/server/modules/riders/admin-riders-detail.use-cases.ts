/**
 * Admin Riders — Detail & Device Data
 *
 * Get a single rider with wallet, and fetch device telemetry (contacts, call logs, locations).
 */

import { db } from '@/lib/db';

/**
 * Get a rider by ID with wallet for admin actions.
 */
export async function getRiderWithWallet(id: string) {
  return db.rider.findUnique({
    where: { id },
    include: { wallet: true },
  });
}

/**
 * Get device data for a rider (contacts, call logs, locations).
 */
export async function getDeviceData(riderId: string, type: string = 'all') {
  const rider = await db.rider.findUnique({
    where: { id: riderId },
    select: {
      isAdminLocked: true,
      lockPasswordHash: true,
      isUninstallBlocked: true,
      isLocationMandatory: true,
      isAppsControlRestricted: true,
    },
  });

  const results: any = { rider };

  if (type === 'CONTACTS' || type === 'all') {
    results.contacts = await db.userContact.findMany({
      where: { riderId },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }
  if (type === 'CALL_LOGS' || type === 'all') {
    results.callLogs = await db.userCallLog.findMany({
      where: { riderId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  }
  if (type === 'LOCATION' || type === 'all') {
    results.locations = await db.userLocation.findMany({
      where: { riderId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  return results;
}

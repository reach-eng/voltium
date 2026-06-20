/**
 * Device Compliance module — Use cases
 */

import { db } from '@/server/shared/db/prisma';
import { logger } from '@/lib/logger';

export const deviceComplianceUseCases = {
  async syncState(riderDbId: string, permissions: Record<string, boolean>) {
    await db.rider.update({
      where: { id: riderDbId },
      data: permissions as any,
    });
    logger.info('[DeviceCompliance] State synced', { riderDbId, permissions });
  },

  async reportViolation(riderDbId: string, permissionId: string) {
    const violation = await db.deviceViolation.create({
      data: { riderId: riderDbId, permissionId, status: 'ACTIVE' },
    });
    await db.rider.update({
      where: { id: riderDbId },
      data: { deviceViolationCount: { increment: 1 }, lastDeviceViolationAt: new Date() },
    });
    return violation;
  },

  async getDeviceState(riderDbId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: {
        isUninstallBlocked: true,
        isLocationMandatory: true,
        isAppsControlRestricted: true,
        isAdminLocked: true,
        lockPassword: true,
        deviceAdminGranted: true,
        displayOverlayGranted: true,
        lastDeviceViolationAt: true,
        deviceViolationCount: true,
        locationGranted: true,
        batteryGranted: true,
        contactsGranted: true,
        callLogsGranted: true,
        micGranted: true,
        cameraGranted: true,
        phoneGranted: true,
      },
    });
    if (!rider) return null;

    const activeViolations = await db.deviceViolation.count({
      where: { riderId: riderDbId, status: 'ACTIVE' },
    });

    return {
      isUninstallBlocked: rider.isUninstallBlocked,
      isLocationMandatory: rider.isLocationMandatory,
      isAppsControlRestricted: rider.isAppsControlRestricted,
      isAdminLocked: rider.isAdminLocked,
      lockPassword: null,
      deviceAdminGranted: rider.deviceAdminGranted,
      displayOverlayGranted: rider.displayOverlayGranted,
      lastDeviceViolationAt: rider.lastDeviceViolationAt,
      deviceViolationCount: rider.deviceViolationCount,
      activeViolations,
      permissions: {
        location: rider.locationGranted,
        battery: rider.batteryGranted,
        contacts: rider.contactsGranted,
        callLog: rider.callLogsGranted,
        mic: rider.micGranted,
        camera: rider.cameraGranted,
        phone: rider.phoneGranted,
        deviceAdmin: rider.deviceAdminGranted,
        displayOverApps: rider.displayOverlayGranted,
      },
    };
  },

  async syncContacts(
    riderDbId: string,
    contacts: Array<{ name: string; phone: string; email?: string }>
  ) {
    await db.userContact.createMany({
      data: contacts.map((c) => ({
        riderId: riderDbId,
        name: c.name,
        phone: c.phone,
        email: c.email,
      })),
    });
  },

  async syncCallLogs(
    riderDbId: string,
    logs: Array<{
      number: string;
      name?: string;
      type?: string;
      duration?: number;
      timestamp: string;
    }>
  ) {
    await db.userCallLog.createMany({
      data: logs.map((c) => ({
        riderId: riderDbId,
        number: c.number,
        name: c.name ?? null,
        type: c.type || 'UNKNOWN',
        duration: c.duration ?? 0,
        timestamp: new Date(c.timestamp),
      })),
    });
  },

  async syncLocation(
    riderDbId: string,
    data: {
      lat: number;
      lng: number;
      accuracy?: number;
      speed?: number;
      isMocked?: boolean;
      batteryLevel?: number;
    }
  ) {
    const [location] = await Promise.all([
      db.userLocation.create({
        data: {
          riderId: riderDbId,
          lat: data.lat,
          lng: data.lng,
          accuracy: data.accuracy,
          speed: data.speed,
          isMocked: data.isMocked || false,
        },
      }),
      db.rider.update({
        where: { id: riderDbId },
        data: {
          lastKnownLat: data.lat,
          lastKnownLng: data.lng,
          lastLocationAt: new Date(),
          batteryLevel: data.batteryLevel ?? undefined,
        },
      }),
    ]);
    return location;
  },
};

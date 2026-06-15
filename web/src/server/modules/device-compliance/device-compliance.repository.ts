/**
 * Device Compliance module — Repository
 */

import { db } from '@/server/shared/db/prisma';
import type { DeviceComplianceState } from './device-compliance.types';

export const deviceComplianceRepository = {
  async getState(riderDbId: string): Promise<DeviceComplianceState | null> {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: {
        locationGranted: true,
        batteryGranted: true,
        contactsGranted: true,
        callLogsGranted: true,
        micGranted: true,
        cameraGranted: true,
        phoneGranted: true,
        deviceAdminGranted: true,
        displayOverlayGranted: true,
        isAdminLocked: true,
        isUninstallBlocked: true,
        isLocationMandatory: true,
        isAppsControlRestricted: true,
        lastDeviceViolationAt: true,
        deviceViolationCount: true,
      },
    });

    if (!rider) return null;

    return {
      riderId: riderDbId,
      locationGranted: rider.locationGranted,
      batteryGranted: rider.batteryGranted,
      contactsGranted: rider.contactsGranted,
      callLogsGranted: rider.callLogsGranted,
      micGranted: rider.micGranted,
      cameraGranted: rider.cameraGranted,
      phoneGranted: rider.phoneGranted,
      deviceAdminGranted: rider.deviceAdminGranted,
      displayOverlayGranted: rider.displayOverlayGranted,
      isAdminLocked: rider.isAdminLocked,
      isUninstallBlocked: rider.isUninstallBlocked,
      isLocationMandatory: rider.isLocationMandatory,
      isAppsControlRestricted: rider.isAppsControlRestricted,
      lastViolationAt: rider.lastDeviceViolationAt,
      violationCount: rider.deviceViolationCount,
    };
  },
};

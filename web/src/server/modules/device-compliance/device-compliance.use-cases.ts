/**
 * Device Compliance module — Use cases
 */

import { db } from '@/server/shared/db/prisma';
import { logger } from '@/lib/logger';

// P1-12 (2026-08-05 legal/device audit): the old signature was
// `Record<string, boolean>` + `data: permissions as any` — a future caller
// sending an unknown key would silently write to a non-existent column or
// throw at runtime. The param is now the typed union of the Rider columns
// the two sync routes are allowed to touch; anything else is dropped.
export type DevicePermissionFields = {
  locationGranted?: boolean;
  batteryGranted?: boolean;
  contactsGranted?: boolean;
  callLogsGranted?: boolean;
  micGranted?: boolean;
  cameraGranted?: boolean;
  phoneGranted?: boolean;
  deviceAdminGranted?: boolean;
  displayOverlayGranted?: boolean;
};

const DEVICE_PERMISSION_FIELDS: (keyof DevicePermissionFields)[] = [
  'locationGranted',
  'batteryGranted',
  'contactsGranted',
  'callLogsGranted',
  'micGranted',
  'cameraGranted',
  'phoneGranted',
  'deviceAdminGranted',
  'displayOverlayGranted',
];

// W10 / I-6: client-fault error classes — the sync route maps these to
// 422/429 instead of the generic 500.
export class SyncValidationError extends Error {}
export class SyncQuotaError extends Error {}

/**
 * W10 / I-6: per-rider hourly volume quotas for device-data syncs.
 * Batch caps alone didn't stop unbounded PII accumulation — a rider could
 * replay capped batches forever. These caps are generous vs legitimate
 * cadences (full-phonebook sync, periodic call-log dumps, ≤1 location
 * ping/min) while hard-bounding each PII table's growth per rider.
 */
const SYNC_QUOTAS = {
  CONTACTS: { perHour: 4000 },
  CALL_LOGS: { perHour: 20_000 },
  LOCATION: { perHour: 600 },
} as const;

const SYNC_QUOTA_MODEL = {
  CONTACTS: 'userContact' as const,
  CALL_LOGS: 'userCallLog' as const,
  LOCATION: 'userLocation' as const,
};

async function assertSyncQuota(
  riderDbId: string,
  kind: keyof typeof SYNC_QUOTA_MODEL
): Promise<void> {
  // UserLocation has no createdAt column — its `timestamp` field is the
  // ingestion time (DB default on create).
  const timeField = kind === 'LOCATION' ? 'timestamp' : 'createdAt';
  const model = db[SYNC_QUOTA_MODEL[kind]] as unknown as {
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await model.count({
    where: { riderId: riderDbId, [timeField]: { gte: hourAgo } },
  });
  const cap = SYNC_QUOTAS[kind].perHour;
  if (count >= cap) {
    throw new SyncQuotaError(
      `Device-data sync quota exceeded for ${kind}: ${count}/${cap} rows in the last hour. Try again later.`
    );
  }
}

export const deviceComplianceUseCases = {
  async syncState(riderDbId: string, permissions: DevicePermissionFields) {
    const data: Record<string, boolean> = {};
    for (const key of DEVICE_PERMISSION_FIELDS) {
      const value = permissions[key];
      if (value !== undefined) data[key] = value;
    }
    // Reviewer nit (2026-08-05 audit pass): dropping unknown keys silently
    // could mask a device misconfiguration — the rider granted a permission
    // that never reached the DB. Warn so ops can see the whitelist dropped
    // something, without breaking the strict-typing contract.
    const dropped = Object.keys(permissions).filter((k) => !(k in data));
    if (dropped.length > 0) {
      logger.warn('[DeviceCompliance] syncState dropped unknown permission keys', {
        riderDbId,
        dropped,
      });
    }
    await db.rider.update({
      where: { id: riderDbId },
      data,
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

    // P1-9/P2-7 (2026-08-05 legal/device audit): `lockPassword: null` was
    // returned literally and the select read a non-existent `lockPassword`
    // column (the model has `lockPasswordHash`). The hash must NEVER reach
    // the rider device — the field is dropped entirely (the Flutter client
    // reads isAdminLocked, not the credential).
    return {
      isUninstallBlocked: rider.isUninstallBlocked,
      isLocationMandatory: rider.isLocationMandatory,
      isAppsControlRestricted: rider.isAppsControlRestricted,
      isAdminLocked: rider.isAdminLocked,
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

  // P3-5/P3-6 (2026-08-05 legal/device audit): the sync routes accepted an
  // unbounded list — a compromised device (or a buggy app) could dump the
  // entire phonebook in one request. Cap each batch and log when truncated.

  async syncContacts(
    riderDbId: string,
    contacts: Array<{ name: string; phone: string; email?: string }>
  ) {
    // W10 / I-6: per-rider hourly quota (see SYNC_QUOTAS below).
    await assertSyncQuota(riderDbId, 'CONTACTS');
    const batch = contacts.slice(0, 1000);
    if (batch.length < contacts.length) {
      logger.warn('[DeviceCompliance] Contacts batch truncated', {
        riderDbId,
        received: contacts.length,
        kept: batch.length,
      });
    }
    await db.userContact.createMany({
      data: batch.map((c) => ({
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
      // W10 / I-6: the route's Zod schema coerces to Date before calling.
      timestamp: string | Date;
    }>
  ) {
    // W10 / I-6: per-rider hourly quota (see SYNC_QUOTAS above).
    await assertSyncQuota(riderDbId, 'CALL_LOGS');
    const batch = logs.slice(0, 5000);
    if (batch.length < logs.length) {
      logger.warn('[DeviceCompliance] Call logs batch truncated', {
        riderDbId,
        received: logs.length,
        kept: batch.length,
      });
    }
    await db.userCallLog.createMany({
      data: batch.map((c) => ({
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
    // W10 / I-6: per-rider hourly quota (see SYNC_QUOTAS above).
    await assertSyncQuota(riderDbId, 'LOCATION');
    // HYGIENE-01 (2026-08-23): reject out-of-range or non-finite
    // coordinates BEFORE the DB transaction. The previous code
    // passed any number straight to `userLocation.create`, which
    // (a) lets a malicious or buggy client write lat=999 or
    // lng=NaN into the audit log, and (b) surfaces a useless
    // "Foreign key constraint violated" error to the caller
    // when the riderId doesn't exist — masking the real problem.
    // Validate the inputs first with a clear error message, then
    // proceed with the normal write.
    if (typeof data.lat !== 'number' || !Number.isFinite(data.lat) || data.lat < -90 || data.lat > 90) {
      throw new Error(
        `Invalid latitude coordinate: ${data.lat}. Must be a finite number in [-90, 90].`
      );
    }
    if (typeof data.lng !== 'number' || !Number.isFinite(data.lng) || data.lng < -180 || data.lng > 180) {
      throw new Error(
        `Invalid longitude coordinate: ${data.lng}. Must be a finite number in [-180, 180].`
      );
    }
    const [location] = await db.$transaction([
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

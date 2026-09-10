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

/**
 * 2026-09-08 device-tracking audit P1-2: the 9-key permission-mapping
 * ladder was copy-pasted verbatim into BOTH permissions routes — two live
 * surfaces for the same writes, divergence guaranteed. This is now the
 * single mapping every permissions route consumes.
 *
 * Accepts the client's aliases (snake / legacy short keys map onto the
 * DB columns); returns ONLY the typed fields syncState may write.
 */
export function mapDevicePermissions(raw: unknown): DevicePermissionFields {
  const p = (raw ?? {}) as Record<string, unknown>;
  const out: DevicePermissionFields = {};
  const pick = (dbKey: keyof DevicePermissionFields, aliases: string[]) => {
    for (const key of [dbKey, ...aliases]) {
      const v = p[key];
      if (typeof v === 'boolean') {
        out[dbKey] = v;
        return;
      }
    }
  };
  pick('locationGranted', ['location']);
  pick('batteryGranted', ['battery']);
  pick('contactsGranted', ['contacts']);
  pick('callLogsGranted', ['callLog', 'call_log']);
  pick('micGranted', ['mic']);
  pick('cameraGranted', ['camera']);
  pick('phoneGranted', ['phone']);
  pick('deviceAdminGranted', ['deviceAdmin']);
  pick('displayOverlayGranted', ['displayOverApps', 'display_over_apps']);
  return out;
}

export type DeviceDataType = 'CONTACTS' | 'CALL_LOGS' | 'LOCATION';

/**
 * 2026-09-08 device-tracking audit P1-1: consent gate helper for PII
 * ingestion. The Consent table (LOCATION | CONTACTS | CALL_LOGS) existed
 * precisely for this and was written by /api/rider/consent but never read
 * by the ingestion path — a rider who DENIED contacts still had their
 * contact book stored.
 *
 * Contract:
 *  - explicit `granted: true` Consent row  → ingestion allowed;
 *  - explicit `granted: false` row (newest) → DeviceConsentError;
 *  - NO row at all → allowed WITH a warning (rider app versions predating
 *    the consent sync would otherwise be locked out of location entirely —
 *    a safety regression, since mandatory-location enforcement depends on
 *    this feed). Fresh clients always write consent before enabling the
 *    collectors, so the warning window is the legacy population only.
 */
export class DeviceConsentError extends Error {
  constructor(public readonly consentType: 'LOCATION' | 'CONTACTS' | 'CALL_LOGS') {
    super(`Consent not granted for ${consentType}`);
    this.name = 'DeviceConsentError';
  }
}

async function assertConsent(riderDbId: string, consentType: 'LOCATION' | 'CONTACTS' | 'CALL_LOGS') {
  const latest = await db.consent.findFirst({
    where: { riderId: riderDbId, consentType },
    orderBy: { createdAt: 'desc' },
  });
  if (latest && !latest.granted) {
    logger.warn('[DeviceCompliance] Ingestion blocked — consent denied', {
      riderDbId,
      consentType,
    });
    throw new DeviceConsentError(consentType);
  }
  if (!latest) {
    logger.warn(
      `[DeviceCompliance] Ingestion proceeding WITHOUT a Consent row (${consentType}) — legacy client before consent sync?`,
      { riderDbId, consentType }
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
    // P1-3 (device-tracking audit, 2026-09-08): dedupe ACTIVE rows.
    // The client posts on every failed integrity check (with a
    // 6/session backoff), so a rider who denies location for a
    // month accumulates hundreds of ACTIVE rows; the counter
    // (which gates the P1-2 alert) only grows. If an ACTIVE row
    // already exists for this rider + permission, no-op — the
    // existing row IS the violation. The counter increment was
    // removed too: the counter is the count of times a violation
    // was reported, not the count of currently-open rows; it was
    // monotonically growing without bound, which is what the
    // audit's "the counter only grows" complaint targeted.
    const existing = await db.deviceViolation.findFirst({
      where: { riderId: riderDbId, permissionId, status: 'ACTIVE' },
    });
    if (existing) {
      return existing;
    }
    const violation = await db.deviceViolation.create({
      data: { riderId: riderDbId, permissionId, status: 'ACTIVE' },
    });
    await db.rider.update({
      where: { id: riderDbId },
      data: { deviceViolationCount: { increment: 1 }, lastDeviceViolationAt: new Date() },
    });
    return violation;
  },

  async resolveViolationOnGrant(riderDbId: string, permissionId: string) {
    // P1-3: when a rider re-grants a permission (consent route
    // POST with `granted: true`), close any open ACTIVE row for
    // that rider + permission and decrement the counter. The 7-day
    // auto-resolver covers the case where the rider never re-grants;
    // this path covers the immediate case where they do.
    const result = await db.deviceViolation.updateMany({
      where: { riderId: riderDbId, permissionId, status: 'ACTIVE' },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    if (result.count > 0) {
      // Decrement the counter by the number of rows we just
      // closed. Guard against going negative (a `decrement` on a
      // counter at 0 would yield -1). The Prisma `decrement` op
      // is unconditional, so we read first and clamp.
      const rider = await db.rider.findUnique({
        where: { id: riderDbId },
        select: { deviceViolationCount: true },
      });
      const current = rider?.deviceViolationCount ?? 0;
      const next = Math.max(0, current - result.count);
      if (next !== current) {
        await db.rider.update({
          where: { id: riderDbId },
          data: { deviceViolationCount: next },
        });
      }
    }
    return result.count;
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
    // P1-1: CONTACTS ingestion is consent-gated (explicit denial → 403).
    await assertConsent(riderDbId, 'CONTACTS');
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
      timestamp: string;
    }>
  ) {
    // P1-1: CALL_LOGS ingestion is consent-gated (explicit denial → 403).
    await assertConsent(riderDbId, 'CALL_LOGS');
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
    // P1-1: LOCATION ingestion is consent-gated (explicit denial → 403;
    // no row = legacy-client warning, see assertConsent). Mandatory-
    // location enforcement depends on this feed, so absence of consent
    // must not break safety flows — only an explicit NO does.
    await assertConsent(riderDbId, 'LOCATION');
    if (typeof data.lat !== 'number' || isNaN(data.lat) || data.lat < -90 || data.lat > 90) {
      throw new Error('Invalid latitude coordinate: must be between -90 and 90');
    }
    if (typeof data.lng !== 'number' || isNaN(data.lng) || data.lng < -180 || data.lng > 180) {
      throw new Error('Invalid longitude coordinate: must be between -180 and 180');
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

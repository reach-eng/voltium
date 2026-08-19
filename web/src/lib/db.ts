import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { env } from './env';

/**
 * Canonical production-like gate. APP_ENV first, NODE_ENV as fallback
 * for plain Next.js prod builds. See scripts/check-no-node-env-security.sh.
 */
const IS_PRODUCTION_LIKE =
  env.APP_ENV === 'production' ||
  env.APP_ENV === 'staging' ||
  process.env.NODE_ENV === 'production';

/**
 * Prisma client wrapper with soft-delete support.
 *
 * History:
 *   - This file used to include a `DATABASE_OFFLINE=true` mock-fallback
 *     path that returned hardcoded mock data (10 hardcoded phones,
 *     auto-approved KYC, ₹1000 balance, ₹5000 deposit) when the DB
 *     was unreachable. It also intercepted query errors and short-
 *     circuited to mock data, bypassing Prisma's normal error path.
 *   - This was a development convenience but created a real production
 *     risk: setting `DATABASE_OFFLINE=true` on a deployed instance
 *     (via misconfiguration, env var leak, or attacker-controlled
 *     .env) would silently route all reads to fake data, and
 *     `errors.badRequest` / `errors.notFound` would never fire
 *     because the mock always returned something.
 *   - PR-98 (DB-CL-1) removed the mock entirely. Soft-delete logic
 *     is preserved (separate concern, unrelated to offline mode).
 *
 *   If you need to disable DB access for tests, use the vitest mock
 *   helpers in `tests/_setup/` (e.g. `vi.mock('../../src/lib/db')`)
 *   — do NOT add an offline env var.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

/**
 * Mutates a Prisma operation `args` in place so soft-deleted rows are
 * filtered out of every read/update. Returns the SAME object (original
 * type preserved) so `query(args)` keeps full return-type inference.
 */
const injectDeletedAt = <T extends { where?: Record<string, unknown> | null }>(args: T): T => {
  const a = args as { where?: Record<string, unknown> | null };
  if (!a.where) a.where = {};
  if (a.where.deletedAt === undefined) {
    a.where.deletedAt = null;
  }
  return args;
};

const createPrismaClient = () => {
  const isDev = !IS_PRODUCTION_LIKE && process.env.NODE_ENV !== 'test';
  const showQueries = process.env.DEBUG_SQL === 'true';

  let dbUrl = process.env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith('postgresql') || dbUrl.startsWith('postgres'))) {
    try {
      const url = new URL(dbUrl);
      if (!url.searchParams.has('connection_limit')) {
        // Default to 50 for test environments and 10 for production.
        // The higher test limit prevents pool exhaustion when 55+ test
        // files share a single Prisma client. Production keeps the
        // smaller pool because concurrent load is bounded by the number
        // of Next.js workers.
        const defaultPool = process.env.NODE_ENV === 'test' ? '50' : '10'; // NODE_ENV=test is a test-runner convention; safe to keep
        url.searchParams.set('connection_limit', process.env.DATABASE_POOL_SIZE || defaultPool);
      }
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', process.env.DATABASE_POOL_TIMEOUT || '30');
      }
      if (!url.searchParams.has('connect_timeout')) {
        url.searchParams.set('connect_timeout', isDev ? '2' : '10');
      }
      // Do NOT set a session timezone. Prisma always sends JS Date values
      // as UTC (ISO 8601 with 'Z' suffix). With the connection in UTC
      // timezone, Postgres stores and compares TIMESTAMPTZ values
      // correctly. Setting a non-UTC session timezone causes Prisma
      // to convert dates to local time on write, which can lead to
      // off-by-hours bugs in time comparisons.
      dbUrl = url.toString();
      logger.info('PostgreSQL pool config applied dynamically', {
        connectionLimit: process.env.DATABASE_POOL_SIZE || '10',
        poolTimeout: process.env.DATABASE_POOL_TIMEOUT || '30',
        connectTimeout: isDev ? '2' : '10',
      });
    } catch (e) {
      logger.warn('Failed to parse DATABASE_URL for dynamic pool configuration', { error: e });
    }
  }

  const client = new PrismaClient({
    log: isDev ? (showQueries ? ['query', 'error', 'warn'] : ['error', 'warn']) : ['error'],
    datasources: dbUrl
      ? {
          db: {
            url: dbUrl,
          },
        }
      : undefined,
  });

  // Soft-delete models: reads inject `deletedAt: null` into the where,
  // `delete`/`deleteMany` become `update`/`updateMany { deletedAt }`,
  // `findUnique`/`findUniqueOrThrow` become `findFirst`/`findFirstOrThrow`.
  // Written as per-model blocks with FULLY INFERRED handler params (NOT
  // `$allModels.$allOperations`, and NOT `any`-annotated handlers — both
  // erase the return type to `any` in Prisma 6.19; verified 2026-08-16).
  // The `withMirror` extension below proves inferred per-model handlers
  // keep full per-call type inference.
  const prisma = client.$extends({
    query: {
      rider: {
        async findMany({ args, query }) { return query(injectDeletedAt(args)); },
        async findFirst({ args, query }) { return query(injectDeletedAt(args)); },
        async count({ args, query }) { return query(injectDeletedAt(args)); },
        async aggregate({ args, query }) { return query(injectDeletedAt(args)); },
        async groupBy({ args, query }) { return query(injectDeletedAt(args)); },
        async update({ args, query }) { return query(injectDeletedAt(args)); },
        async updateMany({ args, query }) { return query(injectDeletedAt(args)); },
        async upsert({ args, query }) { return query(injectDeletedAt(args)); },
        async findUnique({ args, query }) {
          return (client as any).rider.findFirst({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async findUniqueOrThrow({ args, query }) {
          return (client as any).rider.findFirstOrThrow({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async delete({ args, query }) {
          return (client as any).rider.update({ where: args.where, data: { deletedAt: new Date() } });
        },
        async deleteMany({ args, query }) {
          return (client as any).rider.updateMany({ where: args.where || {}, data: { deletedAt: new Date() } });
        },
      },
      vehicle: {
        async findMany({ args, query }) { return query(injectDeletedAt(args)); },
        async findFirst({ args, query }) { return query(injectDeletedAt(args)); },
        async count({ args, query }) { return query(injectDeletedAt(args)); },
        async aggregate({ args, query }) { return query(injectDeletedAt(args)); },
        async groupBy({ args, query }) { return query(injectDeletedAt(args)); },
        async update({ args, query }) { return query(injectDeletedAt(args)); },
        async updateMany({ args, query }) { return query(injectDeletedAt(args)); },
        async upsert({ args, query }) { return query(injectDeletedAt(args)); },
        async findUnique({ args, query }) {
          return (client as any).vehicle.findFirst({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async findUniqueOrThrow({ args, query }) {
          return (client as any).vehicle.findFirstOrThrow({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async delete({ args, query }) {
          return (client as any).vehicle.update({ where: args.where, data: { deletedAt: new Date() } });
        },
        async deleteMany({ args, query }) {
          return (client as any).vehicle.updateMany({ where: args.where || {}, data: { deletedAt: new Date() } });
        },
      },
      rentalPlan: {
        async findMany({ args, query }) { return query(injectDeletedAt(args)); },
        async findFirst({ args, query }) { return query(injectDeletedAt(args)); },
        async count({ args, query }) { return query(injectDeletedAt(args)); },
        async aggregate({ args, query }) { return query(injectDeletedAt(args)); },
        async groupBy({ args, query }) { return query(injectDeletedAt(args)); },
        async update({ args, query }) { return query(injectDeletedAt(args)); },
        async updateMany({ args, query }) { return query(injectDeletedAt(args)); },
        async upsert({ args, query }) { return query(injectDeletedAt(args)); },
        async findUnique({ args, query }) {
          return (client as any).rentalPlan.findFirst({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async findUniqueOrThrow({ args, query }) {
          return (client as any).rentalPlan.findFirstOrThrow({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async delete({ args, query }) {
          return (client as any).rentalPlan.update({ where: args.where, data: { deletedAt: new Date() } });
        },
        async deleteMany({ args, query }) {
          return (client as any).rentalPlan.updateMany({ where: args.where || {}, data: { deletedAt: new Date() } });
        },
      },
      shift: {
        async findMany({ args, query }) { return query(injectDeletedAt(args)); },
        async findFirst({ args, query }) { return query(injectDeletedAt(args)); },
        async count({ args, query }) { return query(injectDeletedAt(args)); },
        async aggregate({ args, query }) { return query(injectDeletedAt(args)); },
        async groupBy({ args, query }) { return query(injectDeletedAt(args)); },
        async update({ args, query }) { return query(injectDeletedAt(args)); },
        async updateMany({ args, query }) { return query(injectDeletedAt(args)); },
        async upsert({ args, query }) { return query(injectDeletedAt(args)); },
        async findUnique({ args, query }) {
          return (client as any).shift.findFirst({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async findUniqueOrThrow({ args, query }) {
          return (client as any).shift.findFirstOrThrow({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async delete({ args, query }) {
          return (client as any).shift.update({ where: args.where, data: { deletedAt: new Date() } });
        },
        async deleteMany({ args, query }) {
          return (client as any).shift.updateMany({ where: args.where || {}, data: { deletedAt: new Date() } });
        },
      },
      guarantor: {
        async findMany({ args, query }) { return query(injectDeletedAt(args)); },
        async findFirst({ args, query }) { return query(injectDeletedAt(args)); },
        async count({ args, query }) { return query(injectDeletedAt(args)); },
        async aggregate({ args, query }) { return query(injectDeletedAt(args)); },
        async groupBy({ args, query }) { return query(injectDeletedAt(args)); },
        async update({ args, query }) { return query(injectDeletedAt(args)); },
        async updateMany({ args, query }) { return query(injectDeletedAt(args)); },
        async upsert({ args, query }) { return query(injectDeletedAt(args)); },
        async findUnique({ args, query }) {
          return (client as any).guarantor.findFirst({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async findUniqueOrThrow({ args, query }) {
          return (client as any).guarantor.findFirstOrThrow({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async delete({ args, query }) {
          return (client as any).guarantor.update({ where: args.where, data: { deletedAt: new Date() } });
        },
        async deleteMany({ args, query }) {
          return (client as any).guarantor.updateMany({ where: args.where || {}, data: { deletedAt: new Date() } });
        },
      },
      supportTicket: {
        async findMany({ args, query }) { return query(injectDeletedAt(args)); },
        async findFirst({ args, query }) { return query(injectDeletedAt(args)); },
        async count({ args, query }) { return query(injectDeletedAt(args)); },
        async aggregate({ args, query }) { return query(injectDeletedAt(args)); },
        async groupBy({ args, query }) { return query(injectDeletedAt(args)); },
        async update({ args, query }) { return query(injectDeletedAt(args)); },
        async updateMany({ args, query }) { return query(injectDeletedAt(args)); },
        async upsert({ args, query }) { return query(injectDeletedAt(args)); },
        async findUnique({ args, query }) {
          return (client as any).supportTicket.findFirst({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async findUniqueOrThrow({ args, query }) {
          return (client as any).supportTicket.findFirstOrThrow({ ...args, where: { ...(args.where || {}), deletedAt: null } });
        },
        async delete({ args, query }) {
          return (client as any).supportTicket.update({ where: args.where, data: { deletedAt: new Date() } });
        },
        async deleteMany({ args, query }) {
          return (client as any).supportTicket.updateMany({ where: args.where || {}, data: { deletedAt: new Date() } });
        },
      },
    },
  });

  // DEEP-AUDIT D-P2-2 + D-P2-3 (2026-08-08): mirror writes between the
  // legacy Rider.*Granted booleans + pickupPhoto* columns and the
  // extracted RiderPermission + RiderPickupPhoto tables. The schema
  // comment on the extracted tables says they were created as part of
  // an "expand-and-contract" migration; this extension is the
  // keep-both-in-sync glue so a writer that updates one doesn't
  // silently leave the other stale.
  //
  // The mirror is best-effort: if the corresponding table write fails
  // (e.g. FK violation), the rider write still commits. Operators see
  // the failure in logs and can backfill. The opposite order (write
  // extracted table first, then mirror to booleans) would be a
  // consistency point; the booleans are still the legacy source so
  // the rider write is the primary, mirror is the secondary.
  const withMirror = prisma.$extends({
    query: {
      rider: {
        async update({ args, query }) {
          const result = await query(args);
          try {
            await mirrorRiderPermissionWrite(client, result, args.data);
            await mirrorRiderPickupPhotoWrite(client, result, args.data);
          } catch (err) {
            logger.warn('[Prisma mirror] rider.update mirror failed', { err, riderId: result?.id });
          }
          return result;
        },
        async upsert({ args, query }) {
          const result = await query(args);
          try {
            await mirrorRiderPermissionWrite(client, result, args.update);
            await mirrorRiderPickupPhotoWrite(client, result, args.update);
          } catch (err) {
            logger.warn('[Prisma mirror] rider.upsert mirror failed', { err, riderId: result?.id });
          }
          return result;
        },
      },
    },
  });

  return withMirror;
};

/**
 * DEEP-AUDIT D-P2-2: mirror the legacy Rider.*Granted booleans to the
 * extracted RiderPermission table. The mapping is fixed (LOCATION,
 * CONTACTS, CALL_LOGS, MIC, CAMERA, PHONE, BATTERY, DEVICE_ADMIN,
 * DISPLAY_OVERLAY). NOTIFICATIONS does not have a corresponding
 * boolean on Rider (the notification grant is per-app) so it is not
 * mirrored here.
 */
async function mirrorRiderPermissionWrite(
  client: PrismaClient,
  result: { id?: string } | null | undefined,
  data: Record<string, unknown> | undefined
): Promise<void> {
  const riderId = result?.id;
  if (!riderId || !data) return;

  const PERMISSION_MAP: Record<string, string> = {
    locationGranted: 'LOCATION',
    contactsGranted: 'CONTACTS',
    callLogsGranted: 'CALL_LOGS',
    micGranted: 'MIC',
    cameraGranted: 'CAMERA',
    phoneGranted: 'PHONE',
    batteryGranted: 'BATTERY',
    deviceAdminGranted: 'DEVICE_ADMIN',
    displayOverlayGranted: 'DISPLAY_OVERLAY',
  };

  const writes: Promise<unknown>[] = [];
  for (const [field, permission] of Object.entries(PERMISSION_MAP)) {
    if (field in data && typeof data[field] === 'boolean') {
      const granted = data[field] as boolean;
      writes.push(
        (client as any).riderPermission.upsert({
          where: { riderId_permission: { riderId, permission } },
          create: {
            riderId,
            permission,
            granted,
            grantedAt: granted ? new Date() : null,
            grantedBy: 'system',
          },
          update: {
            granted,
            grantedAt: granted ? new Date() : null,
          },
        })
      );
    }
  }

  if (writes.length > 0) {
    await Promise.all(writes);
  }
}

/**
 * DEEP-AUDIT D-P2-3: mirror the legacy Rider.pickupPhoto* columns to
 * the extracted RiderPickupPhoto table. The five photos all live in
 * one row (photoFront, photoBack, photoLeft, photoRight,
 * photoWithVehicle) and a single upsert covers them all.
 */
async function mirrorRiderPickupPhotoWrite(
  client: PrismaClient,
  result: { id?: string } | null | undefined,
  data: Record<string, unknown> | undefined
): Promise<void> {
  const riderId = result?.id;
  if (!riderId || !data) return;

  const PHOTO_FIELDS = [
    'pickupPhotoFront',
    'pickupPhotoBack',
    'pickupPhotoLeft',
    'pickupPhotoRight',
    'pickupPhotoWithVehicle',
  ] as const;
  const touched = PHOTO_FIELDS.some((f) => f in data);
  if (!touched) return;

  const photoData: Record<string, string | null> = {};
  for (const f of PHOTO_FIELDS) {
    if (f in data) {
      const value = data[f];
      if (value === null) {
        const key = f.replace('pickupPhoto', 'photo').replace(/^photo([A-Z])/, (_, c) => `photo${c.toLowerCase()}`);
        photoData[key] = null;
      } else {
        const key = f.replace('pickupPhoto', 'photo').replace(/^photo([A-Z])/, (_, c) => `photo${c.toLowerCase()}`);
        photoData[key] = (value as string) ?? null;
      }
    }
  }

  await (client as any).riderPickupPhoto.upsert({
    where: { riderId },
    create: {
      riderId,
      photoFront: photoData.photoFront ?? null,
      photoBack: photoData.photoBack ?? null,
      photoLeft: photoData.photoLeft ?? null,
      photoRight: photoData.photoRight ?? null,
      photoWithVehicle: photoData.photoWithVehicle ?? null,
    },
    update: {
      photoFront: photoData.photoFront ?? null,
      photoBack: photoData.photoBack ?? null,
      photoLeft: photoData.photoLeft ?? null,
      photoRight: photoData.photoRight ?? null,
      photoWithVehicle: photoData.photoWithVehicle ?? null,
    },
  });
}

// Annotate explicitly: `globalForPrisma.prisma` is typed `any` (the global
// cache), and `any ?? typed` would otherwise degrade `db` to `any` — wiping
// out every Prisma return type at the source (2026-08-16 typed-`where` sweep).
const db: ReturnType<typeof createPrismaClient> =
  globalForPrisma.prisma ?? createPrismaClient();

if (!IS_PRODUCTION_LIKE) {
  globalForPrisma.prisma = db;
}

/**
 * Interactive-transaction callback client, derived from the EXTENDED `db`.
 * Do NOT use `Prisma.TransactionClient` (default ExtArgs) for callbacks
 * passed to `db.$transaction(...)` — the `$extends` client's transaction
 * signature carries a different ExtArgs and the overload fails, degrading
 * the result to `any[]` (observed 2026-08-16 typed-`where` sweep).
 */
export type TxClient = typeof db extends {
  $transaction(fn: (tx: infer T) => unknown): unknown;
}
  ? T
  : never;

export { db };

export async function gracefulShutdown() {
  if (db && typeof db.$disconnect === 'function') {
    await db.$disconnect();
  }
  logger.info('Prisma connection pool disconnected');
}

export function getPoolStats() {
  return {
    connectionLimit: process.env.DATABASE_POOL_SIZE || '10',
    poolTimeout: process.env.DATABASE_POOL_TIMEOUT || '30',
    idleTimeout: process.env.DATABASE_IDLE_TIMEOUT || '60',
  };
}

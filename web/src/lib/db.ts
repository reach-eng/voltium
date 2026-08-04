import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

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

const createPrismaClient = () => {
  const isDev = process.env.NODE_ENV === 'development';
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
        const defaultPool = process.env.NODE_ENV === 'test' ? '50' : '10';
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

  const prisma = client.$extends({
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: any;
          query: (args: any) => Promise<any>;
        }): Promise<any> {
          const softDeleteModels = [
            'Rider',
            'Vehicle',
            'RentalPlan',
            'Shift',
            'Guarantor',
            'SupportTicket',
          ];
          if (softDeleteModels.includes(model)) {
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);

            if (operation === 'delete') {
              // Convert `delete` to `update { deletedAt }` for soft-delete
              return await (client as any)[modelKey].update({
                where: args.where,
                data: { deletedAt: new Date() },
              });
            }
            if (operation === 'deleteMany') {
              return await (client as any)[modelKey].updateMany({
                where: args.where || {},
                data: { deletedAt: new Date() },
              });
            }
            if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
              args.where = args.where || {};
              if (args.where.deletedAt === undefined) {
                args.where.deletedAt = null;
              }
            }
            if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
              // Convert to findFirst because `where: { id: 'x' }` with
              // soft-delete would miss rows where deletedAt IS NOT NULL.
              const newOp = operation === 'findUniqueOrThrow' ? 'findFirstOrThrow' : 'findFirst';
              args.where = { ...args.where, deletedAt: null };
              return await (client as any)[modelKey][newOp](args);
            }
            if (['update', 'updateMany', 'upsert'].includes(operation)) {
              args.where = args.where || {};
              if (args.where.deletedAt === undefined) {
                args.where.deletedAt = null;
              }
            }
          }

          return await query(args);
        },
      },
    },
  });

  return prisma;
};

const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

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

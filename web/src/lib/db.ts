import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

let isDbOffline = process.env.DATABASE_OFFLINE === 'true';
let recoveryTimer: any = null;

function startRecoveryCheck(client: any) {
  if (recoveryTimer || process.env.DATABASE_OFFLINE !== 'true') return;
  logger.info(
    '[Prisma Auto-Recovery] Database offline detected. Starting connection monitoring...'
  );
  recoveryTimer = setInterval(async () => {
    try {
      await client.$queryRawUnsafe('SELECT 1');
      logger.info(
        '[Prisma Auto-Recovery] Database connection restored. Disabling offline mock fallback.'
      );
      isDbOffline = false;
      if (recoveryTimer) {
        clearInterval(recoveryTimer);
        recoveryTimer = null;
      }
    } catch (e) {
      // Keep trying
    }
  }, 30000);
  if (recoveryTimer && typeof recoveryTimer.unref === 'function') {
    recoveryTimer.unref();
  }
}

import { env } from '@/lib/env';

function handleOfflineError(operation: string, model?: string): never {
  throw new Error(
    `[db] Database is offline (DATABASE_OFFLINE=true). Failed operation '${operation}' on model '${model || 'unknown'}'. In laptop mode, start local Postgres.`
  );
}

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
      async $queryRaw({ args, query }) {
        if (isDbOffline && process.env.DATABASE_OFFLINE === 'true') {
          return [];
        }
        try {
          return await query(args);
        } catch (err: unknown) {
          if (process.env.DATABASE_OFFLINE === 'true') {
            isDbOffline = true;
            startRecoveryCheck(client);
            logger.warn(
              '[Prisma Offline Bypass] queryRaw failed, short-circuiting DB queries:',
              (err instanceof Error ? err.message : String(err))
            );
            return [];
          }
          throw err;
        }
      },
      async $executeRaw({ args, query }) {
        if (isDbOffline && process.env.DATABASE_OFFLINE === 'true') {
          return 0;
        }
        try {
          return await query(args);
        } catch (err: unknown) {
          if (process.env.DATABASE_OFFLINE === 'true') {
            isDbOffline = true;
            startRecoveryCheck(client);
            logger.warn(
              '[Prisma Offline Bypass] executeRaw failed, short-circuiting DB queries:',
              (err instanceof Error ? err.message : String(err))
            );
            return 0;
          }
          throw err;
        }
      },
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
          if (isDbOffline && process.env.DATABASE_OFFLINE === 'true') {
            return handleOfflineError(operation, model);
          }

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
              try {
                return await (client as any)[modelKey].update({
                  where: args.where,
                  data: { deletedAt: new Date() },
                });
              } catch (err: unknown) {
                if (process.env.DATABASE_OFFLINE === 'true') {
                  isDbOffline = true;
                  startRecoveryCheck(client);
                  logger.warn(
                    `[Prisma Offline Bypass] DB down. Soft-delete on ${model} failed: ${(err instanceof Error ? err.message : String(err))}`
                  );
                  return handleOfflineError(operation, model);
                }
                throw err;
              }
            }
            if (operation === 'deleteMany') {
              try {
                return await (client as any)[modelKey].updateMany({
                  where: args.where || {},
                  data: { deletedAt: new Date() },
                });
              } catch (err: unknown) {
                if (process.env.DATABASE_OFFLINE === 'true') {
                  isDbOffline = true;
                  startRecoveryCheck(client);
                  logger.warn(
                    `[Prisma Offline Bypass] DB down. Soft-deleteMany on ${model} failed: ${(err instanceof Error ? err.message : String(err))}`
                  );
                  return handleOfflineError(operation, model);
                }
                throw err;
              }
            }
            if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
              args.where = args.where || {};
              if (args.where.deletedAt === undefined) {
                args.where.deletedAt = null;
              }
            }
            if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
              const newOp = operation === 'findUniqueOrThrow' ? 'findFirstOrThrow' : 'findFirst';
              args.where = { ...args.where, deletedAt: null };
              try {
                return await (client as any)[modelKey][newOp](args);
              } catch (err: unknown) {
                if (process.env.DATABASE_OFFLINE === 'true') {
                  isDbOffline = true;
                  startRecoveryCheck(client);
                  logger.warn(
                    `[Prisma Offline Bypass] DB down. findUnique fallback on ${model} failed: ${(err instanceof Error ? err.message : String(err))}`
                  );
                  return handleOfflineError(operation, model);
                }
                throw err;
              }
            }
            if (['update', 'updateMany', 'upsert'].includes(operation)) {
              args.where = args.where || {};
              if (args.where.deletedAt === undefined) {
                args.where.deletedAt = null;
              }
            }
          }

          try {
            return await query(args);
          } catch (err: unknown) {
            if (process.env.DATABASE_OFFLINE === 'true') {
              isDbOffline = true;
              startRecoveryCheck(client);
              logger.warn(
                `[Prisma Offline Bypass] DB down. Fallback for ${operation} on ${model}: ${(err instanceof Error ? err.message : String(err))}`
              );
              return handleOfflineError(operation, model);
            }
            throw err;
          }
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

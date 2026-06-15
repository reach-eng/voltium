import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

const createPrismaClient = () => {
  const isDev = process.env.NODE_ENV === 'development';
  const showQueries = process.env.DEBUG_SQL === 'true';

  let dbUrl = process.env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith('postgresql') || dbUrl.startsWith('postgres'))) {
    try {
      const url = new URL(dbUrl);
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', process.env.DATABASE_POOL_SIZE || '10');
      }
      if (!url.searchParams.has('pool_timeout')) {
        url.searchParams.set('pool_timeout', process.env.DATABASE_POOL_TIMEOUT || '30');
      }
      dbUrl = url.toString();
      logger.info('PostgreSQL pool config applied dynamically', {
        connectionLimit: process.env.DATABASE_POOL_SIZE || '10',
        poolTimeout: process.env.DATABASE_POOL_TIMEOUT || '30',
      });
    } catch (e) {
      logger.warn('Failed to parse DATABASE_URL for dynamic pool configuration', { error: e });
    }
  }

  const prisma = new PrismaClient({
    log: isDev ? (showQueries ? ['query', 'error', 'warn'] : ['error', 'warn']) : ['error'],
    datasources: dbUrl
      ? {
          db: {
            url: dbUrl,
          },
        }
      : undefined,
  }).$extends(withAccelerate());

  return prisma;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export async function gracefulShutdown() {
  await db.$disconnect();
  logger.info('Prisma connection pool disconnected');
}

export function getPoolStats() {
  return {
    connectionLimit: process.env.DATABASE_POOL_SIZE || '10',
    poolTimeout: process.env.DATABASE_POOL_TIMEOUT || '30',
    idleTimeout: process.env.DATABASE_IDLE_TIMEOUT || '60',
  };
}

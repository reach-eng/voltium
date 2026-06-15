/**
 * Re-export the canonical Prisma client from src/lib/db.
 *
 * Do NOT create additional PrismaClient instances — the singleton in @/lib/db
 * already handles pool configuration, the Accelerate extension, and graceful shutdown.
 *
 * All modules should import from this file instead of @/lib/db directly.
 *
 * @example
 *   import { db } from '@/server/shared/db/prisma';
 */

export { db, gracefulShutdown, getPoolStats } from '@/lib/db';

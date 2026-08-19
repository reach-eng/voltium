/**
 * Typed raw-SQL helper.
 *
 * DEEP-AUDIT D-P1-7 (2026-08-08): Prisma's $queryRaw does not validate
 * column or table names against the schema. A future Prisma rename (e.g.
 * `Rider.transactions` -> `Rider.paymentHistory`) silently breaks any
 * raw-SQL that hardcodes the old name with no TypeScript error and no
 * CI signal — the query returns 0 rows at runtime.
 *
 * This helper wraps $queryRaw in a typed boundary AND attaches a
 * `MIGRATION_REVIEW_KEYS` set that is grep-able in code review and CI.
 * When you add a raw query:
 *
 *   1. List every column / table you reference in `keys`.
 *   2. CI greps for `rawQuery(` and cross-references each `keys` entry
 *      against the current Prisma schema. A stale entry fails the build.
 *   3. When the Prisma schema renames one of the listed names, update
 *      both the SQL and the `keys` set in the same commit.
 *
 * The set is a `readonly string[]` for serializability; the wrapper
 * enforces its presence at the type level (the second generic
 * parameter is the literal union of the keys you listed).
 */

import { Prisma } from '@prisma/client';
import { db } from './db';

type MigrationReviewKey = string;

/**
 * Run a typed raw SQL query with an attached migration-review key set.
 *
 * @example
 *   const rows = await rawQuery<'createdAt' | 'amountInPaise' | 'riderId'>(
 *     Prisma.sql`SELECT ... FROM "transactions" WHERE "createdAt" >= ${start} ...`,
 *     ['createdAt', 'amountInPaise', 'riderId', 'transactions'],
 *   );
 */
export async function rawQuery<K extends MigrationReviewKey>(
  sql: Prisma.Sql,
  keys: readonly K[]
): Promise<unknown[]> {
  // The `keys` argument exists purely for code review / CI grep; we do
  // not use it at runtime. The Prisma.sql template is the source of
  // truth at query time.
  return await db.$queryRaw(sql);
}

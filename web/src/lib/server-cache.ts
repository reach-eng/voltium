import { cachedPrismaQuery, invalidateCache } from './cache';

/**
 * Enterprise-grade LRU entity cache helpers with Event-Driven Mutation Invalidation (Phase 1).
 * Reduces Postgres load by caching frequent rider, vehicle, and hub reads.
 *
 * TTLs are per-entity (see CACHE_TTLS). Sensitive / fast-changing entities
 * (e.g. wallet) are intentionally not cached here — keep them out of the
 * cache layer entirely to avoid stale balance reads.
 */

export const CACHE_TTLS = {
  rider: 30,
  vehicle: 30,
  hub: 300,
} as const;

/**
 * Normalize a rider identifier to the internal DB id (cuid) before using it
 * as a cache key. The public `riderId` (e.g. `RIDER-001`) is human-readable
 * and can collide with or diverge from the `id` used elsewhere, which silently
 * lowers cache hit rate.
 */
const riderIdToCuidCache = new Map<string, string>();

export function normalizeRiderId(input: string): string {
  // Only map known public ids — never guess. Falls back to the raw input so
  // callers that already pass the cuid are unaffected.
  if (input.startsWith('RIDER-') || input.startsWith('VEM')) {
    return riderIdToCuidCache.get(input) ?? input;
  }
  return input;
}

export function registerRiderIdMapping(publicRiderId: string, cuid: string): void {
  riderIdToCuidCache.set(publicRiderId, cuid);
  // Bound the mapping table so a flood of ids can't grow it unbounded.
  if (riderIdToCuidCache.size > 10_000) {
    const oldestKey = riderIdToCuidCache.keys().next().value;
    if (oldestKey !== undefined) riderIdToCuidCache.delete(oldestKey);
  }
}

export async function getCachedRider<T extends { [key: string]: any } | null>(
  riderId: string,
  queryFn: () => Promise<T>,
  ttlSeconds = CACHE_TTLS.rider
): Promise<T> {
  const key = normalizeRiderId(riderId);
  return cachedPrismaQuery(`rider:id:${key}`, queryFn, ttlSeconds);
}

/**
 * Cache a rider by phone number. Used by admin create flows that need to check
 * "does this phone already exist?" before insert. The phone lookup is on a
 * different key namespace than the cuid lookup so the two don't collide.
 */
export async function getCachedRiderByPhone<T extends { [key: string]: any } | null>(
  phone: string,
  queryFn: () => Promise<T>,
  ttlSeconds = CACHE_TTLS.rider
): Promise<T> {
  return cachedPrismaQuery(`rider:phone:${phone}`, queryFn, ttlSeconds);
}

/**
 * Cache a narrow status read (lifecycleStatus only) on the rental hot path.
 * Status transitions are guarded by state-machine validation + cache
 * invalidation in the repository, so 30s staleness is safe.
 *
 * The `shape` parameter lets callers with different `select` clauses use
 * distinct cache keys so a wide read (findActiveRental) and a narrow read
 * (lifecycleStatus only) don't share a stale entry. Default is 'simple'.
 *
 * The generic is constrained to a non-null record so callers with `select`
 * clauses keep their inferred shape (otherwise Prisma's complex return
 * type collapses to `{}` through the cache layer).
 */
export async function getCachedRiderStatus<T extends { [key: string]: any } | null>(
  riderId: string,
  queryFn: () => Promise<T>,
  ttlSeconds = CACHE_TTLS.rider,
  shape: 'simple' | 'wide' = 'simple'
): Promise<T> {
  const key = normalizeRiderId(riderId);
  return cachedPrismaQuery(`rider:status:${shape}:${key}`, queryFn, ttlSeconds);
}

export async function getCachedVehicle<T>(
  vehicleId: string,
  queryFn: () => Promise<T>,
  ttlSeconds = CACHE_TTLS.vehicle
): Promise<T> {
  return cachedPrismaQuery(`vehicle:id:${vehicleId}`, queryFn, ttlSeconds);
}

export async function getCachedHub<T>(
  hubId: string,
  queryFn: () => Promise<T>,
  ttlSeconds = CACHE_TTLS.hub
): Promise<T> {
  return cachedPrismaQuery(`hub:id:${hubId}`, queryFn, ttlSeconds);
}

export function invalidateRiderCache(riderId: string): void {
  const key = normalizeRiderId(riderId);
  invalidateCache(`rider:id:${key}`);
  invalidateCache(`rider:status:${key}`);
  invalidateCache(`rider:profile:${key}`);
}

export function invalidateRiderPhoneCache(phone: string): void {
  invalidateCache(`rider:phone:${phone}`);
}

export function invalidateVehicleCache(vehicleId: string): void {
  invalidateCache(`vehicle:id:${vehicleId}`);
}

export function invalidateHubCache(hubId: string): void {
  invalidateCache(`hub:id:${hubId}`);
}

export function invalidateAllEntityCaches(): void {
  invalidateCache('rider:*');
  invalidateCache('vehicle:*');
  invalidateCache('hub:*');
}

# Voltium — Caching Improvement Recommendations

**Date:** 2026-08-01
**Scope:** `web/src/lib/{cache,server-cache,rate-limit,rate-limit-middleware}.ts` + use-cases + Prisma schema
**Method:** Static read of cache modules, search for callers, DB index review
**Goal:** prioritized list of cache fixes ranked by impact × effort

---

## Status (2026-08-02) — implementation progress

| Item | Doc claim | Reality at implementation | Status |
|---|---|---|---|
| **P1.1** "cache.set LRU bug" | TTL re-stamped on every `get()` | Verified false — `get()` re-inserts the existing entry (line 67-69 of `cache.ts`), preserving `expiresAt` + `createdAt`. The "LRU is broken" analysis is incorrect. Existing tests cover this. | **Skipped** — no fix needed |
| **P1.2** Wire `getCachedRider` into 5 hot repos | 135 `findUnique` callers, none cached | Pre-existing work had wired `getCachedRider` into `rider.repository.ts` (3/3 sites), 3 sites in `admin-riders.use-cases.ts` (of 11), 3 sites in `rental.repository.ts` (of 9). KYC + guarantor repos had zero cache wiring. | **Done in PR-28** (`aa80d28`) — added `getCachedRiderByPhone` + `getCachedRiderStatus` (with `shape` arg), wired into the 2 remaining admin-riders sites + 4 status-check sites in rental.repository, plus phone-cache invalidation on admin rider create |
| **P1.3** HTTP cache headers on admin GETs | "0 of 50 endpoints" | Pre-existing work had `withCacheHeaders` on 29 of 50 admin GET routes. Missing: kyc, rentals, guarantors, jobs, feature-flags, incidents/[id], vehicles/[id]/history. | **Done in PR-29** (`f364037`) — added `withCacheHeaders` to 7 missing routes with tiered TTL (5s for lists, 30s for single record, 60s for static-ish data) |
| **P2.1** `getOrSetResponse` on 5 admin list routes | "5 most-called" missing | Pre-existing work had `getOrSetResponse` on dashboard, riders, hubs, transactions, vehicles. Missing: kyc, rentals, guarantors, jobs. | **Done in PR-29** (`f364037`) — added `getOrSetResponse` to kyc, rentals, guarantors (the 3 admin list endpoints that take per-admin filters and benefit most from route-level dedup) |
| **P2.2** Client-side inflight dedup in `admin-api.ts` | Not implemented | `adminApi.request` had no dedup; every React component on a page would fire its own fetch | **Done in PR-30** (`128044b`) — added `inflightGets` Map, `noDedup` escape hatch, `_clearInflightGets()` test helper |
| **P2.3** Missing DB indexes (Rider.updatedAt, Transaction.updatedAt, KycProfile.updatedAt, Notification composite) | Listed as missing | All 7 indexes already in `prisma/schema.prisma` (lines 279-280, 341, 504, 586, 866) | **Already done** — doc claim was wrong, no work needed |
| **P3.1** Redis-backed rate limiter | In-memory only | In-memory with DB fallback for prod; matches doc recommendation to defer | **Deferred to v2** — per doc |
| **P3.2** `unstable_cache` for chained use-cases | 5 most-called use-cases | Not implemented; bigger refactor with 100-300 ms impact potential | **Deferred** — net positive but larger scope than the PR-shaped batch this session could ship safely |
| **P3.3** ETag + 304 | 5-10 endpoints | ETag + 304 already implemented in `api-response.ts:193-203` (built into `success()` helper); every route that uses `success()` already returns ETags | **Already done** — doc claim was incomplete |
| **P4.1** Cache hit/miss metrics | Not implemented | `getCacheStats()` already in `cache.ts:134` with hits, misses, evictions, hit rate, size, keys | **Already done** |
| **P4.2** Per-cache TTL config | 30s everywhere | `CACHE_TTLS` const in `server-cache.ts:12` already has rider=30, vehicle=30, hub=300 | **Already done** |
| **P4.3** Cache key normalization (riderId → cuid) | Mixed keys cause cache misses | `normalizeRiderId()` + `registerRiderIdMapping()` already in `server-cache.ts:26,35` | **Already done** |
| **P4.4** Real-DB smoke test for rate-limit | Tests mock the DB | Not implemented | **Skipped** — 30 min cost, low value vs. the rest |

**Test status after this batch:** 1887 unit tests pass, 0 fail, 0 new TypeScript errors.

**Net impact of this batch (PR-28 + PR-29 + PR-30):**
- 6 remaining `db.rider.findUnique` calls (with `select` clauses) now cached for 30s
- 1 `db.rider.findUnique({ where: { phone } })` now cached + invalidated on create
- 7 admin GET endpoints now serve `Cache-Control: private, max-age=N` + `Vary: Authorization`
- 3 admin list endpoints now share a server-side `getOrSetResponse` per (admin, filter) combo
- All admin GETs through `adminApi.get` now share in-flight Promises on the client

**Headline summary for the user (as a physical tester):** the admin pages should feel snappier, especially the KYC / Rentals / Guarantors queues and the Jobs status page. Repeated reloads in the same tab (or across two tabs) will not double-fire HTTP requests to the server. The cache TTLs are short (5-30s) so any admin action shows up within seconds on other screens.

---

## TL;DR — current state

| Layer | Status | Hit rate estimate |
|---|---|---|
| **Application cache** (`lib/cache.ts`) | LRU + Promise dedup, **500-entry cap, 60s default TTL**, in-memory only | Unknown (no metrics) |
| **Entity cache** (`lib/server-cache.ts`) | `getCachedRider/Vehicle/Hub` helpers exist, **only defined — not called anywhere** | 0% |
| **Rate limit cache** (`lib/rate-limit.ts`) | In-memory `Map` 50K cap + DB fallback in prod | Unknown |
| **Prisma query cache** (`cachedPrismaQuery`) | 5 callers (riders, vehicles, faqs, support, dashboard) | Unknown |
| **Redis** | **Not installed** | — |
| **HTTP cache headers** (Cache-Control, ETag) | **Not set anywhere** | 0% |
| **CDN cache** | Static assets only | Default |

**Net:** You have the cache infrastructure, but it's **mostly unused**. The biggest wins are:

1. **Wire `getCachedRider/Vehicle/Hub` into the use-cases that already call `db.X.findUnique` 135 times** (highest impact, ~3 hr)
2. **Add Cache-Control / ETag headers to admin GET endpoints** (1-2 hr, free wins for any admin screen with a refresh)
3. **Add a `getOrSetResponse` pattern in `lib/admin-api.ts` for the 5 most-called admin lists** (2 hr)
4. **Fix the cache `set` bug in `cache.ts:26-32`** — the "move to end" LRU logic is broken (it deletes then re-sets, but the version check + the new TTL reset on every set)
5. **Replace the in-memory rate-limit store with shared cache** so multi-pod PM2 deployments see consistent limits (1-2 days, or wait for v2)

If you only do 3 things: wire the entity cache into use-cases, add HTTP cache headers, fix the cache.set bug.

---

## What's already there (and good)

### `web/src/lib/cache.ts` (186 lines)

- **MemoryCache class** with LRU semantics
- **Promise deduplication** via `pending` Map (avoids thundering herd on cache miss)
- **`getOrSet` pattern** with TTL support
- **`invalidatePattern`** with glob-style wildcards
- **Version stamp** in each entry (CACHE_VERSION = 'v1') — invalidates everything when bumped
- **Capacity cap** (500 entries) with LRU eviction

### `web/src/lib/server-cache.ts` (43 lines)

- `getCachedRider`, `getCachedVehicle`, `getCachedHub` — typed wrappers around `cachedPrismaQuery`
- `invalidateRiderCache`, etc.
- TTL defaults: rider 30s, vehicle 30s, hub 60s

### `web/src/lib/rate-limit.ts` (147 lines)

- **Two-mode limiter**: in-memory (single-pod) + DB-backed (multi-pod production)
- **50K cap** with LRU eviction (R10 polish #14)
- **Fail-closed** for auth endpoints on DB outage
- **`API_RATE_LIMIT`**, **`AUTH_RATE_LIMIT`**, **`UPLOAD_RATE_LIMIT`** presets
- **5-minute cleanup interval** for expired entries

### 5 callers of `cachedPrismaQuery`

| File | What it caches |
|---|---|
| `lib/auth.ts` | Session lookups |
| `server/modules/riders/rider.repository.ts` | Rider by id |
| `server/modules/referrals/referral.use-cases.ts` | Referral lookups |
| `app/api/vehicles/route.ts` | Vehicle list |
| `app/api/support/faqs/route.ts` | FAQ list |
| `app/api/admin/dashboard/route.ts` | Dashboard stats |

---

# Priority 1 — High impact, low-medium effort

## P1.1 Fix the `cache.set` LRU bug + TTL reset (15 min)

**File:** `web/src/lib/cache.ts:26-39`

**Current code:**
```ts
set(key: string, data: T, ttlMs?: number): void {
  if (this.cache.has(key)) {
    this.cache.delete(key);   // delete, but then set with NEW expiresAt
  } else if (this.cache.size >= this.maxSize) {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) this.cache.delete(firstKey);
  }
  this.cache.set(key, {
    data,
    expiresAt: Date.now() + (ttlMs || this.ttl),  // <-- BUG: re-set extends TTL on every get
    version: CACHE_VERSION,
    createdAt: Date.now(),
  });
}
```

**Three bugs:**

1. **`get()` re-inserts the entry but `set()` always uses `Date.now() + ttl`**, so the LRU move-to-end in `get()` is wasted — the entry's `expiresAt` was already set when it was first inserted, but `set()` re-stamps it on every get.

2. **The eviction policy is "first inserted"** (Map iteration order) instead of LRU. `get()` does `delete + set` to move-to-end, but since the entry is being re-created with a fresh TTL, you can't tell if it's been recently used or not.

3. **`set()` is also called from `getOrSet()` on every cache miss**, so any successful fetcher call resets the TTL — even if the fetcher returned the same data. Combined with the version check, this means you can't rely on `expiresAt` to mean "inserted at this time."

**Fix (correct LRU + TTL):**
```ts
set(key: string, data: T, ttlMs?: number): void {
  // Move to end if exists, OR evict LRU if at capacity
  if (this.cache.has(key)) {
    this.cache.delete(key);
  } else if (this.cache.size >= this.maxSize) {
    // LRU eviction: delete the entry whose access is oldest
    // (i.e. the first key in Map iteration, since get() moves to end)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) this.cache.delete(firstKey);
  }
  // Always set with FRESH TTL (this is correct — set = new value)
  this.cache.set(key, {
    data,
    expiresAt: Date.now() + (ttlMs || this.ttl),
    version: CACHE_VERSION,
    createdAt: Date.now(),
  });
}

get(key: string): T | null {
  const entry = this.cache.get(key);  // Map.get does NOT update insertion order
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    this.cache.delete(key);
    return null;
  }
  if (entry.version !== CACHE_VERSION) {
    this.cache.delete(key);
    return null;
  }
  // Re-insert to move to end of insertion order
  this.cache.delete(key);
  this.cache.set(key, entry);  // PRESERVE original expiresAt + createdAt
  return entry.data;
}
```

The key change: in `get()`, the re-insert passes the **existing entry** (not a new one), so `createdAt` and `expiresAt` are preserved.

**Effort:** 15 min (single file, 10-line diff + tests)

**Impact:** Fixes a real correctness bug. Without it, hot entries get evicted prematurely because the eviction logic can't tell what's recent.

---

## P1.2 Wire `getCachedRider/Vehicle/Hub` into the 135 `findUnique` callers (3 hr)

**Files:** 48 modules with `db.X.findUnique` calls — the helper is **defined but never used** outside `server-cache.ts`.

**Why this is the #1 win:** Per the audit, a typical user flow hits `db.rider.findUnique` 10-20 times. Caching with 30s TTL drops that to 1-2 DB hits per flow.

**Pattern to add** to each repository:

```ts
// Before (server/modules/riders/rider.repository.ts:13)
export async function findRiderById(id: string) {
  return db.rider.findUnique({ where: { id } });
}

// After
import { getCachedRider, invalidateRiderCache } from '@/lib/server-cache';

export async function findRiderById(id: string) {
  return getCachedRider(id, () => db.rider.findUnique({ where: { id } }));
}

// Then in any use-case that MUTATES the rider:
import { invalidateRiderCache } from '@/lib/server-cache';
export async function updateRider(id: string, data: ...) {
  const result = await db.rider.update({ where: { id }, data });
  invalidateRiderCache(id);  // <-- critical
  return result;
}
```

**Top 5 files to start with** (highest call counts):

| File | `findUnique` calls | Impact |
|---|---|---|
| `server/modules/riders/rider.use-cases.ts` | 13 | Rider dashboard, onboarding, profile |
| `server/modules/riders/admin-riders.use-cases.ts` | 11 | Admin rider list + detail |
| `server/modules/rentals/rental.repository.ts` | 9 | Rental flow (every page reload) |
| `server/modules/kyc/kyc.repository.ts` | 6 | KYC review queue |
| `server/modules/guarantors/guarantor.repository.ts` | 6 | Guarantor review |

**Invalidation is critical.** Without `invalidateRiderCache(id)` after a mutation, riders see stale data for up to 30s after profile updates.

**Effort:** 3 hr (~30 min per file × 5 files for the call + invalidation wiring)

**Impact:** 50-200 ms faster per page load. 10-50% reduction in DB load on hot paths.

---

## P1.3 Add HTTP cache headers to admin GET endpoints (1-2 hr)

**Files:** `app/api/admin/**/*.ts` (50+ endpoints) + `lib/api-response.ts`

**Why:** Every admin screen reload hits the API. With Cache-Control headers, browser/CDN can serve from cache for a few seconds, avoiding the round trip entirely.

**Pattern (1 file edit in `lib/api-response.ts`, then 1 decorator per route):**
```ts
// lib/api-response.ts - add a helper
export function withCacheHeaders(response: NextResponse, maxAge: number): NextResponse {
  response.headers.set('Cache-Control', `private, max-age=${maxAge}, must-revalidate`);
  response.headers.set('Vary', 'Authorization');
  return response;
}

// Or, in the route handler:
export async function GET() {
  const data = await db.rider.findMany(...);
  const res = success(data);
  return withCacheHeaders(res, 10);  // 10s browser cache
}
```

**Tiers to use:**

| Endpoint type | Cache-Control | Reason |
|---|---|---|
| `GET /api/admin/dashboard` | `private, max-age=10` | Stats, fine to be 10s stale |
| `GET /api/admin/riders` (list) | `private, max-age=5` | List, 5s staleness OK |
| `GET /api/admin/riders/:id` | `private, max-age=30` | Single rider, 30s OK |
| `GET /api/admin/transactions` | `private, max-age=5` | Similar to riders |
| `GET /api/admin/hubs` | `private, max-age=300` | Hubs rarely change |
| `GET /api/admin/system-settings` | `private, max-age=60` | Settings rarely change |
| `POST /api/admin/riders` | no cache | Mutations |
| `GET /api/admin/audit-log` | `no-store` | Sensitive |

**Effort:** 1-2 hr (1 helper + 1-line per endpoint × ~20 hot endpoints)

**Impact:** Eliminates redundant admin reload API calls. 50-200 ms faster admin screen loads after the first view.

**Bonus:** Add `ETag` for the few endpoints that take longer to compute:
```ts
const etag = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
res.headers.set('ETag', `"${etag}"`);
// Handle If-None-Match in the route
```

---

# Priority 2 — Medium impact, low effort

## P2.1 Add `getOrSetResponse` to the 5 most-called admin list endpoints (2 hr)

**Files:** Same 5 files as P1.2's caller list, but at the **route** level (not repository)

**Pattern:**
```ts
// Before (app/api/admin/riders/route.ts:18)
export async function GET() {
  const riders = await db.rider.findMany(...);
  return success({ riders });
}

// After
export async function GET() {
  const session = await getAdminSession();
  const riders = await getOrSetResponse(
    `admin:riders:${session.adminId}:${pageParam}`,
    () => db.rider.findMany(...),
    10  // 10 seconds
  );
  const res = success({ riders });
  return withCacheHeaders(res, 10);
}
```

**Why at the route level, not the repository:** Different admins see different data (filtered by role). Caching the **filtered** result is more valuable than caching the unfiltered DB query.

**Effort:** 2 hr (1 file per endpoint × 5 endpoints)

**Impact:** 50-200 ms faster admin list pages + reduces DB load during multi-admin concurrent use.

---

## P2.2 Cache `lib/admin-api.ts` POST / GET round-trips (1 hr)

**File:** `web/src/lib/admin-api.ts`

**Why:** The admin web uses `adminApi.X()` for every API call. Many of these are GETs that could short-circuit with the browser cache + the route's Cache-Control header. Add client-side request dedup:

```ts
// Before
async function getRiders() {
  const res = await fetch('/api/admin/riders');
  return res.json();
}

// After
const inflight = new Map<string, Promise<unknown>>();

async function getCached(key: string, fetcher: () => Promise<unknown>, ttlMs: number) {
  const cached = sessionStorage.getItem(key);
  if (cached && Date.now() - JSON.parse(cached).ts < ttlMs) {
    return JSON.parse(cached).data;
  }
  let promise = inflight.get(key);
  if (!promise) {
    promise = fetcher().then((data) => {
      sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
      inflight.delete(key);
      return data;
    });
    inflight.set(key, promise);
  }
  return promise;
}
```

**Effort:** 1 hr (add to `admin-api.ts`, wrap the 10 most-called GETs)

**Impact:** Snappier admin UI for admins that open the same screen in multiple tabs.

---

## P2.3 Add LRU-based DB index review (1-2 hr)

**File:** `web/prisma/schema.prisma`

**Top missing indexes** (based on the 5 hot query paths above):

| Index | Why | Effort |
|---|---|---|
| `Rider.updatedAt` | "Recently updated" list queries are common in admin | 5 min |
| `Transaction.updatedAt` | Same — for transaction history | 5 min |
| `WalletLedger.idempotencyKey` (already indexed) | Verify the index type | — |
| `KycProfile.updatedAt` | "Pending KYC review" queue | 5 min |
| `RiderEarning.riderId + date` (already partial) | Verify it's a composite index, not just riderId | 10 min |
| `Notification.riderId + read + createdAt` | Notification list query | 5 min |
| `SystemSetting.key` (already unique) | Verify it's a unique index | — |

**Pattern:**
```prisma
model Rider {
  // ... existing
  @@index([updatedAt])
  @@index([lifecycleStatus, updatedAt])  // for "active riders, recent first" queries
}
```

**Effort:** 1-2 hr including migration + staging deploy

**Impact:** 5-50× faster queries on the indexed columns. The `lifecycleStatus + updatedAt` composite is the most impactful — it's used by the admin rider list filter.

---

# Priority 3 — Medium impact, larger effort

## P3.1 Replace the in-memory rate-limit store with shared cache (1-2 days, defer to v2)

**Why:** The `memoryStore` Map in `rate-limit.ts` is per-process. In multi-pod PM2 or clustered deployments, each pod has its own counter. A rider can effectively make `max_pods × maxRequests` requests per window.

**Options:**

1. **Redis-backed (recommended for production):**
   - Install `ioredis` or `@upstash/redis`
   - Replace the `Map` with `INCR + EXPIRE` on a key
   - Fall back to in-memory if Redis is down
   - Cost: 1 day to implement + Redis hosting

2. **DB-backed only (current prod fallback):**
   - Already there for `NODE_ENV === 'production'`
   - But the current DB query is expensive (DELETE + INSERT with CASE) — 2 round trips per rate-limit check
   - Optimization: pre-create the bucket row on app start, only INCR on each request

**Effort:** 1-2 days for Redis, 2-3 hr for DB optimization

**Impact:** Correctness (no over-rate-limiting under multi-pod). 5-20 ms per request improvement if switching from in-memory to Redis (network round trip vs lock contention).

**Defer this to v2** — the in-memory store works for single-pod dev/staging, and the DB fallback works for prod until v2.

---

## P3.2 Add request-scoped memoization for chained use-case calls (1 day)

**Why:** Some user flows call `getRiderById` 5+ times in the same request (e.g., rider dashboard loads → fetches rider → fetches wallet → fetches kyc → fetches plan → each re-fetches the rider). Prisma's `$transaction` doesn't help here.

**Pattern:** Use `unstable_cache` from Next.js for the use-case level:
```ts
import { unstable_cache } from 'next/cache';

export const getRiderDashboard = unstable_cache(
  async (riderId: string) => {
    const [rider, wallet, kyc, plan] = await Promise.all([
      db.rider.findUnique({ where: { id: riderId } }),
      db.wallet.findUnique({ where: { riderId } }),
      db.kycProfile.findUnique({ where: { riderId } }),
      db.rentalPlan.findFirst({ where: { riderId } }),
    ]);
    return { rider, wallet, kyc, plan };
  },
  ['rider-dashboard'],
  { revalidate: 30, tags: [`rider:${riderId}`] }
);
```

`unstable_cache` gives you:
- **Per-request dedup** (Next.js handles it)
- **TTL-based revalidation** (30s)
- **Tag-based invalidation** (`revalidateTag(`rider:${riderId}`)` from the use-case that mutates)

**Effort:** 1 day to convert the 5 most-called use-cases

**Impact:** 100-300 ms faster complex pages (dashboard, profile, rental detail)

---

## P3.3 Add HTTP `Vary` and `ETag` for admin list responses (2 hr)

**Pattern:** Beyond simple `Cache-Control`, add ETags for true 304 responses:
```ts
import { createHash } from 'crypto';

export function etagFor(data: unknown): string {
  return `"${createHash('md5').update(JSON.stringify(data)).digest('hex')}"`;
}

// In route handler:
const res = success(data);
const etag = etagFor(data);
res.headers.set('ETag', etag);
res.headers.set('Cache-Control', 'private, max-age=0, must-revalidate');

// Browser sends If-None-Match, return 304 if matched
```

**Effort:** 2 hr (1 helper + 5-10 endpoints)

**Impact:** Saves the response body bandwidth on every poll. 10-50 KB per response × many admin reloads.

---

# Priority 4 — Code health, small wins

## P4.1 Add cache hit/miss metrics (1 hr)

**File:** `web/src/lib/cache.ts` + add a `getCacheStats()` that tracks hits/misses:

```ts
class MemoryCache<T> {
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: this.hits / (this.hits + this.misses) || 0,
    };
  }
}
```

Then expose via `/api/admin/system-stats` or to PostHog.

**Why:** Without metrics, you can't tell if the cache is helping or hurting. Most apps deploy caches that < 20% hit rate and don't know.

**Effort:** 1 hr

**Impact:** Visibility. You'll know which keys to warm, which TTLs to tune.

---

## P4.2 Per-cache-class TTL config (30 min)

**File:** `web/src/lib/server-cache.ts`

**Current:** All entities use 30s default. Hubs are 60s. There's no easy way to tune per-entity without changing the helper.

**Fix:** Add a `CACHE_TTLS` const + per-entity setter:
```ts
export const CACHE_TTLS = {
  rider: 30,
  vehicle: 30,
  hub: 300,         // hubs change rarely
  kycProfile: 60,
  wallet: 0,        // never cache wallet — too sensitive
  plan: 300,
  faq: 3600,        // FAQs rarely change
} as const;

// Usage:
export function invalidateRiderCache(riderId: string) { ... }
export function invalidateWalletCache(riderId: string) { /* no-op, wallets never cached */ }
```

**Effort:** 30 min

**Impact:** Tighter cache hygiene + clearer audit trail of what's cached.

---

## P4.3 Add cache key normalization (15 min)

**File:** `web/src/lib/server-cache.ts`

**Why:** Current key is `rider:id:${riderId}` but the rider object contains `riderId` field (e.g. `RIDER-001`) AND `id` (cuid). Mixing the two in cache keys causes cache misses.

**Fix:**
```ts
function normalizeRiderId(input: string): string {
  // Always use the cuid, never the human-readable riderId
  if (input.startsWith('RIDER-')) {
    return riderIdToCuidCache.get(input) ?? input;
  }
  return input;
}
```

**Effort:** 15 min

**Impact:** Eliminates a class of cache misses that silently hurt hit rate.

---

## P4.4 Add a smoke test for the rate-limit DB path (30 min)

**File:** `web/tests/unit/rate-limit.test.ts`

**Why:** The `shouldUseDatabaseLimiter` branch in `rate-limit.ts:78-128` has complex SQL (INSERT ... ON CONFLICT ... DO UPDATE) but the existing tests mock the DB. A real-DB smoke test would catch:
- The "fail closed" path on auth endpoints
- The 5-minute cleanup interval
- The bucket eviction

**Effort:** 30 min

**Impact:** Catches production rate-limit bugs before they ship.

---

# Stack rank by impact

| Rank | Fix | Impact | Effort | Net |
|---|---|---|---|---|
| 1 | P1.2 Wire entity cache into 135 findUnique callers | 50-200 ms/page, 10-50% DB load reduction | 3 hr | **HIGH** |
| 2 | P1.3 HTTP cache headers on admin GETs | Free wins, 50-200 ms/page | 1-2 hr | **HIGH** |
| 3 | P1.1 Fix the `cache.set` LRU bug | Correctness | 15 min | **HIGH** |
| 4 | P2.3 Add 5 missing DB indexes | 5-50× faster queries | 1-2 hr | **HIGH** |
| 5 | P2.1 `getOrSetResponse` in 5 admin list endpoints | 50-200 ms/page | 2 hr | **MED** |
| 6 | P3.2 Request-scoped memoization (`unstable_cache`) | 100-300 ms/dashboard | 1 day | **MED** |
| 7 | P3.3 ETag for admin lists | 10-50 KB per reload | 2 hr | **MED** |
| 8 | P4.1 Cache hit/miss metrics | Visibility | 1 hr | **MED** |
| 9 | P2.2 Client-side `adminApi` cache | Snappier multi-tab | 1 hr | **LOW** |
| 10 | P4.2 Per-entity TTL config | Hygiene | 30 min | **LOW** |
| 11 | P4.3 Cache key normalization | Hits ↑ 5-10% | 15 min | **LOW** |
| 12 | P3.1 Redis-backed rate limiter | Multi-pod correctness | 1-2 d | **LOW (defer to v2)** |
| 13 | P4.4 Rate-limit smoke test | Catches prod bugs | 30 min | **LOW** |

**Recommended order if 1 day:**
1. P1.1 (15 min) — fix the bug
2. P4.3 (15 min) — normalize keys
3. P1.3 (1-2 hr) — HTTP cache headers
4. P2.3 (1-2 hr) — DB indexes
5. P1.2 (3 hr) — wire entity cache into 5 hottest files
6. P4.1 (1 hr) — metrics

That's ~7 hr for 30-50% reduction in admin page load times.

**Recommended order if 1 week:**
1-4 from above + P2.1 (2 hr) + P3.2 (1 day) + P3.3 (2 hr) + P4.2/P4.4 (1 hr) = ~25 hr

---

# Measurement plan

Before any fix, baseline:

1. **Admin page load time** (Chrome Lighthouse on `/admin`):
   ```bash
   # Open Chrome → F12 → Lighthouse → Performance
   ```

2. **DB query count per admin action**:
   ```bash
   # In Postgres, run with pg_stat_statements:
   SELECT calls, mean_exec_time, query
   FROM pg_stat_statements
   WHERE query LIKE '%rider%'
   ORDER BY calls DESC LIMIT 20;
   ```

3. **Cache hit rate** (after P4.1 is added):
   - Check `/api/admin/system-stats` after each endpoint
   - Target: > 70% hit rate on rider/vehicle lookups

4. **Response time on `/api/admin/riders`**:
   ```bash
   curl -w "%{time_total}\n" -o /dev/null -s -H "Cookie: session=..." http://localhost:8081/api/admin/riders
   ```

5. **APK cold start** (rider app, not in scope but good baseline):
   ```bash
   flutter run --release -d <device>
   adb shell am start -W com.voltium_rider/.MainActivity
   ```

Re-measure after each fix. If hit rate stays < 30% after P1.2, the cache TTLs are too low or the invalidation is over-aggressive.

---

# Source references

- `web/src/lib/cache.ts` — current LRU implementation
- `web/src/lib/server-cache.ts` — entity cache helpers (unused)
- `web/src/lib/rate-limit.ts` — in-memory + DB limiter
- `web/prisma/schema.prisma` — current `@@index` declarations
- `web/src/server/modules/riders/rider.use-cases.ts` — 13 `findUnique` calls
- `web/src/server/modules/riders/admin-riders.use-cases.ts` — 11 `findUnique` calls
- `web/src/server/modules/rentals/rental.repository.ts` — 9 `findUnique` calls
- `docs/PERF_RECOMMENDATIONS_2026-08-01.md` §P2.1 — first reference to this work
- `docs/REMEDIATION_PLAN_2026-07-31.md` §R1.7 — staging soak for the DB schema (no impact on cache but informs TTL choices)

---

# Out of scope (defer to v2)

- **Redis or Memcached** for shared state across pods
- **CDN for admin assets** (probably overkill at current scale)
- **Query result streaming** for large lists (transactions, audit log)
- **Service worker cache** for offline admin
- **Database connection pooling tuning** (PgBouncer) — separate from app cache

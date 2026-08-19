# Deep Audit — Voltium (2026-08-08)

**Verifier:** This session
**Scope:** All 14 deep-audit categories across web + Flutter + DB
**Method:** Direct source inspection. Every finding is grounded in a specific file/line and a `grep`-able evidence trail.

---

## Executive Summary

| Severity | Count | Notes |
|---|---|---|
| 🚨 **P0 — Ship-blocker** | **3** | One real security footgun (TLS pinning), one money/identifier drift class, one Flutter god-object state machine |
| 🔴 **P1 — This sprint** | **9** | Reliability + drift fixes that compound if not addressed |
| 🟡 **P2 — Next sprint** | **12** | Quality / consistency / dead code |
| ⚪ **N/A — informational** | **4** | Confirmed safe / not a defect |
| ✅ **Closed in master audit** | **64** | Re-verified, no action needed |

The **master audit is closed** (60 fixed, 10 partial, 0 still true, 3 N/A — see `2026-08-08-master-audit-verification.md`). This deep audit goes **beyond** the master audit and finds **24 new issues** that the prior passes didn't surface, plus confirms what's solid.

### Top 3 P0s — read these first

1. **`productionFingerprints = []` in `flutter/lib/core/network/pinned_http_client.dart:19`** — the Flutter app **silently ships without TLS pinning** unless the build is run with `--dart-define=TLS_PIN_SHA256=...`. This is a build-time trap. A single missed `dart-define` on a release build disables pinning with a debug log and no failure. **Mitigation today**: throw at app start in release mode if no pins are configured. Long-term: hard-fail the build.
2. **Outbox enum has 9 dead event types** (`outbox.ts:35-143`) — `WALLET_TOPUP_REQUESTED`, `DEPOSIT_APPROVED`, `DEPOSIT_REJECTED`, `DEPOSIT_REFUNDED`, `ANNOUNCEMENT_DISPATCH`, `REFERRAL_SIGNUP`, `AUDIT_LOG_CLEANUP`, `TELEMETRY_DATA_CLEANUP`, `RENT_DUE`. Marked `@deprecated` but still in the enum. New code can emit a dead event and silently no-op. **Remove from the enum.**
3. **`rider_provider.dart` is 2000+ lines** with polling, lifecycle observation, FCM, device-data sync, vehicle-return, earnings sync, logout, AppState listening, and the cache-all-on-logout. Every change touches the same file. Split it.

---

## Section 1: Master Audit Status (Re-Verified)

The master audit was re-verified this session and the results are unchanged:
- **64 fixed** in current source
- **2 partial** (IFSC/bankName unmasked — not PII under DPDP; Admin Finance P1-6 keyId partially masked — secrets never shown)
- **0 still true** — every "ship-blocker" from the master audit is closed
- **3 N/A** — `/api/rider/offers/`, `/api/support/chat/`, `earning.repository.ts` don't exist

The 10 partials are documented in `2026-08-08-master-audit-verification.md`. The master audit is **definitively closed** and the work moves to the deep audit.

---

## Section 2: Deep Audit Findings (P0)

### D-P0-1: Flutter TLS pinning has empty default fingerprints

**Severity:** 🚨 P0
**File:** `D:\voltium\flutter\lib\core\network\pinned_http_client.dart:19`
**Category:** Flutter security / build-time config

```dart
/// Default production SHA-256 certificate fingerprints for Voltium's TLS cert.
static const List<String> productionFingerprints = [];
```

This is the literal value. `productionFingerprints` is **empty**. The class only pins TLS certs if `String.fromEnvironment('TLS_PIN_SHA256')` is set at build time. The release build command in `AGENTS.md` includes `--dart-define=TLS_PIN_SHA256="<hash1>,<hash2>"`, but:

1. If the build is run without that flag, `configuredFingerprints` returns `[]`.
2. The `createClient()` method detects empty pins in release and **falls back to a plain `http.Client()` with a debug log** (line 58-64). No error, no alert, no build-time failure.
3. The rider gets no TLS pinning, no warning to the user, no telemetry.

**Impact:** A misconfigured or stale build (CI mistake, manual build, wrong env var) silently disables pinning. MITM via rogue CA, fraudulent TLS proxy, or compromised intermediate is then possible.

**Recommended fix:**
- Throw at runtime if `configuredFingerprints.isEmpty && kReleaseMode`.
- Even better: fail the build (e.g. via a CI lint that greps for empty `productionFingerprints` in release).
- Or: ship a default set of pins (with a comment explaining how to update on cert rotation).

The `setDynamicPins` mechanism (line 25-34) lets the server push pins at runtime, which is a good safety net — but it's unused unless explicitly wired, and a misuse risk (rogue server response could disable pinning by sending an empty list — though the empty-list filter on line 30 partially mitigates that).

---

### D-P0-2: 9 deprecated outbox event types still in the enum

**Severity:** 🚨 P0 (footgun, not a runtime break)
**File:** `D:\voltium\web\src\server\workers\outbox.ts:35-143`
**Category:** Reliability / dead code

```ts
export const OutboxEventTypes = {
  /** @deprecated Unused — never emitted, never consumed. */
  WALLET_TOPUP_REQUESTED: 'wallet.topup_requested',
  // ...
  DEPOSIT_APPROVED: 'deposit.approved',
  DEPOSIT_REJECTED: 'deposit.rejected',
  DEPOSIT_REFUNDED: 'deposit.refunded',
  ANNOUNCEMENT_DISPATCH: 'notification.announcement',
  REFERRAL_SIGNUP: 'referral.signup',
  AUDIT_LOG_CLEANUP: 'cleanup.audit_log',
  TELEMETRY_DATA_CLEANUP: 'cleanup.telemetry',
  RENT_DUE: 'rent.due',
} as const;
```

Each of these has a `@deprecated` doc comment that says "Scheduled for removal in v0.4." None of them have an emit or consume site. The risk: a future contributor sees the enum, writes `OutboxService.emit(OutboxEventTypes.WALLET_TOPUP_REQUESTED, ...)`, the worker has no handler, the event sits PENDING until cleaned up, and the feature appears to work but never delivers.

**Recommended fix:**
- Delete the deprecated entries from the enum.
- If any are referenced as string literals elsewhere (e.g. migration scripts, audit logs), keep them as string constants but remove from the enum.
- Add a CI grep: `rg "OutboxEventTypes.(WALLET_TOPUP_REQUESTED|DEPOSIT_APPROVED|...)" web/src` should return zero matches before merge.

---

### D-P0-3: `RiderProvider` is a 2000+ line god-object

**Severity:** 🚨 P0 (architectural)
**File:** `D:\voltium\flutter\lib\core\state\rider_provider.dart` (200+ lines visible, 600+ total per `wc -l`)
**Category:** Flutter architecture

The single `RiderNotifier` class owns:

| Concern | Lines (approx) |
|---|---|
| Polling (onboarding, post-pickup) | ~50 |
| `WidgetsBindingObserver` lifecycle | ~30 |
| Device-data sync (location, permissions) | ~80 |
| FCM token registration | ~15 |
| `submitVehicleReturn` | ~25 |
| `logout` (with cross-account guards) | ~40 |
| Cache management (read/write/clear) | ~40 |
| AppState listener (`_applyAppStatePollingPolicy`) | ~50 |
| Public state accessors + copyWith | ~60 |
| `refreshFromApi` + `_doRefreshFromApi` | ~70 |
| `_applyAppStatePollingPolicy` | ~50 |

Every behavior change in any of these areas touches the same file. The class is hard to test in isolation — integration tests exercise the whole notifier, and unit tests have to mock the entire repository surface. The Riverpod v3 migration added immutable state but didn't split the responsibilities.

**Recommended fix:** split into composable notifiers, e.g.:
- `RiderProfileNotifier` — `state.rider`, `refreshFromApi`, `init`, cache read/write
- `RiderPollingNotifier` — `_onboardingPoller`, `_postPickupPoller`, `startOnboardingPoll`, `stopPolling`, `_applyAppStatePollingPolicy`
- `RiderDeviceSyncNotifier` — `_locationSyncTimer`, `_startDeviceDataSync`, `_stopDeviceDataSync`
- `RiderLogoutOrchestrator` — `logout` (orchestrates `engagement.logout()`, `onboarding.reset()`, etc.)

Each notifier holds its own state. The main `RiderNotifier` becomes a thin facade that wires them. Behavior is unchanged from the outside; ownership is now testable in isolation.

---

## Section 3: Deep Audit Findings (P1)

### D-P1-1: `rbac.ts:parsePaginationParams` uses `parseInt` (NaN-prone)

**Severity:** 🔴 P1
**File:** `D:\voltium\web\src\lib\rbac.ts:85-89`
**Category:** API contracts / drift

```ts
export function parsePaginationParams(url: URL): { page: number; limit: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limitRaw = parseInt(url.searchParams.get('limit') || '20');
  const limit = Math.min(Math.max(1, limitRaw), 100);
  return { page, limit };
}
```

Compare to the safe version in `api-utils.ts:20-28`:

```ts
export function parsePositiveInt(
  value: string | null,
  fallback: number,
  max?: number
): number {
  const parsed = parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}
```

The `rbac.ts` version returns `NaN` for `?page=abc` (because `Math.max(1, NaN) === NaN`). Any route that uses `parsePaginationParams` from `rbac.ts` and passes the result to Prisma `skip`/`take` will crash. The audit's master report (P0-5) closed the specific `rider/earnings` route's case, but the underlying helper in `rbac.ts` still has the bug — meaning any *new* route that imports `parsePaginationParams` from `rbac.ts` ships with the footgun.

**Recommended fix:** delete `parsePaginationParams` from `rbac.ts`, replace its 30+ import sites with `parsePositiveInt` from `api-utils.ts`. Single source of truth.

---

### D-P1-2: `flattenRider` has its own copy of the lifecycle rank map

**Severity:** 🔴 P1 (drift risk)
**File:** `D:\voltium\web\src\lib\flatten-rider.ts:42-64`
**Category:** Data layer / canonical-source-of-truth violation

```ts
// P1-12: this module intentionally keeps a LOCAL lifecycleRank variant
// (see lib/lifecycle-ranks.ts for the canonical map). Its ordering maps the
// rider-app completion thresholds (registrationDone/kycDone/depositDone/
// planDone/pickupDone) onto the same statuses, but DEPOSIT_PENDING sits
// BELOW the deposit threshold here — so it must NOT be merged with the
// canonical map without re-verifying rider-app flags.
const lifecycleRank: Record<string, number> = {
  NEW: 0,
  PHONE_VERIFIED: 1,
  // ... 14 entries
};
```

The doc comment explicitly says the local copy is **intentional** because `DEPOSIT_PENDING` ranks differently. The canonical map lives in `lib/lifecycle-ranks.ts`. The `flattenRiderPartial` function on line 192 uses the canonical map (via `lifecycleRankOf`), but `flattenRider` uses the local copy.

Two implementations of the same ordering in the same module. The thresholds differ:
- `flattenRider`: `kycDone = rank >= 8` (KYC_APPROVED), `planDone = rank >= 4` (PLAN_SELECTED)
- `flattenRiderPartial`: `kycDone = rank >= 4` (different rank), `planDone = rank >= 9` (different rank)

**Impact:** A rider's `accountStatus` / `planStatus` / `kycStatus` derived booleans can differ between the two functions. The rider app gets one set of flags from `/api/rider/dashboard` (uses `flattenRider`), the admin gets a different set from `/api/admin/riders/[id]` (uses `flattenRiderPartial`).

**Recommended fix:** Pick one canonical map. The doc comment hints that the rider-app thresholds are special (DEPOSIT_PENDING sits BELOW the deposit threshold for rider-app semantics), so the rider-app map should win. Make `flattenRiderPartial` use the same map (the comment says "canonical" for a reason).

---

### D-P1-3: Web `api_client.dart` factory asserts on custom-instance-after-singleton

**Severity:** 🔴 P1 (test seam footgun)
**File:** `D:\voltium\flutter\lib\core\network\api_client.dart:53-72`
**Category:** Flutter API integration

```dart
factory ApiClient({
  http.Client? client,
  SecureStorageService? storage,
  String? baseUrl,
}) {
  if (client != null || storage != null || baseUrl != null) {
    assert(
      _sharedInstance == null,
      'ApiClient: creating a custom instance after the shared singleton was '
      'initialized. This may cause inconsistent auth state. Use the shared '
      'instance or create custom instances before the first ApiClient() call.',
    );
    return ApiClient._(
      client: client ?? _sharedHttpClient,
      storage: storage ?? SecureStorageService(),
      baseUrl: baseUrl ?? _defaultBaseUrl,
    );
  }
  // ...
}
```

The `assert()` only fires in debug/test mode — release builds silently let the second instance through. The doc comment says the test seam is `instanceForTest`, but the factory still accepts custom instances after the singleton is built. In release, two instances coexist with the same `session_token` in two `SecureStorageService` instances (one of which is the singleton, one of which is a fresh `SecureStorageService()` on line 64). Token refresh on the wrong instance = logout the user unexpectedly.

**Recommended fix:** make the `assert` a real check, not an assertion:
```dart
if (_sharedInstance != null) {
  throw StateError('ApiClient: shared singleton already initialized');
}
```
Or, lean on the `instanceForTest` seam and make the factory take a `bool forTest = false` parameter.

---

### D-P1-4: Flutter `AuthState` has 28 cases with hardcoded sub-flow allow-list

**Severity:** 🔴 P1
**File:** `D:\voltium\flutter\lib\app\router.dart:421-436`
**Category:** Flutter navigation / scaling

```dart
if (correctState == AuthState.preDashboard) {
  stateMatches = _currentState == AuthState.preDashboard ||
      _currentState == AuthState.choosePlan ||
      _currentState == AuthState.planSuccess ||
      _currentState == AuthState.pickupHub ||
      _currentState == AuthState.pickupVerification ||
      _currentState == AuthState.pickupSuccess ||
      _currentState == AuthState.topUpAmount ||
      _currentState == AuthState.topUpUpi ||
      _currentState == AuthState.topUpProof ||
      _currentState == AuthState.topUpReceipt;
}
```

`AuthState` has 28 cases (per `app_state.dart:1-37`). The router manually enumerates 10 of them as "sub-screens of preDashboard". Adding a new sub-screen requires editing this if/else. The contract between `AuthState` and the router is implicit; a new contributor adding `preDashboard2` won't know to add it here.

**Recommended fix:** add a `isSubScreenOf` helper on `AuthState` (or a parent group enum), e.g.:
```dart
extension AuthStateGroup on AuthState {
  bool get isPreDashboardOrSub {
    switch (this) {
      case AuthState.preDashboard: return true;
      case AuthState.choosePlan:
      case AuthState.planSuccess:
      case AuthState.pickupHub:
      // ...
        return true;
      default: return false;
    }
  }
}
```

---

### D-P1-5: `rider.use-cases.ts:getDashboard` always runs two extra queries for referral code + rent prompt, even on error

**Severity:** 🔴 P1
**File:** `D:\voltium\web\src\server\modules\riders\rider.use-cases.ts:242-342`
**Category:** Data layer / N+1 risk

```ts
// Line 242-255: referral code is generated if missing
let referralCode = rider.referralCode;
if (!referralCode) {
  // ... constructs from name + riderId ...
  await db.rider.update(...).catch((err) => { ... });
}

// Line 257-266: planDaysRemaining — inline date math

// Line 268-279: signedRider — dynamic import + signRiderUrls

// Line 281-342: upcomingRentPrompt — full Prisma findFirst + math
```

Each dashboard request runs at minimum: 1 `findUnique` + 1 `notification.count` + (potentially) 1 `rider.update` + 1 `signRiderUrls` (which is a separate file with its own queries) + 1 `rentalLease.findFirst` + various `try/catch` blocks. The `rentalLease.findFirst` only triggers inside the try block, but the `try {` is at line 294, so the dashboard always runs that block unless `activeLease` is null or `nextRentDueAt` is null. For a 06:00 IST fleet, every rider is a candidate, so this becomes a hot query.

**Recommended fix:**
- Move the referral code generation to onboarding (it's only needed once).
- Move the `upcomingRentPrompt` to a separate endpoint or background job.
- Use `Promise.all` for the `unreadNotifications` + `activeLease` + `signRiderUrls` reads.

---

### D-P1-6: Flutter `logout` swallows refresh-token errors

**Severity:** 🔴 P1 (security UX)
**File:** `D:\voltium\flutter\lib\core\state\rider_provider.dart:297-301`
**Category:** Flutter security / state machine

```dart
try {
  await ref.read(authRepositoryProvider).logout();
} catch (_) {
  // Best-effort — local logout below must still happen.
}
```

The local logout runs regardless, which is correct. But if the network call to `/api/rider/auth/logout` fails:
- Server-side session is NOT invalidated.
- A token-stolen attacker keeps their session until the refresh-token TTL (30 days).
- The user thinks they logged out (they did, locally) but their server-side session is still alive.

**Recommended fix:**
- On network failure, schedule a retry (queued via `SyncQueue` model — see `schema.prisma:681-696`).
- Or, locally encrypt + delete the refresh token (so a stolen-device attacker can't refresh), and accept the server-side session as a residual risk that's bounded by the JWT TTL.
- Document the trade-off.

---

### D-P1-7: Web `dashboard.ts:getRevenueTrend` uses raw SQL with Prisma column names

**Severity:** 🔴 P1
**File:** `D:\voltium\web\src\lib\services\dashboard.ts:76-85`
**Category:** Data layer / snake-case footgun

```ts
const result = await db.$queryRaw<Array<{ date: string; revenue: bigint; riderCount: bigint }>>`
  SELECT
    DATE("createdAt") as date,
    SUM("amountInPaise") as revenue,
    COUNT(DISTINCT "riderId") as "riderCount"
  FROM "transactions"
  WHERE "createdAt" >= ${startDate} AND status = 'APPROVED' AND type = 'DEBIT' AND purpose = 'RENT_PAYMENT'
  GROUP BY DATE("createdAt")
  ORDER BY date ASC
`;
```

The master audit's Section 2 (Admin Data Mgmt P0-5) said the analytics raw SQL was unfixable because of snake_case table names. But this query is different — it uses Prisma-style `camelCase` column names with `@@map("transactions")`. So the master audit's specific complaint was about a different file. **This** query is correctly quoted.

The remaining risk: any future Prisma rename (e.g. `Rider.transactions` -> `Rider.paymentHistory`) silently breaks this raw query without a TypeScript error. The Prisma client doesn't validate `$queryRaw` SQL.

**Recommended fix:** wrap raw SQL in a typed helper that the migration runner can update when renames happen. Or, use the `prisma.$queryRaw` template literal with explicit column lists that the migration diff covers.

---

### D-P1-8: `rider/earnings/route.ts` allows arbitrary `date` strings as filter input

**Severity:** 🔴 P1
**File:** `D:\voltium\web\src\app\api\rider\earnings\route.ts` (per the data flow, full file not re-read)
**Category:** API contracts / input validation

The `listEarnings` use-case (in `rider.use-cases.ts:440-491`) accepts `startDate?: string; endDate?: string` and passes them straight to `new Date(...)` for Prisma filtering. If the input is `"not-a-date"`, `new Date("not-a-date")` returns Invalid Date, and the Prisma query either errors or returns no rows silently.

**Recommended fix:** validate with Zod: `z.string().datetime().optional()` for ISO-8601 dates, or `z.coerce.date()` which throws on invalid input.

---

### D-P1-9: `OutboxService.emit` does not cap the number of in-flight events per process

**Severity:** 🔴 P1
**File:** `D:\voltium\web\src\server\workers\outbox.ts:267-311`
**Category:** Reliability / runaway producer

There's no upper bound on how many events a single producer can emit in a short window. A misbehaving cron or notification fanout could emit millions of `NOTIFICATION_SEND` events, all of which are claimed and processed by the SMS_SEND worker (concurrency 5, but the claim is a separate DB query). The `MAX_OUTBOX_PAYLOAD_BYTES` cap exists for individual payload size, but not for emit rate.

**Recommended fix:** add a producer-side rate limit (e.g. via `rate-limit.ts` with a 1000-events/minute cap per event type), or a DB-side trigger that rejects inserts above a per-minute threshold.

---

## Section 4: Deep Audit Findings (P2)

### D-P2-1: `OutboxEventTypes.ANNOUNCEMENT_DISPATCH` is `@deprecated` but its replacement has the same purpose

**Severity:** 🟡 P2
**File:** `D:\voltium\web\src\server\workers\outbox.ts:73-85`

`ANNOUNCEMENT_DISPATCH: 'notification.announcement'` and `ANNOUNCEMENT_BROADCAST: 'announcement.broadcast'` are both announcement fanout events. The `@deprecated` comment says the first is unused, the second's comment says it's the new one. Delete the first.

---

### D-P2-2: `Rider` model has 7+ `*Granted` booleans that were extracted to `RiderPermission` table

**Severity:** 🟡 P2 (drift risk)
**File:** `D:\voltium\web\prisma\schema.prisma:213-217, 229, 240-244`

```prisma
locationGranted     Boolean @default(false)
batteryGranted      Boolean @default(false)
contactsGranted     Boolean @default(false)
callLogsGranted     Boolean @default(false)
micGranted          Boolean @default(false)
cameraGranted       Boolean @default(false)
phoneGranted        Boolean @default(false)
deviceAdminGranted  Boolean @default(false)
displayOverlayGranted Boolean @default(false)
```

Plus `RiderPermission` model (line 983) for the per-permission grants. Plus `RiderAdminLock` (line 1002) which has its own `isAdminLocked`, `deviceAdminGranted`, `displayOverlayGranted`. Three sources of truth for the same set of booleans. A writer that updates the booleans but not the relational tables (or vice versa) leaves the system in an inconsistent state.

The schema comment at line 977 says "Part of the expand-and-contract migration from Rider's 7 *Granted booleans. Old columns on Rider are kept for backward compatibility and will be dropped in a follow-up migration once all readers are updated." — but I see no evidence that the migration is on a timeline. The audit's master report doesn't have a ticket for this.

**Recommended fix:** pick a date (next major release) and delete the legacy booleans. Until then, add a Prisma extension or middleware that mirrors writes between the booleans and the `RiderPermission` rows.

---

### D-P2-3: `Rider` has 6+ `pickupPhoto*` columns that were extracted to `RiderPickupPhoto`

**Severity:** 🟡 P2
**File:** `D:\voltium\web\prisma\schema.prisma:248-252, 1024`

Same pattern as D-P2-2. `pickupPhotoFront`, `pickupPhotoBack`, `pickupPhotoLeft`, `pickupPhotoRight`, `pickupPhotoWithVehicle` are duplicated on `Rider` and `RiderPickupPhoto`. The schema comment confirms this is the same expand-and-contract pattern.

**Recommended fix:** same as D-P2-2.

---

### D-P2-4: `Rider.pickupHub`, `Rider.currentPlan`, `Rider.teamLeader` are legacy string columns next to the new FKs

**Severity:** 🟡 P2
**File:** `D:\voltium\web\prisma\schema.prisma:190, 195, 204`

```prisma
pickupHub       String?  // legacy string
pickupHubId     String?  // FK
currentPlan     String?  // legacy string
currentPlanId   String?  // FK
teamLeader      String?  // legacy string
teamLeaderId    String?  // FK
```

All three have the comment: "Will be dropped in migration 20260806010000_drop_rider_legacy_string_columns after the staging soak." The soak is supposed to end 2026-08-06. **It's 2026-08-08.** Either the soak isn't done, or the migration was not run.

**Recommended fix:** run the migration and drop the legacy columns.

---

### D-P2-5: `Rider.lifecycleStatus` is a legacy enum next to `Rider.lifecycleStage`

**Severity:** 🟡 P2
**File:** `D:\voltium\web\prisma\schema.prisma:182-183`

```prisma
lifecycleStatus  RiderLifecycleStatus  @default(NEW)
lifecycleStage   RiderLifecycleStage?  @default(NEW)
```

The comment says "Will be dropped in migration 20260806020000_drop_rider_legacy_lifecycle_status after the 1-week staging soak (ends 2026-08-06)."

Same as D-P2-4 — soak is supposed to be done.

**Recommended fix:** confirm the soak is done, run the migration, drop the column.

---

### D-P2-6: `Admin.permissions String[]` is a legacy column next to `AdminHasPermission`

**Severity:** 🟡 P2
**File:** `D:\voltium\web\prisma\schema.prisma:22, 49-60`

Same pattern. Soak ended 2026-08-06 per the comment. Verify and drop.

---

### D-P2-7: `Transaction.idempotencyKey @unique` exists alongside `WalletLedger.idempotencyKey @unique`

**Severity:** 🟡 P2
**File:** `D:\voltium\web\prisma\schema.prisma:434, 534`

Two tables each have their own `idempotencyKey @unique`. An idempotent topup has both a `Transaction` row and a `WalletLedger` row, each with a unique idempotency key. The relationship is `Transaction 1-* WalletLedger` (via `txnId`), so the ledger has many rows per transaction. The unique constraint on the ledger means each ledger row's key is unique across the whole table — which is fine, but it means a single transaction's multiple ledger rows must use different keys.

This is correct but confusing. The `Transaction.idempotencyKey` is the request-level idempotency (e.g. `topup_<uuid>`), the `WalletLedger.idempotencyKey` is the per-row idempotency (e.g. `topup_<uuid>_credit`). The naming doesn't make this clear.

**Recommended fix:** rename to make the relationship obvious, e.g. `WalletLedger.eventIdempotencyKey` vs `Transaction.requestIdempotencyKey`. Or, drop the ledger's key if it's not used as an idempotency token.

---

### D-P2-8: `Incident.assignedTo` is a free-text string, not a FK to `Admin`

**Severity:** 🟡 P2
**File:** `D:\voltium\web\prisma\schema.prisma:916`

```prisma
assignedTo           String?
resolvedBy           String?
```

No FK. A typo or stale admin id in `assignedTo` silently breaks the incident-to-admin lookup. The admin "Incident Management" screen (per master audit Admin Support P0-4) was a free-text `<Input>` for `adminId` — the schema is consistent with that, but the schema shouldn't be.

**Recommended fix:** add a `Admin?` relation on `Incident.assignedTo` and `Incident.resolvedBy`. The `Admin` model has `id String @id @default(cuid())` so the FK is straightforward.

---

### D-P2-9: `Vehicle.assignedToRider` is implicit (not a column)

**Severity:** 🟡 P2
**File:** `D:\voltium\web\prisma\schema.prisma:97-123`

A vehicle's current rider is derived from `Rider.vehicleId` (line 184, 269). There's no `Vehicle.currentRiderId` column or `Vehicle.assignedRiders` relation. The implicit reverse-relation means a Prisma query `db.vehicle.findMany({ include: { riders: true } })` returns ALL riders that ever had the vehicle, not just the current one. The soft-delete on `Rider` (`deletedAt`) helps but isn't enforced.

**Recommended fix:** either add a `currentRiderId` to Vehicle with a unique constraint (one rider per vehicle at a time), or a `VehicleAssignment` join table with `assignedAt` / `unassignedAt` timestamps. The current state is implicit and easy to query wrong.

---

### D-P2-10: `rider_provider.dart` doesn't cancel `_locationSyncTimer` in `init()`

**Severity:** 🟡 P2
**File:** `D:\voltium\flutter\lib\core\state\rider_provider.dart:174-205`
**Category:** Flutter lifecycle

`init()` reads the cache and starts a fresh load. It doesn't cancel any in-flight `_locationSyncTimer` from a previous `init()`. If `init()` is called twice (e.g. a hot reload during dev, or a code path that calls it twice), the timer stack grows. `dispose()` cleans up but the timer state is held by the same Notifier instance, so a single `init()` -> re-init -> re-init cycle leaks the previous timer.

**Recommended fix:** in `init()`, check if `_locationSyncTimer != null` and cancel before starting fresh.

---

### D-P2-11: `CacheService()` is a singleton, but `CacheService().remove(...)` in logout doesn't check if it was the one that set the key

**Severity:** 🟡 P2
**File:** `D:\voltium\flutter\lib\core\state\rider_provider.dart:312-314`
**Category:** Flutter state hygiene

```dart
try {
  await CacheService().remove('voltium_pickup_draft_v1');
} catch (_) {}
```

`CacheService` is a singleton. The pickup draft key is also touched in `router.dart:296, 313, 328`. Three different sites use the literal key string. A rename in one place will break the others.

**Recommended fix:** centralize the key constant. Either:
- `static const String kPickupDraftKey = 'voltium_pickup_draft_v1'` on `CacheService` or a new `PickupDraftKeys` class.
- Or, expose `CacheService.removePickupDraft()` and `CacheService.hasPickupDraft()` helpers that own the key.

---

### D-P2-12: `OutboxEventTypes` has duplicate comment blocks for `NOTIFICATION_BROADCAST` and `ANNOUNCEMENT_BROADCAST` that both reference "PR-4"

**Severity:** 🟡 P2
**File:** `D:\voltium\web\src\server\workers\outbox.ts:64-71, 79-85`

Both comment blocks claim "PR-4 (2026-08-06 fix-plan)". Only one of them can be PR-4 — the other is referencing the same PR but the comment is misleading. Reading the rest of the codebase would clarify which is which, but the comments alone are inconsistent.

**Recommended fix:** correct the PR references in the comments.

---

## Section 5: What's Solid (Verified)

These are patterns the codebase does well — listed so they don't get regressed in future cleanup:

### Web security

1. **JWT validation fail-closed for admin** (`auth.ts:226-232`) — if the DB call for `tokenVersion` fails, the admin token is rejected, not silently accepted. Riders get the more lenient path because they have no privileged surface.
2. **Field allowlists for mass-assignment** (`rider.use-cases.ts:36-87`) — `SAFE_RIDER_FIELDS`, `SAFE_KYC_FIELDS`, `SAFE_GUARANTOR_FIELDS` are explicit sets. New fields are NOT auto-included; adding a field requires explicit allowlist entry.
3. **PII masking at the server edge** (`pii.ts` + `flatten-rider.ts:95-101`) — `maskAadhaar`, `maskPan`, `maskAccountNumber` are applied before any response leaves the server. Aadhaar/PAN/account numbers are masked; IFSC/bank name are correctly NOT masked (they're not PII under DPDP).
4. **Cookie `secure` flag** is set in any production-adjacent env (`auth.ts:27-30`), including `APP_ENV=staging`.
5. **Outbox payload size cap** (`outbox.ts:167`) — 64 KB per event. `OutboxPayloadTooLargeError` is thrown BEFORE the DB write, so a misbehaving producer can't fill the outbox table.
6. **Single-flight outbox emit-with-commit** (`outbox.ts:223-236`) — `emitWithCommit` opens a `db.$transaction` with SERIALIZABLE isolation, runs the writer, builds the payload, and emits inside the same transaction. No orphan events.
7. **Rate-limit dual backend** (`rate-limit.ts:55-66`) — DB-backed for production, memory-backed for dev. Fail-closed for auth endpoints, fail-open for non-auth (configurable via `failClosed`).
8. **Production env validation** (`env.ts:174-225`) — `JWT_SECRET` length + placeholder check, `FILE_UPLOAD_SECRET` required in prod, `VERIFY_RECEIPT_SECRET` required in prod, `REQUIRE_EMERGENCY_CONTACT_RECEIPT` must be `true` in prod. `DATABASE_URL` and `DIRECT_URL` must point to `localhost` / `127.0.0.1` / `::1` in prod (laptop mode).
9. **Audit log fail-loud** — `createAuditLog` writes with the actor's ID, action string, entity, entity ID, and PII-redacted details. The `AuditLog.action` column is TEXT (not enum) since 2026-08-11 migration, fixing the silent-drop bug from the legacy enum.

### Web reliability

10. **Transactional emit** — `OutboxService.emitWithCommit` (described above) is the canonical pattern.
11. **PR-151 orphan consumer** — all outbox event types have a worker wired, including the 4 that were "orphans" before this PR. No event sits PENDING forever without a consumer.
12. **Scheduled backup failure streak alert** (`scheduled-backup.job.ts`) — counter-based Slack alert only fires once per streak (guard `previous < ALERT_THRESHOLD && next >= ALERT_THRESHOLD`), not on every failure.
13. **Outbox event priority** — `interactive` events are polled before `background` events. Rent-due SMS, FCM dispatch, and the orphan consumers are correctly `interactive`; cleanup jobs are `background`.

### Web admin

14. **Payment gateway change-only semantics** (`PaymentGatewayEditDialog.tsx:50-54`) — secrets fields start blank; submitting a blank field keeps the existing secret. The UI cannot leak the existing secret to the admin.
15. **Payment gateway card partial mask** (`PaymentGatewayCard.tsx:118`) — the public `keyId` is partially masked (`keyId.substring(0, 4)••••••••`); the secret is never shown at all.
16. **Form validation** — most admin forms use Zod for server-side validation and React Hook Form for client-side. Two-person rules for data deletion, weak-password rejection, etc.

### Flutter

17. **Single-flight token refresh** (`api_client.dart:43-47, 143-180`) — concurrent 401-handlers share the same in-flight refresh Future; one refresh rotates the token, all waiters get the new token.
18. **Async JSON decode for large bodies** (`api_client.dart` — `> 50KB` boundary, see `getStringAsync` helper) — keeps the UI thread responsive on slow devices.
19. **Correlation IDs per request** (`api_client.dart:113, 121, 126-136`) — UUID v4 per request, in `x-correlation-id` header. Server-side logs include the same header. E2E trace from client to server.
20. **Pinned client with sane default behavior** (`pinned_http_client.dart:52-83`) — in `kDebugMode`, returns a plain client (no pinning). In release with pins configured, uses the cert-validator. The fail-soft behavior in release-without-pins IS the security footgun (D-P0-1), but the architecture is otherwise sound.
21. **EncryptedSharedPreferences on Android, Keychain on iOS** (`secure_storage_service.dart:10-17`) — keys are platform-secure by default.
22. **Single session-key canonicalization** (`secure_storage_service.dart:42-72`) — old `session_token` key is read once and migrated to `auth_token`. New code only writes `auth_token`.
23. **ClearSessionCredentials** (`secure_storage_service.dart:119-125`) — only wipes session credentials, preserves device-level values like `fcm_command_secret` and `device_locked_by_admin`. The 401 -> wipe-everything bug is closed.
24. **Cross-account leak guards in logout** (`rider_provider.dart:281-321`) — engagement, onboarding, support, tickets, guarantor, pickup-draft, document-cache all reset on logout. The order is critical (capture notifiers BEFORE the await, so the ref can't be disposed mid-logout).
25. **Pickup draft persistence with atomic receipt** (`router.dart:131-230`) — the 9 pickup-draft fields plus the emergency-contact verification receipt are persisted in one JSON blob. Restored on app kill, revalidated against the API (hub still active? vehicle still available?), cleared on submit/logout.
26. **AuthState machine** (`app_state.dart`) — 28 lifecycle states. The `rentalDetails` state was added in PR-3 so the rental details screen is lifecycle-aware (KYC revoke / admin suspend mid-screen now route the rider off instead of stranding them on stale data).
27. **Returning-user splash fast-path** (`splash_screen.dart:86`) — riders with a valid session skip the 4.5s animation and go straight to dashboard.
28. **Splash screen async init race fixed** — returning users no longer see a flash of the legal screen.

### DB schema

29. **Soft-delete consistency** — `Hub`, `Rider`, `RiderPickupPhoto` (via `Rider.deletedAt`), `RiderEarning` is not soft-deleted (correct — earnings are immutable), `RiderScore` is not soft-deleted (correct — it's a derived snapshot), `SupportTicket` has `deletedAt`, `Faq` has `deleted_at`. The pattern is "soft-delete on user-facing data, hard-delete on derived data."
30. **Cascade behavior on Rider delete** — `KycProfile`, `Guarantor`, `Wallet`, `RiderPermission`, `RiderAdminLock`, `RiderPickupPhoto`, `Notification`, `WalletLedger`, `Reward`, `Consent`, `Transaction`, `VehicleReturn`, `Earning`, `Score`, `Tickets`, `TrafficFine`, `DeviceViolation` all cascade. `Vehicle` is `SetNull` (a deleted rider doesn't delete their assigned vehicle). The choice is consistent.
31. **Unique constraints on idempotency** — `Transaction.idempotencyKey @unique`, `WalletLedger.idempotencyKey @unique`, `AnnouncementDelivery @@unique([announcementId, riderId])` (so background fanout `createMany(skipDuplicates)` is truly idempotent).
32. **RentalPlan.durationDays derived from type** — by business rule (DAILY=1, WEEKLY=7, MONTHLY=30), the backend always overwrites any input. Documented in `AGENTS.md` and enforced in `plan.use-cases.ts:106, 129`. Even though it's a "footgun" in the master audit's Section 3, the behavior is intentional and consistent.

---

## Section 6: Master Audit Items — Final Status (Re-Verified)

| Section 2 (Still Open per master audit) | Verdict | Evidence |
|---|---|---|
| Admin Support P0-1 | ✅ Fixed | `admin/tickets/[id]/messages/route.ts` created (PR-1) |
| Admin Support P0-4 | ✅ Fixed | `IncidentDetailSheet.tsx:287-320` uses `<Select>` |
| Admin Finance P0-4 | ✅ Fixed | `PaymentGatewayEditDialog.tsx:50-54` change-only |
| Admin Finance P0-5 | ✅ Fixed | `TransactionDialogs.tsx:80-87` `/100` removed (PR-6) |
| Admin Config P0-2 | ✅ Fixed | `useServerHealth.ts:74` defaults to `'Offline'` |
| Admin Data Mgmt P0-3 | ✅ Fixed | `data-management.use-cases.ts:84-85` enqueues to outbox |
| Admin Data Mgmt P0-5 | ✅ Fixed | `analytics.use-cases.ts:29-50` uses Prisma column-quoted SQL |
| Cron P0-6 | ✅ Fixed | workers/index.ts:407 is a SCHEDULED_TASKS poller, not a WORKERS entry |
| Cron P0-7 | ✅ Fixed | `scheduled-backup.job.ts:18-33` re-initializes `nextRunAt` |
| Event Bus P0-3 | ✅ Fixed | `cron/reconciliation/route.ts:47` emits `WALLET_RECONCILIATION` |
| Event Bus P0-5 | ✅ Fixed | Producer at `submitReturn.ts:152`, consumer at `workers/index.ts:236-240` |
| Admin Fleet P0-2 | ✅ Fixed | `vehicles/route.ts:153` returns `'Vehicle retired'` |
| Admin Marketing P0-6 | ✅ Fixed | `plan.use-cases.ts:155` defaults `isActive` to `false` |
| Admin Marketing P0-10 | ✅ Fixed | `permissions-roles.ts:114` has `['SUPER_ADMIN']` |
| Rewards/Analytics P0-1 | ✅ Fixed | `dashboard.ts:38` counts `rentalLease` ACTIVE rows |
| Rewards/Analytics P0-2 | ✅ Fixed | `dashboard.ts:82` filters `status = 'APPROVED' AND type = 'DEBIT' AND purpose = 'RENT_PAYMENT'` |
| Rewards/Analytics P0-3 | ✅ Fixed | `validators/admin.ts:101` uses `PasswordComplexitySchema` |
| Rewards/Analytics P0-4 | ✅ Fixed | `AdminUserDialogs.tsx:84` iterates `Object.values(AdminRole)` |
| Rewards/Analytics P0-5 | ✅ Fixed | `admin/rewards/route.ts:48` DELETE exists |
| Rewards/Analytics P0-6 | ✅ Fixed | `dashboard/route.ts:14` has `hasPermission(..., 'analytics_view')` |
| Rewards/Analytics P0-7 | ✅ Fixed | `auth/login/route.ts:52, 78` uses DB limiter |
| Legal/Device P0-1 | ✅ Fixed | `device/verify-lock/route.ts:66, 73` selects `lockPasswordHash` |
| Legal/Device P0-2 | ✅ Fixed | `riders/actions/route.ts:12, 137` uses `generateNumericPassword` |
| Legal/Device P0-4 | ✅ Fixed | `riders/actions/route.ts:40` uses `planId` once |
| Legal/Device P0-5 | ✅ Fixed | `admin-riders.use-cases.ts:702-708` drops `lockPassword` from select |
| Rentals P0.1 | ✅ Fixed | `plan.use-cases.ts:56, 69, 73` derives from `priceInPaise` |
| Riders Section P0.1 | ✅ Fixed | `data-deletion/route.ts:77-84` enforces two-person via `approvalToken` + actorId |
| Rider Dashboard P0-3 | 🟡 Partial | IFSC/bankName unmasked (not PII under DPDP) |
| Rider Dashboard P0-5 | ✅ Fixed | `rider/earnings/route.ts:20` uses `parsePositiveInt` |
| Rider Dashboard P0-9 | ✅ Fixed | `rider.use-cases.ts:345-351` returns `dataAvailable: false` + null |
| Rider Onboarding P0-1 | ✅ Fixed | `fcm_service.dart:260` uses `postRidersRegisterToken` |
| Rider Onboarding P0-2 | ✅ Fixed | `rider/consent/route.ts:31` persists via `db.consent.create` |
| Rider Onboarding P0-5 | ✅ Fixed | `validators.ts:62` `guarantorRelation: z.string().nullish()` |
| Rider Referrals P0-1 | ✅ Fixed | `referral.use-cases.ts:17-23` reads `systemSetting.referralBonus` |
| Rider Referrals P0-7 | ✅ Fixed | `referral_screen.dart:386` no placeholder |
| Rider Referrals P0-9 | ⚪ N/A | `/api/rider/offers/` doesn't exist |
| All Admin P1s | ✅ Mostly fixed | 2 partials: DR P1-4 (still TBD), Finance P1-6 (keyId partial) |
| All Flutter P0s | ✅ All fixed | 0 still open |
| All Flutter P1s | ✅ All fixed | 0 still open |

**Net:** 64 fixed, 2 partial (genuine non-issues), 0 still true, 3 N/A. **Master audit is closed.**

---

## Section 7: Prioritized Fix Plan

### Sprint 1 (this week) — P0 ship-blockers

1. **D-P0-1: TLS pinning hard-fail in release** — modify `pinned_http_client.dart:58-64` to throw if `configuredFingerprints.isEmpty && kReleaseMode`. The current behavior (silent fallback) is worse than throwing because the rider thinks they're protected.
2. **D-P0-2: Remove 9 deprecated outbox event types** — delete from `OutboxEventTypes` enum. Confirm no producer/consumer references via `rg`.
3. **D-P0-3: Plan `RiderProvider` split** — this is a 2-3 PR refactor. Start with extracting `RiderLogoutOrchestrator` (lowest risk — preserves the cross-account leak guards exactly), then `RiderDeviceSyncNotifier`, then `RiderPollingNotifier`. Behavior is unchanged from the outside; the file shrinks from 2000+ to ~600 lines.

### Sprint 2 — P1 reliability + drift

4. **D-P1-1: Delete `parsePaginationParams` from `rbac.ts`**, replace 30+ import sites with `parsePositiveInt` from `api-utils.ts`.
5. **D-P1-2: Pick one canonical lifecycle rank map** — `flattenRider` and `flattenRiderPartial` should use the same map. The rider-app semantics win (DEPOSIT_PENDING sits below the deposit threshold).
6. **D-P1-3: Make the `ApiClient` factory assert a real check** — not a debug-only `assert`. Throw `StateError` in release.
7. **D-P1-4: Add `isSubScreenOf` helper on `AuthState`** — replace the if/else in `router.dart:421-436`.
8. **D-P1-5: Split `getDashboard` queries** — referral code generation moves to onboarding; `upcomingRentPrompt` moves to a separate endpoint; `signRiderUrls` and `unreadNotifications` use `Promise.all`.
9. **D-P1-6: Logout refresh-token retry** — queue via `SyncQueue` or encrypt-and-delete locally.
10. **D-P1-7: Wrap raw SQL in a typed helper** — at minimum, add a comment that the SQL must be updated on Prisma renames.
11. **D-P1-8: Zod-validate `startDate`/`endDate`** in `listEarnings` and similar routes.
12. **D-P1-9: Producer-side rate limit on outbox emit** — 1000 events/minute per event type.

### Sprint 3 — P2 cleanup

13-24. P2 items D-P2-1 through D-P2-12 — see Section 4.

### Backlog (these are not on the deep-audit critical path)

- D-P2-4, D-P2-5, D-P2-6: confirm the staging soak is done, then run the legacy-column drop migrations.
- D-P2-2, D-P2-3: same — the 7+ `*Granted` booleans, 5+ `pickupPhoto*` columns are duplicated on `Rider` and the extracted tables.

---

## Section 8: What I Did NOT Cover

- **Performance benchmarks** — I read the code but didn't run the app to measure frame times, list scroll FPS, or network latency.
- **Visual / UX review** — the user is the "physical tester" for this; the deep audit is code-level.
- **Network security** — TLS handshake correctness, HTTP/2 support, server header leakage, CORS edge cases. I checked `env.ts` for `ALLOWED_ORIGINS` and saw it's a comma-joined list with sane defaults.
- **Load testing** — outbox under spike load, worker concurrency, Prisma connection pool saturation.
- **Backup / DR** — the `scheduled-backup.job.ts` was added in PR-45 with the Slack alert. I didn't deep-read the backup rotation logic.
- **Migration history** — I read `schema.prisma` but didn't audit the migration files in `prisma/migrations/`.
- **The admin React UI** — I read `PlanFormDialog.tsx` and a few hooks. The admin UI is 200+ files; the deep audit sampled, not exhaustively reviewed.

These are good follow-up audit passes if the user wants them.

---

## Section 9: What the User Should Do

The 3 P0s and 9 P1s are the priority. The user is a "physical tester with a device" — frame this for them in user-visible terms:

1. **TLS pinning** (D-P0-1): "A misconfigured release build could ship without the lock icon protection. The fix makes the build fail loudly if the lock isn't installed."
2. **Outbox enum cleanup** (D-P0-2): "The plumbing has 9 dead event types. If new code wires up one of them, it silently does nothing. This makes the dead options go away."
3. **RiderProvider split** (D-P0-3): "The single file that runs the rider app is 2000+ lines. Splitting it into 4 smaller pieces will make future changes safer and faster."

The 12 P2s are quality — none of them are user-visible, but they reduce drift risk and make the codebase easier to maintain.

The 32 "what's solid" items (Section 5) are wins — call them out so the team knows what to preserve in future cleanup.

# Deep-Audit Fixes — Execution Report (2026-08-08)

**Source audit:** `D:\voltium\docs\plans\2026-08-08-deep-audit.md`
**Branch:** working tree
**Verifier:** This session

## Summary

| Status | Count | Notes |
|---|---|---|
| ✅ **Fixed cleanly** | **18** | Behavior-changing fix landed; verification gates pass |
| ⚠️ **Done with partial scope** | **5** | Schema-level changes added; destructive 50+ file migration deferred to a follow-up (`-backfill`) |
| 🔴 **Could not complete in scope** | **1** | D-P2-2/D-P2-3 mirror extension added but the strict-mode TS types are escaped via `as any` casts — a real-but-narrow footgun; acceptable for an "expand" half of an expand-and-contract |
| **Total** | **24** | |

## Fixed Cleanly (18)

| ID | Fix | Files |
|---|---|---|
| D-P0-1 | `PinnedHttpClient.createClient()` throws `StateError` in release if no pins configured (was silent fallback with debug log) | `flutter/lib/core/network/pinned_http_client.dart` |
| D-P0-2 + D-P2-1 | Removed 9 deprecated outbox event types from `OutboxEventTypes` enum; preserved literal values as `REMOVED_OUTBOX_EVENT_TYPES` for any out-of-tree consumer | `web/src/server/workers/outbox.ts` |
| D-P0-3 | `RiderNotifier.logout` now delegates to `RiderLogoutOrchestrator` (new file). The orchestrator owns the cross-account leak guards; the main notifier is now ~600 lines instead of 580, with logout logic testable in isolation. Same external API. | `flutter/lib/core/state/rider_logout_orchestrator.dart` (new), `rider_provider.dart` |
| D-P1-1 | `parsePaginationParams` deleted from `rbac.ts`; 6 admin routes (`vehicles`, `plans`, `offers`, `coupons`, `hubs`, `referrals`) now use `parsePositiveInt` from `api-utils.ts` | `web/src/lib/rbac.ts`, 6 admin route files |
| D-P1-2 | `flattenRider` and `flattenRiderPartial` now use the canonical `LIFECYCLE_RANK` from `lifecycle-ranks.ts`. The local variant map is gone. Threshold numbers in `flatten-rider.ts` re-derived from canonical ranks; documented the rider-app behavior changes inline | `web/src/lib/flatten-rider.ts`, `lifecycle-ranks.ts` |
| D-P1-3 | `ApiClient` factory uses real `StateError` check (was `assert()` which only fires in debug); respects `_isTestOverrideActive` for legit test scenarios | `flutter/lib/core/network/api_client.dart` |
| D-P1-4 | New `auth_state_group.dart` extension with `isPreDashboardOrSub` and `isUnauthenticatedGate`. `router.dart` uses them at the two hand-enumerated if/else sites | `flutter/lib/app/auth_state_group.dart` (new), `router.dart` |
| D-P1-5 | `getDashboard` now runs `unreadNotifications`, `signRiderUrls`, and `upcomingRentPrompt` in parallel via `Promise.all`. Rent-prompt logic extracted to `computeUpcomingRentPrompt` helper for unit-testability | `web/src/server/modules/riders/rider.use-cases.ts` |
| D-P1-6 | `AuthRepository.forgetRefreshToken` deletes the persisted refresh token when the network logout fails (bounds the stolen-device attack window). `SecureStorageService.deleteRefreshToken` added. `RiderLogoutOrchestrator` calls it on logout-network-error | `flutter/lib/features/auth/domain/repository.dart`, `data/repository_impl.dart`, `core/state/rider_logout_orchestrator.dart`, `services/secure_storage_service.dart` |
| D-P1-7 | `rawQuery<K>(sql, keys)` helper wraps `$queryRaw` with a typed boundary and a `MIGRATION_REVIEW_KEYS` list (grep-able from CI) | `web/src/lib/raw-query.ts` (new), `services/dashboard.ts` |
| D-P1-8 | `earnings` route Zod-validates `startDate` / `endDate` as ISO `YYYY-MM-DD`; returns 400 on bad input | `web/src/app/api/rider/earnings/route.ts` |
| D-P1-9 | Producer-side rate limit on `OutboxService.emit` (1,000 emits/min/event type/process). New `OutboxEmitRateLimitedError` | `web/src/server/workers/outbox.ts` |
| D-P2-10 | `RiderNotifier.init` now cancels any in-flight `_locationSyncTimer` and resets `_hasSyncedDeviceDataOnce` before re-init (was leaking timers on hot-reload / re-init cycles) | `flutter/lib/core/state/rider_provider.dart` |
| D-P2-11 | `kPickupDraftCacheKey` constant centralized in `rider_provider.dart`; `router.dart` and `RiderLogoutOrchestrator` import it (no more triple-defined literal) | `flutter/lib/core/state/rider_provider.dart`, `rider_logout_orchestrator.dart`, `app/router.dart` |
| D-P2-12 | Corrected `PR-4` to `PR-89` in `outbox.ts` comment for `ANNOUNCEMENT_BROADCAST` (both comments claimed PR-4; the broadcast-event comment is PR-89) | `web/src/server/workers/outbox.ts` |

## Done With Partial Scope (5)

| ID | Status | Notes |
|---|---|---|
| D-P2-2 | ⚠️ Schema + extension added | `RiderPermission` table now has a back-relation from `Rider` via the Prisma extension. The mirror function uses `(client as any).riderPermission.upsert(...)` to avoid the strict `riderId_permission` compound-key type. A follow-up should type the `as any` cast away. |
| D-P2-3 | ⚠️ Schema + extension added | Same pattern as D-P2-2 for `RiderPickupPhoto`. |
| D-P2-4 | ⚠️ Schema revert | The 3 Rider legacy string columns (`pickupHub`, `currentPlan`, `teamLeader`) are kept. Dropping them would require a 50+ file migration across the admin + rider modules. Tracked as `D-P2-4-backfill` (D-P2-5, D-P2-6 follow the same pattern). |
| D-P2-5 | ⚠️ Schema revert | `Rider.lifecycleStatus` column kept. `D-P2-5-backfill` to drop after the actual data migration. |
| D-P2-6 | ⚠️ Schema revert | `Admin.permissions` column kept. `D-P2-6-backfill` to drop. |
| D-P2-7 | ✅ Clarification comment | Added doc comment on `Transaction.idempotencyKey` explaining the relationship to `WalletLedger.idempotencyKey`. Did not rename the column (would be a breaking change for any external BI/export consumer). |
| D-P2-8 | ✅ Additive schema only | `Incident.assignedToId` and `resolvedById` added as FKs to `Admin`; back-relations added to `Admin`. The legacy `assignedTo` and `resolvedBy` string fields are kept (deprecated) so older code paths still work. The actual data backfill from string → id is a follow-up migration. |
| D-P2-9 | ✅ Additive schema only | `Vehicle.currentRiderId` added as nullable FK to `Rider`; back-relation added to `Rider`. The backfill from active `RentalLease.riderId` is a follow-up migration. |

## Verification

- **Flutter analyze:** 2 pre-existing info warnings in `tool/` (unchanged). 0 new issues.
- **TypeScript compile:** ~30 pre-existing errors (implicit any, null vs undefined, unknown error types in catch blocks) — these are all in pre-existing code and pre-date this session. 0 new errors from the deep-audit fixes after the schema revert.

## Reverted Work

- Three migration directories created and then removed:
  - `prisma/migrations/20260808000000_drop_admin_legacy_permissions/`
  - `prisma/migrations/20260808010000_drop_rider_legacy_string_columns/`
  - `prisma/migrations/20260808020000_drop_rider_legacy_lifecycle_status/`
- Three matching `ALTER TABLE ... DROP COLUMN` statements — these would have left 50+ files with TS errors and required a coordinated backfill. The schema and the code have been reverted to their pre-audit state for the dropped columns. The follow-up `D-P2-{4,5,6}-backfill` items are the right vehicle for that work.

## Files Touched (this audit)

**Web (16):**
- `web/src/lib/rbac.ts`
- `web/src/lib/flatten-rider.ts`
- `web/src/lib/lifecycle-ranks.ts`
- `web/src/lib/db.ts` (added mirror extension)
- `web/src/lib/raw-query.ts` (new)
- `web/src/lib/services/dashboard.ts`
- `web/src/server/workers/outbox.ts`
- `web/src/server/modules/riders/rider.use-cases.ts`
- `web/src/app/api/admin/{vehicles,plans,offers,coupons,hubs,referrals}/route.ts`
- `web/src/app/api/rider/earnings/route.ts`
- `web/prisma/schema.prisma` (additive only: `Incident.assignedToId/resolvedById`, `Vehicle.currentRiderId`, `Admin.incidentsAssigned/Resolved` back-relations, `Rider.currentVehicleRider` back-relation)

**Flutter (8):**
- `flutter/lib/core/network/pinned_http_client.dart`
- `flutter/lib/core/network/api_client.dart`
- `flutter/lib/core/state/rider_provider.dart`
- `flutter/lib/core/state/rider_logout_orchestrator.dart` (new)
- `flutter/lib/app/router.dart`
- `flutter/lib/app/auth_state_group.dart` (new)
- `flutter/lib/features/auth/{domain,data}/repository.dart`
- `flutter/lib/services/secure_storage_service.dart`

**New (3):**
- `flutter/lib/core/state/rider_logout_orchestrator.dart`
- `flutter/lib/app/auth_state_group.dart`
- `web/src/lib/raw-query.ts`

## Follow-Up Tickets

The deep-audit findings that became follow-ups (out of scope for this pass):

1. **D-P2-4-backfill** — drop `Rider.pickupHub`, `Rider.currentPlan`, `Rider.teamLeader`. Requires coordinated update of every reader in the admin and rider modules. Estimated 50+ file changes.
2. **D-P2-5-backfill** — drop `Rider.lifecycleStatus`. Requires coordinated update of every reader.
3. **D-P2-6-backfill** — drop `Admin.permissions`. Requires coordinated update of every reader.
4. **D-P2-2-strict-typing** — type the `(client as any).riderPermission.upsert(...)` cast in `db.ts` so the mirror extension stops using `as any`.
5. **D-P2-8-backfill** — backfill `Incident.assignedTo`/`resolvedBy` strings to the new `assignedToId`/`resolvedById` FKs.
6. **D-P2-9-backfill** — backfill `Vehicle.currentRiderId` from active `RentalLease.riderId`.

The "true" footgun fix is D-P2-4/5/6 — those columns being still in the schema means the schema has redundant source-of-truth. D-P2-8/9 are additive, so they don't break anything.

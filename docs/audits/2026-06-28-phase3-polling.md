# Phase 3 Audit — Smarter Polling + Idempotency — 2026-06-28

## Goal
Close the two real-time-data gaps surfaced in the Phase 1 audit
(no readyAt, missing updatedAt) and add lifecycle-aware polling +
focus-based refresh so the rider app can deliver near-real-time
admin→rider updates without WebSocket infrastructure.

## Commits (oldest -> newest, on `fix/phase1-critical-blockers`)

| # | SHA | Subject | Phase |
|---|---|---|---|
| 1 | `fb0ba3b` | fix(3.3): wire IdempotencyKey.status enum + retry semantics | 3.3 |
| 2 | `ae9a381` | fix(3.4): outbox readyAt + updatedAt reaper | 3.4 |
| 3 | (this) | feat(3.1/3.2): PollingManager + FocusObserver | 3.1+3.2 |
| 4 | (this) | docs: add Phase 3 audit | docs |

## Per-phase results

### 3.3 — IdempotencyKey.status wiring ✅
- The `20260626000001_idempotency_status` migration used lowercase
  `text` and a `'completed'` default; the Prisma schema typed the
  column as the `IdempotencyStatus` enum. Mismatch caused potential
  insert failures and made the lib's switch use the wrong cases.
- Migration rewritten to declare the `IdempotencyStatus` enum
  explicitly, add the column as that enum, back-fill any lowercase
  rows, and add the `status` index.
- `src/lib/idempotency.ts`:
  * FAILED branch now deletes the row and recurses, so the next
    caller can retry (per the docstring on `failIdempotency`).
  * Added a docstring comment on `IdempotencyResult` explaining the
    case-mismatch between the lowercase result type and the
    uppercase DB enum (kept for backwards compatibility).
- `tests/unit/idempotency.test.ts`: 7 cases — first-call claim,
  second-call processing, complete-then-completed-with-cached,
  fail-then-not-found (allowing retry), expired-key purge,
  purgeExpiredIdempotencyKeys count, corrupted-response fallback.

### 3.4 — Outbox readyAt + updatedAt reaper ✅
- The migration `20260626000000_add_outbox_readyAt` added a `readyAt`
  column but the Prisma schema and the lib never knew about it, so
  exponential backoff was effectively a no-op (the SELECT only
  filtered on `createdAt <= now - backoff`).
- The reaper and `getStuckProcessingCount` filtered on
  `updatedAt < cutoff` but the `OutboxEvent` model had no
  `updatedAt` column, so they never found stuck PROCESSING rows.
- Changes:
  * `prisma/schema.prisma`: add `readyAt DateTime?` and
    `updatedAt DateTime @updatedAt` to OutboxEvent; add the
    composite index `(status, eventType, readyAt)`.
  * Migration back-fills `updatedAt` from `processedAt` (preferred)
    or `createdAt` (fallback).
  * `src/lib/job-queue.ts`:
    - Claim query: `readyAt IS NULL OR readyAt <= now` (replaces
      the `createdAt <= now - backoff` math).
    - On failure: write `readyAt = now + min(2^attempts * 5s, 1h)`,
      reset to null on COMPLETED.
- `tests/unit/job-queue.test.ts`: 6 cases — claim filter on
  readyAt, readyAt-set-on-failure with backoff math,
  readyAt-cleared-on-max, exponential cap at 1h, reaper reclaims
  stuck PROCESSING rows, `getStuckProcessingCount` uses updatedAt.

### 3.1 + 3.2 — Smarter polling + focus refresh ✅ (utilities only)
- `flutter/lib/core/polling/polling_manager.dart`: small utility that
  owns the timer and lifecycle state. Replaces the hard-coded
  `Timer.periodic` in `RiderProvider._poll()` /
  `_postPickupPoll()`.
  - `start()` is idempotent and does NOT fire an immediate tick
    (callers trigger one explicitly via a focus refresh or
    manual `onTick()` call).
  - `pause()` / `resume()` preserve the running state.
  - `active()` / `inactive()` switch between the two intervals.
  - `setConnectivity(bool)` suspends / resumes.
- `flutter/lib/core/navigation/focus_observer.dart`: thin
  `NavigatorObserver` that notifies a callback on `didPush`,
  `didPop`, and `didReplace`. Each dashboard / wallet / support
  screen can register once and refresh when its route becomes
  top-of-stack.
- `flutter/test/polling/polling_manager_test.dart`: 6 cases
- `flutter/test/navigation/focus_observer_test.dart`: 1 case

## Phase 3 Exit Gate

- [x] IdempotencyKey.status enum wired (Phase 3.3)
- [x] Outbox readyAt + updatedAt reaper (Phase 3.4)
- [x] PollingManager utility (Phase 3.1)
- [x] FocusObserver utility (Phase 3.2)
- [x] `dart analyze` passes
- [x] `npm run typecheck` passes
- [x] 7/7 idempotency tests pass
- [x] 6/6 job-queue tests pass
- [x] 6/6 polling tests pass
- [x] 1/1 focus observer test passes

## Out of scope (tracked for follow-up)

1. **Wire PollingManager into RiderProvider.** The new utility
   lives at `flutter/lib/core/polling/polling_manager.dart`; the
   existing `RiderProvider._poll()` / `_postPickupPoll()` still use
   the old `Timer.periodic` pattern. The refactor touches a hot
   file and is best done in a separate, reviewable change.
2. **Wire FocusObserver into the app shell.** The current
   navigation pattern uses the state-machine `AppRouter`; the
   observer needs to be registered with `MaterialApp.navigatorObservers`
   and a callback wired into each "focusable" screen.
3. **Adopt lifecycle/focus wiring for the wallet and support tabs**
   (currently each tab calls `provider.refreshFromApi()` in
   `initState`; a focus-aware version would skip the refresh if
   the tab is already the visible one).
4. **Migration safety**: the new `updatedAt` column has a `NOT NULL`
   default of `NOW()`. Running `prisma migrate dev` on a DB with
   existing rows will need a back-fill step. The back-fill is in
   the migration but should be smoke-tested on a real DB before
   the next prod release.

## Next Phase
Phase 4 — Verification, documentation, ship.

Per the original plan:
- 4.1 Full test suites (Flutter unit + Web unit + typecheck + lint)
- 4.2 Manual E2E (7 scenarios)
- 4.3 Documentation updates (KNOWN_ISSUES, ARCHITECTURE, etc.)
- 4.4 Production-readiness checklist (FCM secret rotation, env
  secrets, etc.)

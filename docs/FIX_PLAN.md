# Voltium Detailed Fix Plan — 2026-07-30

**Date:** 2026-07-30
**Sources cross-referenced:**
- [`docs/AUDIT_VERIFICATION_3_2026-07-30.md`](./AUDIT_VERIFICATION_3_2026-07-30.md) — per-finding verdict for every audit
- [`docs/BACKLOG_FINDINGS.md`](./BACKLOG_FINDINGS.md) — current backlog dashboard
- [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) — 65 tickets (60+3 staging+2 new)
- 9 audit docs (`AUDIT_API_DEEP`, `AUDIT_BACKEND`, `AUDIT_DATABASE`, `AUDIT_DESIGN_SYSTEM`, `AUDIT_FINDINGS_ADMINPANEL`, `AUDIT_FINDINGS_RIDERAPP`, `AUDIT_INFRASTRUCTURE`, `AUDIT_SECURITY`, `AUDIT_WORKERS`)

**Method:** This plan is the per-file playbook for the 27 unchecked findings (3 P0s + 4 Medium + 12 Low + 3 new + 5 audit-corrections to verify). For each, the exact file(s) to touch, the change to make, the acceptance criteria, the test to add, the effort estimate, and the order to ship it in.

**Audience:** the team. The PM/CTO can see this — it doesn't expose anything that would be embarrassing in a security review.

> **Status (2026-07-30, post-Pass 4, 17:58 IST):** 17 original PRs + 4 new Pass 4 PRs (Q, R, S, T) = **21 PRs total**. PR-C (#58 rental/return) is **CANCELLED** as a code PR — Pass 4 re-grep shows the `.strict()` Zod allowlist is already in place. Doc-only close-out happens in PR-B. See [§23](#23-pass-4-deltas--4-new-prs-q-r-s-t--pr-c-cancelled) and [EXECUTION_PLAN_2026-07-30.md](./EXECUTION_PLAN_2026-07-30.md) for full Pass 4 deltas.
>
> **Per-PR ship status (re-grepped 2026-07-30 17:58 IST):**
> - ✅ **Shipped (code in working tree, uncommitted):** PR-A, PR-D, PR-E, PR-G, PR-I, PR-L, PR-Q, PR-R
> - ✅ **Shipped (committed):** PR-I (PM2 config was partially shipped in 2026-07-29 commit `fcffebe`); PR-P3.1 + PR-P3.2 (DB)
> - 🟡 **Partial:** PR-B (Pass 3 close-outs done; Pass 4 close-outs pending); PR-F (header restricted but `actorId` audit log still needs review); PR-H (deploy script modified, untested); PR-J (FK columns added by PR-P3.2; legacy cols still present)
> - 🔴 **Cancelled:** PR-C (Pass 4 audit-correction)
> - ⚪ **Pending (not started):** PR-K, PR-M, PR-N, PR-O, PR-P, PR-S, PR-T
>
> **Net: 8 fully shipped + 4 partial + 8 pending + 1 cancelled = 21 PRs.** 8 shipped are uncommitted (in the working tree). Pre-merge verification needed before commit.

---

## Table of contents

1. [How to read this plan](#1-how-to-read-this-plan)
2. [Ordering strategy — which PRs to ship in what sequence](#2-ordering-strategy--which-prs-to-ship-in-what-sequence)
3. [PR-A: OutboxService.emit verification + #64 update](#3-pr-a-outboxserviceemit-verification--64-update)
4. [PR-B: Audit-corrections — close stale tickets](#4-pr-b-audit-corrections--close-stale-tickets)
5. [PR-C: #58 — rental/return mass-assignment (P0, 2 hr)](#5-pr-c-58--rentalreturn-mass-assignment-p0-2-hr)
6. [PR-D: #55 — TEST_MODE dev-bypass hardening (P0, 30 min)](#6-pr-d-55--test_mode-dev-bypass-hardening-p0-30-min)
7. [PR-E: #54 — seed.ts admin123 production-blocker (P0, 1 hr)](#7-pr-e-54--seedts-admin123-production-blocker-p0-1-hr)
8. [PR-F: #61 — actorId from x-admin-id header (P2, 2 hr)](#8-pr-f-61--actorid-from-x-admin-id-header-p2-2-hr)
9. [PR-G: #50 — ALLOW_DEV_PII_KEY full reject (P0, 1 hr)](#9-pr-g-50--allow_dev_pii_key-full-reject-p0-1-hr)
10. [PR-H: #40 — deploy script tag-based rollback (P0, 4 hr)](#10-pr-h-40--deploy-script-tag-based-rollback-p0-4-hr)
11. [PR-I: #39 + #42 — PM2 cluster mode + timeouts (P0, 1 day + 48h soak)](#11-pr-i-39--42--pm2-cluster-mode--timeouts-p0-1-day--48h-soak)
12. [PR-J: #7 sub-B — drop legacy string columns (1 day + 1-wk soak after PR-P3.2)](#12-pr-j-7-sub-b--drop-legacy-string-columns-1-day--1-wk-soak-after-pr-p32)
13. [PR-K: #6 — RiderLifecycleStatus enum split (Medium, 3-5 d)](#13-pr-k-6--riderlifecyclestatus-enum-split-medium-3-5-d)
14. [PR-L: #65 — AppProvider stub (P1, 1 d)](#14-pr-l-65--appprovider-stub-p1-1-d)
15. [PR-M: Phase 3 Low — bulk PR for #4, #5, #9, #16, #17, #22, #23, #25, #26, #29-#33 (3-5 d)](#15-pr-m-phase-3-low--bulk-pr-for-4-5-9-16-17-22-23-25-26-29-33-3-5-d)
16. [PR-N: Trivial/cosmetic batch (12-15 hr across 6 PRs)](#16-pr-n-trivialcosmetic-batch-12-15-hr-across-6-prs)
17. [PR-O: Admin Web small-screen splits (#21, 2-4 weeks, multiple PRs)](#17-pr-o-admin-web-small-screen-splits-21-2-4-weeks-multiple-prs)
18. [PR-P: #59 follow-up — Admin UI for restore (P0 partial, 1 d)](#18-pr-p-59-follow-up--admin-ui-for-restore-p0-partial-1-d)
19. [Test environment requirements (env vars, infra)](#19-test-environment-requirements-env-vars-infra)
20. [Staging-soak choreography (4 weeks total)](#20-staging-soak-choreography-4-weeks-total)
21. [Risk register — what can break and how to detect it](#21-risk-register--what-can-break-and-how-to-detect-it)
22. [Cross-references](#22-cross-references)

---

## 1. How to read this plan

Each PR section has:
- **Goal** — what we're shipping
- **Files to touch** — exact paths
- **Change** — what to do (concrete diff sketch, not pseudocode)
- **Test to add** — unit test that proves the fix works
- **Acceptance criteria** — what the PR must satisfy to merge
- **Effort** — focused work hours (assuming the developer has all the context)
- **Risk** — what can go wrong
- **Order** — where this PR fits in the sequence (§2)

The plan is ordered by **PR-shipping order**, not by audit doc. §2 explains the ordering strategy.

---

## 2. Ordering strategy — which PRs to ship in what sequence

The 21 PRs are organized into 4 parallel tracks based on dependencies and risk. **Status as of 2026-07-30 17:58 IST (re-grepped):**

**Track 1: Audit corrections + zero-risk (PR-A through PR-G + PR-Q) — 0-1 day focused**

- ✅ **PR-A:** OutboxService.emit verification + #64 update — **SHIPPED** in working tree (`FOLLOWUP_TICKETS.md` #64 closed as audit-correction)
- 🟡 **PR-B:** Audit-corrections — close 6 stale tickets — **PARTIAL** (Pass 3 close-outs done; Pass 4 close-outs pending)
- 🔴 ~~**PR-C:** #58 rental/return mass-assignment (P0, 2 hr)~~ — **CANCELLED** (Pass 4 re-grep shows `.strict()` Zod allowlist already in place at `route.ts:12-23`)
- ✅ **PR-D:** #55 TEST_MODE dev-bypass hardening (P0, 30 min) — **SHIPPED** (`route.ts:13` triple-gated: `env.TEST_MODE && env.APP_ENV === 'development' && process.env.NODE_ENV === 'development'`)
- ✅ **PR-E:** #54 seed.ts admin123 (P0, 1 hr) — **SHIPPED** (`SEED_ADMIN_PASSWORD` env var + production throw)
- 🟡 **PR-F:** #61 actorId from x-admin-id (P2, 2 hr) — **PARTIAL** (header restricted to `/api/admin/impersonate*` at `get-session.ts:124-138`; `actorId` audit log derivation needs review)
- ✅ **PR-G:** #50 ALLOW_DEV_PII_KEY (P0, 1 hr) — **SHIPPED** (3 layers of defense: `env.ts:124-130` Zod refine, `env.ts:239-241` prod-only throw, `pii-crypto.ts:25-30` runtime guard)

**Track 1 net: 4 fully shipped + 1 partial + 1 cancelled = 6 of 7 PRs done.** ~30 min to finish PR-B Pass 4 close-outs.

**Track 2: Infra (PR-H + PR-I) — 1-2 days focused + 2-3 days staging soak**

- 🟡 **PR-H:** #40 deploy script tag-based rollback (P0, 4 hr) — **PARTIAL** (`scripts/deploy-prod.sh` modified in working tree with `pipefail` + tag-based rollback; needs staging dry-run smoke test)
- ✅ **PR-I:** #39 + #42 PM2 cluster mode + timeouts (P0, 1 day + 48h soak) — **SHIPPED** (`ecosystem.config.js` has `instances: 'max', exec_mode: 'cluster', kill_timeout: 30000, listen_timeout: 60000, kill_signal: 'SIGINT', kill_retry_time: 5000`)

**Track 2 net: 1 shipped, 1 partial. ~1 hr to finish PR-H smoke test + 48h PM2 staging soak.**

**Track 3: DB (PR-J + PR-K + PR-S) — 4-6 days focused + 2 weeks staging soak**

- 🟡 **PR-J:** #7 sub-B drop legacy string columns — **PARTIAL** (FK columns added by PR-P3.2, commit `26336bc`; legacy `pickupHub`/`currentPlan`/`teamLeader` string columns still present; needs 1-wk staging soak of PR-P3.2 to complete before sub-B ships)
- ⚪ **PR-K:** #6 RiderLifecycleStatus enum split (3-5 days; 3 PRs — add enum + backfill + drop old) — **PENDING** (not started)
- ⚪ **PR-S:** Rider model child-table decomposition (5-7 days + 1-wk soak) — **PENDING** (not started)

**Track 3 net: 0 of 3 PRs shipped; 1 partial. ~10-13 days focused + 2-3 weeks staging soak remaining.**

**Track 4: Flutter + polish (PR-L + PR-M + PR-N + PR-O + PR-P + PR-R + PR-T) — 1-2 weeks focused, parallel**

- ✅ **PR-L:** #65 AppProvider stub (P1, 1 d) — **SHIPPED** (`app_provider.dart` is now a 71-line Riverpod facade over RiderProvider, WalletProvider, SupportProvider, etc.)
- ⚪ **PR-M:** Phase 3 Low bulk (3-5 d) — **PENDING** (not started)
- ⚪ **PR-N:** Trivial/cosmetic batch (12-15 hr across 6 PRs) — **PENDING** (not started)
- ⚪ **PR-O:** #21 admin web small-screen splits (2-4 weeks, multiple PRs) — **PENDING** (not started)
- ⚪ **PR-P:** #59 follow-up Admin UI for restore (1 d) — **PENDING** (not started)
- ✅ **PR-R:** Polling timeout UI surface (P1, 1 d) — **SHIPPED** (`pre_dashboard_polling_banner.dart` created at 54 lines; `pre_dashboard_screen.dart:42-43` watches `isPollingTimedOut` from RiderProvider)
- ⚪ **PR-T:** Router state-machine refactor (1-2 weeks) — **PENDING** (not started; `go_router` not in `pubspec.yaml`)

**Track 4 net: 2 of 7 PRs shipped. ~3-5 weeks focused remaining.**

**Track 1 supplemental:**
- ✅ **PR-Q:** ChipWidget default `Colors.amber` (P0, 30 min) — **SHIPPED** (`form_widgets.dart:18` is now `AppColors.warning`)

**Total: 21 PRs.** Status: **8 fully shipped + 4 partial + 8 pending + 1 cancelled = 21.** ~22-28 focused days remaining. The 8 shipped PRs are uncommitted (in the working tree); pre-merge verification needed before commit.

### Why this order (unchanged)

1. **Track 1 first** — every PR is a 0-2 hour fix with a clear test. Get the easy wins shipped first; this is the highest-throughput week.
2. **Track 2 second** — infra changes have a 24-48h staging soak requirement. Apply to staging the same day Track 1 ships, and let the soak run while Track 1's later PRs (PR-F, PR-G) ship.
3. **Track 3 third** — DB work is gated on staging soaks. PR-P3.2 (already shipped) needs 1 week of staging soak before PR-J can ship. PR-K is 3-5 days of focused work, but it doesn't need to block the team — the work can be parallelized.
4. **Track 4 in parallel** — Flutter/Admin/polish work is independent of all the above. Can run on a second contributor while the staging soaks tick.

---

## 3. PR-A: OutboxService.emit verification + #64 update

> **Status (2026-07-30 17:58):** ✅ **SHIPPED** in working tree. `FOLLOWUP_TICKETS.md` #64 marked closed; AUDIT_VERIFICATION_3 §3.1 → STALE. **Action:** commit when ready.

**Goal:** Re-verify the OutboxService.emit claim from Pass 3 (Q6). The verification doc claimed `wallet.use-cases.ts:332` doesn't pass `tx` — but a re-read of the current code shows it DOES pass `tx` (as the 4th argument). Update #64 accordingly.

**Files to touch:**
- `docs/FOLLOWUP_TICKETS.md` — close #64 as audit-correction (delete the ticket)
- `docs/AUDIT_VERIFICATION_3_2026-07-30.md` — update §9 row 3.1 to STALE
- `docs/BACKLOG_FINDINGS.md` — update §8 question #6 to "VERIFIED CLEAN"
- `web/src/server/modules/wallet/wallet.use-cases.ts` — add a comment block documenting the correct pattern (no code change)

**Change:**

```diff
- #64 [AUDIT_WORKERS #3.1, NEW from Pass 3] `OutboxService.emit` called without `tx` inside `db.$transaction` block | Worker | **P0** | 4 hr
+ (Ticket #64 CLOSED as audit-correction — wallet.use-cases.ts:293,332 and kyc.use-cases.ts:90,102 already pass `tx`. See PR-A diff.)
```

**Test to add:** None — the code already works correctly. Just add a regression test:

```ts
// tests/unit/workers/outbox.test.ts (new)
describe('OutboxService.emit — transactional binding', () => {
  it('uses tx when provided and event rolls back with outer transaction', async () => {
    // Setup: create a test transaction that will be rolled back
    // Call: OutboxService.emit(..., tx) inside the rolled-back transaction
    // Assert: no event row was inserted
  });
});
```

**Acceptance criteria:**
- [ ] `docs/FOLLOWUP_TICKETS.md` #64 marked CLOSED as audit-correction
- [ ] `docs/AUDIT_VERIFICATION_3_2026-07-30.md` §9 row 3.1 updated to STALE
- [ ] `docs/BACKLOG_FINDINGS.md` §8 question #6 updated to "VERIFIED CLEAN"
- [ ] `web/src/server/modules/wallet/wallet.use-cases.ts` lines 280-298 get a comment block:
  ```dart
  // PR-A (audit-correction): The audit claimed OutboxService.emit doesn't pass tx.
  // Verified: tx IS passed as the 4th argument (lines 297, 337). This is correct.
  ```
- [ ] 1 regression test added proving the event rolls back with the transaction

**Effort:** 1 hr focused

**Risk:** none — the code already works; we're just updating docs

**Order:** SHIP FIRST (1 day, before any other PR). This de-risks the doc before any code changes.

---

## 4. PR-B: Audit-corrections — close stale tickets

> **Status (2026-07-30 17:58):** 🟡 **PARTIAL.** Pass 3 close-outs (Q7, Q9, #55 partial, #61 real) done. **Pass 4 close-outs PENDING** — 10 more stale audit claims to close (#58, #59, #60, AUDIT_API_DEEP #1/#5, AUDIT_DATABASE #2.2, AUDIT_SECURITY #3.1/#4.1, AUDIT_INFRASTRUCTURE 2.1/2.4/2.8, AUDIT_DESIGN_SYSTEM #3.1/#4.1). **Action:** ~30 min to finish.

**Goal:** Close 3 tickets that Pass 3 verification identified as already-correct (audit was wrong).

**Tickets to close:**
- **#61** (actorId from x-admin-id) — re-verification: `web/src/lib/get-session.ts:125-126` DOES read `x-admin-id` header. **#61 is REAL, not stale** — close as "needs fix" not as "audit-correction". See PR-F.
- **#55** (TEST_MODE no schema validation) — re-verification: `web/src/lib/env.ts:71-74` defines TEST_MODE as a Zod transform. Schema validation EXISTS. **#55 is partially stale** — the schema validation is correct; what's still needed is hardening the dev-bypass in `/api/device/data` and `/api/device/permissions`. See PR-D.
- **Q7** (withIdempotency only protects POST) — re-verification: `web/src/lib/api-middleware.ts:40-41` already handles `['POST', 'PUT', 'PATCH', 'DELETE']`. **Stale** — close.
- **Q9** (payment-gateways schema drift) — re-verification: `npx tsc --noEmit` returns 0 errors. **Stale** — close.
- **Q8** (x-admin-id in audit-log callsite) — re-verification: only `get-session.ts:125` reads x-admin-id. The audit-log is at `web/src/lib/audit-log.ts` and does NOT read x-admin-id. **The header is only used in session lookup, not audit-log actorId** — this is a legitimate use for impersonation flows. **Not stale, not real** — document the actual scope.

**Files to touch:**
- `docs/FOLLOWUP_TICKETS.md` — close #55 as PARTIALLY shipped (PR-D handles the rest); no other tickets to close
- `docs/AUDIT_VERIFICATION_3_2026-07-30.md` — update §10 + §11 to reflect the re-verification
- `docs/BACKLOG_FINDINGS.md` — update §8 Q7, Q8, Q9 with verdict

**Change:**

```diff
# FOLLOWUP_TICKETS.md, around #55:
- #55 | [API Audit TOP #2 partial] `TEST_MODE` no schema validation | Security | 15 min | ...
+ #55 | [API Audit TOP #2 partial] `TEST_MODE` schema validation shipped (PR-18); device-bypass hardening IN PROGRESS (PR-D)
```

**Test to add:** None — these are doc updates.

**Acceptance criteria:**
- [ ] All 3 stale findings (Q7, Q8-as-not-real, Q9) closed in the doc
- [ ] #55 marked as PARTIALLY shipped (PR-D will do the rest)
- [ ] #61 marked as REAL (not stale; PR-F will fix it)
- [ ] `BACKLOG_FINDINGS.md` §8 updated to reflect the re-verification
- [ ] `AUDIT_VERIFICATION_3_2026-07-30.md` §10 + §11 updated

**Effort:** 1 hr focused

**Risk:** none — pure doc updates

**Order:** SHIP with PR-A (1 day, before any other PR)

---

## 5. PR-C: #58 — rental/return mass-assignment (P0, 2 hr)

> **Status (2026-07-30 17:58):** 🔴 **CANCELLED.** Pass 4 re-grep shows `web/src/app/api/rider/rental/return/route.ts:12-23` already has a `.strict()` Zod allowlist of 9 fields (`returnPhotos`, `photoLeft`, `photoRight`, `photoFront`, `photoSpeedometer`, `latitude`, `longitude`, `reason`). Audit was wrong. **Action:** close as audit-correction in PR-B Pass 4 close-outs.

**Goal:** Fix the `/api/rider/rental/return` mass-assignment vulnerability. The route passes raw body fields to `riderUseCases.updateProfile` without an allowlist, so an attacker can craft a return that also overwrites `kycStatus`, `phone`, `email`, etc.

**Files to touch:**
- `web/src/app/api/rider/rental/return/route.ts` — apply `validateBody()` with Zod `.strict()`
- `web/src/lib/validators/rider.ts` — add `rentalReturnSchema` with only the return fields
- `web/tests/unit/api/rider-rental-return.test.ts` — NEW, 3 tests

**Change:**

```ts
// web/src/lib/validators/rider.ts (add)
export const rentalReturnSchema = z
  .object({
    returnPhotos: z.array(z.string().url()).max(10).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    damageAmount: z.number().int().nonnegative().optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();
```

```ts
// web/src/app/api/rider/rental/return/route.ts (apply)
import { rentalReturnSchema } from '@/lib/validators/rider';
import { validateBody } from '@/lib/validators';

const body = await validateBody(request, rentalReturnSchema);
// body is now type-safe: only return fields, rejects unknown keys
```

**Test to add:**

```ts
// web/tests/unit/api/rider-rental-return.test.ts (new)
import { POST } from '@/app/api/rider/rental/return/route';

describe('POST /api/rider/rental/return', () => {
  it('rejects requests with extra fields (kycStatus, phone, etc.)', async () => {
    const req = new Request('http://localhost/api/rider/rental/return', {
      method: 'POST',
      body: JSON.stringify({ latitude: 0, longitude: 0, kycStatus: 'APPROVED' }),  // kycStatus is not in the schema
    });
    const res = await POST(req);
    expect(res.status).toBe(400);  // Zod strict() rejects
  });

  it('accepts requests with only return fields', async () => { ... });

  it('rejects invalid latitude/longitude ranges', async () => { ... });
});
```

**Acceptance criteria:**
- [ ] `rentalReturnSchema` exists in `validators/rider.ts` with `.strict()` and only return fields
- [ ] `route.ts` uses `validateBody(request, rentalReturnSchema)`
- [ ] 3 unit tests pass
- [ ] Existing tests still pass (1598+)
- [ ] `npx tsc --noEmit` clean
- [ ] `#58` marked SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 2 hr focused

**Risk:** low — additive (the schema rejects extra fields; existing legitimate requests have only return fields)

**Order:** SHIP in the "Track 1" week, can be done by the same contributor as PR-D and PR-E

---

## 6. PR-D: #55 — TEST_MODE dev-bypass hardening (P0, 30 min)

> **Status (2026-07-30 17:58):** ✅ **SHIPPED** in working tree. `web/src/app/api/device/data/route.ts:13` and `permissions/route.ts:13` both have the triple-gated check: `env.TEST_MODE && env.APP_ENV === 'development' && process.env.NODE_ENV === 'development'`. **Action:** commit when ready.

**Goal:** Harden the dev-bypass in `/api/device/data` and `/api/device/permissions`. The current code reads `riderDbId` from the body when `TEST_MODE=true` — this is the audit's P0 finding.

**Files to touch:**
- `web/src/app/api/device/data/route.ts:13-15` — restrict the dev-bypass to require BOTH `TEST_MODE` AND `NODE_ENV === 'development'`
- `web/src/app/api/device/permissions/route.ts:13-15` — same
- `web/tests/unit/api/device-data-bypass.test.ts` — NEW, 2 tests

**Change:**

```ts
// web/src/app/api/device/data/route.ts (current)
if (env.TEST_MODE && env.APP_ENV !== 'production') {
  const body = await request.clone().json();
  riderDbId = body.riderId || 'test-rider-001';
}

// After PR-D
if (env.TEST_MODE && env.APP_ENV === 'development' && process.env.NODE_ENV === 'development') {
  const body = await request.clone().json();
  riderDbId = body.riderId || 'test-rider-001';
}
```

The change is to require ALL THREE: `TEST_MODE && APP_ENV === 'development' && NODE_ENV === 'development'`. This is what the audit recommended in §2.1 of AUDIT_API_DEEP: "remove the dev branch, only allow `requireRiderSession`; if a test seed is required, gate on `TEST_MODE && NODE_ENV !== 'production'` with a separate endpoint."

For the minimum viable fix, we'll just tighten the gate. The full "separate test endpoint" is a follow-up.

**Test to add:**

```ts
// web/tests/unit/api/device-data-bypass.test.ts (new)
describe('POST /api/device/data — dev-bypass gate', () => {
  it('rejects body.riderId in staging (TEST_MODE=true but APP_ENV !== development)', async () => {
    process.env.TEST_MODE = 'true';
    process.env.APP_ENV = 'staging';
    // ...
    expect(res.status).toBe(401);
  });

  it('accepts body.riderId in dev (all three flags)', async () => { ... });
});
```

**Acceptance criteria:**
- [ ] Both `device/data` and `device/permissions` routes require `APP_ENV === 'development' && NODE_ENV === 'development'` in addition to `TEST_MODE`
- [ ] 2 unit tests pass
- [ ] All existing tests still pass
- [ ] `npx tsc --noEmit` clean
- [ ] `#55` marked SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 30 min focused

**Risk:** very low — the change makes the dev-bypass MORE restrictive, not less

**Order:** SHIP in the "Track 1" week

---

## 7. PR-E: #54 — seed.ts admin123 production-blocker (P0, 1 hr)

> **Status (2026-07-30 17:58):** ✅ **SHIPPED** in working tree. `web/prisma/seed.ts` uses `SEED_ADMIN_PASSWORD` env var (validated at `env.ts:75-78` as min 16 chars) and throws if production seed is run with the default `admin123`. **Action:** commit when ready.

**Goal:** Make `seed.ts` fail-closed in production. The current code has a `SEED_ADMIN_PASSWORD` env-var path (added in Phase 7), but the hardcoded `admin123` is still the fallback. The audit says the fallback should be a hard error in production.

**Files to touch:**
- `web/prisma/seed.ts` — change the admin123 fallback to a `throw` in production
- `web/.env.example` — add the `SEED_ADMIN_PASSWORD` to the documented env vars
- `web/tests/unit/seed.test.ts` — NEW, 3 tests

**Change:**

```ts
// web/prisma/seed.ts (current pattern, line ~XX)
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

// After PR-E
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword) {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error(
      'SEED_ADMIN_PASSWORD is required in production. Refusing to seed with a default password. ' +
      'Generate one with: openssl rand -base64 32'
    );
  }
  console.warn(
    '[seed] WARNING: Using fallback password "admin123". Set SEED_ADMIN_PASSWORD in non-prod environments too.'
  );
  // For dev/test, use the fallback
  return 'admin123';
}
return adminPassword;
```

**Test to add:**

```ts
// web/tests/unit/seed.test.ts (new)
describe('seed.ts — admin password', () => {
  it('throws in production if SEED_ADMIN_PASSWORD is missing', () => {
    process.env.APP_ENV = 'production';
    delete process.env.SEED_ADMIN_PASSWORD;
    expect(() => getAdminPassword()).toThrow(/SEED_ADMIN_PASSWORD is required/);
  });

  it('uses SEED_ADMIN_PASSWORD when set', () => { ... });

  it('warns in dev if SEED_ADMIN_PASSWORD is missing (uses fallback)', () => { ... });
});
```

**Acceptance criteria:**
- [ ] `seed.ts` throws in production if `SEED_ADMIN_PASSWORD` is missing
- [ ] `seed.ts` warns (not throws) in dev if `SEED_ADMIN_PASSWORD` is missing
- [ ] `.env.example` documents the new env var
- [ ] 3 unit tests pass
- [ ] All existing tests still pass
- [ ] `#54` marked SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 1 hr focused

**Risk:** low — additive. Existing dev workflows still work (with a warning). Production must set the env var, which is the whole point.

**Order:** SHIP in the "Track 1" week

---

## 8. PR-F: #61 — actorId from x-admin-id header (P2, 2 hr)

> **Status (2026-07-30 17:58):** 🟡 **PARTIAL.** `web/src/lib/get-session.ts:124-138` restricts the `x-admin-id` header fallback to `/api/admin/impersonate*` paths only. The `actorId` audit log field is derived from session, not header. **Action:** verify `audit-log.ts:5-7` shows `actorId` is always session-derived, then commit.

**Goal:** Audit-log `actorId` should always come from the session, not from the `x-admin-id` header. Currently, `web/src/lib/get-session.ts:125-126` reads `x-admin-id` from the request header (this is intentional — for admin impersonation flows). But the audit claims that `actorId` is also derived from this header in audit-log calls, which would be a vulnerability. Re-verification: only `get-session.ts:125` reads the header, and it's used for `requireAdmin()` session lookup, not for `actorId`. So this is **partially stale** — the audit was wrong about the audit-log callsite, but the underlying concern (x-admin-id is read from headers) is real.

**Files to touch:**
- `web/src/lib/get-session.ts:125-126` — restrict the x-admin-id header read to only the impersonation routes (use a route-level flag, not a global read)
- `web/src/lib/audit-log.ts` — add a comment block documenting that actorId is always from session
- `web/tests/unit/get-session-impersonation.test.ts` — NEW, 2 tests

**Change:**

```ts
// web/src/lib/get-session.ts (current)
const headerId = request.headers.get('x-admin-id');
if (headerId) return headerId;
```

```ts
// After PR-F — restrict to impersonation routes only
// PR-F (Ticket #61): Only the impersonation endpoints should accept x-admin-id.
// Other routes must require a valid session.
const isImpersonationRoute = request.nextUrl.pathname.startsWith('/api/admin/impersonate');
if (isImpersonationRoute) {
  const headerId = request.headers.get('x-admin-id');
  if (headerId) return headerId;
}
```

```ts
// web/src/lib/audit-log.ts (add comment)
// PR-F (Ticket #61): actorId is always derived from the session via
// `getSession()`, NEVER from request headers. Impersonation routes
// set the session.actorId to the impersonated admin's ID, and the
// audit log records the original admin in `details.impersonatedBy`.
```

**Test to add:**

```ts
// web/tests/unit/get-session-impersonation.test.ts (new)
describe('getSession() — x-admin-id header', () => {
  it('does NOT return x-admin-id on non-impersonation routes', async () => {
    const req = new Request('http://localhost/api/rider/profile', {
      headers: { 'x-admin-id': 'admin-123' },
    });
    const session = await getSession(req);
    expect(session).toBeNull();  // No valid session, no x-admin-id fallback
  });

  it('returns x-admin-id on impersonation routes only', async () => { ... });
});
```

**Acceptance criteria:**
- [ ] `x-admin-id` header is only honored on `/api/admin/impersonate*` routes
- [ ] `audit-log.ts` has a comment documenting the actorId-from-session invariant
- [ ] 2 unit tests pass
- [ ] All existing tests still pass
- [ ] `#61` marked SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 2 hr focused

**Risk:** medium — the change restricts the x-admin-id fallback. If any non-impersonation route silently relied on the fallback, it will now fail. Mitigation: grep the codebase for any route that sets `x-admin-id` and verify none of them are non-impersonation.

**Order:** SHIP in the "Track 1" week

---

## 9. PR-G: #50 — ALLOW_DEV_PII_KEY full reject (P0, 1 hr)

> **Status (2026-07-30 17:58):** ✅ **SHIPPED** in working tree. 3 layers of defense in place: (1) `web/src/lib/env.ts:117-133` Zod refine rejects `ALLOW_DEV_PII_KEY=true` in production/staging; (2) `env.ts:239-241` throws on `APP_ENV=production`; (3) `web/src/lib/pii-crypto.ts:25-30` runtime guard via `isProdEnv()`. **Action:** commit when ready.

**Goal:** Phase 7 added a schema reject for `ALLOW_DEV_PII_KEY=true` in production (in `web/src/lib/env.ts:118`). The audit's "full reject" is to also throw a clear error and document the env var in `.env.example`.

**Files to touch:**
- `web/src/lib/env.ts:118-125` — add a clearer error message naming the offending env var
- `web/.env.example` — document `ALLOW_DEV_PII_KEY` and its production-reject behavior
- `web/src/lib/pii-crypto.ts:15-20` — when the dev key path is used, log a clear warning

**Change:**

```ts
// web/src/lib/env.ts (refine the .refine block)
.refine(
  (data) => {
    if (data.APP_ENV === 'production') {
      if (data.ALLOW_DEV_PII_KEY) {
        throw new Error('ALLOW_DEV_PII_KEY MUST be unset or false in production. The hardcoded dev PII key is a security risk. Rotate the production key and unset this flag.');
      }
    }
    return true;
  },
  {
    message: 'ALLOW_DEV_PII_KEY is not allowed in production. Rotate the production PII key and unset this flag. See docs/SECURITY.md for the rotation procedure.',
  }
)
```

```bash
# web/.env.example (add)
# ━━ ALLOW_DEV_PII_KEY ━━
# Set to `true` ONLY in dev environments to use a hardcoded PII encryption key.
# PRODUCTION ENVIRONMENTS MUST have this unset or `false`. The schema rejects
# the value `true` in APP_ENV=production with a hard error.
# See docs/SECURITY.md for the production key rotation procedure.
ALLOW_DEV_PII_KEY=false
```

```ts
// web/src/lib/pii-crypto.ts:15-20 (clear warning)
if (process.env.ALLOW_DEV_PII_KEY === 'true') {
  console.warn(
    '[pii-crypto] ⚠️  ALLOW_DEV_PII_KEY=true. Using hardcoded dev key. ' +
    'THIS MUST NOT BE USED IN PRODUCTION. The env schema rejects this value in APP_ENV=production.'
  );
  // ... use the hardcoded dev key
}
```

**Test to add:**

```ts
// web/tests/unit/env-schema-rejects-pii.test.ts (new)
describe('env schema — ALLOW_DEV_PII_KEY', () => {
  it('rejects ALLOW_DEV_PII_KEY=true in production', () => {
    process.env.APP_ENV = 'production';
    process.env.ALLOW_DEV_PII_KEY = 'true';
    expect(() => parseEnv()).toThrow(/ALLOW_DEV_PII_KEY MUST be unset/);
  });

  it('accepts ALLOW_DEV_PII_KEY=true in dev', () => {
    process.env.APP_ENV = 'development';
    process.env.ALLOW_DEV_PII_KEY = 'true';
    expect(() => parseEnv()).not.toThrow();
  });
});
```

**Acceptance criteria:**
- [ ] Error message names `ALLOW_DEV_PII_KEY` explicitly
- [ ] `.env.example` documents the env var
- [ ] `pii-crypto.ts` logs a clear warning when the dev key is used
- [ ] 2 unit tests pass
- [ ] All existing tests still pass
- [ ] `#50` marked SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 1 hr focused

**Risk:** low — additive (clearer error message + better docs)

**Order:** SHIP in the "Track 1" week

---

## 10. PR-H: #40 — deploy script tag-based rollback (P0, 4 hr)

> **Status (2026-07-30 17:58):** 🟡 **PARTIAL** in working tree. `scripts/deploy-prod.sh` has been modified with `pipefail` + tag-based rollback, but **untested**. **Action:** run staging dry-run smoke test before committing.

**Goal:** Replace `git revert HEAD` rollback with tag-based rollback. The current `scripts/deploy-prod.sh` uses `git revert HEAD --no-edit` for rollback, which is fragile and doesn't re-run migrations.

**Files to touch:**
- `scripts/deploy-prod.sh:38-43` — replace revert with tag-based rollback
- `scripts/deploy-prod.sh` — add a pre-rollback migration check
- `scripts/deploy-prod.sh:8` — add a `git tag` step on every successful deploy
- `scripts/tests/deploy-prod.test.sh` — NEW, 4 tests (or use shellcheck + bats)

**Change:**

```bash
# scripts/deploy-prod.sh (replace the rollback block)
# On successful deploy, tag the release
git tag -a "deploy-$(date +%Y-%m-%d-%H%M)" -m "Deploy $COMMIT_SHA" || true

# Rollback block (replaces `git revert HEAD --no-edit`)
rollback() {
  local target_tag=$1
  if [ -z "$target_tag" ]; then
    echo "ERROR: rollback target tag required"
    echo "Available deploy tags:"
    git tag -l "deploy-*" | tail -10
    exit 1
  fi

  echo "Rolling back to $target_tag"
  git checkout "$target_tag"

  # Re-run migrations
  if ! npx prisma migrate deploy; then
    echo "ERROR: Migration divergence detected. Manual intervention required."
    echo "Tag: $target_tag"
    echo "Migration status:"
    npx prisma migrate status
    exit 1
  fi

  # Restart PM2
  pm2 reload ecosystem.config.js

  # Health check
  sleep 5
  if ! curl -s -f http://localhost:8081/api/health > /dev/null; then
    echo "ERROR: Health check failed after rollback. Tag: $target_tag"
    exit 1
  fi

  echo "Rollback to $target_tag complete"
}
```

**Test to add:**

```bash
# scripts/tests/deploy-prod.test.sh (new, or use bats)
@test "rollback creates tag on success" { ... }
@test "rollback fails fast if tag is missing" { ... }
@test "rollback aborts on migration divergence" { ... }
@test "rollback health-checks before declaring success" { ... }
```

**Acceptance criteria:**
- [ ] `deploy-prod.sh` tags every successful deploy with `deploy-YYYY-MM-DD-HHMM`
- [ ] Rollback uses `git checkout <tag>` instead of `git revert HEAD`
- [ ] Rollback aborts if `prisma migrate deploy` fails
- [ ] Rollback health-checks before declaring success
- [ ] 4 shell tests pass
- [ ] Manual smoke test in staging: deploy v1, deploy v2, rollback to v1
- [ ] `#40` marked SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 4 hr focused

**Risk:** high — the rollback path is critical infrastructure. A broken rollback means you can't recover from a bad deploy. **MUST** be tested in staging before production.

**Order:** SHIP after Track 1 (PR-A through PR-G). Apply to staging the same day, smoke-test the rollback, then promote to production.

---

## 11. PR-I: #39 + #42 — PM2 cluster mode + timeouts (P0, 1 day + 48h soak)

> **Status (2026-07-30 17:58):** ✅ **SHIPPED** in working tree. `ecosystem.config.js:43-44, 52-53, 59-62` has `instances: 'max', exec_mode: 'cluster', min_uptime: '60s', restart_delay: 30000, kill_timeout: 30000, listen_timeout: 60000, kill_signal: 'SIGINT', kill_retry_time: 5000`. **Action:** commit when ready; 48h staging soak before prod promote.

**Goal:** Enable PM2 cluster mode (`instances: 'max'`) and increase timeouts (`kill_timeout: 30000`, `listen_timeout: 60000`) to enable true zero-downtime deploys.

**Files to touch:**
- `ecosystem.config.js:42-44, 66-68` — change `instances: 1` to `instances: 'max'` for the web process
- `ecosystem.config.js:59-60, 80` — increase timeouts
- `ecosystem.config.js` — add `exec_mode: 'cluster'` for the web process (worker stays at fork)
- `ecosystem.config.js` — add `kill_signal: 'SIGINT'`
- `docs/RUNBOOK.md` — document the new deploy behavior + rollback procedure
- `scripts/deploy-prod.sh:22-23` — verify `pm2 reload` is correct for cluster mode

**Change:**

```js
// ecosystem.config.js (web process)
{
  name: 'voltium-web',
  script: 'node_modules/next/dist/bin/next',
  args: 'start',
  instances: 'max',              // was: 1
  exec_mode: 'cluster',          // was: 'fork' (default)
  // ... existing config ...
  kill_timeout: 30000,           // was: 10000
  listen_timeout: 60000,         // was: 30000
  kill_signal: 'SIGINT',         // NEW
  min_uptime: '60s',             // was: '10s'
  restart_delay: 30000,          // was: 5000
  max_restarts: 15,              // was: 10
}
```

```js
// ecosystem.config.js (worker process — stays fork, single instance)
{
  name: 'voltium-worker',
  // ... existing config, no changes ...
  // The worker MUST stay at instances: 1 to avoid outbox double-processing.
}
```

**Test to add:** No unit test — the verification is operational. Smoke test in staging:
1. Apply the new config
2. Start PM2 — verify N cluster workers spawn (where N = CPU count)
3. `curl http://localhost:8081/api/health` from 3 different sources — all return 200
4. `pm2 reload voltium-web` — verify zero downtime (no failed requests)
5. Kill one cluster worker — verify the others pick up
6. Watch logs for 48h — verify no restart loops

**Acceptance criteria:**
- [ ] `instances: 'max'` for web, `instances: 1` for worker
- [ ] `kill_timeout: 30000`, `listen_timeout: 60000`, `kill_signal: 'SIGINT'`
- [ ] `min_uptime: '60s'`, `restart_delay: 30000`, `max_restarts: 15`
- [ ] 48h staging soak with no restart loops
- [ ] `pm2 reload` demonstrates zero downtime (no failed requests in the 30s window)
- [ ] `RUNBOOK.md` documents the new config
- [ ] `#39` and `#42` marked SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 1 day focused + 48h staging soak (the soak time is calendar, not work hours)

**Risk:** very high — cluster mode changes how the process group is managed. If the new timeouts are too short for actual shutdown time, the cluster will keep restarting. If the cluster isn't properly configured, you can have port conflicts. **MUST** be tested in staging for 48h before production.

**Order:** SHIP after PR-H (deploy rollback is a precondition for safely promoting this). Apply to staging the same day, run the 48h soak, then promote.

---

## 12. PR-J: #7 sub-B — drop legacy string columns (1 day + 1-wk soak after PR-P3.2)

> **Status (2026-07-30 17:58):** 🟡 **PARTIAL.** PR-P3.2 (commit `26336bc`) shipped the FK column ADD + backfill. Legacy `pickupHub`/`currentPlan`/`teamLeader` string columns still present in `web/prisma/schema.prisma:153, 161, 169`. **Action:** wait for PR-P3.2's 1-wk staging soak to complete (~1 week from 2026-07-30), then ship the drop.

**Goal:** Drop the legacy `pickupHub`, `currentPlan`, `teamLeader` string columns from `Rider`, after the new FK columns (`pickupHubId`, `currentPlanId`, `teamLeaderId`) have been verified in production for 1 week. Update all ~12 use-case call sites to use the FK columns.

**Files to touch:**
- `web/prisma/schema.prisma` — remove `pickupHub`, `currentPlan`, `teamLeader` from `Rider`
- `web/prisma/migrations/<ts>_drop_rider_legacy_string_columns/migration.sql` (NEW)
- `web/src/server/modules/announcements/announcement.use-cases.ts:74, 84` — use `pickupHubId`/`currentPlanId` joins
- `web/src/server/modules/riders/admin-riders-list.use-cases.ts:281-282` — use `pickupHubId` joins
- `web/src/server/modules/riders/admin-riders-update.use-cases.ts:284, 285` — write FK IDs
- `web/src/server/modules/riders/rider-lifecycle.use-cases.ts:63` — use `currentPlanRef`
- `web/src/server/modules/riders/rider-queries.use-cases.ts:67, 72, 73, 74` — use new fields
- `web/src/server/modules/riders/admin-riders-update.use-cases.ts:235` — use `currentPlanRef`
- `web/src/server/modules/team-leaders/team-leader.repository.ts:37` — use `teamLeaderId`
- `web/src/server/modules/plans/plan.use-cases.ts:88` — write `currentPlanId`
- `web/src/server/modules/onboarding/onboarding.use-cases.ts:101` — write `currentPlanId`
- `web/src/server/modules/rentals/rental.repository.ts:88, 89` — write FK IDs
- `web/src/server/modules/rentals/rental.use-cases.ts:277, 278` — resolve names to IDs
- `web/src/components/admin/screens/RiderManagement.tsx:2010, 1962, 1180, 1131` — update form bindings
- `web/src/components/admin/screens/rider-management/RiderDetailDialog.tsx:1179, 1131` — same
- `web/src/components/admin/screens/kyc-management/kyc-types.ts:23` — type definitions
- `web/src/types/api.d.ts:104, 108, 115` — type definitions
- `web/src/lib/types/admin.ts:25, 27, 91` — type definitions
- `web/src/lib/flatten-rider.ts:131-218` — flat-rider serialization
- `flutter/lib/models/rider_model.dart` — `pickupHub`/`currentPlan`/`teamLeader` getters need to use FK IDs (or join tables)
- `web/src/contracts/openapi.ts` — regenerate
- `web/tests/integration/**/*.test.ts` — update any tests that use the old fields

**Change:** Too large to fit in this doc. The pattern is:
1. Look up the new FK ID in the use-case (e.g. `await db.hub.findUnique({ where: { name: input.pickupHub } })`)
2. Write the ID to the new FK column (`pickupHubId: hub.id`)
3. Drop the old string column

**Migration SQL:**

```sql
-- web/prisma/migrations/<ts>_drop_rider_legacy_string_columns/migration.sql
DO $$
BEGIN
  -- Drop the legacy string columns. The new FK columns have been
  -- backfilled (PR-P3.2) and verified in production for 1+ week.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'riders' AND column_name = 'pickupHub') THEN
    ALTER TABLE "riders" DROP COLUMN "pickupHub";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'riders' AND column_name = 'currentPlan') THEN
    ALTER TABLE "riders" DROP COLUMN "currentPlan";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'riders' AND column_name = 'teamLeader') THEN
    ALTER TABLE "riders" DROP COLUMN "teamLeader";
  END IF;

  -- Drop the index on the legacy column
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'riders_teamLeader_idx') THEN
    DROP INDEX "riders_teamLeader_idx";
  END IF;
END $$;
```

**Test to add:** Integration tests that verify:
- `rider.create` with only FK IDs works
- `rider.findUnique` returns the joined Hub/RentalPlan/TeamLeader
- The admin riders list query still works

**Acceptance criteria:**
- [ ] PR-P3.2 has been in production for 1+ week (staging soak complete)
- [ ] Spot-check on staging: `SELECT count(*) FROM riders WHERE "pickupHub" IS NOT NULL AND "pickupHubId" IS NULL;` returns 0
- [ ] All use-case call sites updated
- [ ] Type definitions updated
- [ ] Flutter `rider_model.dart` updated
- [ ] `npm run test:unit` still 1598+ pass
- [ ] `npm run test:integration` all pass
- [ ] `npx tsc --noEmit` clean
- [ ] Manual smoke test in staging: create rider, assign plan, verify admin list shows the joined data
- [ ] 1-week staging soak AFTER the migration applies
- [ ] `#7` marked fully SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 1 day focused + 1-wk staging soak

**Risk:** high — this is a destructive schema change. **MUST** be gated on 1-week staging soak of PR-P3.2 first. **MUST** be applied during a low-traffic window.

**Order:** SHIP after PR-P3.2's 1-week staging soak completes. This is the last DB track PR.

---

## 13. PR-K: #6 — RiderLifecycleStatus enum split (Medium, 3-5 d)

> **Status (2026-07-30 17:58):** ⚪ **PENDING.** Not started. The 15-value `RiderLifecycleStatus` enum is at `web/prisma/schema.prisma:1080-1096`. No `RiderLifecycleStage` enum exists yet. **Action:** schedule for Week 2-3.

**Goal:** Split the 15-value `RiderLifecycleStatus` enum into a 5-value `RiderLifecycleStage` + per-step fields. The audit's plan is in `docs/DB_REMEDIATION_PLAN.md`. This is a 3-PR sequence:

- **PR-K.1:** Add new `RiderLifecycleStage` enum + per-step fields; backfill from existing enum
- **PR-K.2:** Update Flutter to read `lifecycleStage` (gated on 1-week staging soak)
- **PR-K.3:** Drop the legacy `lifecycleStatus` column (gated on another 1-week soak)

**Files to touch (per sub-PR):**

### PR-K.1 (2 days)
- `web/prisma/schema.prisma` — add `RiderLifecycleStage` enum (NEW: NEW / IN_PROGRESS / ACTIVE / PAUSED / CLOSED) + `lifecycleStage` field on Rider + per-step fields (e.g. `kycStage`, `depositStage`)
- `web/prisma/migrations/<ts>_add_rider_lifecycle_stage/migration.sql` (NEW)
- `web/src/server/modules/riders/rider.repository.ts` — backfill from `lifecycleStatus` to `lifecycleStage` + per-step fields
- `web/tests/unit/rider-lifecycle-stage.test.ts` (NEW)

### PR-K.2 (0.5 day, after 1-wk soak)
- `flutter/lib/models/rider_model.dart` — add `lifecycleStage` getter, keep `lifecycleStatus` as deprecated
- `flutter/lib/features/auth/presentation/rider_lifecycle_gate.dart` — use `lifecycleStage`
- `flutter/integration_test/e2e_individual/04_login_screen_test.dart` + others — update assertions
- 1-wk staging soak

### PR-K.3 (0.5 day, after another 1-wk soak)
- `web/prisma/schema.prisma` — drop `lifecycleStatus` field
- `web/prisma/migrations/<ts>_drop_lifecycle_status/migration.sql` (NEW)
- All use-cases, validators, types updated
- 1-wk staging soak

**Acceptance criteria (per sub-PR):** as in the original `DB_REMEDIATION_PLAN.md` PR-K plan.

**Effort:** 3-5 days total (1.5 days focused work + 2 weeks of staging soaks)

**Risk:** medium — the enum is queried from many places, but it's a string field, not a foreign key. Refactor is mechanical.

**Order:** SHIP after PR-J (so the staging environment is stable). The work can be parallelized with PR-L (Flutter) and PR-M (Phase 3 Low).

---

## 14. PR-L: #65 — AppProvider stub (P1, 1 d)

> **Status (2026-07-30 17:58):** ✅ **SHIPPED** in working tree. `flutter/lib/core/state/app_provider.dart` is now a 71-line Riverpod facade. The class delegates to `RiderProvider`, `WalletProvider`, `SupportProvider`, `EngagementProvider`, `DevicePolicyProvider`, `ConnectivityProvider` via factory functions. 25 test files that transitively imported it should now compile. **Action:** commit when ready; run `flutter analyze` to confirm.

**Goal:** Create `flutter/lib/core/state/app_provider.dart` so the 25 test files that transitively import it can compile. This unblocks `flutter analyze` on the full codebase.

**Files to touch:**
- `flutter/lib/core/state/app_provider.dart` (NEW, ~100 lines)
- `flutter/test/**/*.dart` (25 files transitively import this; should now compile without modification)

**Change:**

```dart
// flutter/lib/core/state/app_provider.dart (NEW)
import 'package:flutter/foundation.dart';
import '../models/rider_model.dart';
import '../utils/app_constants.dart';

/// Compatibility layer for AppProvider. This is a thin facade over
/// [RiderModel] and [AppConstants]. New code should import those directly.
///
/// PR-L (Ticket #65): Created to unblock `flutter analyze` on the full
/// codebase. 25 test files transitively imported this file but the
/// implementation had been moved to RiderModel. This stub provides
/// the same surface area without re-implementing the state machine.
@immutable
class AppProvider extends ChangeNotifier {
  AppProvider({RiderModel? rider}) : _rider = rider;

  final RiderModel? _rider;

  bool get isReady => _rider != null && _rider.lifecycleStatus != null;
  bool get isOnboarded => _rider?.isOnboarded ?? false;
  bool get isPickupDone => _rider?.isPickupDone ?? false;
  bool get isRegistrationDone => _rider?.registrationDoneAt != null;
  // ... etc, mapping all 9 RiderModel getters

  RiderModel? get rider => _rider;
}
```

**Test to add:**

```dart
// flutter/test/core/state/app_provider_test.dart (new)
testWidgets('AppProvider isReady returns true when RiderModel has a lifecycleStatus', (tester) async {
  final rider = RiderModel(lifecycleStatus: 'PHONE_VERIFIED');
  final provider = AppProvider(rider: rider);
  expect(provider.isReady, isTrue);
});
```

**Acceptance criteria:**
- [ ] `flutter/lib/core/state/app_provider.dart` exists
- [ ] `flutter analyze` passes on the full codebase (was failing on 25 transitively-importing test files)
- [ ] `flutter test` still 1597+ pass
- [ ] `#65` marked SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 1 day focused

**Risk:** low — additive (creates a new file, doesn't refactor existing)

**Order:** SHIP in the "Track 4" week, in parallel with PR-M and PR-N

---

## 15. PR-M: Phase 3 Low — bulk PR for #4, #5, #9, #16, #17, #22, #23, #25, #26, #29-#33 (3-5 d)

> **Status (2026-07-30 17:58):** ⚪ **PENDING.** Not started. Bulk cleanup of low-priority items. **Action:** schedule for Week 3-4, parallel with PR-O.

**Goal:** Ship the remaining 12 Phase 3 Low tickets in a single bulk PR (or 2-3 sub-PRs grouped by domain).

**Files to touch:** Varies per ticket. See the individual ticket detail in `FOLLOWUP_TICKETS.md`.

**Tickets and effort:**

| # | Finding | Effort | Sub-PR group |
|---|---|---|---|
| #4 | Migrate 24 typography aliases to canonical 15 tiers | 1 d | Design System |
| #5 | Migrate 60+ raw color hues to ~12 semantic tokens | 1-2 d | Design System |
| #9 | Migrate `Admin.permissions` from `String` JSON to `text[]` | 1-2 d | DB |
| #16 | Tidy `lib/fcm.ts`, `lib/firebase-admin.ts`, `lib/job-queue.ts` | 1-2 d | Admin Web |
| #17 | Verify `lib/image-optimizer.ts` doesn't duplicate `image-compress.ts` | 1 hr | Admin Web (trivial) |
| #22 | Audit small server modules (28 modules) | 1-2 d | Admin Web |
| #23 | Audit other worker jobs (8 jobs) | 1 d | Workers |
| #25 | Verify `contracts/openapi.ts` (84 KB) is up-to-date | 0.5 d | Admin Web |
| #26 | Audit top-level shell for structural cleanup | 0.5 d | Admin Web |
| #29 | Fix `AppDurations.premiumCurve` | 0.5 d | Design System |
| #30 | Pre-build `AppTypography` 17 styles in static initializer | 0.5 d | Design System |
| #31 | Various small P2/P3 design system tidy-ups | 1 d | Design System |
| #33 | Additional server module splits | 2-3 d | Admin Web |

**Total: 12-17 days focused** — but this is a parallel effort. Group by sub-PR:

- **PR-M.A Design System (#4, #5, #29, #30, #31):** 4-5 days
- **PR-M.B DB (#9):** 1-2 days
- **PR-M.C Admin Web (#16, #17, #22, #25, #26, #33):** 5-7 days
- **PR-M.D Workers (#23):** 1 day

**Acceptance criteria (per sub-PR):** as in the individual ticket detail in `FOLLOWUP_TICKETS.md`.

**Effort:** 12-17 days focused (parallelized)

**Risk:** medium — the design system refactor (#4, #5) has CI lint enforcement now, so a partial migration is verifiable. The admin web refactor (#33) is large and may surface new issues.

**Order:** SHIP in the "Track 4" weeks, in parallel with PR-L, PR-N, PR-O

---

## 16. PR-N: Trivial/cosmetic batch (12-15 hr across 6 PRs)

> **Status (2026-07-30 17:58):** ⚪ **PENDING.** Not started. 120 cosmetic items batched into 6 PRs. **Action:** start with smallest batch (~1 hr) as the first "polish" PR.

**Goal:** Ship the 120 remaining trivial/cosmetic items in 6 batched PRs (1 per source plan).

**Files to touch:** Varies per item. Most are 1-3 line changes.

**Sub-PRs:**

- **PR-N.A Infra polish (24 items):** 3 hr — `bootstrap.sh` `chmod 600`, `bootstrap.sh --non-interactive`, K8S_PROBES doc annotations, etc.
- **PR-N.B Security polish (40 items):** 5 hr — Argon2id parallelism fix, verifyPbkdf2 NaN check, redactPii rename, SENSITIVE_KEYS additions, etc.
- **PR-N.C Design System polish (5 items):** 1 hr — typography alignment, AppDurations fixes already in PR-M
- **PR-N.D Admin Web polish (14 items):** 2 hr — small P2/P3 items in the server modules
- **PR-N.E Workers polish (5 items):** 30 min — APM, circuit-breaker verification, log shipping
- **PR-N.F Docs polish (32 items):** 3 hr — DR RTO/RPO, RUNBOOK expansions, K8S_PROBES deprecation notes

**Acceptance criteria:** All 120 items closed (or moved to a follow-up if any reveal new issues).

**Effort:** 12-15 hr focused across 6 PRs

**Risk:** low — these are small, well-scoped items

**Order:** SHIP in the "Track 4" weeks, in parallel with PR-L, PR-M, PR-O

---

## 17. PR-O: Admin Web small-screen splits (#21, 2-4 weeks, multiple PRs)

> **Status (2026-07-30 17:58):** ⚪ **PENDING.** Not started. Largest single item by effort. **Action:** start with `RiderManagement.tsx` split (largest file).

**Goal:** Split 30+ admin web screens that are >1,000 lines. The audit estimates 2-4 weeks of focused work, broken into 5-10 sub-PRs by feature.

**Sub-PRs:**

- **PR-O.1 Wallet/Transactions screens** (4-5 screens, 1 week)
- **PR-O.2 Riders screens** (4-5 screens, 1 week)
- **PR-O.3 KYC screens** (3-4 screens, 0.5 week)
- **PR-O.4 Settings screens** (3-4 screens, 0.5 week)
- **PR-O.5 Reports screens** (5-6 screens, 1 week)
- **PR-O.6 Support tickets** (3-4 screens, 0.5 week)
- **PR-O.7 Auth/admin screens** (2-3 screens, 0.5 week)
- **PR-O.8 Other** (3-4 screens, 0.5 week)

**Acceptance criteria (per sub-PR):**
- [ ] Each screen file < 1,000 lines
- [ ] Extracted widgets live in `features/<feature>/widgets/` (per Ticket #28)
- [ ] No regression in behavior
- [ ] `npm run test:unit` still 1598+ pass
- [ ] `npm run test:integration` all pass

**Effort:** 2-4 weeks focused (multiple contributors in parallel)

**Risk:** medium — large refactor with many touch points

**Order:** SHIP in the "Track 4" weeks. This is the long-tail work; can be parallelized with multiple contributors.

---

## 18. PR-P: #59 follow-up — Admin UI for restore (P0 partial, 1 d)

> **Status (2026-07-30 17:58):** ⚪ **PENDING.** Not started. v2 Admin UI for restore. **Action:** schedule for Week 3.

**Goal:** Add the Admin UI for the 7-day grace + 2-person rule for data-deletion. Phase 7 shipped the route + 2 endpoints + 3 permission keys, but the UI for "approve" / "reject" / "view pending" is missing.

**Files to touch:**
- `web/src/app/admin/riders/[id]/data-deletion/page.tsx` (NEW)
- `web/src/components/admin/screens/rider-management/DataDeletionApprovalCard.tsx` (NEW)
- `web/src/components/admin/screens/rider-management/DataDeletionQueueTable.tsx` (NEW)
- `web/src/server/modules/admin/admin.repository.ts` — list pending data-deletion requests
- `web/src/lib/validators/admin.ts` — `dataDeletionApproveSchema` + `dataDeletionRejectSchema`
- `web/tests/integration/admin/data-deletion-flow.test.ts` (NEW, 4 tests)

**Acceptance criteria:**
- [ ] Admin can list pending data-deletion requests
- [ ] Admin can approve (requires 2nd admin co-sign)
- [ ] Admin can reject
- [ ] 7-day grace period is enforced (data is soft-deleted, hard-deleted after 7 days)
- [ ] Audit log captures the approve/reject
- [ ] 4 integration tests pass
- [ ] `#59` marked fully SHIPPED in `FOLLOWUP_TICKETS.md`

**Effort:** 1 day focused

**Risk:** low — additive UI

**Order:** SHIP in the "Track 4" week. The route already exists; this is just the UI.

---

## 19. Test environment requirements (env vars, infra)

Every PR in this plan needs the following test environment:

- **Web env vars** (PowerShell):
  ```powershell
  $env:ENABLE_TEST_OTP='false'
  $env:ENABLE_DEV_ADMIN_LOGIN='false'
  $env:NODE_ENV='test'
  $env:DATABASE_URL='postgresql://voltium_user:voltium_pass@localhost:5432/voltium_dev?schema=test'
  $env:SKIP_PRISMA_PUSH='1'
  ```
- **Test commands**:
  - `npx tsc --noEmit` — typecheck
  - `npm run test:unit` — full unit suite
  - `npm run test:integration` — integration suite (needs dev server)
- **Flutter env vars**:
  - `TEST_MODE=true`
  - `--dart-define=API_URL=http://localhost:8081`
  - `--dart-define=TEST_MODE=true`
- **Coverage gate** (CI):
  - `npm run test:coverage:combined` — web unit + integration + Flutter combined
  - Threshold: 85% lines (per `AGENTS.md`)
- **Staging env**: same as dev, with `APP_ENV=staging`. PR-H, PR-I, PR-J, PR-K all require a staging soak.

---

## 20. Staging-soak choreography (4 weeks total)

Several PRs require a 1-week staging soak. Here's the timeline (assuming we start Week 1 Monday):

| Date | Event | Owner |
|---|---|---|
| **Week 1, Mon** | PR-A, PR-B, PR-C, PR-D, PR-E, PR-F, PR-G ship to dev (Track 1) | Dev 1 |
| **Week 1, Tue** | PR-A, PR-B, PR-C, PR-D, PR-E, PR-F, PR-G merge + apply to staging | Dev 1 |
| **Week 1, Wed** | PR-H, PR-I code complete; apply to staging; start 48h PM2 cluster soak | Dev 2 |
| **Week 2, Mon** | PR-H (rollback) smoke-tested; promote to prod | Dev 2 |
| **Week 2, Tue** | PR-I (PM2) 48h soak complete; promote to prod | Dev 2 |
| **Week 2, Wed** | PR-J code complete; apply to staging; start 1-wk soak | Dev 1 |
| **Week 3, Wed** | PR-J 1-wk soak complete; promote to prod (sub-B) | Dev 1 |
| **Week 3, Thu** | PR-K.1 (lifecycle stage enum add) apply to staging; start 1-wk soak | Dev 2 |
| **Week 4, Thu** | PR-K.1 1-wk soak complete; promote to prod | Dev 2 |
| **Week 4, Fri** | PR-K.2 (Flutter reads lifecycleStage) apply; start 1-wk soak | Dev 1 |
| **Week 5, Fri** | PR-K.2 1-wk soak complete; promote to prod (then PR-K.3) | Dev 1 |

In parallel:
- **Track 4 (PR-L, PR-M, PR-N, PR-O, PR-P)** runs continuously through all 4 weeks, with no staging-soak gating.
- **PR-K.3** (drop legacy `lifecycleStatus`) starts after PR-K.2's 1-wk soak completes — that's Week 5 Friday → Week 6 Friday.

**Total: 4 weeks of staging-soak-coordinated work + 1 week for PR-K.3 = 5 weeks total** to land every P0, P1, and Medium ticket.

---

## 21. Risk register — what can break and how to detect it

| Risk | PR | Mitigation | Detection |
|---|---|---|---|
| PM2 cluster port conflict | PR-I | Use `instances: 'max'` with `exec_mode: 'cluster'`; PM2 handles port allocation | Staging: `pm2 status` shows N workers, all listening on same port via SO_REUSEPORT |
| Migration divergence on rollback | PR-H, PR-J | `prisma migrate deploy` aborts rollback | Manual rollback smoke test in staging |
| `actorId` change breaks audit log | PR-F | Restrict to impersonation routes only; grep for x-admin-id usage | Integration tests + manual admin audit log review |
| `TEST_MODE` change breaks Flutter tests | PR-D | Only tighten the gate; existing dev workflows still work | Flutter integration tests pass |
| OutboxService.emit regression | (none — already correct) | The fix is "audit-correction" — no code change | (none) |
| AppProvider stub breaks the 25 test files | PR-L | Stub must provide the same surface area as the old AppProvider | `flutter test` for the 25 files |
| Admin Web screen split breaks RiderManagement | PR-O.1 | Incremental splits; manual smoke test after each | Integration tests for RiderManagement flow |
| RTO/RPO doc not implemented | (out of scope — Trivial #Infra 11.4) | (none — doc-only) | Manual review |
| `flutter analyze` exposes 25 transitively-importing test files | PR-L | The stub file fixes this | `flutter analyze` should pass cleanly after PR-L |

---

## 22. Cross-references

- **Pass 3 verification** (per-finding verdict for every audit doc):
  - [`docs/AUDIT_VERIFICATION_3_2026-07-30.md`](./AUDIT_VERIFICATION_3_2026-07-30.md) — the source-of-truth for "which findings are still real bugs"
- **Backlog dashboard** (current state of every ticket):
  - [`docs/BACKLOG_FINDINGS.md`](./BACKLOG_FINDINGS.md) — Phase 1/2/3 + trivial status
- **Ticket detail** (per-ticket acceptance criteria, files to touch):
  - [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) — 65 tickets, filing checklist
- **Source plans** (the work these tickets came from):
  - [`docs/DB_REMEDIATION_PLAN.md`](./DB_REMEDIATION_PLAN.md) — Tickets #6-#12
  - [`docs/DESIGN_SYSTEM_PLAN.md`](./DESIGN_SYSTEM_PLAN.md) — Tickets #13, #14, #27-#32
  - [`docs/ADMIN_WEB_PLAN.md`](./ADMIN_WEB_PLAN.md) — Tickets #15-#26, #33
  - [`docs/RIDER_APP_PLAN.md`](./RIDER_APP_PLAN.md) — (no separate tickets; in plan PRs)
  - [`docs/INFRASTRUCTURE_PLAN.md`](./INFRASTRUCTURE_PLAN.md) — Tickets #34-#43
  - [`docs/SECURITY_PLAN.md`](./SECURITY_PLAN.md) — Tickets #44-#53
- **Source audits** (the original findings):
  - [`docs/AUDIT_API_DEEP.md`](./AUDIT_API_DEEP.md)
  - [`docs/AUDIT_BACKEND.md`](./AUDIT_BACKEND.md)
  - [`docs/AUDIT_DATABASE.md`](./AUDIT_DATABASE.md)
  - [`docs/AUDIT_DESIGN_SYSTEM.md`](./AUDIT_DESIGN_SYSTEM.md)
  - [`docs/AUDIT_FINDINGS_ADMINPANEL.md`](./AUDIT_FINDINGS_ADMINPANEL.md)
  - [`docs/AUDIT_FINDINGS_RIDERAPP.md`](./AUDIT_FINDINGS_RIDERAPP.md)
  - [`docs/AUDIT_INFRASTRUCTURE.md`](./AUDIT_INFRASTRUCTURE.md)
  - [`docs/AUDIT_SECURITY.md`](./AUDIT_SECURITY.md)
  - [`docs/AUDIT_WORKERS.md`](./AUDIT_WORKERS.md)
- **Operational artifacts:**
  - [`docs/DEVICE_TEST_PLAYBOOK.md`](./DEVICE_TEST_PLAYBOOK.md) — physical device test script
  - [`docs/BUG_REPORT_TEMPLATE.md`](./BUG_REPORT_TEMPLATE.md) — bug filing template
  - [`docs/RELEASE_READINESS_2026-07-29.md`](./RELEASE_READINESS_2026-07-29.md) — release readiness
  - [`SCOPE.md`](../SCOPE.md) — phase history + audit plan entries
- **Pass 4 verification (2026-07-30):**
  - [`docs/AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md) — 10 more stale audit claims caught
  - [`docs/EXECUTION_PLAN_2026-07-30.md`](./EXECUTION_PLAN_2026-07-30.md) — execution plan with 4 new PRs (Q, R, S, T)
- **Staging-soak references** (existing related migrations):
  - `web/prisma/migrations/20260729160000_add_check_constraints/migration.sql` — precedent for idempotent constraint migration
  - `web/prisma/migrations/20260730131814_convert_json_columns/migration.sql` — PR-P3.1, soak-gated
  - `web/prisma/migrations/20260730140000_add_rider_fk_columns/migration.sql` — PR-P3.2, soak-gated

---

## 23. Pass 4 deltas — 4 new PRs (Q, R, S, T) + PR-C cancelled

**Added 2026-07-30** based on Pass 4 verification in [`AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md).

Pass 4 found 4 still-real audit findings that were NOT in the original 17-PR plan. Detailed specs in [EXECUTION_PLAN_2026-07-30.md](./EXECUTION_PLAN_2026-07-30.md) §5-8.

| New PR | Source audit | Finding | Severity | Effort | Status (17:58 IST) |
|---|---|---|---|---|---|
| **PR-Q** | AUDIT_DESIGN_SYSTEM §5.1 | `ChipWidget` default `Colors.amber` (should be `AppColors.warning`) | P0 | 30 min | ✅ **SHIPPED** (`form_widgets.dart:18` is now `AppColors.warning`) |
| **PR-R** | AUDIT_FINDINGS_RIDERAPP §1.3 | Polling timeout has `_isPollingTimedOut` getter but no UI surface | P1 | 1 day | ✅ **SHIPPED** (`pre_dashboard_polling_banner.dart` created; `pre_dashboard_screen.dart:42-43` watches `isPollingTimedOut`) |
| **PR-S** | AUDIT_DATABASE §2.1 | Rider 60+ columns; needs decomposition to 5 child tables | P0 architectural | 5-7 days + 1-wk soak | ⚪ **PENDING** (not started) |
| **PR-T** | AUDIT_FINDINGS_RIDERAPP §1.1 | Router is 30-state setState machine; needs go_router migration | P0 architectural | 1-2 weeks | ⚪ **PENDING** (`go_router` not in `pubspec.yaml`) |

**PR-C (#58 rental/return mass-assignment) is CANCELLED.** Pass 4 re-grep shows the `.strict()` Zod allowlist is already in place at `web/src/app/api/rider/rental/return/route.ts:12-23`. The audit was wrong. PR-B handles the doc-only close-out.

**Updated PR count: 17 → 21 PRs** (after cancellation: 16 existing + 4 new + 1 cancelled = 20 active PRs, plus PR-K.1/2/3 splits = 21 PRs total).

**Updated ship status (2026-07-30 17:58):** 2 of 4 Pass 4 PRs shipped (Q, R). 2 pending (S, T).

**Updated effort: ~22-28 focused days** across 2 contributors, with 3-4 weeks of parallel staging soaks.

### Insertion into §2 tracks

Updated 4-track structure with the 4 new PRs:

**Track 1: Audit corrections + zero-risk (PR-A through PR-G + PR-Q) — 1 day focused**
- PR-A: OutboxService.emit verification + #64 close-out (1 hr, doc-only)
- PR-B: Audit-corrections — close 6 stale tickets (1 hr, doc-only) — **was 3, now 6 per Pass 4**
- ~~PR-C: #58 rental/return mass-assignment~~ — **CANCELLED** per Pass 4
- PR-D: #55 TEST_MODE dev-bypass hardening (P0, 30 min)
- PR-E: #54 seed.ts admin123 production-blocker (P0, 1 hr)
- PR-F: #61 actorId from x-admin-id header (P2, 2 hr)
- PR-G: #50 ALLOW_DEV_PII_KEY full reject + #3.3 + #4.4 hardening (P0, 1.5 hr) — **extended per Pass 4**
- **PR-Q: ChipWidget default `Colors.amber` (P0, 30 min) — NEW**

**Track 2: Infra (PR-H + PR-I) — 1-2 days focused + 2-3 days staging soak**
- PR-H: #40 deploy script tag-based rollback + pipefail + audit (P0, 5 hr) — **was 4 hr, extended per Pass 4 §3.11**
- PR-I: #39 PM2 cluster mode + timeouts (P0, 0.5 day) — **Pass 4 confirmed cluster mode already shipped; just verify**

**Track 3: DB (PR-J + PR-K + PR-S) — 5-7 days focused + 2-3 weeks staging soak**
- PR-J: #7 sub-B drop legacy string columns (1 day + 1-wk soak)
- PR-K.1: #6 add `RiderLifecycleStage` enum + new column (2 days + 1-wk soak)
- PR-K.2: #6 Flutter reads `lifecycleStage` (0.5 day + 1-wk soak)
- PR-K.3: #6 drop legacy `lifecycleStatus` enum (0.5 day)
- **PR-S: Rider model decomposition to 5 child tables (5-7 days + 1-wk soak) — NEW**

**Track 4: Flutter + polish (PR-L + PR-M + PR-N + PR-O + PR-P + PR-R + PR-T) — 1-2 weeks focused, parallel**
- PR-L: #65 AppProvider stub (P1, 1 day)
- PR-M: Phase 3 Low bulk (3-5 days)
- PR-N: Trivial/cosmetic batch (12-15 hr across 6 PRs)
- PR-O: #21 admin web small-screen splits (2-4 weeks)
- PR-P: #59 follow-up Admin UI for restore (1 day)
- **PR-R: Polling timeout UI surface (P1, 1 day) — NEW**
- **PR-T: Router state-machine refactor (P0 architectural, 1-2 weeks) — NEW**

### Updated calendar (4 weeks + optional Week 5)

```
Week 1: Track 1 ships (PR-A → PR-B → PR-D → PR-E → PR-F → PR-G → PR-Q); Track 2 prep; PR-L + PR-R + PR-N PR-1
Week 2: PR-H + PR-I ship + staging soak; PR-J + PR-S start; PR-M + PR-T start
Week 3: PR-H + PR-I promote to prod; PR-J 1-wk soak; PR-K.1 + PR-S continue
Week 4: PR-J promote; PR-K.1 1-wk soak; PR-S + PR-T continue; PR-K.2 ships
Week 5 (optional): PR-S + PR-K.2 1-wk soak; PR-T continues
```

### PR-S detail (NEW)

**Goal:** Decompose `Rider` (60+ columns) into 5 child tables.

**Child tables:**
1. `RiderPickupPhotos` (1:1, 5 photo fields)
2. `RiderPermissions` (1:1, 8 permission booleans + 2 device violation fields)
3. `RiderDevice` (1:1, FCM token + device admin flags + lock password hash + battery level)
4. `RiderLocation` (1:1, last known lat/lng/at)
5. `RiderOnboarding` (1:1, hub/plan/team leader FKs + plan dates + emergency contact)

**Migration strategy (matches PR-P3.1/2 pattern):**
1. ADD child tables with all columns nullable
2. Backfill from `riders` (one-time INSERT)
3. Drop legacy columns from `riders`
4. Add NOT NULL constraints where appropriate
5. All steps idempotent with `IF NOT EXISTS` guards

**Code change:** Update `flatten-rider.ts` to JOIN across child tables. Update all `riderUseCases` writers to write to child tables.

**Test:** 20+ new unit tests for backfill + flatten + write paths.

**Effort:** 5-7 days focused + 1-wk staging soak. **HIGH RISK** — 100+ use-cases touch the Rider model.

### PR-T detail (NEW)

**Goal:** Replace `app/router.dart` (12 KB) + `app/router_body.dart` (15 KB) + `app/app_state.dart` with `go_router` declarative routes.

**Approach:** Two options. Recommend `go_router: ^14.0.0` for time-to-value.

**Migration strategy:**
1. Add `go_router` dependency
2. Define typed route constants (`class Routes { static const login = '/login'; }`)
3. Migrate auth flow first (splash → legal → permissions → login → OTP → dashboard)
4. Migrate onboarding (pre_dashboard, KYC, guarantor, deposit, plan)
5. Migrate main app (dashboard, wallet, profile, support, settings)
6. Extract `PickupFlowProvider` from router
7. Delete `app/router_body.dart` once all branches converted
8. Update 33 E2E tests to use `context.go()`

**Test:** Unit tests for each route's redirect logic + 33 E2E tests + `flutter analyze` clean.

**Effort:** 1-2 weeks focused. **HIGH RISK** — 33 E2E tests affected.

### Risk register updates

| New PR | Risk | Mitigation |
|---|---|---|
| **PR-Q** | Low | Single default color change; easy revert |
| **PR-R** | Low | Affects `pre_dashboard` only; easy revert |
| **PR-S** | **VERY HIGH** | Add child tables additively first; keep legacy columns for 1 release; manual smoke test every flow |
| **PR-T** | **HIGH** | 33 E2E tests need re-baselining; recommend 1-2 weeks parallel with another contributor |

For full risk register, see FIX_PLAN.md §21 (updated).

### Cross-references

- **Full execution plan:** [`docs/EXECUTION_PLAN_2026-07-30.md`](./EXECUTION_PLAN_2026-07-30.md) — supersedes this section for Pass 4 deltas
- **Pass 4 audit verdicts:** [`docs/AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md) — the 10 stale claims + 11 still-real
- **Backlog dashboard:** [`docs/BACKLOG_FINDINGS.md`](./BACKLOG_FINDINGS.md) — current state
- **Tickets:** [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) — 65 tickets, will become 69 with PR-Q/R/S/T as #66/#67/#68/#69

---

## 24. Status snapshot (2026-07-30 17:58 IST) — what's actually in the working tree

**Verification method:** Re-grepped every PR spec against the working tree. The 979 modified files + 43 deleted + 164 untracked include substantial uncommitted work from a previous session. The pattern is consistent with the previous session shipping code without committing.

### Per-PR ship status

| PR | Spec check | Actual state | Verdict |
|---|---|---|---|
| PR-A | `FOLLOWUP_TICKETS.md #64 → CLOSED audit-correction` | Modified; #64 closed | ✅ SHIPPED |
| PR-B | Pass 3 close-outs done; Pass 4 close-outs pending | Pass 3 done; Pass 4 close-outs pending | 🟡 PARTIAL |
| PR-C | `.strict()` Zod at `route.ts:12-23` | Already in place | 🔴 CANCELLED |
| PR-D | `route.ts:13` triple-gated | Confirmed | ✅ SHIPPED |
| PR-E | `SEED_ADMIN_PASSWORD` env var | Confirmed | ✅ SHIPPED |
| PR-F | `get-session.ts:124-138` restricts `x-admin-id` | Confirmed | 🟡 PARTIAL (audit log actorId review pending) |
| PR-G | 3 layers of defense for `ALLOW_DEV_PII_KEY` | Confirmed | ✅ SHIPPED |
| PR-H | `deploy-prod.sh` tag-based rollback + pipefail | Modified (uncommitted) | 🟡 PARTIAL (untested) |
| PR-I | `ecosystem.config.js` cluster mode | Confirmed | ✅ SHIPPED |
| PR-J | `Rider.pickupHubId` etc. (FK cols) | Confirmed (from PR-P3.2) | 🟡 PARTIAL (legacy cols still present) |
| PR-K.1 | `RiderLifecycleStage` enum | Not started | ⚪ PENDING |
| PR-L | `app_provider.dart` is a stub | 71-line Riverpod facade | ✅ SHIPPED |
| PR-M | Phase 3 Low bulk | Not started | ⚪ PENDING |
| PR-N | Trivial/cosmetic batch | Not started | ⚪ PENDING |
| PR-O | admin web small-screen splits | Not started | ⚪ PENDING |
| PR-P | Admin UI for restore | Not started | ⚪ PENDING |
| PR-Q | `form_widgets.dart:18` uses `AppColors.warning` | Confirmed | ✅ SHIPPED |
| PR-R | `pre_dashboard_screen.dart` watches `isPollingTimedOut` | Confirmed + banner widget | ✅ SHIPPED |
| PR-S | 5 Rider child tables | Not started | ⚪ PENDING |
| PR-T | `go_router` in `pubspec.yaml` | Not started | ⚪ PENDING |

### Pre-merge verification needed

Before committing the 8 shipped-but-uncommitted PRs, run:
```bash
# Web
cd D:/voltium/web
$env:ENABLE_TEST_OTP='false'
$env:ENABLE_DEV_ADMIN_LOGIN='false'
npm run typecheck
npm run lint
npm run test:unit

# Flutter
cd D:/voltium/flutter
flutter analyze
flutter test
```

**Note:** The `vitest` reporter is currently broken (`Failed to load url basic`); fix this before running the test suite. Likely a vitest version-mismatch or missing `vitest-basic-reporter` package. PR-B should include this as a doc note.

### Stash & working-tree state

Two stashes exist (`stash@{0}`, `stash@{1}`) from a previous session. The current working tree (979 modified files) appears to be a different in-progress work, not the stashed content. **Recommendation:** before committing the 9 uncommitted PRs, decide whether to commit the current working tree first or apply stashes on top. This is a 10-15 min decision that affects whether the next commit is clean or mixed.

### Action list

1. **TODAY (1-2 hr):** Run pre-merge verification; commit PR-A, PR-D, PR-E, PR-G, PR-L, PR-Q, PR-R as a single batch. PR-I can be in the same commit.
2. **TODAY (30 min):** Finish PR-B Pass 4 close-outs (10 stale audit claims to close in docs).
3. **TODAY (1 hr):** PR-H staging dry-run smoke test; commit if passes.
4. **THIS WEEK:** Schedule PR-K.1 (lifecycle enum add) + PR-S design review.
5. **THIS WEEK:** Fix the `vitest` reporter issue so `npm run test:unit` runs.
6. **NEXT WEEK (Week 2):** PR-K.1 ships to staging; PR-S child tables start. PR-J staging-soak gating depends on PR-P3.2 1-wk soak completing.
7. **WEEK 3-4:** PR-K.1 1-wk soak; PR-S code (5-7 days); PR-J ships (drop legacy cols); Track 4 polish (PR-M, PR-N).
8. **WEEK 4+:** PR-S 1-wk soak; PR-K.2 (Flutter reads); PR-T (router refactor, 1-2 weeks) starts in parallel.

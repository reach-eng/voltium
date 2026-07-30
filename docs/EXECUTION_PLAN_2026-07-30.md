# Voltium Execution Plan — 2026-07-30 (post Pass 4)

**Date:** 2026-07-30
**Sources merged:**
- [`FIX_PLAN.md`](./FIX_PLAN.md) — original 17-PR plan, 4 tracks
- [`AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md) — Pass 4 stale-claim corrections
- [`BACKLOG_FINDINGS.md`](./BACKLOG_FINDINGS.md) — current dashboard (Pass 4 numbers)
- [`FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) — 65 tickets (Pass 4 close-outs: 16 stale)

**Audience:** the team only. PM/CTO not in the loop.
**Goal:** one document that tells you "what to ship, in what order, in what week, with what gates" — covering every Pass 4 still-real finding.

---

## TL;DR

**11 of 95 Top 10 audit P0s are still real after Pass 4.** Of those, **7 are already in FIX_PLAN.md** (PRs C, D, G, H, J, K). **4 are NOT in FIX_PLAN.md** and need new PRs (PR-Q through PR-T). The other 7 audit-correction closures are doc-only work that extends existing PR-A and PR-B.

**Updated PR list:** 17 original (FIX_PLAN.md) + 4 new (Pass 4 deltas) = **21 PRs over 4 weeks**.

**Staging-soak choreography is unchanged** — 4 weeks total, with soaks running in parallel with focused work. Calendar cost is still the longest single soak (~1 week), not the sum.

**Net work:** 11 real P0s + 21 PRs + 16 audit-correction doc closures = 4 weeks focused work, parallelizable across 2 contributors.

---

## How to read this plan

| Layer | Doc | What it has |
|---|---|---|
| **1. High-level (this doc)** | EXECUTION_PLAN_2026-07-30.md | What to ship, when, in what order, with what gates |
| **2. Per-PR detail** | FIX_PLAN.md | Code change sketches, test plan, acceptance criteria, files to touch |
| **3. Current state** | BACKLOG_FINDINGS.md | Dashboard of every finding + status |
| **4. Tickets** | FOLLOWUP_TICKETS.md | `gh issue create`-ready tickets |
| **5. Per-audit verdict** | AUDIT_VERIFICATION_4_2026-07-30.md | Top 10s with file:line evidence |

If you only read one doc, read this one. If you want to do a specific PR, read FIX_PLAN.md §[PR-X].

---

## Table of contents

1. [The 4 Pass 4 deltas — what's NEW since FIX_PLAN.md](#1-the-4-pass-4-deltas)
2. [Updated PR list — 21 PRs across 4 tracks](#2-updated-pr-list)
3. [Calendar — 4 weeks, with parallel soaks](#3-calendar)
4. [PR-A and PR-B extension — close 6 stale, not 3](#4-pr-a-and-pr-b-extension)
5. [NEW PR-Q: ChipWidget default `Colors.amber` (P0, 30 min)](#5-pr-q)
6. [NEW PR-R: Polling timeout UI surface (P1, 1 day)](#6-pr-r)
7. [NEW PR-S: Rider model decomposition (P0 architectural, 5-7 days)](#7-pr-s)
8. [NEW PR-T: Router state-machine refactor (P0 architectural, 1-2 weeks)](#8-pr-t)
9. [What NOT to do — anti-patterns from Pass 3/4](#9-what-not-to-do)
10. [Test + typecheck + coverage requirements](#10-test-coverage-requirements)
11. [Risk register updates](#11-risk-register-updates)

---

## 1. The 4 Pass 4 deltas

Pass 4 verification found 11 still-real findings. Mapping to FIX_PLAN.md:

| # | Pass 4 finding | FIX_PLAN.md PR | Status |
|---|---|---|---|
| 1 | AUDIT_API_DEEP #2 — `/api/device/{data,permissions}` dev-bypass (narrow) | **PR-D** | Already in plan |
| 2 | AUDIT_DATABASE #2.1 — Rider 60+ columns, decomposition pending | **NEW PR-S** | NOT in plan |
| 3 | AUDIT_DATABASE #2.10-2.12 — drop legacy `pickupHub`/`currentPlan`/`teamLeader` | **PR-J** | Already in plan |
| 4 | AUDIT_DATABASE #2.8 — RiderLifecycleStatus 15 values, no TERMINATED | **PR-K** | Already in plan |
| 5 | AUDIT_INFRASTRUCTURE #3.1 — `git revert HEAD` rollback | **PR-H** | Already in plan |
| 6 | AUDIT_INFRASTRUCTURE #3.11 — no `set -o pipefail` | **PR-H** (batched) | Already in plan |
| 7 | AUDIT_RIDERAPP #1.1 — router 30-state state machine | **NEW PR-T** | NOT in plan |
| 8 | AUDIT_RIDERAPP #1.3 — polling timeout no UI surface | **NEW PR-R** | NOT in plan |
| 9 | AUDIT_SECURITY #3.3 — `decryptPii` pass-through fallback | **PR-G** (extends scope) | Already in plan |
| 10 | AUDIT_SECURITY #4.4 — `SENSITIVE_PATTERNS` only 2 patterns | **PR-G** (batched) | Already in plan |
| 11 | AUDIT_DESIGN_SYSTEM #5.1 — `ChipWidget` default `Colors.amber` | **NEW PR-Q** | NOT in plan |

**3 of 11 are NOT in FIX_PLAN.md** (Rider decomposition, router rewrite, ChipWidget, polling UI). These need new PRs.

The 4 new PRs are: **PR-Q, PR-R, PR-S, PR-T**.

---

## 2. Updated PR list

**21 PRs total** (17 original + 4 new), organized into 4 tracks.

### Track 1: Audit corrections + zero-risk (PR-A through PR-G + PR-Q) — 1 day focused

| PR | Title | Source | Severity | Effort | Notes |
|---|---|---|---|---|---|
| **PR-A** | OutboxService.emit verification + #64 close-out | Pass 3 | doc-only | 1 hr | Extend to also close 3 more Pass 4 stale claims |
| **PR-B** | Audit-corrections — close 6 stale tickets | Pass 3+4 | doc-only | 1 hr | Was 3 stale, now 6 (Pass 4 added 3 more) |
| **PR-C** | #58 rental/return mass-assignment (STALE per Pass 4) | API_DEEP | doc-only | 30 min | **Cancelled** — Pass 4 re-grep shows `.strict()` Zod already in place. Just close as audit-correction in PR-B. |
| **PR-D** | #55 TEST_MODE dev-bypass hardening | API_DEEP | P0 | 30 min | Real, narrow (triple-gated) |
| **PR-E** | #54 seed.ts admin123 production-blocker | DB | P0 | 1 hr | Throw in production |
| **PR-F** | #61 actorId from x-admin-id header | BACKEND | P2 | 2 hr | Restrict to `/api/admin/impersonate*` |
| **PR-G** | #50 ALLOW_DEV_PII_KEY full reject + #3.3 + #4.4 hardening | SECURITY | P0 | 1.5 hr | Extends to also fix `decryptPii` pass-through + `SENSITIVE_PATTERNS` (Pass 4 surfaced) |
| **PR-Q** | ChipWidget default `Colors.amber` | DESIGN | P0 | 30 min | NEW — use `AppColors.warning` |

**Track 1 net: 7 active PRs, 1 cancelled (PR-C), 1 new (PR-Q). ~7 hours focused.**

### Track 2: Infra (PR-H + PR-I) — 1-2 days focused + 2-3 days staging soak

| PR | Title | Source | Severity | Effort | Notes |
|---|---|---|---|---|---|
| **PR-H** | #40 deploy script tag-based rollback + pipefail + audit | INFRA | P0 | 5 hr | Was 4 hr; extended per Pass 4 §3.11 (`set -o pipefail`) and §3.13 (explicit exit code check) |
| **PR-I** | #39 PM2 cluster mode + timeouts (already partially shipped per Pass 4) | INFRA | P0 | 0.5 day | Pass 4 confirmed cluster mode already in `ecosystem.config.js`; just verify + bump cluster docs |

**Track 2 net: 2 PRs, ~1.5 days focused + 48h staging soak.**

### Track 3: DB (PR-J + PR-K + PR-S) — 5-7 days focused + 2-3 weeks staging soak

| PR | Title | Source | Severity | Effort | Notes |
|---|---|---|---|---|---|
| **PR-J** | #7 sub-B — drop legacy `pickupHub`/`currentPlan`/`teamLeader` | DB | P0 | 1 day + 1-wk soak | Gated on PR-P3.2 staging soak completing |
| **PR-K.1** | #6 add `RiderLifecycleStage` enum + new column | DB | P1 | 2 days + 1-wk soak | The 15-value `RiderLifecycleStatus` enum split into 5 stage values + per-step |
| **PR-K.2** | #6 Flutter reads `lifecycleStage` | DB | P1 | 0.5 day + 1-wk soak | After PR-K.1 soak |
| **PR-K.3** | #6 drop legacy `lifecycleStatus` enum | DB | P1 | 0.5 day | After PR-K.2 soak |
| **PR-S** | Rider model child-table decomposition (RiderPickupPhotos, RiderPermissions, RiderDevice, RiderLocation, RiderOnboarding) | DB | P0 architectural | 5-7 days + 1-wk soak | NEW — addresses AUDIT_DATABASE #2.1 (Rider 60+ columns) |

**Track 3 net: 5 PRs (3 for K + 1 for J + 1 for S), ~10-13 days focused + 3-4 weeks staging soak (parallel).**

### Track 4: Flutter + polish (PR-L + PR-M + PR-N + PR-O + PR-P + PR-R + PR-T) — 1-2 weeks focused, parallel

| PR | Title | Source | Severity | Effort | Notes |
|---|---|---|---|---|---|
| **PR-L** | #65 AppProvider stub | RIDERAPP | P1 | 1 day | Unblocks `flutter analyze` |
| **PR-M** | Phase 3 Low bulk (#4, #5, #9, #16, #17, #22, #23, #25, #26, #29-#33) | Phase 3 | Low | 3-5 days | Bulk cleanup |
| **PR-N** | Trivial/cosmetic batch (120 items, 6 PRs) | All | P3 | 12-15 hr | Polish |
| **PR-O** | #21 admin web small-screen splits | ADMIN | Low | 2-4 weeks | Multi-PR, can run in parallel |
| **PR-P** | #59 follow-up — Admin UI for restore | API | P0 partial | 1 day | v2 |
| **PR-R** | Polling timeout UI surface | RIDERAPP | P1 | 1 day | NEW — Pass 4 surfaced |
| **PR-T** | Router state-machine refactor (30 states → Navigator-based) | RIDERAPP | P0 architectural | 1-2 weeks | NEW — biggest item not in plan |

**Track 4 net: 7 PRs, ~3-5 weeks focused, parallelizable. PR-T is the biggest single item; PR-N is the cheapest to ship for cumulative polish.**

### Cancelled (Pass 4 audit-correction)

| PR | Title | Reason |
|---|---|---|
| ~~PR-C~~ | #58 rental/return mass-assignment | Pass 4: `.strict()` Zod allowlist already in place at `route.ts:12-23`. The audit was wrong. Just close as audit-correction in PR-B. |

---

## 3. Calendar — 4 weeks, with parallel soaks

Staging soaks are the bottleneck. 4 weeks of calendar time, with focused work running in parallel.

```
Week 1 (Mon-Fri)
├── Track 1: PR-A → PR-B → PR-D → PR-E → PR-F → PR-G → PR-Q (all 1 day, in any order)
├── Track 2 prep: PR-H code complete by Wed; apply to staging Wed evening
├── Track 3 prep: PR-S design review + child-table schema design (parallel with Track 1)
├── Track 4: PR-L + PR-R (1 day each; PR-L first to unblock flutter analyze)
└── Track 4: PR-N PR-1 (smallest trivial batch)

Week 2
├── Track 1 wrap: any spillover from PR-G (decryptPii hardening is the slowest)
├── Track 2: PR-H 48h soak completes Mon; promote to prod. PR-I code complete by Tue; apply to staging.
├── Track 3: PR-S code (Rider child tables) start Wed. PR-K.1 (lifecycle enum add) start Thu.
├── Track 4: PR-M (Phase 3 Low bulk) start in parallel
└── Staging soak: PR-P3.2 (1-wk soak) completes Mon → PR-J can ship next week

Week 3
├── Track 2: PR-I 48h soak completes Mon; promote to prod
├── Track 3: PR-J ships Mon (1-wk soak of PR-P3.2 completed); staging soak starts
├── Track 3: PR-K.1 staging soak continues
├── Track 4: PR-M continues; PR-T (router refactor) can start in parallel
└── Track 4: PR-N PR-2 (second trivial batch)

Week 4
├── Track 3: PR-J 1-wk soak completes Mon; promote to prod (sub-B done)
├── Track 3: PR-K.1 1-wk soak completes Wed; PR-K.2 (Flutter reads) ships Thu; staging soak starts
├── Track 3: PR-S code continues (the big refactor)
├── Track 4: PR-O (admin screen splits) and PR-T (router) continue
└── Track 4: PR-N PR-3 (third trivial batch)

Week 5 (if needed for PR-S + PR-T)
├── Track 3: PR-K.2 1-wk soak completes; PR-K.3 (drop legacy) ships
├── Track 3: PR-S 1-wk soak completes
├── Track 4: PR-T (router) continues
└── Track 4: PR-N PR-4 (fourth trivial batch)
```

**Calendar cost: 4 weeks** (with optional Week 5 for PR-S + PR-T if not finished).

**Effort: ~22-28 focused days** across 2 contributors, with staging soaks running in parallel.

---

## 4. PR-A and PR-B extension

### PR-A: OutboxService.emit verification + audit-correction close-out (1 hr, doc-only)

**Original scope:** Re-verify OutboxService.emit claim from Pass 3, close #64.

**Pass 4 extension:** Pass 4 found that 3 more Pass 3 stale claims are still listed as "open" in the docs:
- AUDIT_API_DEEP #1 (webhook dev grant) — STALE per Pass 4
- AUDIT_DESIGN_SYSTEM #3.1 (primary color mismatch) — STALE per Pass 4
- AUDIT_DESIGN_SYSTEM #4.1 (AppColors.primary contradicts spec) — STALE per Pass 4

**Updated PR-A scope (still 1 hr):**
1. Re-read `wallet.use-cases.ts:293, 332` and `kyc.use-cases.ts:90, 102` to confirm `tx` is passed
2. Update `FOLLOWUP_TICKETS.md` #64 → CLOSED as audit-correction
3. Update `AUDIT_VERIFICATION_3_2026-07-30.md` §3.1 → STALE
4. Update `AUDIT_VERIFICATION_4_2026-07-30.md` §1 (API_DEEP #1, DESIGN #3.1/4.1) → STALE
5. Add comment block to `wallet.use-cases.ts` documenting the correct pattern (no code change)

### PR-B: Audit-corrections — close 6 stale tickets (1 hr, doc-only)

**Original scope:** Close 3 stale Pass 3 questions (#61 if re-verified, #55 if re-verified, #9 if re-verified).

**Pass 4 extension:** Pass 4 found 3 more stale audit claims:
- AUDIT_API_DEEP #5 (rental/return mass-assignment) — STALE per Pass 4
- AUDIT_API_DEEP #6 (data-deletion no audit) — STALE per Pass 4 (already SHIPPED via #59)
- AUDIT_API_DEEP #9, #10 (worker auth, jobs permission) — STALE per Pass 4 (already SHIPPED via #60)
- AUDIT_DATABASE #2.2 (lockPassword plaintext) — STALE per Pass 4
- AUDIT_SECURITY #3.1 (ALLOW_DEV_PII_KEY), #4.1 (maskEmail) — STALE per Pass 4

**Updated PR-B scope (still 1 hr):**
1. Update `FOLLOWUP_TICKETS.md`:
   - #58 → CLOSED as audit-correction (was P0; Pass 4 shows it's already shipped)
   - #59 → CONFIRMED SHIPPED (Pass 4 verified)
   - #60 → CONFIRMED SHIPPED (Pass 4 verified)
2. Update `AUDIT_VERIFICATION_4_2026-07-30.md` §1 (API_DEEP #5, #6, #9, #10) → STALE
3. Update `AUDIT_VERIFICATION_4_2026-07-30.md` §3 (DATABASE #2.2) → STALE
4. Update `AUDIT_VERIFICATION_4_2026-07-30.md` §8 (SECURITY #3.1, #4.1) → STALE
5. Add note to `FOLLOWUP_TICKETS.md` "Stale claims" section

**Note:** PR-C (#58 rental/return mass-assignment) is **CANCELLED** as a code PR. The fix is already in place per Pass 4 re-grep. PR-B handles the close-out.

---

## 5. NEW PR-Q: ChipWidget default `Colors.amber` (P0, 30 min)

**Audit source:** AUDIT_DESIGN_SYSTEM.md §5.1
**Severity:** P0 (visual inconsistency with design system)
**Effort:** 30 minutes

**Why it matters:**
`widgets/form_widgets.dart:18` has `final Color color = Colors.amber;` as a default. This bypasses the design system's `AppColors.warning = #F59E0B`. Two warning yellows in the codebase = visual inconsistency.

**Files to touch:**
- `flutter/lib/widgets/form_widgets.dart` (line 18) — change default to `AppColors.warning`
- `flutter/test/widgets/form_widgets_test.dart` (new) — test that the default color is `AppColors.warning`

**Code change:**
```dart
// Before
final Color color = Colors.amber;

// After
final Color color = AppColors.warning;  // #F59E0B
```

**Test:**
```dart
testWidgets('ChipWidget defaults to AppColors.warning', (tester) async {
  await tester.pumpWidget(
    const MaterialApp(home: Scaffold(body: ChipWidget(label: 'test'))),
  );
  final chip = tester.widget<Chip>(find.byType(Chip));
  expect(chip.backgroundColor, AppColors.warning);
});
```

**Acceptance criteria:**
- [ ] `ChipWidget` default color is `AppColors.warning`
- [ ] All existing widget tests still pass
- [ ] `flutter analyze` clean
- [ ] No visual regression in any of the 33 E2E tests

**Effort:** 30 min focused.

---

## 6. NEW PR-R: Polling timeout UI surface (P1, 1 day)

**Audit source:** AUDIT_FINDINGS_RIDERAPP.md §1.3
**Severity:** P1 (UX issue, not security)
**Effort:** 1 day

**Why it matters:**
`RiderProvider._onboardingPoller` (line 87-91) runs for 2 hours (240 polls × 30s active). If polling times out (e.g. backend never approves the rider), the rider sees the same "waiting for approval" screen for 2 hours and then... nothing changes. No error, no UI surface for the timeout.

The provider has `_isPollingTimedOut` getter (line 88-89) but no UI surface uses it.

**Files to touch:**
- `flutter/lib/core/state/rider_provider.dart` (line 87-91) — already has `_isPollingTimedOut`
- `flutter/lib/features/dashboard/presentation/screens/pre_dashboard_screen.dart` — wire the timeout state to UI
- `flutter/test/core/state/rider_provider_timeout_test.dart` (new) — test the timeout state
- `flutter/integration_test/e2e_individual/28_offline_indicator_test.dart` — extend to test timeout state

**Code change:**
```dart
// In pre_dashboard_screen.dart
@override
Widget build(BuildContext context) {
  final riderProvider = context.watch<RiderProvider>();

  if (riderProvider.isPollingTimedOut) {
    return _PollingTimeoutView(
      onRefresh: () => riderProvider.refresh(),
      onContactSupport: () => Navigator.pushNamed(context, '/support'),
    );
  }

  return _WaitingForApprovalView(/* ... existing ... */);
}

class _PollingTimeoutView extends StatelessWidget {
  // "Still waiting for approval after 2 hours?
  //  Pull to refresh, or contact support."
  // Add a refresh button and a "Contact support" link.
}
```

**Test:**
```dart
test('RiderProvider times out after 240 polls and sets _isPollingTimedOut', () async {
  // Mock PollingManager.onTick to always return null (no state change)
  // Advance fake clock by 240 × 30s = 7200s
  // Assert isPollingTimedOut == true
});
```

**Acceptance criteria:**
- [ ] `pre_dashboard_screen.dart` shows timeout UI after 2 hours
- [ ] Refresh button restarts polling
- [ ] Contact support link opens support screen
- [ ] No regression in 33 E2E tests
- [ ] `flutter analyze` clean

**Effort:** 1 day focused.

---

## 7. NEW PR-S: Rider model decomposition (P0 architectural, 5-7 days)

**Audit source:** AUDIT_DATABASE.md §2.1
**Severity:** P0 architectural (the Rider model has 60+ columns; needs decomposition)
**Effort:** 5-7 days focused + 1-week staging soak

**Why it matters:**
Rider model has 60+ data fields. Every UPDATE writes the whole row (Postgres MVCC). Adding a new column requires migration on a wide table. Read patterns conflict: `SELECT phone, fullName` reads the full row due to Postgres heap layout.

**Files to touch:**
- `web/prisma/schema.prisma` — add 5 new 1:1 child tables
- `web/prisma/migrations/202607XX_rider_decomposition/migration.sql` (new)
- `web/src/lib/flatten-rider.ts` — update to JOIN across child tables
- `web/src/server/modules/riders/*.use-cases.ts` — update writers to use child tables
- `web/tests/unit/rider-decomposition-migration.test.ts` (new)

**Schema change:**
```prisma
// New child tables (1:1 with Rider)

model RiderPickupPhotos {
  riderId              String  @id
  front                String?
  back                 String?
  left                 String?
  right                String?
  withVehicle          String?
  rider                Rider   @relation(fields: [riderId], references: [id], onDelete: Cascade)
  @@map("rider_pickup_photos")
}

model RiderPermissions {
  riderId              String  @id
  locationGranted      Boolean @default(false)
  batteryGranted       Boolean @default(false)
  contactsGranted      Boolean @default(false)
  callLogsGranted      Boolean @default(false)
  micGranted           Boolean @default(false)
  cameraGranted        Boolean @default(false)
  phoneGranted         Boolean @default(false)
  lastDeviceViolationAt DateTime?
  deviceViolationCount Int     @default(0)
  rider                Rider   @relation(fields: [riderId], references: [id], onDelete: Cascade)
  @@map("rider_permissions")
}

model RiderDevice {
  riderId              String  @id
  fcmToken             String?
  isAdminLocked        Boolean @default(false)
  lockPasswordHash     String?
  isUninstallBlocked   Boolean @default(true)
  isLocationMandatory  Boolean @default(true)
  isAppsControlRestricted Boolean @default(true)
  deviceAdminGranted   Boolean @default(false)
  displayOverlayGranted Boolean @default(false)
  batteryLevel         Int     @default(100)
  rider                Rider   @relation(fields: [riderId], references: [id], onDelete: Cascade)
  @@map("rider_device")
}

model RiderLocation {
  riderId      String    @id
  lastKnownLat Float?
  lastKnownLng Float?
  lastLocationAt DateTime?
  rider        Rider     @relation(fields: [riderId], references: [id], onDelete: Cascade)
  @@map("rider_location")
}

model RiderOnboarding {
  riderId           String    @id
  pickupHubId       String?
  currentPlanId     String?
  planStartDate     DateTime?
  planEndDate       DateTime?
  advanceRentPaid   Boolean   @default(false)
  preferredShift    String?
  teamLeaderId      String?
  emergencyContact  String?
  planRejectionReason String?
  rider             Rider     @relation(fields: [riderId], references: [id], onDelete: Cascade)
  // FKs to Hub, RentalPlan, TeamLeader use the existing PR-P3.2 columns
  @@map("rider_onboarding")
}
```

**Migration strategy:**
1. ADD child tables with all columns nullable
2. Backfill from `riders` (one-time COPY)
3. Drop legacy columns from `riders`
4. Add NOT NULL constraints where appropriate

**Code change (in flatten-rider.ts):**
```typescript
// Before: SELECT * FROM riders WHERE id = ?
// After:
const rider = await db.rider.findUnique({
  where: { id: riderDbId },
  include: {
    pickupPhotos: true,
    permissions: true,
    device: true,
    location: true,
    onboarding: { include: { pickupHubRef: true, currentPlanRef: true, teamLeaderRef: true } },
  },
});

// Flatten in the response (existing flatten-rider.ts logic still works)
return flattenRider(rider);
```

**Migration risk:** HIGH. The Rider table is read by 100+ use-cases. Every one needs to be updated.

**Mitigation:**
- Deploy child tables as nullable (additive, no data movement)
- Backfill in a single transaction (10 min on 50k rows)
- Run writer migrations in batches (don't update all use-cases at once)
- Staging soak for 1 week

**Test:**
- Unit test for `flatten-rider.ts` with mocked child tables
- Integration test that reads + writes each child table
- Migration test that ADD+UPDATE+DROP+RENAME works on synthetic 1k rows

**Acceptance criteria:**
- [ ] 5 child tables created with backfill
- [ ] All use-case writers updated
- [ ] `flatten-rider.ts` JOINs across child tables
- [ ] `npm run test:unit` 1411+ still pass
- [ ] Staging soak 1 week passes
- [ ] No regression in 33 E2E Flutter tests

**Effort:** 5-7 days focused + 1-wk staging soak.

---

## 8. NEW PR-T: Router state-machine refactor (P0 architectural, 1-2 weeks)

**Audit source:** AUDIT_FINDINGS_RIDERAPP.md §1.1
**Severity:** P0 architectural (router is a 30-state state machine in `setState`, 23 KB of state-driven UI)
**Effort:** 1-2 weeks focused

**Why it matters:**
`app/router.dart` (12 KB) + `app/router_body.dart` (15 KB) + `app/app_state.dart` define a 30-value `AuthState` enum. The router doesn't push routes — it just rebuilds the entire scaffold body in a giant `switch` on `_currentState`. Pickup data is held in the router rather than in a flow-specific provider, so a 9-field update requires a router-level setState. Adding a new screen means adding a new `case` in three places.

**Approach:**
Two options:
1. **Migrate to `go_router`** (1-2 weeks) — typed declarative routes
2. **Hand-rolled Navigator-based router** (2-3 weeks) — full control

Recommend go_router for time-to-value.

**Files to touch:**
- `pubspec.yaml` — add `go_router: ^14.0.0`
- `flutter/lib/app/router.dart` — replace with `GoRouter` config
- `flutter/lib/app/router_body.dart` — delete; logic moves to per-screen providers
- `flutter/lib/app/app_state.dart` — keep AuthState enum, but no longer drive the router
- `flutter/lib/features/pickup/providers/pickup_flow_provider.dart` (new) — extract pickup data from router
- `flutter/lib/features/auth/presentation/rider_lifecycle_gate.dart` — keep as the redirect logic
- All `Navigator.push` call sites — update to use `context.go()` / `context.push()`
- 33 E2E tests — update `navigateToTab` helpers to use go_router

**Migration strategy:**
1. Add `go_router` dependency
2. Define typed route constants (`class Routes { static const login = '/login'; }`)
3. Migrate the auth flow first (splash → legal → permissions → login → OTP → dashboard)
4. Migrate onboarding next (pre_dashboard, KYC, guarantor, deposit, plan)
5. Migrate main app flow last (dashboard, wallet, profile, support, settings)
6. Delete `app/router_body.dart` once all branches are converted
7. Update 33 E2E tests to use `context.go('/dashboard')` instead of tap-based navigation

**Test:**
- Unit test for each route's redirect logic
- E2E test that all 33 paths still work
- `flutter analyze` clean

**Acceptance criteria:**
- [ ] `go_router` is the only router
- [ ] `app/router_body.dart` deleted
- [ ] Pickup data is in `PickupFlowProvider`, not the router
- [ ] All 33 E2E tests pass
- [ ] `flutter analyze` clean
- [ ] No visual regression in the auth → onboarding → dashboard flow

**Effort:** 1-2 weeks focused. Recommend a second contributor so PR-T doesn't block PR-L/PR-R/PR-M.

---

## 9. What NOT to do — anti-patterns from Pass 3/4

Lessons from the verification passes that bit us:

1. **Don't mark a finding "STILL TRUE" without re-grepping the file.** Pass 3 and Pass 4 combined found 16 audit-side errors because verdicts were inferred from doc snapshots, not actual file reads. Every PR-A/PR-B/PR-anything close-out must include a `file:line` re-grep.

2. **Don't ship PRs that "look like" the audit's fix without re-reading the audit.** AUDIT_API_DEEP #1 (webhook dev grant) — Pass 4 found the actual code was already fail-closed. We would have shipped a duplicate fix if we hadn't re-grepped.

3. **Don't assume "P0" means "ship a P0 PR."** Sometimes the P0 is already shipped, and the work is just doc cleanup (PR-B is 1 hour of doc updates, not a code PR).

4. **Don't batch audit-corrections into code PRs.** PR-C (#58 rental/return) was cancelled because the fix is already in place. The audit-correction lives in PR-B (doc-only). Keep them separate so reviewers don't get confused.

5. **Don't extend PR-G's scope to "every PII hardening" — it already covers #3.3, #4.4, and #50. Adding more dilutes the review.** Each hardening gets its own line in PR-G's diff, but the PR is one PR, not 3.

6. **Don't trust `Test-Path` for file existence when there's a worktree involved.** AUDIT_FINDINGS_RIDERAPP #1.4 said `app_provider.dart` was missing; in fact it was 935 bytes. Re-grep with `Get-ChildItem` before declaring "missing".

---

## 10. Test + typecheck + coverage requirements

Every PR must:
- Pass `npm run typecheck` (web)
- Pass `npm run lint` (web)
- Pass `flutter analyze` (Flutter)
- Add unit tests for new code (85% line coverage minimum)
- Not reduce overall coverage (current: 1598 passing)
- All 33 E2E tests still pass

**Coverage gate:** 85% lines for all new code. PR-P3.5 had CI failure when this dropped.

**Test schema:** After schema changes, must run:
```powershell
$env:DATABASE_URL='postgresql://voltium_user:voltium_pass@localhost:5432/voltium_dev?schema=test'
npx prisma db push --accept-data-loss --skip-generate
```

**Build env vars:** `ENABLE_TEST_OTP=false`, `ENABLE_DEV_ADMIN_LOGIN=false` (matches existing CI config).

---

## 11. Risk register updates

From FIX_PLAN.md §21, with Pass 4 deltas:

| PR | Risk | Mitigation |
|---|---|---|
| **PR-A** | None — doc-only | — |
| **PR-B** | None — doc-only | — |
| **PR-D** | Low — narrow env hardening | Triple-gated check; won't break existing dev workflow |
| **PR-E** | Low — throw in production | Already in test env; just add prod branch |
| **PR-F** | Medium — restrict `x-admin-id` to impersonate routes | **Mitigation:** grep for `x-admin-id` first to confirm only impersonation uses it |
| **PR-G** | Low — PII hardening | Each fix is additive; existing data is unaffected |
| **PR-H** | Medium — deploy script changes | Test on staging first; manual smoke test after rollback |
| **PR-I** | Low — already partially shipped per Pass 4 | Just verify staging behavior matches cluster expectations |
| **PR-J** | High — drops legacy columns | Gated on PR-P3.2 1-wk staging soak |
| **PR-K.1/2/3** | High — enum split, 3-PR sequence | Each step has 1-wk staging soak |
| **PR-L** | Low — stub class | Unblocks flutter analyze; no production impact |
| **PR-M** | Low — bulk cleanup | Each change is small; easy to bisect |
| **PR-N** | None — cosmetic | — |
| **PR-O** | Low — admin screen splits | Multi-PR; can ship incrementally |
| **PR-P** | Low — admin UI | Just adds a button + modal |
| **PR-Q** | Low — single default color change | Easy to revert if visual regression |
| **PR-R** | Low — UI state surface | Affects pre_dashboard only; easy to revert |
| **PR-S** | **VERY HIGH** — Rider decomposition, 100+ use-cases affected | **MUST** go to staging first; manual smoke test on every flow; rollback plan: legacy columns kept for 1 release cycle |
| **PR-T** | **HIGH** — router refactor, 33 E2E tests affected | All E2E tests need re-baselining; recommend 1-2 weeks of parallel work with another contributor |

**Critical:** PR-S is the highest-risk single PR in the entire plan. The Rider model is read by 100+ use-cases. The migration strategy is **additive first, then backfill, then drop** — this gives us a 1-week window where the legacy columns are still there and we can roll back by just removing the JOINs.

---

## Action items (next steps)

1. **Update `FIX_PLAN.md` §2** to reflect the 4 new PRs (Q, R, S, T) and the cancellation of PR-C.
2. **Update `FOLLOWUP_TICKETS.md`** to add tickets for PR-Q, PR-R, PR-S, PR-T (as #66, #67, #68, #69).
3. **Land PR-A first** (1 hr, doc-only) — proves the pattern, gets the team in flow.
4. **Land PR-B in parallel with PR-A** (1 hr, doc-only) — closes 6 stale claims.
5. **Land PR-D, PR-E, PR-F, PR-G, PR-Q** as a Track 1 batch (3-4 hours focused).
6. **PR-S is gated** on having 1-2 weeks of dedicated time + a second contributor to handle the support load. Schedule for Week 4-5, NOT Week 1.
7. **PR-T is the largest single item** — schedule for Week 4+, parallel with PR-S.

---

## Summary

| Track | PRs | Effort | Calendar |
|---|---|---|---|
| **Track 1** (audit corrections + small P0s) | PR-A, B, D, E, F, G, Q | ~7 hours | Week 1 |
| **Track 2** (infra) | PR-H, I | ~1.5 days + 2-3 days soak | Week 1-2 |
| **Track 3** (DB) | PR-J, K.1-3, S | ~10-13 days + 3-4 weeks soak | Week 2-5 |
| **Track 4** (Flutter + polish) | PR-L, M, N, O, P, R, T | ~3-5 weeks (parallel) | Week 1-5 |
| **Total** | **21 PRs** | **~22-28 focused days** | **4-5 weeks** |

**For 2 contributors in parallel:** 22-28 days / 2 = ~11-14 days each.
**For 1 contributor:** 22-28 days = 4-5 weeks.

The single biggest item is **PR-T (router refactor)** at 1-2 weeks. The single highest-risk item is **PR-S (Rider decomposition)** at 5-7 days + 1-wk soak. **Recommend: assign PR-T to one contributor, PR-S to the other, run in parallel Week 2-4.**

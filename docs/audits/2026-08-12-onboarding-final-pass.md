# Voltium onboarding flow — final pre-release audit

**Audit date:** 2026-08-12
**Auditor:** general-purpose worker (manual deep-read of source)
**Scope:** Post-fix verification of the onboarding/lifecycle path before the user's first device walk-through. Rider `8999999999 / +918999999999 / cmsptwbhm00k5rizo8z3ysykm` is the test subject — server has `lifecycleStatus = 'ACTIVE'` but `lifecycleStage = 'NEW'` (data inconsistency from the archived `fix-rider.js` debug script).

This pass focuses on the 12-point checklist the user provided and confirms whether the prior audit's fixes held, exposes anything new, and is written in user-visible language where possible.

---

## CRITICAL — must fix before any release

### C1. Server `accountStatus` reports `ACTIVE` at rank 10 (PICKUP_SCHEDULED) — overstates rider activity
- **Where:** `web/src/lib/flatten-rider.ts:86`
- **Bug:** `accountStatus: rank >= 10 ? 'ACTIVE' : rank >= 2 ? 'PRE_ACTIVE' : 'INACTIVE'`
  - At rank 10 (PICKUP_SCHEDULED) the rider is **not yet active** — they have submitted the pickup form and are waiting for admin to flip them to ACTIVE. The server tells the rider they are.
  - This contradicts `pickupDone` (line 80) which correctly uses `rank >= 11 || pickedUpAt`.
  - Same off-by-one in the threshold table that the prior fix moved to `rank >= 11` for `pickupDone` — the `accountStatus` line was missed.
- **Why it matters (user-visible):**
  - `flutter/lib/models/rider_model.dart:540` — `isActuallyActive` returns `true` for PICKUP_SCHEDULED riders (because `accountStatus == AccountStatus.active`).
  - This gates device-data sync (`flutter/lib/core/state/rider_provider.dart:263-266`) — a PICKUP_SCHEDULED rider starts syncing location/battery as if they were riding. Privacy + battery implication.
  - `flutter/lib/widgets/shell_banners.dart:106` and several dashboard-only widgets read `rider.accountStatus == AccountStatus.active` to decide whether to show "active" UI. A rider on hangTight would see dashboard surfaces tagged "active" in places they shouldn't.
- **Repro:** server-side `db.rider.update` to set `lifecycleStatus = 'PICKUP_SCHEDULED'` for any rider. Hit `/api/rider/dashboard`. The response's `accountStatus` is `"ACTIVE"`, but `pickupDone` is `false`. The Flutter app's `RiderModel.accountStatus` is `AccountStatus.active`.
- **Recommended fix (one line in `flatten-rider.ts:86`):**
  ```ts
  accountStatus: rank >= 11 ? 'ACTIVE' : rank >= 2 ? 'PRE_ACTIVE' : 'INACTIVE',
  ```
  Mirrors the `pickupDone` fix from the prior audit.
- **Ship as-is?** No. The downstream Flutter gating behavior is incorrect. Quick fix, low risk.

### C2. `flattenRiderPartial` reports `pickupDone = true` at rank 10 (PICKUP_SCHEDULED) — admin/debug data drift
- **Where:** `web/src/lib/flatten-rider.ts:218`
- **Bug:** `pickupDone: rank >= 10` — uses rank 10, while `flattenRider` (the production one) correctly uses `rank >= 11 || pickedUpAt`. Same off-by-one as C1 but on the `pickupDone` axis.
- **Production impact:** Currently zero — `flattenRiderPartial` is **only** imported by `web/check-flat-8999.js:2` (a debug script). No admin endpoint, no Flutter code path, no hot path uses it. Confirmed via `grep -r 'flattenRiderPartial' web/`.
- **Why it still matters:**
  - The function is exported and could be picked up by a future admin tool.
  - The drift between the two functions in the same file (`pickupDone` rank 10 vs 11, `accountStatus` rank 10 vs 11) means any new caller that reads the wrong one gets a different answer. Future tech-debt magnet.
- **Recommended fix (two lines in `flatten-rider.ts:211,218`):** bring `flattenRiderPartial` in line with `flattenRider`:
  ```ts
  accountStatus: rank >= 11 ? 'ACTIVE' : rank >= 2 ? 'PRE_ACTIVE' : 'INACTIVE',
  // ...
  pickupDone: rank >= 11,
  ```
  Or — better — delete `flattenRiderPartial` entirely. It's debug-only and `flattenRider` accepts both `RiderWithRelations` and `RiderPartial` shapes per its signature.
- **Ship as-is?** Yes (no production impact), but fix in the same PR as C1 so the file is self-consistent.

---

## HIGH — should fix this sprint

### H1. `RiderModel.==` does not include `kycStatus` — KYC row on hangTight can stay stale
- **Where:** `flutter/lib/models/rider_model.dart:288-315`
- **Bug:** The equality contract is `id, updatedAt, lifecycleStatus, pickupDone`. If the server changes the rider's `kycStatus` (e.g. admin approves KYC after the rider reached hangTight) **without bumping the rider's `updatedAt`**, `RiderModel.==` returns `true` and the `ref.watch(riderProvider.select((p) => p.rider))` on the hangTight screen does not fire.
- **Why the server doesn't bump `updatedAt` in this case:** `web/src/server/modules/riders/admin-riders.use-cases.ts:461-478` — when KYC is approved on a rider already past KYC rank (rank 5+), the rider row is updated with only `kycDoneAt`. Prisma's `@updatedAt` would still bump the field, so the rider row update *would* refresh `updatedAt`. But: in the same flow the rider row update is only made if `Object.keys(riderData).length > 0` (line 505) — and `riderData` for a post-KYC rider only contains `kycDoneAt`, which IS non-empty, so the update does fire. **Net effect:** `updatedAt` IS bumped for a post-KYC rider whose KYC is later approved. The watch fires.
  - However, for a rider already on hangTight who has deposit approved but the `riderData` is empty (only `walletData` updates fire), `updatedAt` is NOT bumped. Same for the guarantor approval flow. The watch stays silent.
- **User-visible impact:** The KYC row on hangTight says "KYC under review" even after admin approved it. Minor cosmetic issue, but the rider notices ("but the support agent said my KYC was approved an hour ago").
- **Recommended fix (adds 2 lines to `rider_model.dart:311-314` and `319-321`):**
  ```dart
  return other.id == id &&
      other.updatedAt == updatedAt &&
      other.lifecycleStatus == lifecycleStatus &&
      other.pickupDone == pickupDone &&
      other.kycStatus == kycStatus &&
      other.depositStatus == depositStatus;
  ```
  Mirrors the comment at line 294: the two fields the routing layer cares about plus the two fields the rider-facing status row cares about. `kycStatus` and `depositStatus` are the next-most-common reasons the hangTight status row would change while the rider is on it.
- **Ship as-is?** Yes, but document. This is a cosmetic staleness, not a stuck-state. The hangTight auto-redirect (the reason for the recent fix) is unaffected.

### H2. Suspended rider can be auto-redirected to dashboard via pre-dashboard's derived-getter redirect
- **Where:** `flutter/lib/features/dashboard/presentation/screens/legacy/pre_dashboard_screen.dart:63`
- **Bug:** The pre-dashboard auto-redirect checks `rider.isPickupDone` (the **derived getter**), not the raw `pickupDone` flag. The getter (rider_model.dart:528-531) is `pickupDone || assignedVehicle?.isNotEmpty || rank >= 11`.
  - For a SUSPENDED rider (rank 12) with `assignedVehicle` set, `isPickupDone` returns `true` → the pre-dashboard's auto-redirect fires → the rider is sent to `AuthState.dashboard`.
  - The hangTight screen fixed this by reading the raw `pickupDone` field instead of the getter (hang_tight_screen.dart:108 comment explains why). The pre-dashboard was not updated.
- **Why it matters:** `_lifecycleTargetToAuthState` maps `LifecycleTarget.suspended` → `AuthState.preDashboard` (router.dart:643-647). So a suspended rider does land on pre-dashboard, and the auto-redirect would immediately yank them off. The lifecycle gate would then re-route them back to pre-dashboard on the next didChangeDependencies — an infinite loop of "you have a suspension banner" → "go to dashboard" → "you have a suspension banner" → ….
- **How to repro:**
  1. Rider reaches PICKUP_SCHEDULED (rank 10), `assignedVehicle` is set by `syncPickup`.
  2. Admin marks KYC rejected → server sets `lifecycleStatus = SUSPENDED` (rank 12). `accountStatus` may also be `suspended` (see admin-riders.use-cases.ts:495 — only fires `logAccountSuspension` but does it also set `accountStatus`? — let me note: this is the open question; if `accountStatus` is not updated, then `LifecycleTarget.suspended` is reached via `lifecycleStatus == 'SUSPENDED'`.).
  3. The Flutter lifecycle gate re-evaluates and returns `LifecycleTarget.suspended` → `_lifecycleTargetToAuthState` returns `AuthState.preDashboard`.
  4. The pre-dashboard's auto-redirect fires immediately (because `isPickupDone = true` at rank 12).
  5. The lifecycle gate re-routes back to pre-dashboard on the next frame.
- **User-visible impact:** The suspension banner never gets a chance to render; the rider sees the dashboard while suspended. Account/safety issue if a KYC rejection was triggered by fraud signals.
- **Recommended fix (one-line change in `pre_dashboard_screen.dart:63,70`):**
  ```dart
  // Read the raw pickupDone flag, not the derived getter (the getter is
  // true for SUSPENDED riders with assignedVehicle, which would yank a
  // suspended rider to the dashboard and bypass the suspension banner).
  if (rider.pickupDone == true && !_redirected) {
  ```
  Same change for the `else if` branch on line 70. The hangTight screen already does this correctly — copy the pattern.
- **Ship as-is?** Risky. Edge case but a real account-safety concern. The bug only manifests if a rider is suspended after having `assignedVehicle` set, which is the normal path (pickup → admin suspend). Fix in this PR or accept and file a P0.

### H3. Active path's deposit does not bump the rank — re-entering the app mid-deposit creates a duplicate transaction
- **Where:** Lifecycle mapping in `flutter/lib/features/auth/presentation/rider_lifecycle_gate.dart:171-172` + the design decision in `web/src/lib/services/deposit-service.ts:121-130` and `web/src/server/modules/transactions/transaction.use-cases.ts:111-114`.
- **Bug:** The active path's design (per the comment at rider_lifecycle_gate.dart:165-170) is that the deposit submission does NOT change `lifecycleStatus` — the rider stays at PLAN_SELECTED (rank 9) the entire time they go through `topUpAmount → topUpProof → pickupHub → pickupVerification → hangTight`.
  - If the rider is mid-flow and the app is killed (or the user navigates back, or the system reclaims memory), the lifecycle gate re-evaluates on resume and finds `rank = 9` → sends the rider to `AuthState.topUpAmount`.
  - The router has no awareness of an in-progress SECURITY_DEPOSIT transaction. The rider re-fills the amount, re-submits the proof → **second SECURITY_DEPOSIT transaction is created**.
  - This is a real money-handling issue if the rider re-submits the same UPI reference (the server likely has a dedupe by UPI ref) or different UPI ref (two transactions, one of which must be refunded).
- **How to repro:**
  1. Rider completes `topUpAmount`, taps proceed → on `topUpProof`.
  2. Rider uploads a screenshot, taps submit → on `pickupHub` (active path skips planSuccess per router_body.dart:542-544).
  3. Rider taps home button (Android), app is suspended.
  4. OS kills the app for memory. Rider taps the app icon → cold start → splash → lifecycle gate → `rank = 9` (still PLAN_SELECTED) → routes to `topUpAmount` again.
  5. Rider re-submits. `wallet.use-cases.ts:81-86` sets `finalPurpose = rank < 10 ? 'SECURITY_DEPOSIT' : …` — so a second SECURITY_DEPOSIT transaction is created.
- **User-visible impact:** The rider has two security-deposit transactions on their wallet. One of them must be refunded manually by admin. The rider sees "₹4,999 debited" twice in their bank statement. Support tickets.
- **Recommended fix (two pieces):**
  1. **Server:** Have the deposit approval flow bump the rank to `DEPOSIT_APPROVED` (rank 8) regardless of current rank. Currently `deposit-service.ts:126` has `lifecycleRankOf(currentRider.lifecycleStatus) < 8` which **excludes** PLAN_SELECTED riders (rank 9). Loosen the guard:
     ```ts
     if (currentRider && lifecycleRankOf(currentRider.lifecycleStatus) < 10) {
       // rank < 10 means: not yet ACTIVE / PICKUP_SCHEDULED. After deposit
       // approval, mark DEPOSIT_APPROVED so the lifecycle gate can tell
       // a rider who already paid apart from one who hasn't.
     }
     ```
     And the matching guard in `transaction.use-cases.ts`.
  2. **Flutter:** Have the lifecycle gate check `rider.depositStatus` (or `rider.isDepositDone`) before routing PLAN_SELECTED to `topUpAmount`:
     ```dart
     if (rank == 9) {
       return rider.isDepositDone ? LifecycleTarget.pickupHub : LifecycleTarget.topUpAmount;
     }
     ```
- **Ship as-is?** No for the deposit-skip case. The duplicate-transaction risk is small (the rider has to kill the app at exactly the wrong moment) but the impact is high (support ticket + manual refund).

---

## MEDIUM — fix this quarter

### M1. `RiderModel.isPickupDone` getter uses `assignedVehicle` — inconsistent with server's `pickupDone`
- **Where:** `flutter/lib/models/rider_model.dart:528-531`
- **Bug:** Flutter's `isPickupDone` returns `true` for any rider with `assignedVehicle?.isNotEmpty == true`. The server's `pickupDone` (flatten-rider.ts:80) returns `true` only for `rank >= 11 || pickedUpAt`.
  - After `syncPickup` (rental.use-cases.ts:343), the server sets `assignedVehicle` and `lifecycleStatus = 'PICKUP_SCHEDULED'`. Server's `pickupDone` is `false` (rank 10). Flutter's `isPickupDone` is `true` (because `assignedVehicle` is set).
  - HangTight's auto-redirect uses the **raw** `pickupDone` field (hang_tight_screen.dart:108), so it correctly does NOT fire. But other Flutter code that reads `rider.isPickupDone` (pre-dashboard, approval_matrix_widget, app_state_provider, app_provider) gets a different answer than the server.
- **Impact:**
  - The "Pickup" row in `approval_matrix_widget.dart:96-101` shows as done for any PICKUP_SCHEDULED rider. The hangTight screen says "Pickup confirmed" in the status list. The pre-dashboard would auto-redirect (see H2).
  - `app_provider.dart:132` returns `true` for PICKUP_SCHEDULED — used in places that don't expect it.
- **Recommended fix (rider_model.dart:528-531):** Mirror the server. Drop the `assignedVehicle` clause and the `rank >= 11` clause, rely on the raw `pickupDone` field (which the server now correctly sets at rank 11+). If a fallback is desired, use the lifecycle gate's redirect result instead of duplicating the logic:
  ```dart
  bool get isPickupDone => pickupDone;
  // Use RiderLifecycleGate.redirect(rider) == LifecycleTarget.dashboard
  // if you need the broader semantic.
  ```
- **Ship as-is?** Yes for now — the hangTight fix already navigates around this. But fix the pre-dashboard redirect (H2) and the approval matrix in a follow-up.

### M2. Lifecycle rank table drift — Flutter has 5 dead entries
- **Where:** `flutter/lib/utils/lifecycle_rank.dart:22-43`
- **Bug:** Flutter has entries for `ACTIVE_RIDING`, `RIDING`, `RETURNED`, `PICKUP_COMPLETED`, `TERMINATED` that do **not** exist in the Prisma enum (`web/prisma/schema.prisma:1362-1378`) or in `web/src/lib/lifecycle-ranks.ts:21-37`. The Prisma enum is the source of truth — those 5 values will never be returned by the API.
  - Consequence 1: `RiderLifecycleGate.redirect` checks `rider.lifecycleStatus == 'TERMINATED'` (rider_lifecycle_gate.dart:100) which is unreachable. Terminated riders only get caught by `lifecycleRank(rider) >= 14` (CLOSED).
  - Consequence 2: A rider moved to `RETURNED` server-side (not in the enum, would fail Prisma) could be coerced to a Flutter-specific rank — but the server would never let this happen.
- **Recommended fix (delete 5 lines from `lifecycle_rank.dart:35-42`):** Match the Prisma enum exactly. Drop `ACTIVE_RIDING`, `RIDING`, `RETURNED`, `PICKUP_COMPLETED`, `TERMINATED`. In the lifecycle gate, remove the `rider.lifecycleStatus == 'TERMINATED'` clause (line 100) — `lifecycleRank(rider) >= 14` already covers CLOSED.
- **Ship as-is?** Yes (dead code, no functional impact) but the file is the canonical source of truth — drift is a future-bug magnet.

### M3. `RiderProvider.routeAfterLogin` is a deprecated wrapper with diverging mapping
- **Where:** `flutter/lib/core/state/rider_provider.dart:511-545`
- **Bug:** The wrapper maps `LifecycleTarget.suspended` and `LifecycleTarget.terminated` and `LifecycleTarget.unknown` **all to `AuthState.login`** (lines 540-543). The modern `_lifecycleTargetToAuthState` in `router.dart:608-656` maps:
  - `suspended` → `preDashboard` (with suspension banner)
  - `terminated` → `accountClosed` (terminal surface)
  - `unknown` → `login` (only)
  - These are correct. The wrapper is wrong.
- **Impact:** Zero in production. The wrapper is not called from anywhere (verified via `grep`). It's a footgun: anyone who finds it and uses it gets a broken mapping.
- **Recommended fix (delete lines 511-545 in rider_provider.dart):** Remove the deprecated wrapper entirely. The `routeAfterLoginAppState` wrapper on line 505-507 is fine to keep (it just delegates to `RiderLifecycleGate.redirectAppState`).
- **Ship as-is?** Yes.

### M4. Session expiry on hangTight fails silently
- **Where:** `flutter/lib/features/dashboard/presentation/screens/hang_tight_screen.dart:82-89`
- **Bug:** `_safeRefresh` catches **all** exceptions from `refreshFromApi`. A 401 (session expired) is swallowed. The rider sees hangTight forever; the "Refresh" button also fails silently.
- **User-visible impact:** A rider whose JWT expired while waiting for admin approval will see the hangTight screen with no error and no "log in again" prompt. The rider can't proceed.
- **How to repro:** Wait for admin to take >1 hour to approve, or kill the session manually (`prisma.rider.update` to invalidate). The 15s timer keeps firing, every call 401s, the rider sees hangTight with stale data.
- **Recommended fix (two-line change in `_safeRefresh`):**
  ```dart
  } on ApiException catch (e) {
    if (e.statusCode == 401) {
      if (mounted) widget.onSessionExpired?.call();
      return;
    }
    // Offline / transient — the next tick will retry.
  }
  ```
  And add an `onSessionExpired` callback to `HangTightScreen` that the router wires to `logout()` (which clears state and navigates to login).
- **Ship as-is?** Yes, with a known-issue note. The JWT TTL appears to be long enough that this rarely manifests in practice.

### M5. Rider PICKUP_SCHEDULED → PICKUP_SCHEDULED reversal (admin reverts) auto-redirects back to topUpAmount
- **Where:** `flutter/lib/features/dashboard/presentation/screens/hang_tight_screen.dart:116-120` and `flutter/lib/app/router_body.dart:113-114`
- **Bug:** If admin reverses a rider's pickup approval (e.g. corrects a misclick), the rider's `lifecycleStatus` goes from `ACTIVE` (rank 11) back to `PICKUP_SCHEDULED` (rank 10) — or worse, to `PLAN_SELECTED` (rank 9) if admin reverts further.
  - HangTight's `_redirected = false` correctly re-arms (line 116-120).
  - The lifecycle gate then routes the rider to `LifecycleTarget.topUpAmount` (rank 9) or `LifecycleTarget.hangTight` (rank 10). For rank 9, the rider is sent back to **deposit entry** with a confirmed deposit on file — see H3 for the duplicate-transaction risk.
- **User-visible impact:** A rider who was once active and is now reverted by admin sees the wrong screen. They're sent back through steps they already completed.
- **Recommended fix:** None required if H3 is fixed (the lifecycle gate would route a rider with `isDepositDone` past `topUpAmount` to `pickupHub`). Until then, the hangTight defensive re-arm is correct; the issue is the deposit-routing logic.
- **Ship as-is?** Yes, contingent on H3.

---

## LOW — nice to have

### L1. `flutter/lib/features/dashboard/presentation/screens/legacy/pre_dashboard_screen.dart` is now legacy-only
- Only reached from `LifecycleTarget.suspended`. Could be moved to a `legacy/` sub-folder of `presentation/screens/` (it's already in `legacy/` per AGENTS.md) and the `_redirected` logic removed since the only valid redirect target (dashboard) is blocked by H2.

### L2. `pre_dashboard_screen.dart:56` debug print in `appDebug`
- The `appDebug('PreDashboardScreen: currentPlan = ...')` log statement dumps several fields on every rebuild. It will spam release logs if `appDebug` ever gets routed to `print` in production. Add a guard or remove.

### L3. `flattenRiderPartial` debug script committed in `web/check-flat-8999.js`
- Reads from production DB to inspect a specific rider's flattened payload. Should live in `.trash/` or `scripts/debug/` rather than the repo root, or be deleted.

---

## NOTES — worth knowing but not actionable

### N1. Sync pickup transition: rank does go to 10, not 9
The prior summary's "stays at 9" is **wrong**. Reading `web/src/server/modules/rentals/rental.use-cases.ts:316-343`, the new active-path `syncPickup` does set `lifecycleStatus: 'PICKUP_SCHEDULED'` (rank 10). The transition fires. The Flutter `RiderLifecycleGate.redirect` for rank 10 with `!pickupDone` is `LifecycleTarget.hangTight` — and the hangTight auto-redirect waits for the next transition to rank 11 (ACTIVE). This part of the design works.

### N2. Polling resilience is actually fine
The user's worry: `_applyAppStatePollingPolicy` HangTight case calls `startOnboardingPoll` which re-checks `appState is Onboarding || PreDashboard` and bails for `HangTight`. Reading the listener wiring (`rider_provider.dart:165-167`):
- `appStateProvider` is set by the **OTP screen** (otp_verification_screen.dart:204-205) using `result.determineAppState(rider)`.
- For a rider who reaches hangTight, the OTP screen ran at login time when the rider was at a different lifecycle (likely PLAN_SELECTED → `Onboarding(planSelect)` or KYC_APPROVED → `Onboarding(guarantor)`).
- The router's `_navigateToLocal` (router.dart:495-512) changes `_currentState` but **does not** update `appStateProvider`.
- So `appStateProvider` is "frozen" at whatever the OTP screen set. The polling policy's Onboarding case fires, the onboarding poller is started, and the poller calls `refreshFromApi` every 30s.
- Combined with the hangTight screen's own 15s timer, the rider is polled every 15s in practice. The polling is robust.

The latent risk: if the OTP screen somehow set `appStateProvider = HangTight()` (e.g. an already-PICKUP_SCHEDULED rider logs in fresh), the polling policy's HangTight case fires but the onboarding poller doesn't start. The screen's 15s timer is the only poll. In practice this is fine — the timer is the primary.

### N3. KYC auto-approve guarantor fix is in place
`web/src/server/modules/riders/admin-riders.use-cases.ts:467-478` — the guarantor is only set to `APPROVED` if it was already in `SUBMITTED` state. A PENDING or DRAFT guarantor is left alone on KYC review. Fix from the prior audit is intact.

### N4. `lifecycleStage` (5-value) column is on the rider row but underused
`web/prisma/schema.prisma:211` defines `lifecycleStage RiderLifecycleStage? @default(NEW)` with the 5-value enum (NEW, IN_PROGRESS, ACTIVE, PAUSED, CLOSED). The Flutter side reads it (`rider_model.dart:679-682`) but the active-path code only references `lifecycleStatus` (15-value). The 5-value column is read-only on the rider app.

Looking at `lifecycle-ranks.ts:1-50` and `lifecycle_rank.dart:1-72`, only the 15-value `lifecycleStatus` is mapped to ranks. The 5-value `lifecycleStage` has its own `lifecycleStageRank` function in Flutter but it's not called from the lifecycle gate.

The 5-value column is currently a dead branch waiting for migration. Note in the design doc: "the 1-week staging soak (ends 2026-08-06)" was missed, and the column was reverted in deep-audit D-P2-5. So the 5-value column is now optional and unmaintained. No bug, but worth a TODO.

### N5. `lifecycleStage = 'NEW'` for an `ACTIVE` rider is the result of the archived `fix-rider.js` script
The user's test rider has `lifecycleStatus = 'ACTIVE'` but `lifecycleStage = 'NEW'`. This is a data inconsistency from when the archived script forced `lifecycleStatus = 'ACTIVE'` directly without going through the state machine (which would have also set `lifecycleStage = 'ACTIVE'`). It's a known wart, not a bug. Going forward, the 5-value column should be deprecated or kept in sync.

### N6. AuthState → AppState mapping is complete
All 28 `AuthState` values are handled in `appStateFromAuthState` (flutter/lib/core/navigation/app_state.dart:210-264). The router_body switch covers 24 cases with a `default: break` (no default — exhaustive). The new `hangTight` case is in both directions. The `_lifecycleTargetToAuthState` mapping is exhaustive over the 12 `LifecycleTarget` values.

### N7. HangTight auto-redirect mechanics are correct
`hang_tight_screen.dart:108-120`:
- Reads raw `pickupDone` (not the derived getter) — correct (M1 documents why)
- Post-frame callback for navigation — correct (avoids the build-during-build trap)
- `_redirected` flag is reset if the rider goes back to PICKUP_SCHEDULED — correct (handles admin reversal)
- `_refreshTimer` is cancelled on dispose and on success — correct

The router's `onActivated: () => state._navigateToLocal(AuthState.dashboard)` (router_body.dart:488) is wired correctly.

### N8. The `assignedVehicle` consistency between flattenRider and Flutter `isPickupDone`
- Server's `pickupDone` (flattenRider): `rank >= 11 || pickedUpAt`
- Flutter's `isPickupDone` (rider_model.dart): `pickupDone || assignedVehicle?.isNotEmpty || rank >= 11`
- These diverge at rank 10 (PICKUP_SCHEDULED) with `assignedVehicle` set. The hangTight fix avoided this trap by reading the raw field. The pre-dashboard did not (H2).

### N9. The 5-row hangTight status list is hardcoded for the "happy path" (Guarantor, Plan, Pickup, KYC, Vehicle)
The screen always shows Guarantor/Plan/Pickup as "done" (hang_tight_screen.dart:222-241) regardless of the rider's actual state. For a rider whose KYC was rejected and is still on hangTight (a rare edge case via admin reversion), the screen would show "KYC under review" forever even if the rider's KYC is now REJECTED. The KYC row does react to the actual `kycStatus` (the spinner switches to a warning icon for rejected/expired/infoRequired), so this is a minor edge case for a state the rider should not normally be in.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 2     | C1, C2 — both fixable in 1-2 lines, no test churn needed |
| HIGH     | 3     | H1, H2, H3 — H2 is the account-safety one to prioritize |
| MEDIUM   | 5     | M1-M5 — clean-up work, can ship as-is |
| LOW      | 3     | L1-L3 — housekeeping |
| NOTES    | 9     | informational, no action |

**Pre-release readiness:** the active-path onboarding can ship **as-is** for the user's device walk-through. C1 + H2 + H3 are the only ones I'd block on. C1 is a 1-line fix; H2 is a 1-line fix; H3 is a 2-piece fix (server guard + lifecycle gate branch) but the duplicate-transaction risk is small in the test walk-through.

**Recommended ship-it PR (single commit, ≤30 lines changed):**
1. `web/src/lib/flatten-rider.ts:86` — `rank >= 11` instead of `rank >= 10` (C1).
2. `web/src/lib/flatten-rider.ts:211,218` — bring `flattenRiderPartial` in line with `flattenRider` (C2).
3. `flutter/lib/features/dashboard/presentation/screens/legacy/pre_dashboard_screen.dart:63,70` — read raw `pickupDone` instead of derived getter (H2).
4. `web/src/lib/services/deposit-service.ts:126` and `web/src/server/modules/transactions/transaction.use-cases.ts:111-114` — loosen rank guard to `< 10` (H3 server half).
5. `flutter/lib/features/auth/presentation/rider_lifecycle_gate.dart:171-173` — check `isDepositDone` before routing PLAN_SELECTED to topUpAmount (H3 client half).

That gives the test rider a clean run from hangTight → ACTIVE → dashboard without any of the listed edge cases biting.

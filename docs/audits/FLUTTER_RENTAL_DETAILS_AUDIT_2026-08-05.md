# Flutter Rider App — Rental Details Screen & Sub-Screens — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:**
- `flutter/lib/features/rentals/` — 11 files (~85 KB)
  - `presentation/screens/rental_details_screen.dart` (318 lines) — the main "your rental" page
  - `presentation/screens/choose_plan_screen.dart` (691 lines) — the plan picker shown before pickup
  - `presentation/screens/plan_success_screen.dart` (72 lines) — the "Subscription Confirmed" interstitial
  - `presentation/screens/end_rental_screen.dart` (776 lines) — the return flow (photos + odometer + submit)
  - `presentation/widgets/choose_plan/{plan_card_tile, plan_header_card}.dart` (270 + 69 lines) — **dead widgets**
  - `presentation/widgets/end_rental/{end_rental_photo_grid, return_step_indicator}.dart` (170 + 67 lines) — **dead widgets**
  - `domain/entity.dart` (RentalPlanEntity, ActiveRentalEntity)
  - `domain/repository.dart` (RentalRepository interface)
  - `data/repository_impl.dart` (RentalRepositoryImpl — **has a parameter-name swap bug**)
- Related: `flutter/lib/core/state/rider_provider.dart` (525 lines, owns `submitVehicleReturn` and `logout` — P0-4 from dashboard audit repeats here)
- Related: `flutter/lib/services/voltium_api_service.dart::submitVehicleReturn` (the method the `EndRentalScreen` actually calls in production)
- Related: `flutter/lib/services/image_compression_service.dart` (the camera flow that can silently fail)
- Tests: `flutter/integration_test/e2e_individual/32_rental_end_test.dart` (1 test — "Rental – dashboard accessible" — does not actually exercise the rental flow)

**Out of scope:** Pickup flow (`features/pickup/`) — it owns the photo capture & TL details step that *precedes* the rental. KYC / guarantor / onboarding. Wallet / top-up. The admin side of plans (covered in earlier admin audits).

---

## TL;DR

**The rental details screen is a thin read-only view that works on the happy path but silently misroutes the user in two important edge cases.** Most impactful: when a rider submits a vehicle return from the rental details screen, the success state shows "Request Submitted!" for 2 seconds and then **does nothing** — the rider is left looking at the screen with no clear next step, because the `onSuccess` callback is `null` (the screen is launched as a plain `Navigator.push(MaterialPageRoute(...))` from `rental_details_screen.dart:243-250` without `onSuccess` being wired). The rental details page itself is also **not part of the router's `AuthState` state machine** — it has no entry in `flutter/lib/app/app_state.dart`, so lifecycle changes (KYC revoked, rental cancelled by admin, account suspended) cannot route the rider off the screen.

The choose-plan flow is large (691 lines) and re-implements a `PlanCardTile` widget that already exists in `widgets/choose_plan/plan_card_tile.dart` — the screen inlines ~290 lines of card UI that duplicate the shared widget, AND the shared widget is never imported anywhere. Same story for `EndRentalPhotoGrid` (5KB) vs the inline `_buildPhotoGrid` (120 lines) in `end_rental_screen.dart`. **~450 lines of dead-and-duplicate code in the rentals feature.**

The **`RentalRepositoryImpl.submitVehicleReturn`** has a parameter-name bug that misroutes the `vehicleId` argument to the `riderId` parameter of the underlying API and discards `hubId` entirely. It is dead code today (no UI calls it) but is a latent P0: any future refactor that wires the repository back in will silently send `vehicleId` strings as `riderId` to the server.

There are **4 P0s** (end-rental success leaves the user stuck; rental-details screen not in AuthState; `RiderProvider.submitVehicleReturn` passes empty strings; dashboard P0-4 `engagementProvider.logout` not called on `riderProvider.logout`), **7 P1s** (PostHog fires from `build`; reuse-vs-inline widget duplication; `_toDouble` paise flag inconsistent; "Days Remaining" clamps past dates to 0; "Time Remaining" hardcoded `7d 0h` fallback; `pickAndCompress` silent camera-fail; etc.), and **6 P2s** (test coverage gap, naming, error UX).

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, silent data loss, riders stranded on a screen | Before next release |
| **P1** | UX friction, accessibility, race condition, misleading data, dead code that confuses future work | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: `EndRentalScreen` success path is a dead end when launched from `rental_details_screen.dart` — the rider is stranded

**Files:**
- `flutter/lib/features/rentals/presentation/screens/rental_details_screen.dart` lines 243-250 (the "End Rental" button).
- `flutter/lib/features/rentals/presentation/screens/end_rental_screen.dart` lines 134-208 (`_handleReturn` + line 195 `widget.onSuccess?.call()`).

**What:** The "End Rental" button on the rental details screen does a manual `Navigator.push(MaterialPageRoute(builder: (_) => const EndRentalScreen()))`. **No `onSuccess` callback is passed.** When the rider takes all 4 photos, enters the odometer, checks the confirm box, taps "Confirm Return", and the API succeeds, the screen sets `_submitted = true` and renders the green checkmark interstitial. After a 2-second `Future.delayed`, it calls `widget.onSuccess?.call()` — which is `null`, so **nothing happens**. The rider sees "Request Submitted!" floating in space for 2 seconds and then is still looking at the end-rental screen with the photos gone, the odometer empty, the checkbox unchecked, the submit button re-enabled. There is no auto-navigation back to the rental details, no success animation that goes anywhere, and the only escape is the back arrow.

The router-managed path (`AuthState.endRental` from `router_body.dart:337-343`) wires both `onBack` and `onSuccess` to `_navigateToLocal(AuthState.dashboard)`, so the bug only affects the **rental-details and workflow-hub entry points** — exactly the two places the rider is most likely to use this flow (after looking at their rental info).

**Repro:**
1. Log in as a rider, complete KYC, complete deposit, complete pickup, complete a plan purchase.
2. Land on the active dashboard.
3. Tap the profile card → rental details screen.
4. Tap "End Rental".
5. Take all 4 photos, enter a 5-digit odometer, check the confirm box, tap "Confirm Return".
6. Wait for the "Request Submitted!" interstitial.
7. **Observe:** the interstitial sits there for 2 seconds, then the screen returns to the blank end-rental form. There is no auto-navigation. The rider has to press back.

**Impact:** Every rider who ends a rental from the details page gets stranded. A confused rider may resubmit the form (with now-empty photos), which would fail silently. The form fields are reset but the photos stay cleared.

**Fix:**
```dart
// rental_details_screen.dart:243-250
ElevatedButton(
  onPressed: () async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => EndRentalScreen(
          onSuccess: () => Navigator.of(context).pop(true),
          onBack: () => Navigator.of(context).pop(false),
        ),
      ),
    );
    // Optional: re-fetch the rider on return so planEndDate is updated
    // ref.read(riderProvider.notifier).refreshFromApi();
  },
  ...
)
```

Alternative: convert `EndRentalScreen` to a `Navigator.pop` with a result by default (treat absence of `onSuccess` as "just pop"). Either fix is ~10 lines.

**Effort:** 10 min. **Risk:** Low (pure additive — does not change the router path).

---

### P0-2: `RentalDetailsScreen` is not in `AuthState` — lifecycle changes can't route the rider off this screen

**Files:**
- `flutter/lib/app/app_state.dart` (no `rentalDetails` entry).
- `flutter/lib/features/dashboard/presentation/screens/active_dashboard_screen.dart:254` (manual `AppNavigator.push`).
- `flutter/lib/features/workflows/presentation/screens/rider_workflow_hub_screen.dart:150` (manual `AppNavigator.push`).

**What:** The rental details screen is reached via a direct `AppNavigator.push` from the active dashboard and the workflow hub. The router's lifecycle gate (`flutter/lib/app/rider_lifecycle_gate.dart`, evaluated in `router.dart:201-219`) decides where the rider belongs (KYC preflight / onboarding / pre-dashboard / dashboard / suspended / terminated) and re-routes them by setting `_currentState` and rebuilding the body. **But this only works for screens the router is rendering.** A pushed `RentalDetailsScreen` on top of the dashboard is a separate `MaterialPageRoute` — when the lifecycle gate decides "this rider should be on `accountClosed`", the gate sets `_currentState = accountClosed` and the router body swaps to the account-closed screen, **but the rental-details screen is still on top of it** and the rider sees a stale rental info page with no way to know the session was invalidated underneath them.

This matters because the rental-details page shows sensitive data: current plan, security deposit, wallet balance, payment streak, assigned vehicle, team leader, pickup hub, and rental status. If the rider's KYC is revoked, account is suspended, or rental is admin-cancelled while they're viewing the page, the page should not be rendered.

**Repro:**
1. Rider with active rental opens the rental details page.
2. Admin in the web console revokes KYC, suspends the account, or force-closes the rental.
3. Observe: the rider is still on the rental details page. They see a plan they're no longer entitled to, a vehicle they no longer have access to, a team leader they shouldn't be calling.
4. When the rider finally presses back, the lifecycle gate fires and the router swaps to the appropriate termination screen — but only on back navigation, which is asynchronous to the state change.

**Impact:** Stale-data exposure + UX confusion. The same pattern affects all the auth-state-less pushed screens (vehicle photos, TL details, FAQ, my documents, top-up flow, referral details, legal page). Fixing the rental details flow unblocks a sweep of the other 7.

**Fix:** Add `rentalDetails` to `AuthState`, route it from the router body, and replace the manual `AppNavigator.push` calls with `state._navigateToLocal(AuthState.rentalDetails)`. The back button uses `_handleSystemBack` to go to dashboard. The end-rental button on the rental-details screen can still push `EndRentalScreen` directly, or it can switch to `AuthState.endRental` (which already exists and is wired). The choice depends on whether the end-rental flow should also be lifecycle-aware.

**Effort:** 1-2h to convert + add the state. **Risk:** Medium (touches the router state machine, which is the kind of change that exposes other latent bugs).

---

### P0-3: `RiderProvider.submitVehicleReturn` passes empty strings for `vehicleId` and `hubId` to the repository

**File:** `flutter/lib/core/state/rider_provider.dart` lines 279-301.

**What:** The `RiderNotifier.submitVehicleReturn` method is the high-level API the screen layer *should* be using. It accepts a `List<File> photos` and a `reason`, uploads each photo, then calls the rental repository:

```dart
// rider_provider.dart:291-295
await _rentalRepository.submitVehicleReturn(
  vehicleId: '',
  hubId: '',
  photos: photoUrls,
);
```

Both `vehicleId` and `hubId` are passed as empty strings. This is a clear bug — the rider's actual vehicle ID and pickup hub ID are available on `state.rider` and should be passed. Furthermore, the repository's `submitVehicleReturn` is declared as:

```dart
// features/rentals/domain/repository.dart:24-28
Future<Map<String, dynamic>> submitVehicleReturn({
  required String vehicleId,
  required String hubId,
  required List<String> photos,
});
```

…and the implementation **misroutes the `vehicleId` parameter to the `riderId` parameter** of the underlying API and **discards `hubId` entirely**:

```dart
// features/rentals/data/repository_impl.dart:50-60
Future<Map<String, dynamic>> submitVehicleReturn({
  required String vehicleId,
  required String hubId,
  required List<String> photos,
}) async {
  // Delegate to the singleton service which routes to POST /api/rider/vehicle-return.
  return VoltiumApiService().submitVehicleReturn(
    riderId: vehicleId,  // ← BUG: passing vehicleId AS riderId
    photoUrls: photos,
  );
}
```

**The bug is currently latent** because the `EndRentalScreen` does NOT use `RiderNotifier.submitVehicleReturn` — it calls `VoltiumApiService().submitVehicleReturn(riderId: riderId, photoUrls, reason)` directly (`end_rental_screen.dart:180-184`), passing the real rider ID. The repository path is dead code today, but the moment anyone wires the screen to use `riderProvider.submitVehicleReturn` (which is the architecturally correct pattern), the bug fires immediately.

**Repro:** `grep` for callers of `_rentalRepository.submitVehicleReturn` → 1 hit (line 291 of `rider_provider.dart`). `grep` for callers of `RiderNotifier.submitVehicleReturn` (the public API) → 0 hits. The dead-code path has the bug; the live path works by accident.

**Fix:** Two options.
- **Option A (minimal):** Fix the call site in `rider_provider.dart:291-295` to pass the real values:
  ```dart
  final r = state.rider;
  await _rentalRepository.submitVehicleReturn(
    vehicleId: r?.assignedVehicle ?? '',
    hubId: r?.pickupHub ?? '',
    photos: photoUrls,
  );
  ```
  …and fix the repository implementation to accept (and ignore, since the API doesn't need it) `hubId` while correctly passing `riderId`:
  ```dart
  return VoltiumApiService().submitVehicleReturn(
    riderId: rIdFromSomewhere,  // not vehicleId
    photoUrls: photos,
  );
  ```
- **Option B (cleaner):** Delete the repository method, delete the repository interface entry, delete `RentalRepositoryImpl.submitVehicleReturn`. The only caller of this method (`RiderNotifier.submitVehicleReturn`) is itself unused. ~40 lines deleted. The screen layer's direct `VoltiumApiService().submitVehicleReturn` call is the right shape.

**Effort:** 5 min for Option A, 30 min for Option B. **Risk:** Option A is the smallest diff; Option B is the right cleanup. I'd recommend Option B as part of a P0/P2 sweep that also kills the rest of the `RentalRepository` interface (the `subscribePlan`, `fetchHubs`, `fetchVehicles`, `syncPickup` methods are also unused at the screen layer).

---

### P0-4: `RiderNotifier.logout()` does NOT clear `engagementProvider` state — multi-account device leak (cross-audit with audit #7 P0-4)

**File:** `flutter/lib/core/state/rider_provider.dart` lines 270-277.

**What:** This was also called out in the Flutter dashboard audit (audit #7 P0-4). Repeating here because the rental flows are the most affected — a rider ending a rental and then logging out keeps the prior rider's reward/referral/notification state until the next `initEngagementData()` call fires for the new rider.

```dart
// rider_provider.dart:270-277
void logout() {
  state = const RiderState();
  _refreshInFlight = null;
  _stopDeviceDataSync();
  _hasSyncedDeviceDataOnce = false;
  stopPolling();
  DocumentLocalCache.clearAll();
  // ← MISSING: ref.read(engagementProvider.notifier).logout();
  // ← MISSING: ref.read(supportProvider.notifier).reset?.call();
}
```

**Repro:**
1. Rider A logs in, ends a rental, accumulates 3 unread notifications, 2 pending rewards.
2. Rider A logs out (from the rental details → menu → logout).
3. Rider B logs in on the same device.
4. **Observe:** if `initEngagementData()` is the first thing the new session calls, the engagement provider is fresh. But if the router is restored to `dashboard` from the cached state (via `CacheService().getString('voltium_saved_auth_state')`) before `initEngagementData()` runs, Rider B sees Rider A's notification bell count and reward balance for a brief window.

**Fix:**
```dart
void logout() {
  state = const RiderState();
  _refreshInFlight = null;
  _stopDeviceDataSync();
  _hasSyncedDeviceDataOnce = false;
  stopPolling();
  DocumentLocalCache.clearAll();
  // PR-7.4: clear engagement (notifications/rewards/referrals) so a
  // multi-account device doesn't leak the prior rider's data during
  // the brief window between logout and the next session's init call.
  ref.read(engagementProvider.notifier).logout();
  ref.read(supportProvider.notifier).reset?.call();
}
```

**Effort:** 5 min. **Risk:** Low. **Co-fix with:** audit #7 P0-4 (same one-liner, same PR).

---

## P1 — Next 2 sprints

### P1-1: `PlanSuccessScreen` fires `PostHogService.capture('plan_purchased')` from inside `build` — fires on every rebuild

**File:** `flutter/lib/features/rentals/presentation/screens/plan_success_screen.dart` lines 14-16.

**What:**
```dart
@override
Widget build(BuildContext context) {
  WidgetsBinding.instance.addPostFrameCallback((_) {
    PostHogService.capture('plan_purchased');
  });
  return Scaffold(...);
}
```

This is the classic Flutter anti-pattern. Every rebuild of this `StatelessWidget` schedules a new post-frame callback. PostHog's `capture` is itself fire-and-forget and (per common PostHog SDK shapes) likely dedupes by event name within a short window — but if it doesn't, every theme change, every focus change, every parent rebuild (the router is a parent and it rebuilds on lifecycle changes) will fire `plan_purchased` again. The first render of the screen on a successful purchase is what should fire it, exactly once.

**Repro:**
1. Subscribe to a plan → `PlanSuccessScreen` shown.
2. Trigger a rebuild: rotate the device, switch theme, return from another app.
3. **Observe:** PostHog receives N `plan_purchased` events for 1 plan purchase.

**Fix:** Convert to `StatefulWidget`, fire from `initState` with a `_fired` flag guard, or use a `StatefulHookConsumerWidget` with a `useEffect_once`. ~15 lines.

**Effort:** 15 min. **Risk:** Low.

---

### P1-2: `ChoosePlanScreen` re-implements a `PlanCardTile` widget that already exists in `widgets/choose_plan/plan_card_tile.dart` — ~290 lines of inline UI duplication

**Files:**
- `flutter/lib/features/rentals/presentation/screens/choose_plan_screen.dart` lines 304-594 (inline card UI, 290 lines).
- `flutter/lib/features/rentals/presentation/widgets/choose_plan/plan_card_tile.dart` (270 lines, **never imported**).

**What:** The shared `PlanCardTile` widget does *almost* what the inline card does, but with one visual difference: the inline card on the screen has a "CURRENT PLAN" / "SELECTED PLAN" header label and a description row, while the shared widget only has the title. The two are 90% visually identical and would be much smaller as one parameterized widget. The barrel file `widgets/choose_plan/choose_plan_widgets.dart` is a 2-line re-export of the unused widgets.

**Repro:** `grep -r "PlanCardTile" flutter/lib` → 0 hits outside of the widget file itself. The widget is dead.

**Fix:** Either:
- **(a)** Refactor: pick the better visual, parameterize, and have the screen use the shared widget. ~250 lines deleted.
- **(b)** Delete: remove `plan_card_tile.dart` and `choose_plan_widgets.dart`. Inline is fine if it's a one-screen use. ~340 lines deleted.

**Effort:** (a) ~2h; (b) ~15 min. **Risk:** Low. **Same applies to** `PlanHeaderCard` (69 lines, dead, replaced by inline header in screen lines 251-289) — the screen doesn't use it.

---

### P1-3: `EndRentalScreen` re-implements `EndRentalPhotoGrid` inline — ~120 lines of UI duplication

**Files:**
- `flutter/lib/features/rentals/presentation/screens/end_rental_screen.dart` lines 393-511 (`_buildPhotoGrid` inline).
- `flutter/lib/features/rentals/presentation/widgets/end_rental/end_rental_photo_grid.dart` (170 lines, **never imported**).

**What:** Same story as P1-2. The inline `_buildPhotoGrid` in the screen is a 4-slot 2-column grid that takes photos and triggers `_takePhoto` / `_showPhotoOptionsDialog`. The shared `EndRentalPhotoGrid` widget does the same thing with the same 4 slots. The shared widget is dead.

**Fix:** Either refactor the screen to use the shared widget, or delete the shared widget. ~170 lines deleted net.

**Effort:** 30 min. **Risk:** Low.

---

### P1-4: `RentalDetailsScreen` "Days Remaining" clamps past dates to "0 Days" with the error color — confusing copy for expired plans

**File:** `flutter/lib/features/rentals/presentation/screens/rental_details_screen.dart` lines 174-181.

**What:**
```dart
if (endDate != null) ...[
  _buildDetailRow(Icons.timer_outlined, 'Days Remaining',
      '${endDate.difference(DateTime.now()).inDays.clamp(0, 999)} Days',
      valueColor:
          endDate.difference(DateTime.now()).inDays <= 3
              ? AppColors.error
              : AppColors.primary),
  const Divider(height: 1, color: AppColors.iconBackground),
],
```

For a plan that has expired (e.g. a 7-day plan from last week), `endDate.difference(DateTime.now()).inDays` is negative (e.g. -3). The `.clamp(0, 999)` makes it "0 Days", and the color check `<= 3` makes it red. The rider sees "Days Remaining: **0 Days**" in red. The label "Days Remaining" is misleading for an expired plan — the more useful copy would be "Plan **expired 3 days ago**" in red, or "Plan **ends today**" for the edge case.

The same calculation is performed twice in the line above, which is also a small code-smell.

**Fix:** Replace the inline calc with a `DateHelpers.daysOverdue(endDate)` helper (sibling to the existing `daysRemaining`) that returns a `(daysRemaining: int, isPast: bool, isExpiringSoon: bool)` triple. Render three distinct strings:
- Future, >3 days: "**5 Days**" (blue/primary)
- Future, ≤3 days: "**2 Days**" (red)
- Today: "**Ends today**" (red)
- Past: "**Expired N days ago**" (red)

**Effort:** 20 min. **Risk:** Low.

---

### P1-5: `DateHelpers.computeTimeRemaining(planEndDate)` returns the hardcoded string `'7d 0h'` when `planEndDate` is null — used by the dashboard's `PlanCard`

**Files:**
- `flutter/lib/utils/date_helpers.dart` lines 91-100.
- `flutter/lib/features/dashboard/widgets/dashboard_plan_card.dart:107`.

**What:** This is **not the rental details screen's bug** — the rental details screen has its own "Days Remaining" logic (see P1-4). But this same code path is used by the dashboard's `PlanCard`, which is the immediate source of the rental info. When a rider has no plan, the dashboard shows "**7d 0h**" as a "Time Remaining" — that number is completely made up, with no basis in the rider's actual data. Cross-audit with audit #7 P1-4 (same code, same fix).

**Repro:**
1. Log in as a rider who has not yet subscribed to a plan (onboarding state).
2. Land on the pre-dashboard.
3. The dashboard's `PlanCard` is not shown pre-dashboard, but if the rider opens the active dashboard in any state where `planEndDate` is null, they see "7d 0h".

**Fix:**
```dart
static String computeTimeRemaining(DateTime? planEndDate) {
  if (planEndDate == null) return '—';  // or "No active plan"
  final remaining = planEndDate.difference(DateTime.now());
  if (remaining.isNegative) return 'Expired';
  if (remaining.inDays > 0) return '${remaining.inDays}d ${remaining.inHours % 24}h';
  if (remaining.inHours > 0) return '${remaining.inHours}h';
  return '<1h';
}
```

**Effort:** 5 min. **Risk:** Low.

---

### P1-6: `ImageCompressionService.pickAndCompress` silently returns `null` on camera failure — no error UI

**File:** `flutter/lib/services/image_compression_service.dart` lines 30-33.

**What:** When the camera permission is revoked, the device storage is full, or the user denies the camera, the picker throws and the service catches and returns `null`. The caller in `end_rental_screen.dart:53-58` checks `if (file != null && mounted)` and silently does nothing on null. The rider taps the photo slot, the camera doesn't open (or opens and immediately fails), and they see no error — they think the app is broken.

**Repro:**
1. Deny camera permission for the app.
2. Open the end-rental flow.
3. Tap a photo slot.
4. **Observe:** nothing happens. No error, no retry prompt, no toast.

**Fix:** Throw a typed exception from the service (e.g. `CameraFailureException`) and have the screen catch it and show a snackbar with "Camera unavailable. Please check permissions in Settings." Add a "Open Settings" action that uses `permission_handler`'s `openAppSettings()`. ~20 lines.

**Effort:** 30 min. **Risk:** Low.

---

### P1-7: `_toDouble` paise-flag inconsistency — `currentPlanPrice` in cache uses `convertPaise: false` but JSON uses `convertPaise: true`

**File:** `flutter/lib/models/rider_model.dart` lines 710-725 (cache path) vs lines 594-595 (JSON path).

**What:** When deserializing from the live API JSON, `currentPlanPrice` is parsed with `convertPaise: true` (divides by 100). When deserializing from the local cache, `currentPlanPrice` is parsed with `convertPaise: false` (does not divide). If the server changes the convention (e.g. starts sending rupees in JSON), the JSON path correctly returns rupees, but the cache path would return the same value interpreted as rupees (which would be a 100x bug if the server was previously sending paise). The cache is set from the already-converted value (`_toDouble(json['currentPlanPrice'], convertPaise: true)` → divides by 100, stores the rupee value in cache), so the `false` flag on the cache read is correct *given the current server*. But the asymmetry is a latent bug if anyone changes one flag without the other.

**Fix:** Always `convertPaise: true` on both paths and ensure the cache only stores the already-converted rupee value. Or, add a unit test that pins the conversion behavior for both paths.

**Effort:** 5 min to fix the asymmetry, 30 min to add the test. **Risk:** Low.

---

## P2 — Cleanup backlog

### P2-1: `RentalRepository` interface + `RentalRepositoryImpl` are 90% dead code

- `fetchHubs` / `fetchVehicles`: never called by any screen.
- `subscribePlan`: called by the now-removed `RiderNotifier.subscribePlan` (or never — verify) — current `ChoosePlanScreen` calls `VoltiumApiService().subscribePlan` directly.
- `syncPickup`: never called.
- `submitVehicleReturn`: called by the dead `RiderNotifier.submitVehicleReturn`.

~90 lines of dead code. Either delete the repository pattern or wire it through. The repository pattern would be the right architecture, but the screen layer is bypassing it everywhere, so the current code is the worst of both worlds.

**Effort:** 1h to delete, 3-4h to properly wire. **Risk:** Low (delete) / Medium (wire).

### P2-2: `32_rental_end_test.dart` is a one-line smoke test that does not exercise the rental flow at all

```dart
testWidgets('Rental – dashboard accessible', (tester) async {
  await fullLoginFlow(tester);
  await expectOnDashboard(tester);
});
```

This is a complete-journey test that stops at the dashboard. It does not test the rental details screen, the end-rental flow, the photo grid, the odometer, the parallel upload, the success path, or any of the P0s/P1s above. **None of the rental feature is covered by tests.**

Suggested tests to add (would have caught the P0s):
1. **P0-1 test:** Subscribe to plan → end rental from details → assert user lands back on details (or dashboard) within 3 seconds.
2. **P0-2 test:** Open rental details → admin revokes KYC via API → trigger app foreground → assert user is routed off the rental details.
3. **P0-3 test:** Call `RiderNotifier.submitVehicleReturn([file1, file2])` → assert the API call payload includes the real vehicleId and hubId (not empty strings).
4. **P1-4 test:** Open rental details with a plan that ended 3 days ago → assert copy is "Expired 3 days ago" (not "0 Days").
5. **P1-1 test:** Render `PlanSuccessScreen` twice (e.g. via theme change) → assert `PostHogService.capture` was called exactly once.
6. **P1-6 test:** Mock camera failure → tap a photo slot → assert snackbar appears with the error message.

**Effort:** 4-6h for the full set. **Risk:** Low.

### P2-3: `rental_details_screen.dart` `_calculateEndDate` helper duplicates `AppConstants.getPlanDurationDays` logic

The screen has a private `_calculateEndDate(startDate, plan)` (line 313-317) that adds `getPlanDurationDays(plan)` to `startDate`. The `PlanCard` on the dashboard also has a `DateHelpers.daysRemaining(endDate)` and the server is the source of truth for `planEndDate`. The screen-level calc is a fallback for when the server doesn't send `planEndDate`, but the fallback uses the same `defaultPlanDurationDays = 7` (a hardcoded weekly assumption) — so an unknown plan type falls back to "your plan ends 7 days after start", which is wrong for monthly and elite plans. A "No plan end date" copy would be safer.

**Effort:** 10 min. **Risk:** Low.

### P2-4: `rental_details_screen.dart` mixes the rental info section with the action buttons — no separation of concerns

The screen is 318 lines of one `build` method with the header, info card, and action buttons all inline. A small refactor to `RentalHeaderCard`, `RentalInfoCard`, `RentalActionButtons` would shrink the screen to ~80 lines of layout and make each piece individually testable.

**Effort:** 1h. **Risk:** Low.

### P2-5: `end_rental_screen.dart` is 776 lines of one file with `_buildWarningCard`, `_buildPhotoGrid`, `_buildOdometer`, `_buildBattery`, `_buildCheckbox`, `_buildConfirmButton` as private methods

Same as P2-4. The widgets would be more reusable if they were top-level widgets in `widgets/end_rental/`. The existing `return_step_indicator.dart` could host the warning card. The existing `end_rental_photo_grid.dart` already exists (see P1-3).

**Effort:** 2h. **Risk:** Low.

### P2-6: Inconsistent error UX across the rental screens

- `choose_plan_screen.dart:132-136` uses a `SnackBar` for subscribe errors.
- `end_rental_screen.dart:200-206` uses a `SnackBar` for submit errors.
- `rental_details_screen.dart` has no error UX (read-only screen).
- `end_rental_screen.dart:79-87` (photo upload catch) silently counts failures via `_uploadedCount += 1` but does not surface them — the rider sees "2/4 uploaded" and doesn't know that 2 failed. The submit still goes through with only 2 photo URLs.

The PR-66 fix was good (added cancel + progress) but the failure-surfacing was missed. A failed photo should be marked red in the grid, and the submit should require at least 3 of 4 photos to succeed.

**Effort:** 1h. **Risk:** Low.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-1** Wire `onSuccess` from rental-details end-rental push | rental_details_screen.dart | 10min | Low |
| 2 | **P0-3** Delete `RentalRepository.submitVehicleReturn` (or fix) | features/rentals/ | 30min | Low |
| 3 | **P0-4** Add `engagementProvider.logout()` to `RiderNotifier.logout()` | rider_provider.dart | 5min | Low |
| 4 | **P1-1** Move PostHog capture from `build` to `initState` (or guard) | plan_success_screen.dart | 15min | Low |
| 5 | **P1-5** Replace `'7d 0h'` fallback with `'—'` | date_helpers.dart | 5min | Low |
| 6 | **P1-4** Distinct "expired N days ago" copy | rental_details_screen.dart | 20min | Low |
| 7 | **P1-7** Symmetrize `_toDouble` paise flag | rider_model.dart | 5min | Low |
| 8 | **P1-2 / P1-3** Delete dead `PlanCardTile`, `PlanHeaderCard`, `EndRentalPhotoGrid` OR wire them in | features/rentals/ | 30min–2h | Low |
| 9 | **P1-6** Surface camera failure in `EndRentalScreen` | image_compression_service.dart + end_rental_screen.dart | 30min | Low |
| 10 | **P0-2** Add `rentalDetails` to `AuthState` and route it | app_state.dart + router_body.dart + active_dashboard_screen.dart | 1-2h | Medium |
| 11 | **P2-6** Surface failed photo uploads in the end-rental grid | end_rental_screen.dart | 1h | Low |
| 12 | **P2-2** Add the 6 suggested tests | flutter/integration_test/e2e_individual/ | 4-6h | Low |
| 13 | **P2-1** Delete the rest of `RentalRepository` (or properly wire it) | features/rentals/ | 1-3h | Low/Medium |

**Suggested PR shape (each shippable independently):**
- **PR: "P0-1 + P0-4 + P1-1 — rental success + logout reset + PostHog"** — 3 small fix-one-thing PRs merged into 1 for review ease. ~30 lines, 3 files.
- **PR: "P0-3 + P1-2 + P1-3 — clean up dead code in rentals/"** — delete the dead repository method, the dead `PlanCardTile`, `PlanHeaderCard`, `EndRentalPhotoGrid`. ~500 lines deleted net. Pure refactor, no behavior change.
- **PR: "P1-4 + P1-5 + P1-7 — date copy + hardcoded fallback"** — fix the misleading date displays. ~30 lines, 3 files.
- **PR: "P0-2 — rental details in AuthState"** — architectural fix, touches the router. ~80 lines, 4 files. Higher risk, separate PR.
- **PR: "P2-2 — rental test coverage"** — add the 6 tests. Higher effort but high value.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **Rental details screen** | None | The P0-1 success-navigation bug. The P0-2 lifecycle-routing bug. The P1-4 "0 Days" copy bug. The P1-1 PostHog double-fire bug. The P2-3 fallback-date bug. |
| **Choose plan** | None | The plan-subscribe flow. The "best value" badge logic. The "current plan" pre-selection logic. The "Pay advance rent" checkbox state. The retry-on-error UX. |
| **Plan success** | None | The PostHog-once semantics (P1-1). The "Proceed to Pickup" button wiring. |
| **End rental** | None | The P0-1 success path. The PR-66 parallel-upload cancel semantics. The photo failure surfacing. The odometer validation. The "I confirm" checkbox. The camera-failure UX (P1-6). |
| **Repository / model** | Some unit tests (rider_model) | The `RiderNotifier.submitVehicleReturn` empty-strings bug (P0-3). The `_toDouble` paise-flag asymmetry (P1-7). |

**The `32_rental_end_test.dart` integration test is a complete-journey smoke test that ends at the dashboard — it has zero coverage of the rental feature itself.** The 33-test inventory listed in the AGENTS context is misleading on this one file. A more honest test name would be `01_full_auth_login_test_alt.dart`.

The most valuable tests to add (in priority order):
1. **P0-1 test:** end-rental from details → assert the screen pops back to details (or dashboard) within 3 seconds.
2. **P0-3 test:** call `RiderNotifier.submitVehicleReturn` → assert the API payload includes real IDs (not empty strings).
3. **P1-1 test:** mount `PlanSuccessScreen` → trigger a rebuild → assert PostHog fired exactly once.
4. **P1-4 test:** render rental details with a plan that ended 3 days ago → assert copy is "Expired 3 days ago".
5. **P1-6 test:** mock camera failure → tap a photo slot → assert snackbar appears.

---

## Architecture observations (informational)

1. **The rental features are reachable via 3 different paths** (router-managed AuthState, manual Navigator.push from dashboard, manual Navigator.push from workflow hub). The state of the rental flow is not centrally tracked — the rental details screen doesn't know if the user is in the middle of the pickup flow or just looking at their existing rental. The router-managed path is the cleanest (single source of truth), but the manual pushes bypass it. A wholesale refactor to "all rental flows are AuthStates" would make the lifecycle gate work for everything. Effort: ~6-8h, including the 7 other AuthState-less pushed screens.

2. **The `EndRentalScreen` accepts `onBack` and `onSuccess` callbacks** (lines 17-19) but defaults them to null with a Navigator.maybePop fallback for back and no-op for success. The asymmetric default (back: works, success: silent no-op) is exactly the bug in P0-1. The default for `onSuccess` should be `Navigator.maybePop(context)` to match the symmetric intent. ~3 lines.

3. **The `RiderRepository` interface in `domain/repository.dart` has 5 methods, of which 4 are dead** (see P2-1). The interface exists but the implementations are bypassed everywhere. This is "domain-driven theater" — the domain layer is shaped like the right architecture, but the screen layer doesn't honor it. Either commit to the repository pattern (refactor all the screens to use the repository) or delete it (use the API service directly). The current state is the worst of both.

4. **The `rental_details_screen.dart` is purely a `ConsumerWidget`** — no state. That's appropriate for a read-only view, but the screen makes ~15 `riderProvider.select(...)` calls via the single `ref.watch(riderProvider).rider` call. Any change to the rider state triggers a full screen rebuild (and the back-button shadow, the gradient card, the entire `_buildDetailRow` list). A `Consumer` widget that selects on specific fields would reduce the rebuild scope. Low priority but worth noting.

5. **The `PlanCardTile` widget in `widgets/choose_plan/plan_card_tile.dart` is a 270-line widget that does the same thing as 290 lines of inline code in `choose_plan_screen.dart`** — and the inline code has a "BEST VALUE" badge (line 175-194) that the widget also has. The widget could be parameterized with a `showHeader: bool` flag, and the screen could use it. The duplication is the result of a half-completed refactor (someone extracted the widget, then inlined a different version in the screen). The barrel file `choose_plan_widgets.dart` exists to export the dead widgets — it's an "intent" file that never got connected.

6. **The `EndRentalScreen._handleReturn` method (line 134-208) is the only production path for vehicle-return submission** — `RiderNotifier.submitVehicleReturn` is unused. The screen calls `api.submitVehicleReturn` directly with the riderId, photoUrls, and reason. The repository pattern was abandoned mid-flight. The code works, but the abstraction layer is misleading.

7. **The `_handleReturn` parallel-upload code (PR-66) has a subtle race condition**: `Future.wait` with `eagerError: false` will await ALL uploads even after one fails (the `rethrow` on line 167 is wrapped in `eagerError: false` which suppresses the throw). The `_uploadedCount` increments on success OR failure (line 165), which is good for UX but masks the failure from the submit logic. A failed upload results in the corresponding URL being absent from `photoUrls`, but the submit still goes through with N-1 URLs. The server may reject the submit or may accept it with missing photos. The error UX is the issue (P2-6).

8. **The `riderProvider.notifier` is created in `core/state/rider_provider.dart` as a Riverpod `Notifier`**, but the `submitVehicleReturn` method is a public method that any screen could call. The fact that no screen does call it suggests the original intent (have screens delegate to the notifier for business logic) was abandoned. The notifier owns 5+ methods that have no callers in the current codebase: `init`, `updateCredentials`, `registerFcmToken`, `submitVehicleReturn`. A dead-code sweep would be valuable.

---

## Out-of-scope notes

- **Pickup verification & vehicle photos** (in `features/pickup/`) feed into the rental flow but are audited separately as part of the pickup feature. The photo-capture code path shares `ImageCompressionService` and would benefit from the P1-6 fix.
- **Wallet & top-up flow** is its own feature, but the rental subscribe and end-rental both touch the wallet for advance rent and security deposit. The deposit-payment integration is audited separately.
- **Notifications** — the audit #4 P0-4 (admin never sends) + audit #7 P0-1 (dashboard never reads) cross-cut still applies: the rental flow has no notifications for "rental ending in 3 days", "rental ended successfully", etc. The end-rental success message is screen-only; no push is sent.
- **KYC re-verification on rental change** — the rental-details screen shows the assigned vehicle and team leader but does not surface the rider's KYC status. If KYC expires while the rider has an active rental, the screen does not warn them. A future audit of the profile/KYC feature should pick this up.
- **The admin side of rental cancellation** — if an admin force-cancels a rental via the web panel, the rider's app does not receive a push (per audit #4 P0-4) and the rental details screen continues to show the now-cancelled rental as "ACTIVE". A polling-based check on the rental details screen would catch this, but the screen does no polling of its own (it relies on the dashboard's poll).
- **The `rentalStatus` field on the rider model has the values 'NONE', 'ACTIVE', 'OVERDUE', etc. but the rental details screen just calls `.toUpperCase()` and displays it as a chip with no logic for OVERDUE.** A "your rental is overdue" red warning banner would be a small P1 add.
- **The security deposit field on the rental details screen is read-only** — there's no way for the rider to see when the deposit was paid, when it's refundable, or what condition it's in. The wallet feature has a deposit ledger that the rental details screen could link to.
- **The team leader and pickup hub are shown as plain strings** — there's no deep-link to a map view of the hub, no phone-call shortcut to the team leader, no contact card. The pickup feature has a `tl_details_screen` that the rental details could link to.
- **The `rentalDetails` AuthState is not in the router** (P0-2), and neither are `vehiclePhotos`, `tlDetails`, `faq`, `myDocuments`, `topUpFlow`, `referralDetails`, `legalPage` — 7 other AuthState-less pushed screens. The same architectural fix would address all 8.

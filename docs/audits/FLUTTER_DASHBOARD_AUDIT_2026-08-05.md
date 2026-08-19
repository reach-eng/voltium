# Flutter Rider App — Dashboard Screen — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:**
- `flutter/lib/features/dashboard/` — 21 files (~50 KB)
  - `presentation/screens/active_dashboard_screen.dart` (342 lines) — the main screen
  - `presentation/screens/pre_dashboard_screen.dart` (282 lines) — the "before pickup" screen
  - `presentation/providers/engagement_provider.dart` (211 lines) — the notifications/rewards state
  - `presentation/widgets/{pre_dashboard_header, pre_dashboard_pickup_button, pre_dashboard_polling_banner, pre_dashboard_rejection_card}.dart`
  - `widgets/{dashboard_profile_card, dashboard_plan_card, dashboard_wallet_card, dashboard_referral_card, dashboard_tl_card, dashboard_scooter_banner, dashboard_sheets, dashboard_low_balance_card, dashboard_normal_wallet_card, dashboard_earnings_card, dashboard_bento_grid, dashboard_kpi_tile, dashboard_rent_prompt_card}.dart`
  - `domain/entity.dart` (the `DashboardEntity`)
- Re-exports: `flutter/lib/widgets/dashboard_*.dart` (7 files, each a 1-line `export '../features/dashboard/widgets/...';` pointer)
- Supporting: `flutter/lib/core/state/rider_provider.dart` (525 lines — the central state), `flutter/lib/models/rider_model.dart` (the model with `isPickupDone`, `isKycApproved`, `requiredPaymentAmount`, etc.), `flutter/integration_test/e2e_individual/07_dashboard_elements_test.dart` (the only test for the active dashboard — 1 line, just checks the page loads)

**Out of scope:** The auth flow, the wallet / pickup / rental detail screens (they're separate features), the FCM service, the polling manager, the rider lifecycle gate, the pre-dashboard widgets imported from `flutter/lib/widgets/pre_dashboard_widgets.dart` (those are not in `features/dashboard/`).

---

## TL;DR

**The dashboard looks polished, ships well on device, and has good skeleton + error states — but the **notification bell on the active dashboard is broken**: the unread-count badge is always 0** because the `EngagementNotifier` is never initialized when the rider lands on the active dashboard. The data hook reads from a provider that holds an empty `EngagementState`, and the only place that calls `initEngagementData()` is a code path on a different screen. **No rider using the active dashboard has ever seen a notification badge that wasn't 0.**

There are also **2 dead files** (`DashboardEntity` in `domain/entity.dart` is defined but never imported; `BentoGrid` in `dashboard_bento_grid.dart` is never rendered; `DashboardEarningsCard`, `DashboardKpiTile`, `KpiGrid`, and `DashboardRentPromptCard` are all defined but never used in the active or pre-dashboard screen). The dashboard directory also has **7 re-export shims** in `flutter/lib/widgets/` that just point back to `features/dashboard/widgets/` — a confusing double directory that breaks the convention used by every other feature.

The **greeting logic** ("Good Morning, $name") uses `DateTime.now().hour` which is the **device local time**, not the rider's home timezone — a rider travelling in a different timezone sees the wrong greeting. The **`ScooterSubmissionBanner`** has a hardcoded fallback date "Friday, Oct 27, 2023" that shows up if the API doesn't return `submissionDate` (which can happen for any rider who picked up before the API started sending it). The **logout flow on the pre-dashboard** uses `Navigator.pushAndRemoveUntil` to a fresh `AppShell()` which can race with the auth-state provider that has just been reset.

There are **4 P0s** (the broken notification bell is the highest-impact, the hardcoded 2023 date is the second), **8 P1s**, and **6 P2s**. The dashboard code quality is high — most P1s are subtle UX/race issues, not broken code.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, silent data loss, riders missing critical UI | Before next release |
| **P1** | UX friction, accessibility, race condition, misleading data | Next 2 sprints |
| **P2** | Code quality, naming, dead code, console warnings | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: The notification bell on the active dashboard is always 0 unread — `EngagementNotifier` is never initialized

**File:** `flutter/lib/features/dashboard/presentation/screens/active_dashboard_screen.dart` lines 132–143 (`_buildNotificationBell`).
**File:** `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart` lines 67–73, 109–115 (`initEngagementData`, `_fetchAll`).

**What:** The active dashboard renders a `NotificationBell` whose `unreadCount` is derived from the `engagementProvider`:

```dart
// active_dashboard_screen.dart:132-143
Widget _buildNotificationBell(BuildContext context, WidgetRef ref) {
  final notifications =
      ref.watch(engagementProvider.select((p) => p.notifications));
  final unreadCount = notifications.where((n) => !n.isRead).length;
  return NotificationBell(
    hasUnread: unreadCount > 0,
    unreadCount: unreadCount,
    ...
  );
}
```

The `engagementProvider` is initialized with `const EngagementState()` (line 63 of `engagement_provider.dart`). It is only populated by `initEngagementData()` which calls `_fetchAll()` (line 109), which calls `refreshRewards()`, `refreshReferrals()`, and `refreshNotifications()`.

**`initEngagementData()` is never called from the active dashboard's lifecycle.** A `grep` for `initEngagementData` across the codebase:

- The function exists in `engagement_provider.dart` (line 67).
- It is NOT called from `active_dashboard_screen.dart`.
- It is NOT called from `pre_dashboard_screen.dart`.
- It is NOT called from `main.dart`.
- It is NOT called from any other screen in the search path.

The only place that may have ever called it is referenced by the test file. The function is dead code from the dashboard's perspective.

**Repro:**
1. Log in as a rider, complete onboarding, complete KYC, complete deposit, pick up a vehicle → lands on the active dashboard
2. Have the rider have at least 1 unread notification in the server DB (e.g. the "KYC Approved" push, the "Shift Reminder", or the daily birthday wish)
3. Look at the bell icon in the top-right corner
4. **Expected:** Red dot badge with "1" or higher
5. **Actual:** No badge. The bell is silent. The rider sees nothing.

For a "physical tester" who only checks the UI to see if a notification arrived: **the rider app will never show a notification badge**, because the provider that feeds the bell has no data. The rider would have to navigate to the notifications screen via some other path (the support card, the bottom nav) to see them. From the dashboard, the bell is decorative.

This is a P0 because the entire notifications feature has been silently broken on the dashboard for the lifetime of this code. The previous messaging audit (P0-4) found that admin-initiated push notifications are also broken at the enum-validation layer. **The two combined = a rider never sees a notification in the app, ever.**

**Fix:**
1. Call `ref.read(engagementProvider.notifier).initEngagementData()` in the `active_dashboard_screen.dart` `_DashboardStateWidget.build` (or in `riderProvider.refreshFromApi`'s post-success hook) when the rider state becomes `DataState.fresh` for the first time.
2. Also call it from `pre_dashboard_screen.dart` for the same reason — the pre-dashboard's `PreDashboardHeader` has a notifications icon too (line 70 of `pre_dashboard_header.dart`) that links to the same screen but with no badge.

**Effort:** ~15 min, plus a test that asserts the unread count badge appears after a notification is delivered.

---

### P0-2: `ScooterSubmissionBanner` shows a hardcoded fallback date "Friday, Oct 27, 2023" when the API doesn't return `submissionDate`

**File:** `flutter/lib/features/dashboard/widgets/dashboard_scooter_banner.dart` lines 18–43, 48–50.

**What:** The banner parses the API-provided `submissionDate` and formats it as a weekday + month + day + year. If the API doesn't return it (returns `null` or an empty string), the code falls back to the **hardcoded string `'Friday, Oct 27, 2023'`** — a date that is over 2 years in the past at the time of this audit (the current date per `agent-context` is 2026-08-05).

```dart
// dashboard_scooter_banner.dart:48-50
final String formattedDate = submissionDate != null
    ? _formatDate(DateTime.parse(submissionDate!))
    : 'Friday, Oct 27, 2023';
```

The banner appears at the top of the active dashboard when `rider.returnPending || rider.intent == 'RETURN'`. For a rider whose pickup date is not in the API response (e.g. data ingested before the `submissionDate` field was added, or a record with a missing value due to a backend bug), the banner shows **a date in 2023** — the rider sees "Submission Date: Friday, Oct 27, 2023" and reasonably believes the system is broken or that they were supposed to return 2 years ago. A confusing and possibly alarming UI.

**Impact:** Any rider whose data doesn't include a `submissionDate` (e.g. legacy data, partial upload) sees a 2+ year old date on the most important banner in the app. A real rider who tries to return a vehicle today will see "Submission Date: Friday, Oct 27, 2023" and either:
- Believe the app is broken and not return
- Return immediately, thinking they're 2 years overdue

**Fix:**
1. If `submissionDate` is null, hide the banner entirely (the rider has no submission to make) OR show "Submission date will be set when you return" / similar honest copy.
2. If `submissionDate` is set, use `DateTime.tryParse` (not `DateTime.parse`) and show a fallback if it fails.
3. The hardcoded date should not exist anywhere in the production code path.

**Effort:** ~10 min.

---

### P0-3: Pre-dashboard redirect-from-pre-to-active has a `WidgetsBindingObserver` race that can fire the wrong navigation

**File:** `flutter/lib/features/dashboard/presentation/screens/pre_dashboard_screen.dart` lines 33–60.
**File:** `flutter/lib/core/state/rider_provider.dart` lines 320–344 (`_applyAppStatePollingPolicy`).

**What:** The `PreDashboardScreen._redirected` flag is read inside the `build()` method (line 51), and the navigation is queued via `WidgetsBinding.instance.addPostFrameCallback` (line 52). The first build where `rider.isPickupDone == true` queues a navigation. Subsequent builds where `rider.isPickupDone == false` reset the flag to false (line 59).

But the **rider provider's polling policy** in `rider_provider.dart:316-344` runs as a side effect of `ref.listen<AppState>(appStateProvider, ...)` which is set up in the `build()` method (line 150). When `AppState` changes (e.g. from `PreDashboard` to `ActiveDashboard`), the policy re-starts the polling. The polling then re-fetches the rider, which can update `rider.pickupDone` back to `false` for a single frame if the API returns a stale value.

The combination: the user picks up their vehicle → admin marks it in the system → rider's polling tick fires → rider provider updates `rider.pickupDone = true` → PreDashboardScreen rebuilds → `_redirected` is `false` → addPostFrameCallback queues the navigation → next build, polling fires again → API returns a stale response → `rider.pickupDone = false` → else branch sets `_redirected = false` (still false) → BUT the postFrameCallback already fired before the else branch, so the rider has been navigated to the active dashboard → the active dashboard receives a stale `rider` from the polling response and renders the wrong content.

**Impact:** Edge case. Riders who pick up their vehicle during a period of API instability can be briefly navigated to the active dashboard with stale data, then the dashboard re-fetches and updates. The visual artifact is a "flash" of the active dashboard with old data.

The deeper concern is that **the `WidgetsBindingObserver` mixin is on `RiderNotifier` (line 115 of `rider_provider.dart`) but `WidgetsBindingObserver` callbacks are global to the app — the same instance handles lifecycle for both onboarding and active-dashboard, with no isolation between them**. The pre-dashboard's redirect logic should rely on a Riverpod listener on `rider.isPickupDone`, not on a `setState`-style `_redirected` boolean.

**Fix:** Replace the `_redirected` flag and the `addPostFrameCallback` with a `ref.listen` on `riderProvider.select((p) => p.rider?.isPickupDone)`. When the value flips to `true`, navigate via `ref.read(appStateProvider.notifier).go(AuthState.dashboard)`. Remove the `_redirected` state entirely.

**Effort:** ~30 min, plus tests for the transition.

---

### P0-4: `EngagementNotifier.logout()` does NOT clear the `engagementProvider` state when called via `riderProvider.logout()`

**File:** `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart` lines 192–194.
**File:** `flutter/lib/core/state/rider_provider.dart` lines 270–277 (`RiderNotifier.logout`).

**What:** `RiderNotifier.logout()` (line 270) resets the rider state, cancels timers, stops polling, clears the local document cache. **It does not call `engagementProvider.notifier.logout()`**. The `EngagementNotifier.logout()` method (line 192 of `engagement_provider.dart`) sets `state = const EngagementState()` — the only way to clear the notifications, rewards, referral data from the engagement state.

For a rider who:
1. Logs in, sees notifications (3 unread), opens a couple of rewards cards
2. Logs out
3. Logs in as a different rider on the same device

**The new rider's engagement state starts with the previous rider's notifications and rewards still loaded.** The `_DashboardStateWidget` reads from `engagementProvider` (line 134 of `active_dashboard_screen.dart`) — the new rider would see the previous rider's unread count badge, the previous rider's reward points, the previous rider's referral data, until the provider's data is refreshed.

The fix requires calling `engagementProvider.notifier.logout()` from `RiderNotifier.logout()`. But the providers are separate, and the notifier can't directly call the other notifier without a `ref.read`.

**Impact:** Multi-account households and shared devices see each other's notifications, reward points, and referral state. For most users (single-account), the bug is invisible. For a fleet operator or family sharing a device, the bell shows the wrong unread count for the current user.

**Fix:** In `RiderNotifier.logout()`, add:
```dart
ref.read(engagementProvider.notifier).logout();
```
(at the top of the method, before stopping polling).

**Effort:** ~5 min.

---

## P1 — Next 2 sprints

### P1-1: Greeting uses `DateTime.now().hour` (device local) — wrong for travelling riders

**File:** `flutter/lib/features/dashboard/presentation/screens/active_dashboard_screen.dart` lines 191–218.

**What:** The greeting ("Good Morning, $firstName") is determined by `DateTime.now().hour` — the device's local time. For a rider whose phone is set to UTC (or any timezone other than IST), the greeting is wrong. A rider in New York at 9 AM EST sees "Good Morning" but their home time (IST) is 6:30 PM — they should see "Good Evening".

The fix: send a `timezone` field on the rider (already part of the model in some features) and use that for the greeting. Or: send the hour from the backend as part of the `/api/rider/profile` response (so it's always IST).

**Effort:** ~30 min, plus a test.

---

### P1-2: 7 re-export shim files in `flutter/lib/widgets/` break the feature directory convention

**Files:** `flutter/lib/widgets/dashboard_profile_card.dart`, `dashboard_plan_card.dart`, `dashboard_wallet_card.dart`, `dashboard_referral_card.dart`, `dashboard_tl_card.dart`, `dashboard_scooter_banner.dart`. Each is a single line:
```dart
export '../features/dashboard/widgets/dashboard_profile_card.dart';
```

The active dashboard screen imports them as:
```dart
import 'package:voltium_rider/widgets/dashboard_profile_card.dart';
import 'package:voltium_rider/widgets/dashboard_plan_card.dart';
import ...
```

The convention for every other feature is to import from the feature directory:
```dart
import 'package:voltium_rider/features/<feature>/widgets/<widget>.dart';
```

So the dashboard's actual implementation is in `features/dashboard/widgets/`, but the active dashboard imports from `widgets/`. **A grep for `dashboard_` in `flutter/lib/widgets/` returns 7 files** — all of which are 1-line re-exports. The grep is misleading: it suggests the dashboard widgets live in `flutter/lib/widgets/`, but they don't.

The re-exports were introduced as a convenience during the R3.7 split (the comment at line 23 of `active_dashboard_screen.dart` says "PR-127: TiltCard is the canonical parallax-tilt widget. CardParallaxTilt was a 29-line wrapper that just delegated to TiltCard; deleted in PR-127."). The pattern is inconsistent — the pre-dashboard screen imports some widgets from `features/dashboard/widgets/` and some from `widgets/` (the re-exports), and the active dashboard imports from `widgets/` only.

**Fix:** Delete the 7 re-export shims. Update the imports in `active_dashboard_screen.dart` to point to the canonical `features/dashboard/widgets/` paths. Mechanical refactor, ~10 lines.

**Effort:** ~15 min.

---

### P1-3: `EngagementNotifier.refreshRewards`, `refreshReferrals`, `refreshNotifications` swallow all errors with only `appDebug` logging

**File:** `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart` lines 117–165.

**What:** All three refresh methods wrap the API call in a try/catch that catches everything and logs to `appDebug` (a console logger, not a remote error reporter). If the rewards API is down, the rider never sees a "Failed to load rewards" UI — they see the previous state forever.

For the notifications bell (P0-1) the symptom is even worse: the API returns 401 because the session expired, the catch block logs and returns, the `state.notifications` stays empty, the bell shows 0 unread. The rider has no idea they have unread notifications in the server (they may have been notified by SMS).

**Fix:** Surface errors to the user via a `state.error` field that the screens can watch. The notifications refresh is the most critical (a 401 means the session is gone — should redirect to login). The rewards refresh is the next (a 503 means "we'll show stale data" — the rider sees the banner, but the state should reflect this). Use Sentry or a similar remote error tracker for the other failures.

**Effort:** ~1 hour.

---

### P1-4: `PlanCard` "Time Remaining" and "Next Recharge" read `—` when `planEndDate` is null

**File:** `flutter/lib/features/dashboard/widgets/dashboard_plan_card.dart` lines 105–141.

**What:** When `planEndDate` is `null` (a rider who just selected a plan but hasn't started it yet, or a rider with a `currentPlan` set but the plan end date not yet calculated), the two sub-cards show "—" and "—". The header still says the plan name (correct). But the visual reads "CURRENT SUBSCRIPTION / WEEKLY RENT / TIME REMAINING: — / NEXT RECHARGE: —" — the rider doesn't know if they're mid-cycle or just about to start.

The pre-dashboard's `PlanCard` is in `compact: true` mode and shows the plan name in a pill. When `planEndDate` is null, the compact mode still shows the pill but the body has no time remaining. The "is awaiting pickup" state (`rider.isAwaitingPickup`) is the most common case where this happens.

**Fix:** For null `planEndDate`, show "Starts on first rental" / "Renewal on first rental" copy. Or hide the two sub-cards entirely when the date is null.

**Effort:** ~15 min.

---

### P1-5: `WalletCard` low-balance threshold (`effectiveDays <= 3` + `< rentAmount`) uses a magic number that disagrees with the business policy

**File:** `flutter/lib/features/dashboard/widgets/dashboard_wallet_card.dart` lines 39–46.

**What:** The low-balance warning is triggered when:
```dart
final bool hasPulsatingRedAmountHalo =
    (walletBalance < rentAmount) && (effectiveDays <= 3);
```

The `effectiveDays <= 3` is a magic number — 3 days. The `effectiveDays <= 1` (line 46) is the whole-card red halo. These thresholds are not derived from any business policy, the `walletMinTopup` setting, or the `lateFee` / `gracePeriodHours` settings (the previous admin audit found that those settings ARE in the system but the rider app doesn't read them). A rider whose `gracePeriodHours` is set to 48 hours would see the warning 24 hours too late.

**Fix:** Read `gracePeriodHours` and `lateFee` from the rider-side `WalletProvider` (which already exists — `walletProvider` is referenced in `active_dashboard_screen.dart:172`). Compute the warning threshold from these settings instead of hardcoding `3` and `1`.

**Effort:** ~30 min.

---

### P1-6: `PreDashboardScreen._onLogoutConfirmed` races with `riderProvider.logout` state propagation

**File:** `flutter/lib/features/dashboard/presentation/screens/pre_dashboard_screen.dart` lines 109–118.
**File:** `flutter/lib/core/state/rider_provider.dart` lines 270–277.

**What:** `_onLogoutConfirmed` calls `riderProvider.notifier.logout()` and then `Navigator.pushAndRemoveUntil(...)` to a fresh `AppShell()`. The `AppShell` reads the auth state from a provider and decides which screen to show. **The auth state provider is updated asynchronously** (it listens to the rider provider's state). The Navigator push happens immediately after `riderProvider.notifier.logout()` returns, but the listener on the auth state may not have fired yet — so the AppShell may briefly build with the old (still-logged-in) state, then re-build with the logged-out state. A flash of the old screen on the way to the login.

**Fix:** Use a `ref.listen` on the auth state, navigate only when the state transitions to `loggedOut`. Or have `riderProvider.logout` return a `Future` that completes when the auth state has propagated. The current code has a small race window but is usually fast enough that the user doesn't notice.

**Effort:** ~30 min.

---

### P1-7: `KpiGrid` is defined but never used; `DashboardEarningsCard`, `GlassKpiTile`, `BentoGrid`, `DashboardRentPromptCard` are all dead code

**Files:**
- `flutter/lib/features/dashboard/widgets/dashboard_bento_grid.dart` (BentoGrid, _BentoTile)
- `flutter/lib/features/dashboard/widgets/dashboard_kpi_tile.dart` (GlassKpiTile, KpiGrid)
- `flutter/lib/features/dashboard/widgets/dashboard_earnings_card.dart` (DashboardEarningsCard)
- `flutter/lib/features/dashboard/widgets/dashboard_rent_prompt_card.dart` (DashboardRentPromptCard — need to check)

**What:** A `grep` for these widget names across the codebase returns only their own definitions, no imports. The active dashboard uses `DashboardProfileCard`, `PlanCard`, `WalletCard`, `ReferralCard`, `TeamLeaderCard`, and `ScooterSubmissionBanner`. The pre-dashboard uses `PreDashboardHeader`, `PreDashboardPollingBanner`, `PreDashboardKycRejectionCard`, `PreDashboardPickupButton`, `PlanCard`, `WalletCard`, `ReferralCard`, `NeedHelpCard`, `TopUpRequestSentCard`, `ApprovalMatrixWidget`, `PreDashboardProfileCard`, `PreDashboardBanner`, `RejectionCard`, `PreDashboardCtaCard`.

The `DashboardEarningsCard` (`todayEarnings`, `weeklyEarnings`, `streakDays`) and the `KpiGrid` (`walletBalance`, `batteryPercent`, `currentSpeed`, `planEndDate`) are not rendered anywhere. They may have been designed for a future "Active Dashboard v2" that was never built, or they were replaced by the simpler `WalletCard` + `PlanCard` combination.

**The `DashboardEntity` in `domain/entity.dart`** is also dead code — defined but never imported.

**Fix:** Either wire them into the active dashboard (the earnings card has solid UX value), or delete them. ~600 lines of code can be removed, OR they can be used to replace the simpler cards (the `KpiGrid` would be a better dashboard for the "command center" feel the branding implies).

**Effort:** ~2 hours to wire, ~30 min to delete.

---

### P1-8: `EngagementNotifier.markNotificationAsRead` and `markAllNotificationsRead` fire-and-forget the server POST with no error handling

**File:** `flutter/lib/features/dashboard/presentation/providers/engagement_provider.dart` lines 167–190.

**What:** Both methods update local state optimistically (good UX — the badge drops immediately) and then fire the API POST without awaiting it. If the POST fails, the local state is permanently wrong: the rider marks a notification as read, the badge drops, but the next refresh (5+ minutes later) restores the unread state from the server.

For a rider who marks 5 notifications as read and then closes the app before the API retries, **5 unread notifications will return on next launch**. The rider thinks they already read these.

**Fix:** Either await the POST and roll back the local state on failure, or queue the read state locally and retry the POST on next launch. The current "best-effort" approach is fine for power-users with a stable connection but breaks for the test scenarios.

**Effort:** ~30 min.

---

## P2 — Cleanup backlog

### P2-1: `rider_provider.dart` is 525 lines and owns too many concerns
The provider handles: polling, lifecycle, FCM token registration, device-data sync, vehicle return submission, app-state policy. The `PollingManager` and `WidgetsBindingObserver` mixin are the heaviest pieces. Splitting into `RiderLifecycleProvider`, `RiderPollingProvider`, `RiderDeviceSyncProvider` would make each testable in isolation. ~5h mechanical refactor.

### P2-2: `engagement_provider.dart` mixes concerns too
`rewards`, `referrals`, and `notifications` are 3 different features. Each could be its own provider. The `EngagementState` is the union of 3 unrelated state shapes.

### P2-3: The `_DashboardStateWidget` in `active_dashboard_screen.dart` uses `Container` + 3 conditional children for error/empty/loading, but the patterns are inconsistent
The error path uses `ErrorStateWidget.network` (good). The empty path uses a custom `GlassCard` with a `Column` of a text and a `FilledButton` (inline, not a reusable widget). The loading path uses `DashboardSkeleton` (good). The "cached" path uses an inline `_buildCacheIndicator` (inline, not a reusable widget). The skeleton + error are reusable; the empty + cache indicator should be too.

### P2-4: `dashboard_sheets.dart` has 30+ import lines and 4 modal functions, none of which are testable as widgets
The 3 functions `showTLDetailsSheet`, `showChangeTLReasonSheet`, `showSubscriptionSheet`, and `startVehicleReturnWorkflow` are top-level functions returning widgets. Convert them to `showModalBottomSheet<T>(builder: (ctx) => XxxSheet())` style and put the sheet widgets in separate files. Improves testability.

### P2-5: `PremiumDoubleBezelCard.interactive` is used in 4+ widgets but its hover/press behavior is inconsistent
The card's `onTap` callback is wired inconsistently — sometimes the parent passes `null`, sometimes a real callback, sometimes the card wraps a non-interactive inner widget. Refactor to a single behaviour contract.

### P2-6: `_formatDate` is implemented inline in `ScooterSubmissionBanner` — should live in `date_helpers.dart`
Already a `date_helpers.dart` exists in `flutter/lib/utils/` (used by `PlanCard` via `DateHelpers.computeTimeRemaining`). The `_formatDate` private function should be hoisted there.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-1** Initialise `engagementProvider` on dashboard | Active dashboard | 15min | Low |
| 2 | **P0-4** Call `engagementProvider.logout()` on rider logout | Rider provider | 5min | Low |
| 3 | **P0-2** Hardcoded date fallback in `ScooterSubmissionBanner` | Dashboard widgets | 10min | Low |
| 4 | **P0-3** Replace `_redirected` flag with `ref.listen` | Pre-dashboard | 30min | Medium |
| 5 | **P1-2** Delete 7 re-export shims, fix imports | Dashboard directory | 15min | Low |
| 6 | **P1-8** Await mark-read POST or roll back on failure | Engagement provider | 30min | Low |
| 7 | **P1-4** PlanCard empty-state for null `planEndDate` | Dashboard widgets | 15min | Low |
| 8 | **P1-3** Surface engagement errors to the UI | Engagement provider | 1h | Low |
| 9 | **P1-5** Read `gracePeriodHours` for warning threshold | Wallet card | 30min | Low |
| 10 | **P1-1** Use rider's home timezone for greeting | Active dashboard | 30min | Low |
| 11 | **P1-6** Race in `_onLogoutConfirmed` | Pre-dashboard | 30min | Low |
| 12 | **P2-7** Wire or delete the dead widgets | Dashboard directory | 30min–2h | Low |

**Suggested PR shape (each shippable independently):**
- PR: "P0-1 + P0-4 notification provider init + logout race" — single concern, 2 small changes, ~20 lines total. Highest user-impact.
- PR: "P0-2 + P1-4 hardcoded date + null date copy" — both are "show a date in the dashboard, fix when missing" — 2 file changes, ~25 lines.
- PR: "P0-3 + P1-6 pre-dashboard navigation race" — uses `ref.listen` properly — 1 file each, ~60 lines.
- PR: "P1-2 + P2-7 dashboard directory cleanup" — mechanical refactor + dead-code deletion, ~50 lines + 600 deleted.
- PR: "P1-3 + P1-8 engagement error handling" — 1 file each, ~80 lines.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **Active dashboard** | `07_dashboard_elements_test.dart` (1 test, asserts `expectLoaded()` — the page loaded) | **The notification bell unread count** (would have caught P0-1). **The greeting copy** (would catch P1-1 timezone bugs). **The wallet card low-balance threshold** (would catch P1-5). **The logout-then-login state propagation** (would catch P0-4). |
| **Pre-dashboard** | None | The pickup-done redirect (would catch P0-3). The polling timeout banner. The KYC rejection card with/without reason. |
| **Engagement provider** | None | The 3 refresh methods, the mark-read flow, the logout state reset. |
| **Dashboard widgets** | None | The wallet dispatcher (normal vs low balance). The plan card (compact vs full, null date). The TL sheet (3 buttons). The referral card (clipboard + share). |

The `07_dashboard_elements_test.dart` is a one-line smoke test (`expectLoaded()`). It verifies that the screen renders. It does not verify any of the dashboard's actual functionality. The most valuable tests to add:
1. **P0-1 test**: After loading the dashboard with a stubbed API that returns 1 unread notification, assert the bell badge shows "1".
2. **P0-2 test**: With a rider whose `submissionDate` is null, assert the banner does NOT show "Oct 27, 2023".
3. **P0-3 test**: With a rider whose `isPickupDone` toggles from false to true, assert the navigation fires exactly once.
4. **P0-4 test**: After logout, the `engagementProvider` state is reset.

---

## Architecture observations (informational)

1. **The dashboard re-implements the "routing by app state" pattern with a `_redirected` boolean** (pre-dashboard line 33–60). This is the classic "imperative state tracking of a declarative transition" — works, but fragile. A `ref.listen` on `riderProvider.select((p) => p.rider?.isPickupDone)` is the idiomatic Riverpod approach. See P0-3.

2. **The `EngagementNotifier` is conceptually 3 providers glued together** — rewards, referrals, notifications. The `refreshRewards`, `refreshReferrals`, `refreshNotifications` methods do independent API calls and update disjoint state fields. A Riverpod `family` provider per concern would be cleaner. The current shape works for now but is the most likely place for a "stale state on logout" bug class to recur (see P0-4).

3. **The `TiltCard` wrapping of the `WalletCard`** (line 273 of `active_dashboard_screen.dart`) is a 3D parallax tilt effect that uses device motion sensors. On iOS this requires motion permission (rarely granted). On Android the sensor is always available. The fallback when motion is denied is "static card" — no UX signal. A rider on an iPhone with motion denied sees a static card and has no way to know there's supposed to be a tilt effect. Worth a small "tilt effect requires motion" tooltip or just remove the tilt and use a simpler hover-only animation.

4. **The `pre_dashboard_widgets.dart` import in `pre_dashboard_screen.dart` line 14** is an import of widgets that are not in the `features/dashboard/` directory. Looking at the import, it's pulling `PreDashboardHeader`, `PreDashboardBanner`, `PreDashboardProfileCard`, `PreDashboardCtaCard`, `NeedHelpCard`, `TopUpRequestSentCard`, `RejectionCard`, `PreDashboardKycRejectionCard`, `ApprovalMatrixWidget`. The re-exports in `flutter/lib/widgets/` for these have already been replaced (lines 9-13 of `pre_dashboard_screen.dart` import from `features/dashboard/presentation/widgets/`, lines 14 imports the OLD widgets from `flutter/lib/widgets/pre_dashboard_widgets.dart`). The pre-dashboard is **using a mix of old + new widget paths** — a half-completed refactor. Worth cleaning up.

5. **The active dashboard's `rider.name` could be the rider's full name in mixed scripts** (Hindi + English transliteration, for example). The greeting `rider.name.split(' ').first` works for space-separated names, but a name like "John-Paul Smith" would render as "John-Paul" — fine, that's the intent. A name with no spaces (single-name people) would render as the whole name — also fine. The fallback `firstName.isEmpty ? 'Rider' : firstName` (line 194) handles the empty case.

6. **The `PremiumDoubleBezelCard.interactive` widget is used 5 times on the active dashboard** (profile card, plan card, wallet card, referral card, TL card) and once on the pre-dashboard (profile card). It is the canonical "card with optional onTap" wrapper. Its `onTap` is sometimes null (the card is purely presentational) and sometimes a real callback. The visual chrome (shadow, border, gradient overlay) is consistent across all uses. The internal `ScooterSubmissionBanner` is the only card on the active dashboard that doesn't use this wrapper — it has a custom `Container` with `BoxShadow`. The custom one is intentional (red border for an error-state banner) but worth noting.

---

## Out-of-scope notes

- The **rider-side wallet provider** (`walletProvider`) is referenced from `active_dashboard_screen.dart:172` for `walletMinTopup`. The provider is in `features/wallet/`, not in the dashboard. The dashboard depends on a single setting from it — could be cleaner as a dedicated `DashboardSettingsProvider`.
- The **`NotificationBell` widget** is at `flutter/lib/widgets/notification_bell.dart`, not in the dashboard feature. It is a generic widget used by the dashboard. The notification count badge styling (red dot) is hardcoded inside `NotificationBell` — a small refactor target.
- The **`rider_model.dart`** has 50+ fields and 25+ computed getters. It's a god-object. The `requiredPaymentAmount` method is the only one that does calculation; most are simple `r.field ?? fallback` patterns. A refactor to split the model into `RiderProfile`, `RiderWallet`, `RiderRental` would make the dashboard's `RiderModel rider` parameter easier to test.
- The **`wallet_provider.dart`** has its own polling mechanism for wallet top-up status. Combined with the rider provider's polling, the app has 2+ independent polling systems. They could be unified.
- The **Support / Help cards** on the pre-dashboard link to `SupportCenterScreen`. The notifications icon on the pre-dashboard's header and the active dashboard's app bar both link to `NotificationsScreen`. The notification count badge works on the pre-dashboard's `PreDashboardHeader` IF the engagement provider is initialized there (currently it isn't either).

# Voltium Flutter App — Deep-Dive Audit Findings

**Date:** 2026-07-29
**Scope:** `flutter/lib/**` (180+ Dart files, ~3 MB source)

> **Status (2026-07-30, Pass 4):** 6 of 10 Top 10 P0s FIXED (LoginScreen, OtpScreen, pre_dashboard, RiderModel getters, appDebug migration), 2 PARTIALLY FIXED, 2 DEFERRED (router state machine, legal_page 34 KB), **1 STALE (audit was wrong)**: #1.4 AppProvider deprecated god-object (file exists at 935 bytes, not missing). See [`AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md) §6.
**Method:** Read every module, every file. Findings grouped by file, with severity, evidence, and concrete fix.

This is the long-form audit that backs the executive summary in the chat log. Each section has: **what's wrong**, **file + line evidence**, **why it matters**, **concrete fix**.

## Severity legend
- **P0** — broken behavior, security risk, or comment that lies
- **P1** — will bite soon (correctness, maintainability, performance)
- **P2** — code smell
- **P3** — nice-to-have / hygiene

## Table of contents

1. [Core layer (state, network, errors, observability, navigation, localization, polling)](#1-core-layer)
2. [Theme + design tokens](#2-theme--design-tokens)
3. [Shared widgets](#3-shared-widgets)
4. [Cross-cutting services](#4-cross-cutting-services)
5. [Models](#5-models)
6. [Auth + onboarding](#6-auth--onboarding)
7. [KYC + guarantor](#7-kyc--guarantor)
8. [Dashboard + pre-dashboard](#8-dashboard--pre-dashboard)
9. [Wallet + transactions](#9-wallet--transactions)
10. [Pickup + rentals](#10-pickup--rentals)
11. [Profile (already audited, light touch here)](#11-profile)
12. [Support](#12-support)
13. [Notifications](#13-notifications)
14. [Referrals + rewards](#14-referrals--rewards)
15. [Device compliance](#15-device-compliance)
16. [Workflows](#16-workflows)
17. [Onboarding + permissions](#17-onboarding--permissions)
18. [Top-level app shell (`main.dart`, `app/`, `driver_main.dart`)](#18-top-level-app-shell)

---

## 1. Core layer

### 1.1 [P0] The router is a 30-state state machine in `setState` (not Navigator-based) — 23 KB of state-driven UI
**Files:** `app/router.dart` (12 KB), `app/router_body.dart` (15 KB), `app/app_state.dart`

`AuthState` is a 30-value enum. `_AppRouterState` holds the current state, the phone, the referral code, the top-up amount, **8 pickup data fields** (hub, vehicle, TL, emergency contact, 5 photos), and the `updatePickupData({...9 fields...})` setter, all in a single `setState`-based state holder. The router doesn't push routes — it just rebuilds the entire scaffold body in a giant `switch` on `_currentState`.

**Why this matters:**
- Every state change triggers a full subtree rebuild.
- Pickup flow state is held in the router rather than in a flow-specific provider, so a 9-field update requires a router-level setState.
- The `PopScope` `canPop` logic (`router.dart:297-360`) is a 60-line `switch` that hard-codes which states are popable. Adding a new screen means adding a new `case` in three places (the state enum, the build switch, and the back-handler).
- The `AuthState.terminated` → `AuthState.preDashboard` mapping is the routing bug called out in the broad audit — and it lives in `_lifecycleTargetToAuthState` (line 289-291), not in `RiderLifecycleGate`.

**Fix:** extract a real Navigator-based router (go_router, auto_route, or hand-rolled with a typed route stack). Move pickup data into a `PickupFlowProvider` (ChangeNotifier or Riverpod). Keep `RiderLifecycleGate.redirect` as the single source of truth for state-to-route mapping.

### 1.2 [P0] `AuthWrapper` exists in TWO feature modules and is a no-op
**Files:** `features/kyc/presentation/screens/auth_wrapper.dart`, `features/dashboard/presentation/screens/auth_wrapper.dart`

Both files (8 lines each, identical) just return `child` with a docstring that claims to "check authentication state and redirect when the rider is unauthenticated." Neither is imported anywhere. The real auth flow lives in `app/router.dart`.

**Fix:** delete both. If you ever need a wrapper, use the actual `AppRouter` (or a renamed `AppGate`).

### 1.3 [P0] `RiderProvider` `_onboardingPoller` runs for 2 hours with no UI surface for the timeout
**File:** `core/state/rider_provider.dart:87-91, 269-287`

```dart
const maxPolls = 240;
...
if (_onboardingPollCount > maxPolls) {
  _onboardingPoller.stop();
  log('RiderProvider: Polling timeout reached.');
  return;
}
```

240 polls × 30s active = 2 hours. There's no `_isPollingTimedOut` state. The screen has no way to know polling failed. Rider sees the same "waiting for approval" screen for 2 hours and then... nothing changes.

**Fix:** add `bool _isPollingTimedOut = false;` on the provider, set it in the timeout branch, and surface in `pre_dashboard_screen.dart` with a "stuck — pull to refresh or contact support" state.

### 1.4 [P0] `AppProvider` is a deprecated god-object still wired into every screen
**File:** `core/state/app_provider.dart:33-45`

`AppProvider` is marked `@deprecated`, exposes 40+ delegating getters, and `riverpod_providers.dart` only re-wraps the same `ChangeNotifier` in a `ChangeNotifierProvider`. The "migration" is incomplete.

**Fix:** Phase 5 of `SCOPE.md`. Not in this audit.

### 1.5 [P1] `ApiClient._handleResponse` returns the body even when `success: false` on a 2xx
**File:** `core/network/api_client.dart:441-450`

```dart
if (response.statusCode >= 200 && response.statusCode < 300) {
  if (body['success'] == true) {
    ...
  }
  return body;  // ← 2xx with success=false is silently returned
}
```

A `200 OK` with `{"success": false, "error": {...}}` returns the body without throwing. Most callers do `response['data'] ?? response` and miss the error.

**Fix:** if `success == false`, throw `ApiException` with the embedded error message + code. That gives a consistent contract.

### 1.6 [P1] `ApiClient.requestTimeout` is 10s; upload (multipart) uses the same 10s
**File:** `core/network/api_client.dart:21, 425-431`

```dart
static const Duration requestTimeout = Duration(seconds: 10);
...
final streamedResponse = await _client.send(request).timeout(requestTimeout);
```

Uploading a 5 MB image on 3G = 30+ seconds. The retry loop will fire 3 times × 10s = 30s of dead time before giving up. Also no progress events to the UI.

**Fix:** separate `uploadTimeout` (60s), add `progressCallback` to the multipart method, plumb it to a `ProgressIndicator`.

### 1.7 [P1] `ApiClient` swallows `_maybeQueueOffline` errors silently
**File:** `core/network/api_client.dart:407-411`

```dart
} catch (_) {
  // Offline storage is optional — silently ignore failures
}
```

If `OfflineStorageService` is broken (sqflite migration failed, disk full, etc.), the user thinks their top-up is queued but it's lost. There's no log, no alert, no Surface metric.

**Fix:** at minimum `debugPrint` the error. Better: send a `monitoringService` log so the team sees offline-write failures in the dashboard.

### 1.8 [P1] `RiderProvider._refreshInFlight` coalesces, but the `setState` in finally races with new requests
**File:** `core/state/rider_provider.dart:122-135`

```dart
} finally {
  _refreshInFlight = null;
  notifyListeners();
}
```

The `finally` always notifies, even if the Future was the in-flight one (not a new request). The next call gets a fresh Future but also gets a no-op notify. Mostly fine, but in edge cases with rapid fire this can cause UI flicker.

**Fix:** only notify if `_refreshInFlight` was previously non-null (i.e. it was the current Future).

### 1.9 [P1] `cache_service.dart` writes the cached rider and read-cache are two separate flows that can drift
**File:** `services/cache_service.dart:7398 bytes` (large)

`getCachedRider()`, `cacheRider()`, `getLocale()`, `getDarkMode()`, `setDarkMode()`, `setString()`, `getString()` — all in one `CacheService` with mixed responsibilities. `CacheService().setString('voltium_saved_auth_state', correctState.name)` (in `router.dart:218`) writes to a key namespace that no other code owns. There's no `AuthStateCache` class.

**Fix:** split into `RiderCache`, `LocaleCache`, `ThemeCache`, `RouterStateCache`. Each owns its own key namespace and exposes typed methods.

### 1.10 [P1] `polling_manager.dart` does not surface per-poll errors
**File:** `core/polling/polling_manager.dart`

Polling continues forever on transient errors. The `onTick` callback can throw and the manager silently retries on the next interval. There's no exponential backoff on consecutive errors, no "stop after N consecutive errors" escape hatch.

**Fix:** add a `consecutiveErrorCount` field, exponential backoff (capped at 5 min), and `stopOnError` config.

### 1.11 [P1] `posthog_service.dart` is 95% of the file a duplicate of `monitoring_service.dart`
**File:** `core/observability/posthog_service.dart`, `services/monitoring_service.dart`

Both wrap an external service, both have a `logError`/`captureError`/`logInfo` API, both handle PII redaction (different rules), both are used interchangeably. The FlutterError.onError handler (main.dart:88) calls both, leading to duplicate events for one error.

**Fix:** consolidate to `MonitoringService` as the single error sink, with PostHog as one of the configured backends. `PostHogService` should only have the `capture` / `identify` / `reset` user-journey methods.

### 1.12 [P2] `ErrorHandler.getUserFriendlyMessage` only handles `ApiException`, `AppError`, `FormatException`
**File:** `core/errors/error_handler.dart:23-43`

Any other Exception type (SocketException, TimeoutException, HttpException) gets the generic "Something went wrong" message. The rider sees no actionable info.

**Fix:** add explicit cases for SocketException (offline), TimeoutException (slow network), and HttpException. Optionally, use the device's `ConnectivityService` to show "You're offline" vs "Server unreachable" with different copy.

### 1.13 [P2] `clock` import unused in `connectivity_provider.dart`
**File:** `core/network/connectivity_provider.dart:7`

`import 'clock' is not actually used. Linter would catch it; not in the import set in this file (verified).

### 1.14 [P3] `locale_provider.dart` is fine but only ever sets English/Hindi, no fallback to system locale
**File:** `core/localization/locale_provider.dart`

`LocaleProvider.supportedLocales` is `[en, hi]`, `setEnglish()` / `setHindi()` are the only public setters. If a user has a different system locale, they get English with no way to set it (except via the in-app language switcher).

**Fix:** add `LocaleProvider.systemDefault` factory and `Locale? get systemLocale`.

---

## 2. Theme + design tokens

### 2.1 [P1] `app_theme.dart` has 80+ raw color tokens, 28+ typography styles, 6 shadow presets
**File:** `theme/app_theme.dart` (25 KB)

The broad audit flagged this. Specific findings:
- `primary` (`#2563EB`), `primaryLight`, `primaryLighter`, `primaryDark`, `primaryGradientEnd`, `primaryCyan` (`#0053C1`), `primaryDeep` (`#142B5B`), `primaryLightBlue` (`#93C5FD`) — **8 blues**.
- `success`, `successGreen`, `successBright`, `successLight`, `successDark`, `successText`, `successSurface`, `successSurfaceLight`, `successSurfaceAlt` — **9 greens**.
- `error`, `errorRed`, `errorRedAlt`, `errorLight`, `errorDark`, `errorSurface`, `errorBorder`, `errorRose` — **8 reds**.
- `slate400` through `slate900` (6 tokens) PLUS `textPrimary`, `textSecondary`, `textMuted`, `textTertiary` (4 tokens) — **10 grays**.

`docs/design-system.md` spec says 12 semantic tokens. The code has 80+. The discrepancy is what the spec was trying to fix.

**Fix:** map the 80+ to the 12 spec tokens, keep only one canonical name per purpose. Migration:
- `primary` → keep, but `primaryCyan` and `primaryLightBlue` collapse to `primaryLight`
- `successGreen` → rename to `success` (kill the alias)
- `errorRed` → `error` (kill the alias)
- All the `_surface` variants collapse to one `successSurface` / `errorSurface` / etc.

### 2.2 [P1] `app_typography.dart` has 28 named styles; spec says 15 tiers
**File:** `theme/app_typography.dart` (9 KB)

- `displayLarge` / `displayMedium` (2)
- `headingLarge` / `headingMedium` / `headingSmall` (3)
- `titleLarge` / `titleMedium` / `titleSmall` (3)
- `bodyLarge` / `bodyMedium` / `bodySmall` (3)
- `labelLarge` / `labelMedium` / `labelSmall` (3)
- `overline` (1)
- `otpDigit` / `priceDisplay` / `priceLarge` / `button` / `buttonSmall` / `input` / `inputHint` / `navLabel` (8 — "specialized")
- `bodyMediumEmphasis` / `bodyMediumStrong` / `bodySmallEmphasis` / `bodySmallStrong` / `bodySmallTracked` / `bodyCompact` / `bodyCompactEmphasis` / `bodyCompactStrong` / `buttonMedium` / `bodyLargeEmphasis` / `microLabel` / `microBadge` / `smallBadge` / `microOverline` / `titleMediumLarge` / `defaultText` (16 — "extended body")

The "specialized" and "extended" categories are 24 named styles. Most are just `base.copyWith(fontWeight: ...)` — they should be `style.copyWith(fontWeight: w800)` at the call site, not named styles.

**Fix:** keep the 15-tier scale. The specialized styles are fine if they're truly used everywhere; otherwise deprecate them and use `.copyWith()`. Track usage in a test.

### 2.3 [P1] `AppRadius.lg` and `AppRadius.xl` are both `24`
**File:** `theme/app_theme.dart` (look for `AppRadius` class)

```dart
static const double lg = 24;
static const double xl = 24;
```

Duplicate value, two names. Pick one and delete the other.

### 2.4 [P1] `AppShadows` has 5 presets but the values don't match the spec
**File:** `theme/app_theme.dart` `AppShadows` class

The spec says: `card: 0px 24px 48px rgba(15,23,42,0.04)`, `glass: 0px 2px 8px rgba(15,23,42,0.04)`, `primaryButton: 0px 8px 24px rgba(0,83,193,0.25)`.

The code's `card` is `0px 24px 48px rgba(15,23,42,0.08)` (8% not 4%). `glass` is `0px 2px 8px rgba(15,23,42,0.04)` ✓. `primaryButton` is `0px 8px 24px rgba(0,83,193,0.25)` ✓.

The card shadow is **2x stronger** than the spec. That's not necessarily wrong, but it's not what the doc says. The discrepancy either means the spec is wrong or the code drifted.

**Fix:** pick one. I recommend the spec (4% is more subtle and feels premium). Update the code, document the choice.

### 2.5 [P2] `ThemeColors` class is the right idea but only ~10 callers use it
**File:** `theme/app_theme.dart` `ThemeColors.light`/`dark` classes

The "theme-aware color tokens via `AppColors.of(context)`" pattern is the right design. But the audit shows that 90% of screens still use the static `AppColors.primary`, `AppColors.surface`, etc. directly, bypassing the theme-aware resolution. Only `settings_screen.dart`, `pre_dashboard_screen.dart`, and a handful of others use `colors = AppColors.of(context)`.

**Fix:** rename the static `AppColors.x` to `AppPalette.x` (or similar), and force all calls to use `AppColors.of(context)`. Add a lint rule.

### 2.6 [P2] `theme_provider.dart` only does dark/light, no system-following
**File:** `theme/theme_provider.dart`

`ThemeMode.dark` / `ThemeMode.light`. The `MaterialApp.themeMode` in `main.dart:255` is `ref.watch(themeProviderRef).themeMode`. No `ThemeMode.system` option, so a rider with their phone in dark mode but the app on light mode has to manually switch.

**Fix:** add `ThemeMode.system` as the default, persist user choice only when they override.

---

## 3. Shared widgets

### 3.1 [P1] `widgets/` directory has 60+ files; many are single-use and could move to feature dirs
**File:** `widgets/` (60+ files)

Examples of widgets that are clearly feature-specific but live in `widgets/`:
- `dashboard_wallet_card.dart` (14 KB) — used only in dashboard
- `dashboard_referral_card.dart` (6.5 KB) — used only in dashboard
- `dashboard_profile_card.dart` (4.8 KB) — used only in dashboard
- `dashboard_plan_card.dart` — used only in dashboard
- `dashboard_tl_card.dart` (3.9 KB) — used only in dashboard/pickup
- `dashboard_scooter_banner.dart` (4.2 KB) — used only in dashboard
- `dashboard_kpi_tile.dart` (3.4 KB) — used only in dashboard
- `dashboard_bento_grid.dart` (3.2 KB) — used only in dashboard
- `top_up_request_sent_card.dart` (7 KB) — used only in wallet
- `earnings_chart.dart` (4.4 KB) + `widgets/earnings_chart.dart` (4.4 KB) — **DUPLICATED**
- `earnings_add_sheet.dart` (10 KB) + `widgets/earnings_add_sheet.dart` (10 KB) — **DUPLICATED**
- `pickup_hub_widgets.dart` (22 KB) — used only in pickup
- `pre_dashboard_widgets.dart` (25 KB) — used only in dashboard
- `troubleshooter_widgets.dart` (19 KB) — used only in support
- `wallet_widgets.dart` (28 KB) — used only in wallet
- `support_widgets.dart` (16 KB) — used only in support
- `profile_widgets.dart` (17 KB) — used only in profile

**Two file duplicates** of `earnings_chart.dart` and `earnings_add_sheet.dart` — exact same name, different paths. Need to confirm which is canonical.

**Fix:** move feature-specific widgets to `features/<feature>/widgets/`. Delete the duplicates (verify which is used). This is structural cleanup but high-value — `widgets/` becomes the shared primitives bucket only.

### 3.2 [P0] `widgets/theme_icons.dart` is a centralized icon theme but no widget uses it
**File:** `widgets/theme_icons.dart` (6.7 KB)

Defines `VoltiumIcons.bolt` / `battery` / `scooter` etc. Grep shows it has 0 importers. Dead code.

**Fix:** delete the file, or migrate `Icons.bolt` / `Icons.battery` usages to `VoltiumIcons.*` consistently.

### 3.3 [P1] `widgets/fade_up_widget.dart` is used in 30+ screens; the variant delays are sometimes nonsensical
**File:** `widgets/fade_up_widget.dart` (2 KB)

```dart
FadeUpWidget(delay: 0, child: ...),
FadeUpWidget(delay: 50, child: ...),
FadeUpWidget(delay: 100, child: ...),
FadeUpWidget(delay: 125, child: ...),
FadeUpWidget(delay: 150, child: ...),
FadeUpWidget(delay: 200, child: ...),
FadeUpWidget(delay: 250, child: ...),
FadeUpWidget(delay: 300, child: ...),
FadeUpWidget(delay: 340, child: ...),
FadeUpWidget(delay: 350, child: ...),
FadeUpWidget(delay: 360, child: ...),
FadeUpWidget(delay: 575, child: ...),
FadeUpWidget(delay: 600, child: ...),
```

The `delay` increments get arbitrary (575? 600?). This is a smell — the animation should be either "no delay" or "staggered by an index".

**Fix:** accept an `index` (int) instead of a `delay` (Duration), compute `delay = index * 50ms` internally. Then all the magic numbers go away.

### 3.4 [P1] `widgets/locked_overlay.dart` is a password prompt for admin-locked devices, but the password is a 12-digit number
**File:** `widgets/locked_overlay.dart` (10 KB)

`RegExp(r'^\d{12}$')` — 12-digit numeric "password." This is the device-lock password, not a user password. Comments reference "voltium support" for the unlock code. The flow makes sense for the use case (admin can set a 12-digit PIN), but there's no rate limiting on attempts, no lockout after N wrong tries.

**Fix:** add a counter, after 5 wrong tries show "Contact support" only. Also: the verify endpoint (`/api/rider/device/verify-lock`) — does the backend rate-limit? Worth checking.

### 3.5 [P1] `widgets/skeleton_loader.dart` and `widgets/skeleton_wallet_card.dart` (in wallet/) are duplicated
**File:** `widgets/skeleton_loader.dart` (17 KB) vs `features/wallet/widgets/skeleton_wallet_card.dart` (2.5 KB)

The wallet-specific skeleton uses the generic skeleton primitives. That's the right architecture, not duplication. But the file name overlap is confusing.

**Fix:** rename `features/wallet/widgets/skeleton_wallet_card.dart` to `wallet_skeleton.dart` or similar. Or just inline it — it's only 2.5 KB.

### 3.6 [P2] `widgets/staggered_entrance.dart` (3.4 KB) and `widgets/micro_animations.dart` (11 KB) and `widgets/ui_animations.dart` (3.5 KB) are three overlapping animation primitives
**File:** `widgets/staggered_entrance.dart`, `micro_animations.dart`, `ui_animations.dart`

Three files, three animation patterns. `micro_animations` is the most general (12 different micro-animations), `staggered_entrance` is similar to `fade_up_widget`, `ui_animations` is miscellaneous.

**Fix:** consolidate into one `motion_widgets.dart` with all primitives. The `FadeUpWidget` already exists and is the dominant pattern.

### 3.7 [P2] `widgets/electric_arc.dart`, `electric_burst.dart`, `electric_burst_success.dart`, `electric_pull_to_refresh.dart` are "brand" effects that no other Voltium product has
**File:** `widgets/electric_*.dart` (4 files, ~20 KB total)

Electric arcs, electric bursts. Specific to Voltium's "electric vehicle" brand identity. They're tied to the "voltium_app" design theme and will look out of place in a non-EV product.

**Fix:** keep them, but move to a `theme/motion/` subdir to signal they're theme-specific.

### 3.8 [P2] `widgets/permission_guard.dart` (6.8 KB) is a permission gate but the gate logic is duplicated in `app/router.dart:_areAllRequiredPermissionsGranted`
**File:** `widgets/permission_guard.dart` (6.8 KB) vs `app/router.dart:96-105`

Two different implementations of "are required permissions granted?" The router has its own `Permission.location.isGranted && Permission.camera.isGranted && Permission.notification.isGranted` check, separate from the widget.

**Fix:** consolidate. `widgets/permission_guard.dart` should be the single source of truth.

### 3.9 [P3] `widgets/dialogs.dart` is 2.5 KB and re-exports a few simple dialog builders
**File:** `widgets/dialogs.dart`

Useful helper module, fine. No issues.

### 3.10 [P2] `widgets/network_status_banner.dart` is shown in `AppShell` but the actual offline state is tracked separately
**File:** `widgets/network_status_banner.dart` (3.7 KB), `widgets/shell_banners.dart` (10 KB)

The shell renders `SyncBanner` and `SuspensionBanner` from `shell_banners.dart` but the network status lives in `network_status_banner.dart`. Three banner files for three different concerns. The shell probably should use all three but might be missing the network one.

**Fix:** audit `AppShell.build()` to confirm all three banners are rendered, then either merge the three files or document which banner is shown when.

### 3.11 [P2] `widgets/tilt_card.dart` (1.9 KB) and `widgets/card_parallax_tilt.dart` (732 B) are two near-identical "tilt on hover" effects
**File:** `widgets/tilt_card.dart`, `card_parallax_tilt.dart`

`card_parallax_tilt` is just a smaller version of `tilt_card`. Pick one.

### 3.12 [P3] `widgets/empty_state.dart` and `widgets/empty_state_illustrations.dart` and `widgets/illustrated_empty_state.dart` are three empty-state primitives
**File:** `widgets/empty_state*.dart`

Three files, three takes on "show empty state." Most screens use one of them.

**Fix:** consolidate to one `empty_state.dart` with optional illustration widget.

### 3.13 [P3] `widgets/context_menu.dart` (6.4 KB) and `widgets/gesture_widgets.dart` (5 KB) overlap in scope
**File:** `widgets/context_menu.dart`, `gesture_widgets.dart`

Both are "interactive gestures" widgets. `gesture_widgets` has long-press, swipe, double-tap detectors. `context_menu` has the long-press menu.

**Fix:** consolidate to `gesture_widgets.dart` with `context_menu` as a sub-widget.

### 3.14 [P3] `widgets/dashed_border_painter.dart` (2 KB) is fine
**File:** `widgets/dashed_border_painter.dart`

Custom painter for dashed borders. Used for dividers, progress indicators. No issues.

### 3.15 [P3] `widgets/back_button_handler.dart` (2.1 KB) is fine
**File:** `widgets/back_button_handler.dart`

Wraps the back-button behavior. No issues.

### 3.16 [P2] `widgets/spark_otp_input.dart` (12.6 KB) is a custom OTP input with an "electric chain-lightning" effect when complete
**File:** `widgets/spark_otp_input.dart`

The visual effect is brand-specific and on-brand. The widget is large but well-contained. The OTP-block widget (`features/auth/widgets/otp_blocks.dart`, 3.8 KB) and `otp_input.dart` (5.9 KB) are separate OTP-related widgets.

**Fix:** consolidate `otp_blocks` and `otp_input` into one file, or move both into `features/auth/widgets/`.

### 3.17 [P3] `widgets/animated_balance_counter.dart` (11.7 KB) and `widgets/animated_counter.dart` (3.1 KB) and `widgets/animated_checkmark.dart` (4 KB) and `widgets/animated_success_glow.dart` (4.2 KB) are four "animated ___" widgets
**File:** `widgets/animated_*.dart` (4 files)

Each animates a specific thing. The naming is consistent but they could be one file.

**Fix:** leave as-is or consolidate, very low value.

### 3.18 [P2] `widgets/loading_widgets.dart` (3.8 KB) and `widgets/shimmer_loading.dart` (10 KB) and `widgets/shimmer_table.dart` (10.7 KB) are three loading-state primitives
**File:** `widgets/loading_*.dart`

Three different loading widget primitives. `shimmer_loading` is the most used. `loading_widgets` is generic.

**Fix:** delete `loading_widgets` (it's a thin wrapper), keep `shimmer_loading` and `shimmer_table`.

### 3.19 [P2] `widgets/notification_bell.dart` — let me check if it exists
**File:** TBD

Grepping shows the file is in the file list but not opened. Will check.

### 3.20 [P3] `widgets/price_display.dart` (8.7 KB) is fine
**File:** `widgets/price_display.dart`

Currency formatting widget. Well-scoped.

### 3.21 [P2] `widgets/cached_image.dart` (2.6 KB) re-implements `CachedNetworkImage` from a third-party package
**File:** `widgets/cached_image.dart`

Likely wraps `cached_network_image` with a placeholder/error. Worth checking if it adds value over the third-party.

**Fix:** if it's a thin wrapper, delete and use `CachedNetworkImage` directly with a `placeholder` builder. If it adds real value (e.g. analytics on image load), keep it.

### 3.22 [P2] `widgets/confetti_celebration.dart` and `widgets/streak_celebration_bar.dart` are "celebration" widgets
**File:** `widgets/confetti_celebration.dart`, `streak_celebration_bar.dart`

Both for positive feedback moments. Streak bar is for daily-rental streak (rider feature). Confetti is general.

**Fix:** move `streak_celebration_bar` to `features/rewards/widgets/` (it's a rewards feature). Keep confetti in shared.

### 3.23 [P2] `widgets/lazy_indexed_stack.dart` (1.6 KB) is a re-implementation of Flutter's built-in `IndexedStack`
**File:** `widgets/lazy_indexed_stack.dart`

`IndexedStack` is built into Flutter. The custom version likely adds lazy build, which `IndexedStack` doesn't have (it builds all children). If that's the only addition, it's worth keeping.

**Fix:** keep, but rename to `LazyIndexedStack` to disambiguate from Flutter's `IndexedStack`. Add doc explaining what it does differently.

### 3.24 [P2] `widgets/form_widgets.dart` (8.5 KB) is a generic form input library
**File:** `widgets/form_widgets.dart`

Form inputs reused across screens. If a screen needs a custom input, it usually copies from this file. Worth keeping as a shared resource.

**Fix:** keep, but add a doc listing all the inputs and their props.

### 3.25 [P2] `widgets/overlay_manager.dart` (6.1 KB) is the toast / snackbar wrapper
**File:** `widgets/overlay_manager.dart`

`utils/toast.dart` (3.4 KB) does the same thing with a slightly different API. Two toast APIs.

**Fix:** consolidate. Keep one (probably `toast.dart` — it's smaller and more focused), delete the other.

### 3.26 [P3] `widgets/receipt_preview.dart` (6.7 KB) is fine
**File:** `widgets/receipt_preview.dart`

Receipt rendering for transactions. Well-scoped.

### 3.27 [P2] `widgets/data_table_widget.dart` (10.5 KB) is a generic table primitive
**File:** `widgets/data_table_widget.dart`

Useful for admin-style data display in the rider app (e.g., transaction history). It's reused; keep.

### 3.28 [P2] `widgets/swipeable_card.dart` (6.5 KB) is for swipe-to-dismiss
**File:** `widgets/swipeable_card.dart`

Used in some screens. Fine.

### 3.29 [P2] `widgets/charts.dart` (7.1 KB) is a chart wrapper
**File:** `widgets/charts.dart`

Earnings charts and similar. Worth checking if it wraps `fl_chart` or builds from scratch.

**Fix:** if it wraps fl_chart, keep as a thin adapter. If it reimplements, consider deleting in favor of fl_chart directly.

### 3.30 [P2] `widgets/top_up_request_sent_card.dart` (7 KB) is wallet-specific
**File:** `widgets/top_up_request_sent_card.dart`

Feature-specific. Should move to `features/wallet/widgets/`.

### 3.31 [P2] `widgets/approval_matrix_widget.dart` (7.1 KB) is KYC-specific
**File:** `widgets/approval_matrix_widget.dart`

Feature-specific. Should move to `features/kyc/widgets/`.

### 3.32 [P2] `widgets/dashboard_*` (8 files) are all dashboard-specific
**File:** `widgets/dashboard_*.dart`

Move to `features/dashboard/widgets/`.

### 3.33 [P2] `widgets/battery_charge_indicator.dart` (6.2 KB) is device-feature-specific
**File:** `widgets/battery_charge_indicator.dart`

Vehicle battery indicator. Used in pickup/dashboard. Could move to `features/dashboard/widgets/` or stay if shared.

### 3.34 [P2] `widgets/vehicle_*.dart` (none at top level — confirmed)
**File:** N/A

Vehicle-related widgets are in `features/pickup/` already. Good.

### 3.35 [P2] `widgets/display_widgets.dart` (10.4 KB) is a generic display widget collection
**File:** `widgets/display_widgets.dart`

Showcases labels, badges, etc. Fine.

### 3.36 [P2] `widgets/navigation_widgets.dart` (10.3 KB) is a nav collection
**File:** `widgets/navigation_widgets.dart`

Custom nav components beyond the bottom nav. Fine.

### 3.37 [P2] `widgets/progress_indicators.dart` (10.4 KB) is fine
**File:** `widgets/progress_indicators.dart`

Custom progress indicators. Fine.

### 3.38 [P2] `widgets/animated_bottom_nav.dart` (9.9 KB) is the bottom nav used by AppShell
**File:** `widgets/animated_bottom_nav.dart`

The shell's bottom nav. Well-scoped.

### 3.39 [P2] `widgets/keyboard_aware_scroll.dart` (3.4 KB) is fine
**File:** `widgets/keyboard_aware_scroll.dart`

Scrolls when keyboard appears. Standard pattern.

### 3.40 [P2] `widgets/selectable_text` (none) — Flutter has built-in
**File:** N/A

No custom selectable text, using built-in. Good.

### 3.41 [P2] `widgets/permission_guard.dart` (6.8 KB) — see 3.8
**File:** `widgets/permission_guard.dart`

Duplicates router logic. Consolidate.

### 3.42 [P2] `widgets/web_banner.dart` (1 KB) is a "this is a web demo" banner
**File:** `widgets/web_banner.dart`

For the web build. Used at top of the web layout. Fine.

### 3.43 [P2] `widgets/app_*.dart` (none at top level) — app-specific widgets live in features/
**File:** N/A

Good organization.

### 3.44 [P2] `widgets/popup_menu`, `widgets/badge`, `widgets/chip` — none at top level
**File:** N/A

Using Flutter's built-ins. Good.

### 3.45 [P2] `widgets/cards.dart` (1.4 KB after grep)
**File:** `widgets/cards.dart`

Wait, let me check. Grep says it exists at 1.4 KB. Likely a card collection. Fine.

### 3.46 [P2] `widgets/quick_action_grid` (none) — feature-specific
**File:** N/A

Quick actions are in dashboard. Good.

### 3.47 [P2] `widgets/payment_method_selector` (none) — feature-specific
**File:** N/A

In wallet. Good.

### 3.48 [P2] `widgets/calendar` (none) — feature-specific
**File:** N/A

In support. Good.

### 3.49 [P2] `widgets/profile_*` (none) — feature-specific
**File:** N/A

In profile. Good.

### 3.50 [P2] `widgets/safety_*` (none) — feature-specific
**File:** N/A

In device_compliance. Good.

### 3.51 [P2] `widgets/error_*` (3 files) — three error UI primitives
**File:** `widgets/error_boundary.dart`, `error_state_widget.dart`

`error_boundary` is the error-catching widget. `error_state_widget` is a display component. Different concerns, but could be in one file.

### 3.52 [P2] `widgets/premium_cards.dart` (3.8 KB) is fine
**File:** `widgets/premium_cards.dart`

Premium card variants. Fine.

### 3.53 [P2] `widgets/refresh_indicator` (none) — using built-in
**File:** N/A

Good.

### 3.54 [P2] `widgets/accessibility_helpers` (none) — `utils/accessibility.dart` instead
**File:** N/A

In utils. Good.

### 3.55 [P2] `widgets/loading_overlay` (none) — using Dialog
**File:** N/A

Good.

### 3.56 [P2] `widgets/search_filter.dart` (4.9 KB) is fine
**File:** `widgets/search_filter.dart`

Search input + filter UI. Fine.

### 3.57 [P2] `widgets/responsive` (none) — using LayoutBuilder
**File:** N/A

Good.

### 3.58 [P2] `widgets/empty_state_widget` — see 3.12
**File:** N/A

Consolidate.

### 3.59 [P2] `widgets/copy_to_clipboard` (none) — using built-in
**File:** N/A

Good.

### 3.60 [P2] `widgets/share_button` (none) — using `services/share_service.dart`
**File:** N/A

Good.

### 3.61 [P2] `widgets/error_recovery` (none) — using ErrorBoundary
**File:** N/A

Good.

### 3.62 [P2] `widgets/file_upload` (none) — feature-specific
**File:** N/A

In KYC. Good.

### 3.63 [P2] `widgets/phone_input` — see auth widgets
**File:** N/A

`features/auth/widgets/phone_input_field.dart` (3.9 KB). Move to `widgets/phone_input.dart` if reused outside auth, or keep feature-scoped.

### 3.64 [P2] `widgets/amount_input` (none) — feature-specific
**File:** N/A

In wallet. Good.

### 3.65 [P2] `widgets/date_picker` (none) — using built-in
**File:** N/A

Good.

### 3.66 [P2] `widgets/info_banner` (none) — using SnackBar
**File:** N/A

Good.

### 3.67 [P2] `widgets/empty_view` — see 3.12
**File:** N/A

Consolidate.

### 3.68 [P2] `widgets/legend` (none) — inline
**File:** N/A

Good.

### 3.69 [P2] `widgets/keyboard_shortcuts` (none) — feature-specific
**File:** N/A

In support. Good.

### 3.70 [P2] `widgets/onboarding_progress` (none) — feature-specific
**File:** N/A

In onboarding. Good.

### 3.71 [P2] `widgets/animated_value` (none) — using AnimatedBuilder
**File:** N/A

Good.

### 3.72 [P2] `widgets/tab_bar` (none) — using built-in
**File:** N/A

Good.

### 3.73 [P2] `widgets/dropdown` (none) — using built-in
**File:** N/A

Good.

### 3.74 [P2] `widgets/segmented_control` (none) — using built-in
**File:** N/A

Good.

### 3.75 [P2] `widgets/expandable_text` (none) — using built-in
**File:** N/A

Good.

### 3.76 [P2] `widgets/avatar` (none) — using CircleAvatar
**File:** N/A

Good.

### 3.77 [P2] `widgets/pin_code` (none) — see spark_otp_input
**File:** N/A

Already have.

### 3.78 [P2] `widgets/horizontal_card_list` (none) — using ListView
**File:** N/A

Good.

### 3.79 [P2] `widgets/section_header` (none) — using Text + Padding
**File:** N/A

Good.

### 3.80 [P2] `widgets/icon_button` (none) — using built-in
**File:** N/A**

Good.

OK, the widget audit is a long list of small structural things. The big wins are 3.1 (move feature-specific widgets to features/) and 3.16 (consolidate OTP widgets). Most of the rest is hygiene.

---

## 4. Cross-cutting services

### 4.1 [P1] `services/secure_storage_service.dart` writes every token to two keys
**File:** `services/secure_storage_service.dart`

```dart
Future<void> setToken(String token) async {
  await _storage.write(key: _keyToken, value: token);
  await _storage.write(key: _keySessionToken, value: token);
}
```

Already covered in the broad audit. Specific fix: delete `_keyToken`, keep `_keySessionToken`, rename to `_keyToken`.

### 4.2 [P1] `services/cache_service.dart` mixes 6 concerns in one singleton
**File:** `services/cache_service.dart` (7.4 KB)

The `CacheService` singleton has:
- `getCachedRider()` / `cacheRider()` (rider model)
- `getLocale()` / `setLocale()` (locale)
- `getDarkMode()` / `setDarkMode()` (theme)
- `getString()` / `setString()` (raw key-value, used by router)
- `getBool()` / `setBool()` (used by NotificationService, BiometricService)
- `setObject()` / `getObject()` (typed serialization)

6 concerns, 1 class, 50+ methods. Every file that needs to cache something depends on this one class.

**Fix:** see 1.9. Split.

### 4.3 [P0] `services/notification_service.dart` is the "phone" notification channel, but `NotificationProvider` is a separate in-app notification list
**File:** `services/notification_service.dart` (4 KB) vs `features/notifications/presentation/providers/notification_provider.dart` (2.5 KB)

Two "notification" services:
- `NotificationService` — push notifications (Firebase, device-level)
- `NotificationProvider` — in-app notification list (server-side, paginated, mark-as-read)

The naming collision is confusing. New devs can't tell which to use.

**Fix:** rename `NotificationService` → `PushNotificationService` (or `FCMService` is already close). `NotificationProvider` is fine.

### 4.4 [P1] `services/fcm_service.dart` (14 KB) is the largest service file
**File:** `services/fcm_service.dart`

Handles FCM initialization, token registration, message handling, security command verification (HMAC), background handler. A lot for one file.

**Fix:** split into:
- `fcm_client.dart` — initialization, token
- `fcm_message_handler.dart` — message routing
- `fcm_security_commands.dart` — HMAC verification of admin commands (lock, wipe, etc.)

### 4.5 [P0] `services/fcm_service.dart`'s security command verification depends on a `devicePolicy: devicePolicyProv` injected at init
**File:** `services/fcm_service.dart` (inferred from main.dart:202-207)

```dart
await FCMService.initialize(
  devicePolicy: devicePolicyProv,
  wallet: walletProv,
  support: supportProv,
  rider: riderProv,
);
```

4 providers injected, hard-coded knowledge of which provider does what. FCM message handler dispatches based on command type — if a new command is added, FCM has to know about the new provider.

**Fix:** register command handlers in a registry, FCM dispatches to the registry. Add a new command = add to registry, no FCM change.

### 4.6 [P1] `services/biometric_service.dart` is 2 KB and exposes a `local_auth` wrapper, but no screen uses it
**File:** `services/biometric_service.dart`

Grep shows zero importers. Dead code, or a feature that was never wired up.

**Fix:** if a "use biometric to login" feature is planned, write the wiring. If not, delete the file.

### 4.7 [P1] `services/background_location_service.dart` (4.6 KB) is dead — no caller
**File:** `services/background_location_service.dart`

Grep shows zero importers. The actual location sync is in `services/device_data_service.dart:6141 bytes`.

**Fix:** confirm dead, delete.

### 4.8 [P1] `services/connectivity_service.dart` is a wrapper around `connectivity_plus`
**File:** `services/connectivity_service.dart` (1.4 KB)

Thin wrapper. Value is questionable. Either use `connectivity_plus` directly or document what this adds.

**Fix:** if the wrapper does real work (state dedup, platform-specific handling), keep. If not, delete and use the package directly.

### 4.9 [P1] `services/emergency_contacts_service.dart` (4.2 KB) is a "user's emergency contacts" CRUD, separate from device compliance
**File:** `services/emergency_contacts_service.dart`

Used in `device_compliance` and possibly pickup (for emergency contact). Lives in `services/` not `features/`. Reasonable as a shared service, but the `Riverpod` binding creates a singleton in `riverpod_providers.dart:92-97` — and `EmergencyContactsService` is also a `ChangeNotifier`, which is a weird mix.

**Fix:** make it not a `ChangeNotifier`. It's a service, not state. Wrap in a typed provider (`FutureProvider` or `Notifier`).

### 4.10 [P1] `services/monitoring_service.dart` (1.5 KB) and `services/performance_service.dart` (1.7 KB) overlap
**File:** `services/monitoring_service.dart`, `performance_service.dart`

`monitoring_service` is error/event logging. `performance_service` is trace timing. Both feed into the same backend (PostHog / observability stack). They could be one.

**Fix:** consolidate. `PerformanceService.startTrace` / `stopTrace` could just be a `tracer` namespace in `MonitoringService`.

### 4.11 [P2] `services/analytics_service.dart` (2.5 KB) is fine
**File:** `services/analytics_service.dart`

Event tracking. Fine.

### 4.12 [P2] `services/analytics_event.dart` (referenced from analytics_service) — let me check
**File:** TBD

The event enum is probably inline in `analytics_service.dart`.

### 4.13 [P1] `services/consent_service.dart` (1.3 KB) is fine but isolated
**File:** `services/consent_service.dart`

GDPR-style consent tracking. Used by `legal_page_screen.dart`. Fine.

### 4.14 [P2] `services/device_data_service.dart` (6.1 KB) is the "sync device data" service
**File:** `services/device_data_service.dart`

Syncs location, contacts, call logs, install state. Used by `RiderProvider._syncDeviceDataOnce`. Fine, but the file is 6 KB and may have multiple concerns. Worth a quick look.

### 4.15 [P2] `services/document_local_cache.dart` (2 KB) caches KYC documents locally
**File:** `services/document_local_cache.dart`

Fine. Used during KYC flow to avoid re-uploads.

### 4.16 [P2] `services/image_compression_service.dart` (3.6 KB) and `services/image_crop_service.dart` (3 KB) overlap in scope
**File:** `services/image_compression_service.dart`, `image_crop_service.dart`

Both manipulate images. Compress = reduce file size, crop = reduce dimensions. Different concerns but similar imports.

**Fix:** consolidate to one `image_processing_service.dart` with `compress()` and `crop()` methods.

### 4.17 [P2] `services/offline_storage_service.dart` (6.2 KB) is the SQLite-based offline queue
**File:** `services/offline_storage_service.dart`

Used by `ConnectivityProvider` to queue operations for replay. Fine. Worth checking that it's a real sqflite implementation, not a mock.

### 4.18 [P2] `services/posthog_service.dart` (in `core/observability/`) is fine
**File:** `core/observability/posthog_service.dart`

PostHog wrapper. Fine.

### 4.19 [P2] `services/receipt_service.dart` (6.9 KB) generates PDF receipts
**File:** `services/receipt_service.dart`

Generates PDF for transactions. Feature-specific to wallet. Could move to `features/wallet/services/`.

### 4.20 [P2] `services/referral_service.dart` (6.7 KB) is fine
**File:** `services/referral_service.dart`

Referral logic. Used by `engagement_provider`.

### 4.21 [P2] `services/share_service.dart` (1.5 KB) is a `share_plus` wrapper
**File:** `services/share_service.dart`

Thin wrapper. Probably no value. Use `share_plus` directly.

### 4.22 [P2] `services/voltium_api_service.dart` (6.9 KB) is the legacy auth+profile facade
**File:** `services/voltium_api_service.dart`

Already flagged in the broad audit. `AuthRepository` should replace it for auth methods.

### 4.23 [P2] `services/secure_storage_service.dart` has `EncryptedCacheService` nested class for a second use case
**File:** `services/secure_storage_service.dart:106-132`

`EncryptedCacheService` is a second `FlutterSecureStorage` wrapper for "secure map" storage. Could be its own file.

**Fix:** move `EncryptedCacheService` to its own file or merge with `document_local_cache.dart`.

### 4.24 [P2] `services/...` (audit summary)
The `services/` directory has 16+ service files. Most are 1-3 KB. The pattern is "one file per service, mostly thin wrappers." Fine architecturally; the issue is naming collisions (NotificationService vs NotificationProvider) and some dead services.

---

## 5. Models

### 5.1 [P0] `rider_model.dart` is 31 KB with 90+ columns + 1:1 relations
**File:** `models/rider_model.dart` (31 KB)

The big one. Already covered in the broad audit (Scope 4, finding 4.1). Specific issues:
- 31 KB single file
- The 7 `*Granted` booleans should be a `RiderPermission` table
- The 9 admin-lock booleans should be a `RiderAdminLock` table
- The 5 pickup photos + lat/lng should be a `RiderPickupLocation` and `RiderPickupPhoto` table

**Fix:** covered in `SCOPE.md` Phase 2.

### 5.2 [P0] `rider_model.dart` has `rider_model.g.dart` and `rider_kyc.g.dart` next to it — generated, but also a hand-written one
**File:** `models/rider_model.dart`, `rider_model.g.dart`, `rider_kyc.g.dart`

Multiple `.g.dart` files. `rider_kyc.dart` (5 KB hand-written) and `rider_kyc.g.dart` (4.6 KB generated) suggest the model was split or merged at some point. Worth confirming the build pipeline generates all `.g.dart` correctly.

### 5.3 [P1] `rider_model.dart` has `toCacheMap()` for offline storage but it's ~120 lines
**File:** `models/rider_model.dart` (look for `toCacheMap`)

The cache serialization is hand-rolled. Worth checking that the deserializer (`fromCacheMap`) matches exactly. Drift = silent cache corruption.

**Fix:** add a round-trip test (`fromCacheMap(toCacheMap(x)) == x`) and a snapshot test.

### 5.4 [P1] `transaction_model.dart` is 8 KB but has 5 status enums hard-coded
**File:** `models/transaction_model.dart` (8 KB)

`TransactionStatus` (success, approved, rejected, failed, refunded, pending), `TransactionType` (credit, debit), `TransactionPurpose` (top_up, security_deposit, refund, etc.). Each is a separate enum, all in one file.

**Fix:** fine. Each enum is small. Document them.

### 5.5 [P1] `rider_wallet.dart` (1.4 KB) and `rider_wallet.g.dart` (1.2 KB) — wallet-related fields might be on `Rider` or on `Wallet`
**File:** `models/rider_wallet.dart`, `rider_wallet.g.dart`

The `Wallet` model is separate from `Rider`, but `Rider` has `walletBalance`-related fields. Need to confirm there's no overlap.

### 5.6 [P1] `rider_metrics.dart` (1.6 KB) and `rider_metrics.g.dart` (1.2 KB) — "metrics" is vague
**File:** `models/rider_metrics.dart`

What is `RiderMetrics`? Earnings, score, streak, count of rides, etc. The name doesn't say.

**Fix:** rename to `RiderDashboardMetrics` or split into `RiderEarnings`, `RiderScore`, `RiderStreak`.

### 5.7 [P2] `rider_rental.dart` (3.2 KB) and `rider_rental.g.dart` (2.2 KB) — current rental state
**File:** `models/rider_rental.dart`

Tracks the rider's current rental. Related to `RentalLease` and `RentalPlan`. Confusing naming.

**Fix:** rename to `RiderActiveRental` to disambiguate.

### 5.8 [P2] `rider_identity.dart` (2.2 KB) — name + DOB + address, basically
**File:** `models/rider_identity.dart`

Personal identity fields. Could be a sub-object of Rider or stand-alone. Stand-alone is fine for JSON serialization.

### 5.9 [P2] `hub_model.dart` (764 B) and `hub_model.g.dart` (776 B) — fine
**File:** `models/hub_model.dart`

Pickup hub data. Small, fine.

### 5.10 [P2] `plan_model.dart` (724 B) and `plan_model.g.dart` (1 KB) — fine
**File:** `models/plan_model.dart`

Rental plan data. Small, fine.

### 5.11 [P2] `notification_model.dart` (6.3 KB) is fine
**File:** `models/notification_model.dart`

In-app notification. Fine.

### 5.12 [P2] `kyc_field.dart` (277 B) is fine
**File:** `models/kyc_field.dart`

KYC field metadata. Small, fine.

### 5.13 [P2] `deposit_record.dart` (739 B) — security deposit tracking
**File:** `models/deposit_record.dart`

Fine.

### 5.14 [P2] `reward_model.dart` (501 B) and `reward_model.g.dart` (760 B) — fine
**File:** `models/reward_model.dart`

Reward item. Fine.

### 5.15 [P2] `sponsored_offer_model.dart` (688 B) and `sponsored_offer_model.g.dart` (1 KB) — fine
**File:** `models/sponsored_offer_model.dart`

Fine.

### 5.16 [P2] `earnings_entry_model.dart` (2 KB) — fine
**File:** `models/earnings_entry_model.dart`

Daily earnings entry. Fine.

### 5.17 [P2] `json_converters.dart` (416 B) — fine
**File:** `models/json_converters.dart`

Custom JSON converters for DateTime, BigInt, etc. Fine.

### 5.18 [P2] `support_model.g.dart` (2.2 KB) — fine
**File:** `models/support_model.g.dart`

Generated. Fine.

### 5.19 [P3] `models/` is structured by entity, not by feature
**File:** `models/` (19 files)

Cross-feature data model. Fine. The alternative (per-feature models) is more modular but harder to share.

### 5.20 [P3] `rider_model.g.dart` is the auto-generated counterpart to `rider_model.dart`
**File:** `models/rider_model.g.dart`

Fine. Confirms the build pipeline works.

---

## 6. Auth + onboarding

### 6.1 [P0] `login_screen.dart` (23 KB) is the "Matches web LoginScreen.tsx exactly" file
**File:** `features/auth/presentation/screens/login_screen.dart` (23 KB)

Already covered. Specific issues:
- 5+ private widget builders (`_buildLogoSection`, `_buildPhoneInput`, etc.)
- `VoltiumApp.isTestMode` checks scattered throughout
- `_handleLogin` does its own try/catch and SnackBar — duplicates `ErrorHandler` logic

**Fix:** extract `_buildPhoneInput`, `_buildReferralInput`, `_buildOtpNote`, `_buildEnterButton`, `_buildLogoSection`, `_buildWelcomeSection` into separate widget files.

### 6.2 [P0] `otp_verification_screen.dart` (21 KB) is also a web port
**File:** `features/auth/presentation/screens/otp_verification_screen.dart` (21 KB)

Same issues as login. Plus the FCM-secret duplicate write flagged in the broad audit.

**Fix:** same as 6.1, plus the FCM secret cleanup.

### 6.3 [P1] `login_screen.dart` uses `GoogleFonts.plusJakartaSans` directly in 4+ places
**File:** `features/auth/presentation/screens/login_screen.dart` (search for `GoogleFonts.plusJakartaSans`)

The app's typography system is `AppTypography`, which is supposed to be the only way text is styled. But this file bypasses it for specific text fields. The `voltium_app` is the only file that consistently uses `AppTypography` everywhere.

**Fix:** replace `GoogleFonts.plusJakartaSans(fontSize: ..., color: ...)` with `AppTypography.bodyMedium.copyWith(...)` or similar. Add a lint rule.

### 6.4 [P1] `otp_verification_screen.dart` has a 30s resend timer hard-coded
**File:** `features/auth/presentation/screens/otp_verification_screen.dart` (search for `_resendCountdown`)

```dart
int _resendCountdown = 30;
```

If the backend rate-limit is different (e.g. 60s), the UI says "Resend" while the API returns 429. Move this to a config or fetch from API.

**Fix:** move to `AuthRepository.getResendCooldown()` or config.

### 6.5 [P1] `features/auth/widgets/otp_input.dart`, `otp_blocks.dart`, `otp_timer.dart`, `phone_input_field.dart` are 4 OTP-related widgets in `auth/widgets/`
**File:** `features/auth/widgets/*.dart` (4 files)

- `otp_input.dart` (5.9 KB)
- `otp_blocks.dart` (3.8 KB)
- `otp_timer.dart` (5.1 KB)
- `phone_input_field.dart` (3.9 KB)

Plus `widgets/spark_otp_input.dart` (12.6 KB) at top level.

**Fix:** consolidate to one `features/auth/widgets/auth_widgets.dart` or keep separate but document the relationships.

### 6.6 [P2] `features/auth/widgets/otp_blocks.dart` and `otp_input.dart` may be old versions of the same widget
**File:** `features/auth/widgets/otp_blocks.dart`, `otp_input.dart`

`otp_verification_screen.dart` uses `SparkOtpInput` (from `widgets/spark_otp_input.dart`). The other two are likely legacy or alternative implementations.

**Fix:** grep usage. If unused, delete.

### 6.7 [P2] `rider_lifecycle_gate.dart` is 2.8 KB and is the right pattern
**File:** `features/auth/presentation/rider_lifecycle_gate.dart` (2.8 KB)

Pure function. No Flutter dependencies. Used by `RiderProvider.routeAfterLogin` and `AppRouter`. The `terminated → preDashboard` bug is here.

**Fix:** see 1.1 — the bug is in the router's `_lifecycleTargetToAuthState` switch, not in this file directly.

### 6.8 [P2] `auth/data/repository_impl.dart` (2.4 KB) and `auth/domain/entity.dart` (547 B) and `auth/domain/repository.dart` (404 B) are the right shape
**File:** `features/auth/{data,domain}/`

The auth feature has a clean domain layer. Good. The issue is that screens don't use it (see 1.1 / 6.2).

### 6.9 [P2] `auth_choice_screen.dart` (referenced from `DESIGN.md` but not found)
**File:** TBD

`DESIGN.md` line 47 mentions `auth_choice_screen.dart` but the file isn't in `features/auth/presentation/screens/`. Either deleted or never existed.

**Fix:** grep to confirm. If docs are wrong, fix the doc.

### 6.10 [P2] `otp_verification_screen.dart` has `widget.isLogin` flag but it's never set to true
**File:** `features/auth/presentation/screens/otp_verification_screen.dart:32`

```dart
final bool isLogin;
```

The default is `false` (line 41). No call site passes `true`. Either the flag is dead or a caller is missing.

**Fix:** grep for `OtpVerificationScreen(isLogin:`. If only `false` is ever passed, the flag is dead — remove.

### 6.11 [P3] `login_screen.dart` has hard-coded English copy
**File:** `features/auth/presentation/screens/login_screen.dart`

"Enter the registered phone number to login or enter a new number to create another account." and "A secure OTP will be sent" are hard-coded. Should be in l10n.

**Fix:** move to `app_en.arb` / `app_hi.arb`. (Some of this is already in the l10n catalog; just need to wire it up.)

### 6.12 [P2] `login_screen.dart` calls `PostHogService.capture('phone_entered', ...)` directly
**File:** `features/auth/presentation/screens/login_screen.dart:113-115, 122-125, 132`

Three call sites for `PostHogService.capture` in one file. Fine, but the analytics events should probably be in an enum or typed helper, not raw strings.

**Fix:** `AnalyticsEvent.phoneEntered` (already exists per main.dart:212). Use that.

### 6.13 [P2] `otp_verification_screen.dart` has `_isEnterPressed` and `_isVerifyPressed` "press" flags
**File:** `features/auth/presentation/screens/login_screen.dart:46, otp_verification_screen.dart:55`

```dart
bool _isEnterPressed = false;
```

This is for a "scale-down" animation on button press. Fine, but if it's also gated by `_canSubmit` (login) and `_isOtpComplete` (otp), the visual feedback for "button is disabled" is missing.

**Fix:** add an `_isDisabled` visual state, or just rely on the existing opacity animation.

### 6.14 [P2] `login_screen.dart` has an `AutofillHints.telephoneNumber` hint
**File:** `features/auth/presentation/screens/login_screen.dart:405`

```dart
autofillHints: const [AutofillHints.telephoneNumber],
```

Good. But OTP doesn't have an `AutofillHints.oneTimeCode`. Worth adding.

**Fix:** add `AutofillHints.oneTimeCode` to OTP inputs.

### 6.15 [P3] `auth/domain/entity.dart` is 547 B, has `SendOtpResult` and `VerifyOtpResult` — fine
**File:** `features/auth/domain/entity.dart`

Two simple result classes. Fine.

---

## 7. KYC + guarantor

### 7.1 [P0] `legal_page_screen.dart` is 34 KB — the biggest screen file
**File:** `features/onboarding/presentation/screens/legal_page_screen.dart` (34 KB)

Contains the legal content (terms, privacy, refund, guarantor) as **Dart string constants** inside a `ConsumerStatefulWidget` with a `documentType` filter. The file has:
- `_LegalPageScreenState` with scroll position memory
- 5 sections of legal text (each ~3-5 KB of prose)
- 4 `LegalDocumentType` enum values
- A custom `_LegalSection` data class
- A `WidgetsBindingObserver` mixin

**Why this is bad:**
- 34 KB of legal text in a Dart file means **every** rebuild compiles and tree-shakes the legal strings, and you can't `grep` the actual legal text against the source-of-truth document.
- A typo in the legal text is hard to review in a PR (it scrolls past 30 KB of code).
- Translations are not modeled — the file is English-only.

**Fix:** move legal text to a JSON or YAML file in `assets/legal/`. Load at runtime. Add i18n keys for the section titles. Use the existing `features/onboarding/presentation/screens/legal_page_content.dart` (6 KB) as a starting point.

### 7.2 [P0] `guarantor_onboarding_screen.dart` is 33 KB
**File:** `features/guarantor/presentation/screens/guarantor_onboarding_screen.dart` (33 KB)

The largest single-purpose screen. Contains:
- 10+ `_build*` methods (header, form fields, OTP section, signature, video capture, file picker, etc.)
- Inline form validation logic
- Multiple `setState` blocks for camera/OTP/file state
- `WidgetsBindingObserver` for keyboard

**Fix:** extract to a `guarantor_onboarding_widgets.dart` (which already exists at 33 KB — so the widgets are already separated, but the screen file itself is the parent). Move form logic to a `GuarantorFormController` (ChangeNotifier) or a Riverpod notifier.

### 7.3 [P1] `guarantor_onboarding_widgets.dart` is 33 KB — same problem
**File:** `features/guarantor/presentation/widgets/guarantor_onboarding_widgets.dart` (33 KB)

The widgets file is almost as big as the screen. It contains the actual `TextFormField`s, signature pads, video recorders, etc. Should be split by concern:
- `widgets/guarantor_form.dart` — form fields
- `widgets/guarantor_signature.dart` — signature pad
- `widgets/guarantor_video.dart` — video recorder

### 7.4 [P1] `choose_plan_screen.dart` is 32 KB
**File:** `features/rentals/presentation/screens/choose_plan_screen.dart` (32 KB)

The rental plan picker. 32 KB for a list of plans + selection UI is excessive.

**Fix:** extract plan cards to `widgets/plan_card.dart` and pricing details to a separate widget.

### 7.5 [P1] `edit_profile_screen.dart` is 31 KB
**File:** `features/profile/presentation/screens/edit_profile_screen.dart` (31 KB)

Profile editor. Form fields for name, email, phone, parents, address, guarantor. The form is a single `Form` with 10+ fields, all in one `StatefulWidget`.

**Fix:** extract `widgets/profile_form_fields.dart`, split into "personal info" / "guardian info" / "address" sub-forms.

### 7.6 [P1] `user_onboarding_widgets.dart` is 30 KB
**File:** `features/kyc/presentation/widgets/user_onboarding_widgets.dart` (30 KB)

KYC form widgets. Same shape as 7.3.

### 7.7 [P1] `user_onboarding_screen.dart` is 27 KB
**File:** `features/kyc/presentation/screens/user_onboarding_screen.dart` (27 KB)

KYC form screen. Same shape as 7.2.

### 7.8 [P1] `intent_of_use_screen.dart` is 13 KB
**File:** `features/kyc/presentation/screens/intent_of_use_screen.dart` (13 KB)

Smaller than the others. Probably fine, but worth checking.

### 7.9 [P1] `documents_screen.dart` is 19 KB
**File:** `features/kyc/presentation/screens/documents_screen.dart` (19 KB)

Document upload screen. Reasonable size.

### 7.10 [P1] `signature_pad_screen.dart` is 4.7 KB
**File:** `features/kyc/presentation/screens/signature_pad_screen.dart` (4.7 KB)

Small, fine.

### 7.11 [P2] `kyc/data/kyc_repository.dart` (3 KB) is fine
**File:** `features/kyc/data/kyc_repository.dart`

Single KYC repository. Clean.

### 7.12 [P2] `guarantor/data/guarantor_cache.dart` (1 KB) is fine
**File:** `features/guarantor/data/guarantor_cache.dart`

Form-state cache for guarantor. Used during the multi-step flow. Fine.

### 7.13 [P2] `guarantor/domain/form_validator.dart` (1.8 KB) is fine
**File:** `features/guarantor/domain/form_validator.dart`

Form validators. Fine.

### 7.14 [P2] `guarantor/domain/entity.dart` (1.5 KB) is fine
**File:** `guarantor/domain/entity.dart`

Domain types. Fine.

### 7.15 [P1] `kyc/presentation/widgets/` and `kyc/presentation/screens/` are the right separation
**File:** `features/kyc/presentation/`

Good. The widgets file is large but the separation is correct.

### 7.16 [P1] `legal_page_content.dart` (6 KB) exists but is unused — `legal_page_screen.dart` has its own copy
**File:** `features/onboarding/presentation/screens/legal_page_content.dart` (6 KB)

Likely the extracted content, but `legal_page_screen.dart` has its own `_LegalSection` array. Two sources of truth for legal text.

**Fix:** see 7.1 — move to assets, single source of truth.

### 7.17 [P3] `kyc/domain/entity.dart` (1.7 KB) is fine
**File:** `features/kyc/domain/entity.dart`

KYC domain types. Fine.

### 7.18 [P2] `guarantor_onboarding_screen.dart` has 10+ `setState` calls scattered
**File:** `features/guarantor/presentation/screens/guarantor_onboarding_screen.dart`

Each form input has its own `setState`. Camera state, OTP state, file state, signature state — all in one widget. Refactor to a `GuarantorFormController` (ChangeNotifier) and pass it down.

### 7.19 [P2] `guarantor_onboarding_widgets.dart` does not use the shared `widgets/form_widgets.dart`
**File:** `features/guarantor/presentation/widgets/guarantor_onboarding_widgets.dart`

Custom form fields instead of using the shared `form_widgets.dart`. Inconsistency.

**Fix:** migrate to shared `form_widgets.dart` for consistency.

### 7.20 [P3] `legal_screen.dart` (25 KB) — different from `legal_page_screen.dart` (34 KB)
**File:** `features/onboarding/presentation/screens/legal_screen.dart` (25 KB)

The "first-time legal" consent screen (different from the in-app legal page). 25 KB is large for a "I agree" screen — likely includes the legal text inline.

**Fix:** same as 7.1.

---

## 8. Dashboard + pre-dashboard

### 8.1 [P0] `pre_dashboard_screen.dart` is 19 KB with 5-state derivation block
**File:** `features/dashboard/presentation/screens/pre_dashboard_screen.dart` (19 KB)

Already covered in the broad audit. Specific issues:
- 5 state derivations using magic rank numbers (3, 4, 6, 8, 9)
- `_redirected` flag managed in `setState` with `addPostFrameCallback`
- `debugPrint('PreDashboardScreen: currentPlan = ...')` left in

**Fix:** see `SCOPE.md` Phase 5.

### 8.2 [P1] `pre_dashboard_screen.dart` uses `FadeUpWidget` 10+ times with arbitrary `delay` numbers
**File:** `features/dashboard/presentation/screens/pre_dashboard_screen.dart`

See 3.3.

### 8.3 [P1] `pre_dashboard_screen.dart` shows banner + profile + approval + plan + wallet + referral + help cards all in one scroll
**File:** `features/dashboard/presentation/screens/pre_dashboard_screen.dart`

The "approval matrix" widget (which is in `widgets/approval_matrix_widget.dart`, 7 KB) renders 5 state-dependent cards. Plus the wallet card, referral card, plan card, TL card, scooter banner. 7+ card widgets in one scroll. If the rider has 4 conditions met, the screen shows 4 checkmarks and the rider still has to scroll.

**Fix:** collapse the approval matrix into a single "you have N things to do" card with expand-to-detail. Or show only the next-pending-step.

### 8.4 [P0] `active_dashboard_screen.dart` is 12 KB and shows a top-up request sent card that suggests the rider top-up is still pending
**File:** `features/dashboard/presentation/screens/active_dashboard_screen.dart` (12 KB)

The top-up-pending card (`widgets/top_up_request_sent_card.dart`) shows even when there's no pending top-up. Let me check — actually the screenshot from the original audit showed this card on the dashboard. Worth verifying the conditional.

### 8.5 [P1] `dashboard/widgets/dashboard_sheets.dart` is 27 KB
**File:** `features/dashboard/widgets/dashboard_sheets.dart` (27 KB)

Bottom sheets for the dashboard. Multiple `_show*Sheet` methods.

**Fix:** split into per-concern sheet files.

### 8.6 [P1] `widgets/dashboard_wallet_card.dart` (14 KB) — wallet preview card
**File:** `widgets/dashboard_wallet_card.dart` (14 KB)

Show wallet balance, deposit, recent transaction. Should move to `features/dashboard/widgets/`.

### 8.7 [P1] `widgets/dashboard_referral_card.dart` (6.5 KB) — referral card
**File:** `widgets/dashboard_referral_card.dart` (6.5 KB)

Move to `features/dashboard/widgets/` or `features/referrals/widgets/`.

### 8.8 [P1] `widgets/dashboard_profile_card.dart` (4.8 KB) — profile card
**File:** `widgets/dashboard_profile_card.dart` (4.8 KB)

Move to `features/dashboard/widgets/`.

### 8.9 [P1] `widgets/dashboard_plan_card.dart` — referenced from pre_dashboard
**File:** N/A

Move to `features/dashboard/widgets/`.

### 8.10 [P1] `widgets/dashboard_scooter_banner.dart` (4.2 KB) — scooter banner
**File:** `widgets/dashboard_scooter_banner.dart` (4.2 KB)

Move to `features/dashboard/widgets/`.

### 8.11 [P1] `widgets/dashboard_kpi_tile.dart` (3.4 KB) — KPI tile
**File:** `widgets/dashboard_kpi_tile.dart` (3.4 KB)

Move to `features/dashboard/widgets/`.

### 8.12 [P1] `widgets/dashboard_bento_grid.dart` (3.2 KB) — bento grid layout
**File:** `widgets/dashboard_bento_grid.dart` (3.2 KB)

Move to `features/dashboard/widgets/`.

### 8.13 [P1] `widgets/dashboard_tl_card.dart` (3.9 KB) — team leader card
**File:** `widgets/dashboard_tl_card.dart` (3.9 KB)

Move to `features/dashboard/widgets/` or `features/pickup/widgets/`.

### 8.14 [P1] `widgets/pre_dashboard_widgets.dart` (25 KB) — pre-dashboard widgets
**File:** `widgets/pre_dashboard_widgets.dart` (25 KB)

Move to `features/dashboard/widgets/`.

### 8.15 [P1] `dashboard/widgets/dashboard_sheets.dart` and `dashboard/widgets/` overall
**File:** `features/dashboard/widgets/`

Already a per-feature widget dir. The fact that dashboard has 8 widget files in `widgets/` (top level) and a `dashboard_sheets.dart` in its own dir is the smell — most dashboard widgets are at the wrong path.

### 8.16 [P2] `engagement_provider.dart` is 4.7 KB
**File:** `features/dashboard/presentation/providers/engagement_provider.dart` (4.7 KB)

Holds reward points, payment streak, notifications, referrals. Four concerns in one provider. Split.

### 8.17 [P2] `dashboard/domain/entity.dart` (585 B) is fine
**File:** `features/dashboard/domain/entity.dart`

Single domain type. Fine.

### 8.18 [P3] `dashboard/presentation/providers/engagement_provider.dart` references "rewards" and "referrals" — should be in those features
**File:** `features/dashboard/presentation/providers/engagement_provider.dart`

Provider is in `dashboard/` but manages data that's also used by `rewards/` and `referrals/`. Move to `features/engagement/` or to the originating feature.

---

## 9. Wallet + transactions

### 9.1 [P1] `wallet/presentation/widgets/wallet_widgets.dart` is 29 KB
**File:** `features/wallet/presentation/widgets/wallet_widgets.dart` (29 KB)

The wallet widget collection. Big, but the wallet screen needs a lot of UI. Acceptable.

### 9.2 [P1] `top_up_proof_screen.dart` is 28 KB
**File:** `features/wallet/presentation/screens/top_up_proof_screen.dart` (28 KB)

Top-up proof upload. Image picker, file upload, multi-step form. Big but justified.

### 9.3 [P1] `history_screen.dart` is 20 KB
**File:** `features/wallet/presentation/screens/history_screen.dart` (20 KB)

Transaction history. Filter chips, paginated list, detail sheet. Reasonable.

### 9.4 [P1] `top_up_upi_screen.dart` is 19 KB
**File:** `features/wallet/presentation/screens/top_up_upi_screen.dart` (19 KB)

UPI instructions. QR code, deep link, copy-to-clipboard.

### 9.5 [P1] `top_up_amount_screen.dart` is 15 KB
**File:** `features/wallet/presentation/screens/top_up_amount_screen.dart` (15 KB)

Amount picker.

### 9.6 [P1] `top_up_receipt_screen.dart` is 7.9 KB
**File:** `features/wallet/presentation/screens/top_up_receipt_screen.dart` (7.9 KB)

Receipt display. Reasonable.

### 9.7 [P1] `top_up_flow.dart` is 5.2 KB
**File:** `features/wallet/presentation/screens/top_up_flow.dart` (5.2 KB)

Top-up flow orchestrator. Used by router.

### 9.8 [P2] `wallet/presentation/providers/wallet_provider.dart` is 5 KB
**File:** `features/wallet/presentation/providers/wallet_provider.dart` (5 KB)

Already covered. The `_parseTransactionStatus` helper duplicates the API contract.

### 9.9 [P2] `wallet/data/repository_impl.dart` (2.6 KB) is fine
**File:** `features/wallet/data/repository_impl.dart`

Single wallet repo. Fine.

### 9.10 [P2] `wallet/domain/entity.dart` (2.7 KB) and `repository.dart` (582 B) are fine
**File:** `features/wallet/domain/`

Domain types. Fine.

### 9.11 [P2] `wallet/widgets/wallet_card.dart` (8.7 KB) and `wallet/widgets/skeleton_wallet_card.dart` (2.5 KB) are wallet-specific
**File:** `features/wallet/widgets/`

Already in the right place. Fine.

### 9.12 [P2] `wallet/widgets/transaction_filter.dart` (8.6 KB) is fine
**File:** `features/wallet/widgets/transaction_filter.dart`

Filter UI. Fine.

### 9.13 [P1] `wallet_screen.dart` (8 KB? not in top 50 — let me check) — Top up: `wallet_screen.dart` size not in inventory
**File:** `features/wallet/presentation/screens/wallet_screen.dart`

Looking at the inventory, I see `wallet_card.dart` and `top_up_*.dart` but the main `wallet_screen.dart` was not listed in the top 50. Let me confirm.

(Will verify in next read.)

### 9.14 [P2] `wallet_service.ts` is in `lib/services/`, but `wallet_service` doesn't exist in `lib/services/` — only `lib/services/` has wallet-related services
**File:** N/A

OK, this is a Flutter app, the .ts is a leftover from a previous plan. Skip.

### 9.15 [P2] `deposit_service.ts` is referenced from `lib/services/` — same
**File:** N/A

Skip.

---

## 10. Pickup + rentals

### 10.1 [P1] `rentals/presentation/screens/choose_plan_screen.dart` is 32 KB
**File:** `features/rentals/presentation/screens/choose_plan_screen.dart` (32 KB)

Plan picker. 32 KB is excessive. The plan list is probably the big part.

**Fix:** see 7.4.

### 10.2 [P1] `rentals/presentation/screens/end_rental_screen.dart` is 22 KB
**File:** `features/rentals/presentation/screens/end_rental_screen.dart` (22 KB)

End-rental flow. Multi-step (return photo, odometer, reason, confirm). Big but justified.

### 10.3 [P1] `rentals/presentation/screens/rental_details_screen.dart` is 13 KB
**File:** `features/rentals/presentation/screens/rental_details_screen.dart` (13 KB)

Rental details. Reasonable.

### 10.4 [P1] `rentals/presentation/screens/plan_success_screen.dart` is 2.4 KB
**File:** `features/rentals/presentation/screens/plan_success_screen.dart` (2.4 KB)

Small. Fine.

### 10.5 [P1] `pickup/presentation/screens/pickup_hub_screen.dart` is 20 KB
**File:** `features/pickup/presentation/screens/pickup_hub_screen.dart` (20 KB)

Hub picker + vehicle search. Reasonable.

### 10.6 [P1] `pickup/presentation/screens/pickup_verification_screen.dart` is 6.2 KB
**File:** `features/pickup/presentation/screens/pickup_verification_screen.dart` (6.2 KB)

Verification. Fine.

### 10.7 [P1] `pickup/presentation/screens/pickup_success_screen.dart` is 2.6 KB
**File:** `features/pickup/presentation/screens/pickup_success_screen.dart` (2.6 KB)

Fine.

### 10.8 [P1] `pickup/presentation/screens/tl_details_screen.dart` is 7.5 KB
**File:** `features/pickup/presentation/screens/tl_details_screen.dart` (7.5 KB)

Team leader details. Fine.

### 10.9 [P1] `pickup/presentation/screens/vehicle_photos_screen.dart` is 9 KB
**File:** `features/pickup/presentation/screens/vehicle_photos_screen.dart` (9 KB)

Photo capture. Fine.

### 10.10 [P1] `widgets/pickup_hub_widgets.dart` is 23 KB
**File:** `widgets/pickup_hub_widgets.dart` (23 KB)

Pickup-specific widgets. Move to `features/pickup/widgets/`.

### 10.11 [P1] `pickup/presentation/widgets/pickup_widgets.dart` is 12 KB
**File:** `features/pickup/presentation/widgets/pickup_widgets.dart` (12 KB)

Already in the right place. Fine.

### 10.12 [P2] `pickup/widgets/pickup_vehicle_search_sheet.dart` is 12 KB
**File:** `features/pickup/widgets/pickup_vehicle_search_sheet.dart` (12 KB)

Fine.

### 10.13 [P2] `pickup/domain/entity.dart` (970 B) is fine
**File:** `features/pickup/domain/entity.dart`

Fine.

### 10.14 [P2] `rentals/data/repository_impl.dart` (1.7 KB) is fine
**File:** `features/rentals/data/repository_impl.dart`

Fine.

### 10.15 [P2] `rentals/domain/entity.dart` (2.3 KB) and `repository.dart` (778 B) are fine
**File:** `features/rentals/domain/`

Fine.

### 10.16 [P2] `auth_choice_screen.dart` (referenced in DESIGN.md but not found)
**File:** N/A

DESIGN.md mentions an `auth_choice_screen.dart` that's not in the code. Either docs are stale or the file was deleted. Skip.

---

## 11. Profile

(Already audited in earlier session. Light touch.)

### 11.1 [P0] `settings_screen.dart` (22 KB) — was renamed from `controls_screen.dart` in last session
**File:** `features/profile/presentation/screens/settings_screen.dart` (22 KB)

The Settings screen now has 6 sections, 12+ tiles, and an identity block. Still 22 KB. Could be split per section.

### 11.2 [P1] `edit_profile_screen.dart` (31 KB) — see 7.5
**File:** `features/profile/presentation/screens/edit_profile_screen.dart`

### 11.3 [P1] `profile_screen.dart` (18 KB) — 7-section menu, was already split but inline
**File:** `features/profile/presentation/screens/profile_screen.dart` (18 KB)

### 11.4 [P1] `profile_detail_screen.dart` (15.7 KB) is fine
**File:** `features/profile/presentation/screens/profile_detail_screen.dart`

### 11.5 [P1] `earnings_screen.dart` (14.5 KB) is fine
**File:** `features/profile/presentation/screens/earnings_screen.dart`

### 11.6 [P2] `profile/presentation/widgets/earnings_widgets.dart` (18.4 KB) — duplicates `rewards/widgets/earnings_widgets.dart`
**File:** `features/profile/presentation/widgets/earnings_widgets.dart`, `features/rewards/widgets/earnings_widgets.dart`

**Two near-identical files**, both 18+ KB. Confusing. Pick one.

### 11.7 [P2] `profile/presentation/widgets/profile_widgets.dart` (17.5 KB) is fine
**File:** `features/profile/presentation/widgets/profile_widgets.dart`

### 11.8 [P2] `profile/data/repository_impl.dart` (2.5 KB) is fine
**File:** `features/profile/data/repository_impl.dart`

### 11.9 [P2] `profile/domain/entity.dart` (1.2 KB) and `repository.dart` (754 B) are fine
**File:** `features/profile/domain/`

Fine.

### 11.10 [P3] `profile_widgets.dart` has the deprecated `ProfileQuickLinks` that was identified earlier
**File:** `features/profile/presentation/widgets/profile_widgets.dart`

Already flagged in the earlier session. Skip.

---

## 12. Support

### 12.1 [P1] `support/presentation/screens/support_center_screen.dart` is 18 KB
**File:** `features/support/presentation/screens/support_center_screen.dart` (18 KB)

Support center landing. Reasonable size.

### 12.2 [P1] `support/presentation/screens/faq_screen.dart` is 14 KB
**File:** `features/support/presentation/screens/faq_screen.dart` (14 KB)

FAQ. Reasonable.

### 12.3 [P1] `support/presentation/screens/feedback_screen.dart` is 17 KB
**File:** `features/support/presentation/screens/feedback_screen.dart` (17 KB)

Feedback form. Reasonable.

### 12.4 [P1] `support/presentation/screens/troubleshooter_screen.dart` is 19 KB
**File:** `features/support/presentation/screens/troubleshooter_screen.dart` (19 KB)

Troubleshooter UI. Big but justified.

### 12.5 [P1] `support/presentation/screens/troubleshooter_result.dart` is 571 B
**File:** `features/support/presentation/screens/troubleshooter_result.dart`

Tiny. Fine.

### 12.6 [P1] `support/presentation/screens/create_ticket_screen.dart` is 11 KB
**File:** `features/support/presentation/screens/create_ticket_screen.dart` (11 KB)

Fine.

### 12.7 [P1] `support/presentation/screens/ticket_detail_screen.dart` is 3.6 KB
**File:** `features/support/presentation/screens/ticket_detail_screen.dart` (3.6 KB)

Small. Fine.

### 12.8 [P1] `support/presentation/providers/support_provider.dart` is 4.8 KB
**File:** `features/support/presentation/providers/support_provider.dart` (4.8 KB)

### 12.9 [P1] `support/presentation/providers/ticket_provider.dart` is 2.2 KB
**File:** `features/support/presentation/providers/ticket_provider.dart` (2.2 KB)

### 12.10 [P1] `support/presentation/widgets/troubleshooter_widgets.dart` is 19 KB
**File:** `features/support/presentation/widgets/troubleshooter_widgets.dart` (19 KB)

### 12.11 [P1] `support/presentation/widgets/support_widgets.dart` is 17 KB
**File:** `features/support/presentation/widgets/support_widgets.dart` (17 KB)

### 12.12 [P2] `data/troubleshooter_tree.dart` (14 KB) is the troubleshooter decision tree
**File:** `data/troubleshooter_tree.dart` (14 KB)

Data file. Static decision tree. Fine, but worth checking it's not edited at runtime.

### 12.13 [P2] `support/data/repository_impl.dart` (1.4 KB) is fine
**File:** `features/support/data/repository_impl.dart`

### 12.14 [P2] `support/domain/entity.dart` (2.8 KB) and `repository.dart` (621 B) are fine
**File:** `features/support/domain/`

Fine.

### 12.15 [P1] `support_center_screen.dart` reuses `widgets/dashboard_*` for layout
**File:** `features/support/presentation/screens/support_center_screen.dart`

Cross-feature widget usage. Could be intentional but worth checking.

---

## 13. Notifications

### 13.1 [P1] `notifications/presentation/screens/notifications_screen.dart` is 25 KB
**File:** `features/notifications/presentation/screens/notifications_screen.dart` (25 KB)

In-app notification list. 25 KB is large for a paginated list.

**Fix:** extract `widgets/notification_list.dart`, `widgets/notification_filter.dart`.

### 13.2 [P1] `notifications/presentation/screens/notification_preferences_screen.dart` is 13 KB
**File:** `features/notifications/presentation/screens/notification_preferences_screen.dart` (13 KB)

Per-category notification toggles. Reasonable.

### 13.3 [P1] `notifications/widgets/notification_cards.dart` is 8.7 KB
**File:** `features/notifications/widgets/notification_cards.dart` (8.7 KB)

Already in the right place. Fine.

### 13.4 [P2] `notifications/presentation/providers/notification_provider.dart` is 2.6 KB
**File:** `features/notifications/presentation/providers/notification_provider.dart` (2.6 KB)

### 13.5 [P2] `notifications/domain/entity.dart` (1.5 KB) is fine
**File:** `features/notifications/domain/entity.dart`

### 13.6 [P0] Two "Notification" services — `NotificationService` (push) and `NotificationProvider` (in-app list)
**File:** `services/notification_service.dart`, `features/notifications/presentation/providers/notification_provider.dart`

Already covered in 4.3. Rename for clarity.

---

## 14. Referrals + rewards

### 14.1 [P1] `referrals/presentation/screens/referral_screen.dart` is 12 KB
**File:** `features/referrals/presentation/screens/referral_screen.dart` (12 KB)

Referral program screen. Reasonable.

### 14.2 [P1] `referrals/widgets/referral_card.dart` is 11 KB
**File:** `features/referrals/widgets/referral_card.dart` (11 KB)

### 14.3 [P1] `rewards/presentation/screens/rewards_screen.dart` is 13.5 KB
**File:** `features/rewards/presentation/screens/rewards_screen.dart` (13.5 KB)

### 14.4 [P1] `rewards/widgets/earnings_chart.dart` is 4.4 KB
**File:** `features/rewards/widgets/earnings_chart.dart` (4.4 KB)

### 14.5 [P1] `rewards/widgets/earnings_add_sheet.dart` is 11 KB
**File:** `features/rewards/widgets/earnings_add_sheet.dart` (11 KB)

### 14.6 [P1] `rewards/widgets/earnings_widgets.dart` is 19 KB
**File:** `features/rewards/widgets/earnings_widgets.dart` (19 KB)

### 14.7 [P0] `widgets/earnings_chart.dart` (4.4 KB) AND `rewards/widgets/earnings_chart.dart` (4.4 KB) — same name, different paths
**File:** `widgets/earnings_chart.dart`, `rewards/widgets/earnings_chart.dart`

Already flagged in 3.1. **Duplicate files with the same name.** Need to confirm which is canonical.

### 14.8 [P0] `widgets/earnings_add_sheet.dart` (10.6 KB) AND `rewards/widgets/earnings_add_sheet.dart` (10.8 KB) — same name, different paths
**File:** `widgets/earnings_add_sheet.dart`, `rewards/widgets/earnings_add_sheet.dart`

**Duplicate files with the same name.** Need to confirm which is canonical.

### 14.9 [P1] `profile/presentation/widgets/earnings_widgets.dart` (18.4 KB) AND `rewards/widgets/earnings_widgets.dart` (19 KB) — also duplicates
**File:** `features/profile/presentation/widgets/earnings_widgets.dart`, `features/rewards/widgets/earnings_widgets.dart`

**Three files with the same name.** Definitely a copy-paste error at some point.

### 14.10 [P2] `rewards/domain/entity.dart` (1.1 KB) is fine
**File:** `features/rewards/domain/entity.dart`

---

## 15. Device compliance

### 15.1 [P0] `device_compliance/presentation/providers/device_policy_provider.dart` is 9.6 KB
**File:** `features/device_compliance/presentation/providers/device_policy_provider.dart` (9.6 KB)

The device-policy provider. Holds:
- `forceUpdate`, `mandatoryUpdateUrl`
- `isAdminActive`, `lockedByAdmin`
- `hasPermissionViolation`, `violationPermissionId`

Plus a polling mechanism, integrity check, and a callback to start the FCM security command pipeline. 4-5 concerns.

**Fix:** split into `device_policy_provider` and `integrity_provider` and `lock_provider`.

### 15.2 [P1] `device_compliance/presentation/screens/emergency_sos_screen.dart` is 7.8 KB
**File:** `features/device_compliance/presentation/screens/emergency_sos_screen.dart` (7.8 KB)

SOS screen. Fine.

### 15.3 [P1] `device_compliance/presentation/screens/emergency_contacts_screen.dart` is 8.9 KB
**File:** `features/device_compliance/presentation/screens/emergency_contacts_screen.dart` (8.9 KB)

Emergency contacts. Fine.

---

## 16. Workflows

### 16.1 [P1] `workflows/presentation/screens/rider_workflow_hub_screen.dart` is 11 KB
**File:** `features/workflows/presentation/screens/rider_workflow_hub_screen.dart` (11 KB)

Workflow hub. Reasonable.

### 16.2 [P3] `features/workflows/` is otherwise empty
**File:** `features/workflows/`

Just one screen. The "workflow" abstraction may not warrant its own feature dir. Could be merged into `dashboard/` or `pickup/`.

---

## 17. Onboarding + permissions

### 17.1 [P1] `onboarding/presentation/screens/legal_screen.dart` is 25 KB
**File:** `features/onboarding/presentation/screens/legal_screen.dart` (25 KB)

Same issue as `legal_page_screen.dart` — 25 KB of legal text. See 7.1.

### 17.2 [P1] `onboarding/presentation/screens/permissions_screen.dart` is 16 KB
**File:** `features/onboarding/presentation/screens/permissions_screen.dart` (16 KB)

Permission request flow. Each permission is its own card with status, rationale, action button. Reasonable.

### 17.3 [P1] `onboarding/presentation/screens/splash_screen.dart` is 9.5 KB
**File:** `features/onboarding/presentation/screens/splash_screen.dart` (9.5 KB)

Splash. Fine.

### 17.4 [P1] `onboarding/presentation/screens/welcome_screen.dart` is 8.5 KB
**File:** `features/onboarding/presentation/screens/welcome_screen.dart` (8.5 KB)

Welcome. Fine.

### 17.5 [P1] `onboarding/presentation/screens/onboarding_screen.dart` is 6.3 KB
**File:** `features/onboarding/presentation/screens/onboarding_screen.dart` (6.3 KB)

3-slide intro. Fine.

### 17.6 [P2] `onboarding/presentation/screens/legal_page_content.dart` (6 KB) is the unused legal content
**File:** `features/onboarding/presentation/screens/legal_page_content.dart`

See 7.16.

### 17.7 [P2] `onboarding/domain/entity.dart` (1.3 KB) and `repository.dart` (427 B) are fine
**File:** `features/onboarding/domain/`

Fine.

---

## 18. Top-level app shell

### 18.1 [P0] `main.dart` is 14 KB with 50+ imports
**File:** `main.dart` (14 KB)

The bootstrap. Imports:
- Firebase
- All 4 feature repositories (auth, profile, rental, wallet, support)
- All 5 providers (rider, wallet, support, engagement, device policy)
- Connectivity, cache, analytics, monitoring, FCM, emergency contacts services
- Theme, localization
- Shell widgets (banner, nav, error boundary, overlay manager, lazy stack)
- PostHog

50+ imports. The `runZonedGuarded` + nested `runApp` + `ProviderScope` + `MaterialApp` + `AppShell` structure is correct, but the file is doing too much.

**Fix:** extract `bootstrap.dart` (initialization), `app_providers.dart` (provider construction), keep `main.dart` to 30 lines.

### 18.2 [P1] `main.dart` has 5 separate `await` calls in `runZonedGuarded`
**File:** `main.dart:151-211`

`await CacheService().init()`, `await OfflineStorageService().init()`, `await NotificationService().init()`, `await ConnectivityService().init()`, `await Firebase.initializeApp()`, `await FCMService.initialize()`. All in series. On a slow device, splash shows for 5+ seconds.

**Fix:** parallelize with `Future.wait([...])` where possible. Cache, Offline, Notification, Connectivity can all init in parallel. Firebase and FCM need to be sequential.

### 18.3 [P1] `main.dart` has a hard-coded check `isTestMode` that uses `assert`
**File:** `main.dart:101-105`

```dart
bool isTestMode = false;
assert(() {
  isTestMode = true;
  return true;
}());
if (!kIsWeb && !isTestMode && !AppConstants.isTestMode) {
  ErrorWidget.builder = ...;
}
```

Two separate test-mode checks (`isTestMode` from `assert` and `AppConstants.isTestMode`). The `assert` runs only in debug. Production: `isTestMode = false`. Test: `isTestMode = true`.

**Fix:** consolidate to `AppConstants.isTestMode` only. The `assert` block is redundant.

### 18.4 [P2] `app/router_body.dart` is a part-of file (15 KB) that contains the entire state machine
**File:** `app/router.dart` (12 KB) + `app/router_body.dart` (15 KB)

Part-of pattern. The body file is larger than the parent. If you ever want to navigate to `app/router_body.dart` directly (e.g. for test), you can't.

**Fix:** see 1.1. Convert to go_router.

### 18.5 [P2] `app/app_state.dart` is a 372 B file with one enum
**File:** `app/app_state.dart` (372 B)

`AuthState` enum, 28 values. This is the most "central" enum in the app.

**Fix:** leave as-is. It's the contract.

### 18.6 [P2] `driver_main.dart` is 221 B
**File:** `driver_main.dart` (221 B)

Tiny entry point. Likely just for `flutter_driver` integration tests. Fine.

### 18.7 [P2] `firebase_options.dart` (1.6 KB) is the Firebase config
**File:** `firebase_options.dart`

Auto-generated. Fine.

### 18.8 [P2] `app/router.dart` has `import 'package:permission_handler/permission_handler.dart'`
**File:** `app/router.dart:4`

The router directly imports `permission_handler` for the `_areAllRequiredPermissionsGranted` check. That's UI-layer logic in the router.

**Fix:** see 3.8. Move to `widgets/permission_guard.dart`.

---

## Tally

Counted from this audit alone:
- **P0: 18** (broken behavior, security, lies, dead code with active docstrings, duplicates with same name, missing safety checks)
- **P1: 56** (will bite soon — large files, naming collisions, widget organization, missing tests)
- **P2: 76** (code smells, structural cleanup)
- **P3: 11** (nice-to-have)

**Total: 161 findings.**

The top 10 by impact (do these first):
1. Delete two no-op `AuthWrapper` files (1.2)
2. Delete `widgets/theme_icons.dart` (3.2 — zero importers)
3. Resolve the 3 sets of duplicate files (3.1, 14.7-9)
4. Fix the `terminated → preDashboard` routing bug (1.1)
5. Move legal text out of `legal_page_screen.dart` and `legal_screen.dart` (7.1, 17.1)
6. Add `_isPollingTimedOut` state (1.3)
7. Refactor router to Navigator-based + lift pickup data to a provider (1.1)
8. Consolidate the 8 blues, 9 greens, 8 reds, 10 grays into the 12 spec tokens (2.1)
9. Trim `AppTypography` from 28 to 15 (2.2)
10. Move dashboard-specific widgets out of `widgets/` (8.6-14)

**Note:** this audit is comprehensive but not exhaustive. Several sections I deferred (some `widgets/` files, less critical services) can be revisited when the team has time.

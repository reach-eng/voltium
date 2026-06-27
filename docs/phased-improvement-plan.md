# Voltium Rider App — Phased Improvement Plan

> **Base path**: `flutter/lib/` — all paths below are relative to this directory.
> **Goal**: Incrementally improve quality, reliability, performance, architecture, testing, and polish — each phase self-contained and executable independently.

---

## Phase 1: Quality/Cleanup
*Design token consistency, dead code removal, quick fixes.*

**Risk: Low — mechanical changes, no behavior modification.**

| # | File | Change | Why |
|---|------|--------|-----|
| 1.1 | `main.dart` | Replace `const Color(0xFF0053C1)`, `Colors.white` with `AppColors.primary`, `AppColors.surfaceWhite` | Token consistency |
| 1.2 | `theme/app_theme.dart` | `CardTheme.color` uses `Colors.white` → `AppColors.surfaceWhite`. Verify `CardTheme.margin` vs design spec (8px vs 12px) | Spec alignment |
| 1.3 | `theme/app_colors.dart` | Audit unused colors (`iconBackgroundBlue`, etc.) and prune | Dead code removal |
| 1.4 | `services/receipt_service.dart` | Replace `Colors.grey.shade*` inline with `AppColors.onSurfaceVariant`, `AppColors.outlineVariant` | Token migration |
| 1.5 | `services/voltium_api_service.dart` | Remove `import` from `app_provider.dart` once consolidated (Phase 4) or tag for deprecation | Points to Phase 4.1 |
| 1.6 | `services/analytics_service.dart` | Ensure singleton access pattern is consistent between `main.dart` error handler and direct calls | Consistency |
| 1.7 | `services/crash_reporter.dart` | Add doc comment clarifying role vs `MonitoringService` | Architectural clarity |
| 1.8 | `widgets/shell_banners.dart` | Verify `_Severity`, `_Reason` are unused outside this file | Dead-code hygiene |
| 1.9 | All files | Run `dart fix --apply` for `saropa_lints`/`flutter_lints` | Baseline lint |

**Phase 1 deliverable**: All hardcoded colors use `AppColors.*`, project lint-clean.

---

## Phase 2: Reliability
*State management, navigation timing, error handling.*

**Risk: Medium — touches provider internals and error paths.**

| # | File | Change | Why |
|---|------|--------|-----|
| 2.1 | `main.dart` | `ErrorWidget.builder` "Restart App" button does nothing — wire to `Navigator.pushReplacement` (rebuild widget tree) or `SystemNavigator.route()` (close app). Remove if unimplementable | User-facing dead button erodes trust |
| 2.2 | `main.dart` (VoltiumApp.build()) | `context.watch<LocaleProvider>()` + `context.watch<ThemeProvider>()` rebuild entire `MaterialApp` on any change. Wrap in `AnimatedBuilder` scoped to affected properties only | Unnecessary full widget tree reconstruction |
| 2.3 | `providers/app_provider.dart` | `Timer(Duration.zero, notifyListeners)` coalesces to next microtask. Change to `Timer(const Duration(milliseconds: 16))` for frame-level batching | Throttles rebuilds to ~60fps rate |
| 2.4 | `providers/rider_provider.dart` | `_poll()` uses `Completer<void>` + `Timer` inside `doWhile` — anti-pattern. Replace with `Timer.periodic` + `cancel()` | Eliminates potential lockup |
| 2.5 | `providers/rider_provider.dart` | `_extractUserMessage` checks `error.toString().contains('SocketException')` — fragile. Use `on SocketException` / `on TimeoutException` catch clauses | Robust error handling |
| 2.6 | `providers/support_provider.dart`, `engagement_provider.dart` | Both initialize mock data in `kDebugMode` blocks. Remove `initSupportData()` mock path, push to test fixtures | Production reliability — no mock data in shipped builds |
| 2.7 | `services/fcm_service.dart` | `_handleOverlayTrigger` calls nullable `_devicePolicy?.setForceUpdate(...)` etc — could be null if FCM inits before providers. Ensure ordered init or add null-safety assertions | Crash prevention |
| 2.8 | `services/connectivity_service.dart` | `_updateConnectionStatus` uses `List<ConnectivityResult>` (v6). Ensure `checkConnection()` stream doesn't double-subscribe on `init()` | Prevents event leak |
| 2.9 | `services/offline_storage_service.dart` | `_initialized` flag not reset on `close()`. Set `_initialized = false` | Prevents stale DB state on re-init |
| 2.10 | `app/router.dart` | `didChangeDependencies` calls `AppProvider.init()` on every dep change. Move to single post-frame callback with `_initialized` flag | Prevents redundant init calls |

**Phase 2 deliverable**: Error button works, throttled provider rebuilds, no mock data in production, safe FCM/connectivity init.

---

## Phase 3: Performance
*Animation optimization, const correctness, rebuild reduction.*

**Risk: Medium — affects animation curves, widget lifecycle.**

| # | File | Change | Why |
|---|------|--------|-----|
| 3.1 | All feature screens | Audit `const` constructors — add `const` to all widgets with const-compatible parameter lists | Reduces widget allocation on rebuild |
| 3.2 | `widgets/animated_bottom_nav.dart` | `GoogleFonts.inter()` called per `Text` widget in `_NavButton.build()`. Extract `TextStyle` as cached static or `const` | Text layout performance on every frame |
| 3.3 | `dashboard/.../active_dashboard_screen.dart` | Entire screen rebuilds on any `AppProvider` change. Split into `DashboardHeader`, `DashboardContent`, `DashboardErrorState` each with narrow `context.select()` | Isolates rebuilds to affected sections |
| 3.4 | `providers/device_policy_provider.dart` | `startIntegrityCheck()` runs 10s timer calling `Permission.location.isGranted` (platform channel). Add count limit + exponential backoff on failure | Prevents battery drain on repeated failures |
| 3.5 | `services/background_location_service.dart` | `Timer.periodic(30s)` with `LocationAccuracy.high`. Reduce to `LocationAccuracy.medium` + 60s interval unless tracking state demands high accuracy | Battery life optimization |
| 3.6 | `widgets/skeleton_loader.dart` (new — Phase 6) | Pre-create skeleton widget once screens are ready for it | Ready when Phase 6 starts |

**Phase 3 deliverable**: Const-correct widget tree, narrow rebuild scopes, reduced platform channel calls.

---

## Phase 4: Architecture
*API client consolidation, feature isolation, provider strategy.*

**Risk: High — structural changes, affects all layers.**

| # | File | Change | Why |
|---|------|--------|-----|
| 4.1 | `services/voltium_api_service.dart` + `core/network/generated/*` | `VoltiumApiService` wraps `ApiClient` which wraps `VoltiumApiClient` — double-wrap. Remove `voltium_api_service.dart`, move its methods into feature repositories (`RiderRepository`, `WalletRepository`, `SupportRepository`). Generated client is single source of truth | Eliminates duplicate API layer |
| 4.2 | `providers/app_provider.dart` | "God provider" — creates/owns/exposes all sub-providers via delegation getters. Mark all delegation getters `@Deprecated('Inject RiderProvider directly')`. New screens should inject sub-providers directly via `Provider.of<T>()` | Breaks monolithic coupling |
| 4.3 | All feature `data/repository_impl.dart` files | Instantiated inside `AppProvider` constructor. Move to a `Provider` factory at app root for testability | DI readiness |
| 4.4 | `app/router.dart` | 45+ lines of inline flow state + 200+ lines of switch-case routing. Extract `PickupFlowState`, `TopUpFlowState`, `AuthFlowState` into separate classes | Single-responsibility routing |
| 4.5 | `core/network/files_repository.dart` | Used by both `FilesRepository` and `VoltiumApiService.uploadFile`. After 4.1 only `FilesRepository` remains. Move to shared singleton/provider | Clean DI |
| 4.6 | Feature screen re-exports (e.g., `features/dashboard/presentation/screens/support_center_screen.dart`) | Remove re-export files, import directly from feature's own screen file | Reduces import indirection |
| 4.7 | All screens with manual lifecycle comparisons | Normalize to `utils/lifecycle_rank.dart` `lifecycleRank()` calls | Consistency in lifecycle routing |

**Phase 4 deliverable**: Single API client, `AppProvider` deprecation started, router broken into focused navigators.

---

## Phase 5: Testing
*Provider unit tests, E2E robustness.*

**Risk: Low — new files, no production code changes.**

| # | File | Change | Why |
|---|------|--------|-----|
| 5.1 | `test/providers/rider_provider_test.dart` (new) | Mock `RiderRepository`, `RentalRepository`, `FilesRepository` (mocktail). Cover: init with cache hit/miss, refresh success/error, logout clears state | Core provider — regression protection |
| 5.2 | `test/providers/wallet_provider_test.dart` (new) | Mock `WalletRepository`, `FilesRepository`. Cover: refreshTransactions, topUpWallet, deleteTransactionHistory, logout reset | Payment provider needs coverage |
| 5.3 | `test/providers/connectivity_provider_test.dart` (new) | Bind service mock, toggle online/offline, setPendingSyncCount | Cross-cutting connection state |
| 5.4 | `test/providers/app_provider_test.dart` (new) | Create sub-providers, delegate correctly, logout, dispose. Mock all repositories | God provider coverage before decomposition |
| 5.5 | `test/services/cache_service_test.dart` (new) | In-memory SharedPreferences mock. Cover: cacheRider/getCachedRider, expiry, locale, theme | Offline data integrity |
| 5.6 | `test/services/fcm_service_test.dart` (new) | HMAC signing, replay detection, stale command rejection, valid/invalid actions | Security-critical path |
| 5.7 | `test/test_utils/mocks.dart` (new) | Shared `MockRiderRepository`, `MockWalletRepository`, `MockApiClient`, `MockSharedPreferences` using mocktail | Reduces test boilerplate |

**Phase 5 deliverable**: Unit tests for all major providers, FCM security validation, shared test utilities.

---

## Phase 6: Polish
*Shared widgets, loading skeletons, localization, consolidation.*

**Risk: Low — new widgets, small refactors.**

| # | File | Change | Why |
|---|------|--------|-----|
| 6.1 | `widgets/skeleton_loader.dart` (new) | Shared shimmer-based `SkeletonLoader` widget. Extract from inline skeletons in dashboard screens | Consistent loading states |
| 6.2 | `widgets/voltium_card.dart` (new) | Shared `VoltiumCard`: white bg, `BorderRadius.circular(28)`, subtle shadow. Replaces inline `BoxDecoration` in many screens | Single point of card styling |
| 6.3 | `utils/voltium_sheet.dart` | Drag handle uses `Colors.grey.shade300` → `AppColors.outlineVariant` or `AppColors.sheetHandle` | Token consistency |
| 6.4 | `widgets/animated_bottom_nav.dart` | Spring entry uses `Future.delayed(100ms)` → use post-frame callback `_entryCtrl.forward()` in `initState` | Smoother initial render |
| 6.5 | `features/notifications/` | Two notification models (`EngagementProvider.AppNotification` + `NotificationProvider`) are identical. Merge into one, remove `NotificationProvider` if `EngagementProvider` covers same ground | Eliminates data duplication |
| 6.6 | `utils/app_info.dart` | `VersionWidget` unused — wire into settings/about screen or remove | Dead code or opportunity |
| 6.7 | `features/wallet/.../screens/` | Wallet screens use `AppNavigator.push` directly → `Navigator.push` with `PageTransitions` | Consistent navigation patterns |
| 6.8 | `l10n/` | Audit all hardcoded user-facing strings (`'Something went wrong'`, etc.) against `AppLocalizations` | i18n readiness |

**Phase 6 deliverable**: Shared skeleton + card widgets, consolidated notifications, localized strings.

---

## Summary

| Phase | Risk | Est. Effort | Key Dependency |
|-------|------|-------------|----------------|
| **1: Quality/Cleanup** | Low | ~4h | None |
| **2: Reliability** | Medium | ~6h | Phase 1 |
| **3: Performance** | Medium | ~5h | Phase 2 |
| **4: Architecture** | High | ~10h | Phases 1-3 |
| **5: Testing** | Medium | ~8h | Phase 4 |
| **6: Polish** | Low | ~4h | Any (parallel with 5) |

**Total**: ~37h. Each phase delivers independent value and can be reviewed/merged independently.

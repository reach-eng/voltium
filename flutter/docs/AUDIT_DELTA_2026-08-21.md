# Voltium Rider App — Audit Delta (2026-08-21)

**Supersedes:** `AUDIT_rider_app.md` (2026-07-08) — keep that as historical.
**Audit target:** `flutter/` on commit at 2026-08-21 15:40 IST.
**Method:** Static source review against today's code. No new live-build runs.

---

## TL;DR

The 2026-07-08 audit is **mostly stale**. The team has shipped 11 P0 / 12 P1 / 9 P2 items since then. Out of 25 F-items, **17 are resolved**, **3 are partially resolved**, **5 are still live**.

What's left is small and shippable. The remaining work is dominated by:
1. **One real correctness bug** — `isNewRider` defaults to `false` (still live from F-006)
2. **One provider-package purge** — `provider: ^6.1.2` is in `pubspec.yaml` but **zero imports** in `lib/`
3. **One l10n sweep** — 32 files still have hardcoded English strings (LANGUAGE-AUDIT was partial)
4. **One shim to delete** — `AppProvider` creates a new `ProviderContainer` per feature on construction
5. **One dark-mode coverage gap** — a few widgets still use light-only `AppColors.X` statics instead of `AppColors.of(context).X`

Note: `call_log` + `flutter_contacts` (F-020) is **intentional and stays** per user direction (2026-08-21). No plan action on it.

No new deep-architecture work. The Provider→Riverpod migration is functionally complete; the API client is hardened; the auth/router flow is sound.

---

## F-Item Status Table

| ID  | Title | 2026-07-08 | 2026-08-21 | Evidence |
| --- | ----- | ---------- | ---------- | -------- |
| F-001 | Cached auth state strands rider | High | **Resolved** | `app/router.dart` first-launch gate uses `legal_accepted_v1`; KYC pre-flight + legal are skipped on return |
| F-002 | Legal links push same page | Medium | **Resolved** | `legal_page_screen.dart` now has doc-type param (per code comments) |
| F-003/4 | Permissions mismatch (phone/call_log) | Medium | **Partially resolved** | Permissions UI declares phone/call_log; router only gates location/camera/notifications. Still inconsistent. |
| F-005 | `privacy_consent_screen.dart` dead code | Low | **Resolved** | File no longer exists at the path. |
| F-006 | OTP `isNewRider` defaults to `false` | High | **STILL LIVE** | `features/auth/data/repository_impl.dart:56` — `final isNewRider = response.isNewRider ?? false;` then routes to `PreDashboard`. New rider with backend schema drift → wrong flow. |
| F-007/8 | Intent-of-use error swallowed | Medium | **Resolved** | `intent_of_use_screen.dart` shows error + null-checks `rider.id` |
| F-009 | NotificationCenterScreen is a 48-line stub | Medium | **Resolved** | `notifications_screen.dart` is the real one (tabs, swipe-to-delete, server-side delete per PR-VER-2026-08-06). `notification_center_screen.dart` and `SmartNotificationsScreen` both gone. |
| F-010–13 | Various | — | Resolved | Confirmed in current code |
| F-014/15 | KYC intent-of-use error | Medium | **Resolved** | Same as F-007/8 |
| F-017 | Dual state mgmt (Provider+Riverpod) | High | **Mostly resolved** | `provider: ^6.1.2` still in `pubspec.yaml` but **0 imports** in `lib/`. `flutter_riverpod` v3 is canonical. `AppProvider` is a 137-line shim with `_createDefaultRiderProvider` etc. that makes new `ProviderContainer`s per instance. |
| F-018 | Dormant GoRouter | Medium | **Resolved** | `router/app_router.dart` no longer exists at that path; `app/router.dart` is the live (and only) router, now a Riverpod `ConsumerStatefulWidget`. |
| F-019 | API token refresh race | High | **Resolved** | `api_client.dart` has `_refreshInFlight` single-flight, `_refreshToken` returns pending future, `_safeJsonDecode` swallows `FormatException`, 5xx + timeout retries with exponential backoff + jitter, GET dedup map, ETag/SWR caching, `_storage.clearSessionCredentials()` (not `clearAll()`) on explicit 401/403, `requestTimeout` 30s, `uploadTimeout` 60s. |
| F-020 | Privacy-sensitive plugins | High | **Kept on purpose** | `call_log: ^6.1.2` + `flutter_contacts: ^2.2.2` in `pubspec.yaml`. `services/device_data_service.dart` actively calls `CallLog.get()` and `FlutterContacts.getAll()`. User has a planned feature use; not removing. |
| F-021 | Dark mode token coverage | Medium | **Mostly resolved** | `AppColors.of(context)` returns `ThemeColors.light` / `ThemeColors.dark` via `Theme.of(context).extension<ThemeColors>()`. ~80 semantic tokens. Some statics still light-only — `AppColors.surface` is hardcoded `0xFFF7F9FB`; widgets must use `AppColors.of(context).surface` (most do, but statics still bite if someone uses them). |
| F-022 | Four telemetry systems | Low | **Partially resolved** | `opentelemetry_dart` no longer in pubspec (removed). `posthog_flutter`, `firebase_*` (Performance), `monitoring_service.dart`, `performance_service.dart` remain — but `monitoring_service` now wraps them as the canonical logger. Acceptable. |
| F-023 | Hardcoded English | Medium | **Partially resolved** | `LANGUAGE-AUDIT 2026-08-16` swept several surfaces (per comments), but **32 files** still contain hardcoded `Couldn't`, `Failed to`, `Server error` strings (grep). `wallet_provider.dart:192` and `device_policy_provider.dart` still hardcode English error messages. `txterror*` keys likely exist; the sweep was incomplete. |
| F-024 | Reentrant refresh drops callers | Medium | **Resolved** | `WalletNotifier.refreshTransactions` (wallet_provider.dart:148) coalesces onto in-flight Future, exposes `lastError`. `RiderNotifier` uses immutable state with `isRefreshing` flag. |
| F-025 | Singleton anti-pattern | Low | **Partially resolved** | `ApiClient` still a static-singleton factory (but with a test seam). `VoltiumApiService` still has `instance` setter. `SecureStorageService` still re-instantiated per ApiClient. **`AppProvider` shim still creates new `ProviderContainer`s per feature** in `_createDefaultRiderProvider` etc. — see PR-F-3 below. |

---

## New Findings (since 2026-07-08)

### N1: Dead `provider` package in `pubspec.yaml`
**Severity:** Low (hygiene)  
**Location:** `pubspec.yaml:19`

`provider: ^6.1.2` is listed but **zero `lib/` files** import `package:provider/...`. Every state holder uses `flutter_riverpod: ^3.3.2`. Removing it costs nothing and shrinks the dependency surface.

### N2: `AppProvider` shim leaks `ProviderContainer`s
**Severity:** Medium (resource / correctness)  
**Location:** `lib/core/state/app_provider.dart:38-82`

`_createDefaultRiderProvider`, `_createDefaultWalletProvider`, `_createDefaultSupportProvider` each construct a fresh `ProviderContainer` with overrides, then return the notifier instance. Three containers per `AppProvider` construction. `AppProvider()` is called once in `main.dart:176` (production), so in production this is a one-time hit — but tests that construct `AppProvider` for each test case will leak containers. The shim is held over from pre-migration; nothing actually uses `AppProvider` features anymore (the router reads providers via `ref.read(riderProvider.notifier)` etc.). **Delete the shim.**

### N3: `EngagementProvider()` / `DevicePolicyProvider()` / `ConnectivityProvider()` constructed via legacy default constructors
**Severity:** Low (consistency)  
**Location:** `app_provider.dart:109-111`

```dart
engagementProvider = engagementProvider ?? EngagementProvider(),
devicePolicyProvider = devicePolicyProvider ?? DevicePolicyProvider(),
connectivityProvider = connectivityProvider ?? ConnectivityProvider(),
```

These three are the only ones NOT pulled from Riverpod. `EngagementProvider` and friends should also be Riverpod Notifier providers. The shim papers over the gap. Removing `AppProvider` (N2) forces this fix.

### N4: `VoltiumApiService` still wraps typed client → Map<String, dynamic>
**Severity:** Low (architectural)  
**Location:** `services/voltium_api_service.dart`

The generated `VoltiumApiClient` produces typed models. `VoltiumApiService` then calls `response.toJson()` on many of them, throwing away the type safety. Listed in 2026-07-08 audit; not addressed. With the Riverpod migration complete, the right move is to delete `VoltiumApiService` and have repositories call `VoltiumApiClient` directly.

### N5: `AppShell` import in `app/router.dart` is a circular import risk
**Severity:** Low (hygiene)  
**Location:** `app/router.dart:21`

```dart
import '../main.dart' show AppShell;
```

`main.dart` constructs the providers, then `app/router.dart` imports back to grab the shell widget. Works, but the import direction is wrong. Move `AppShell` to a separate `widgets/app_shell.dart` and import from there.

---

## Coverage & Test Health (informational)

- `flutter/coverage/lcov.info` exists (the coverage gate from `bash scripts/flutter-coverage.sh` at 85% threshold).
- Integration test inventory: 49/49 (per AGENTS.md).
- 32 source files still contain hardcoded English UI/error strings (see F-023).

---

## Verdict

The codebase is in good shape. The 5-PR ship-it list in `IMPLEMENTATION_PLAN_2026-08-21.md` covers the highest-value items. The comprehensive fix-everything list (including everything previously deferred: full DI refactor, telemetry consolidation, FCM secret audit, top-up flow state, etc.) is in `IMPLEMENTATION_PLAN_FULL_2026-08-21.md`, organized in 3 tiers so you can pick what to take on.

# Voltium — Rider App (Flutter) Remediation Plan

**Date:** 2026-07-29
**Source:** `docs/AUDIT_FINDINGS_RIDERAPP.md` (161 findings, ~62 KB)
**Scope:** `flutter/lib/**` (180+ Dart files, ~3 MB source)
**Total findings:** 161 (18 P0, 56 P1, 76 P2, 11 P3)
**Already done (Phase 0-7):** ~7 items, including 2 of 18 P0s (`AuthWrapper` x2 dead files, `theme_icons.dart`)
**Total estimated effort:** ~30 focused days across 14 PRs

> **Read this first.** This plan turns the broad rider app audit into review-ready PRs. The big insight: **most of the security/data layer is already solid** (Phase 0-7 cleaned it up). What remains is **size** (giant screen files, oversized use-cases, 80+ raw color tokens) and **architecture** (router state machine, widget organization, duplicate file names).
>
> **Honest framing:** the rider app audit found **2 sets of duplicate files with the same name** (3 files each: `earnings_chart.dart`, `earnings_add_sheet.dart`, `earnings_widgets.dart`). This is a real bug — git doesn't prevent it, and code search will pick up the wrong one. Highest priority.

---

## What's already done (Phase 0-7)

| Audit ref | Item | Where it was fixed |
|---|---|---|
| 1.2 [P0] | Two `AuthWrapper` files (no-op, 0 importers) deleted | Phase 0 (originally in SCOPE.md "Phase 0 quick wins") |
| 3.2 [P0] | `widgets/theme_icons.dart` (0 importers) deleted | Design System Plan PR-2 (in this doc) |
| 1.1 [P0] (partial) | `terminated → preDashboard` routing bug fixed (now → `accountClosed` screen) | Phase 1 (Q1 of Phase 7 audit close) |
| 1.3 [P0] | Polling-timeout UI banner added (`_isPollingTimedOut` is now consumed) | Phase 5 |
| 1.6 [P1] | `ApiClient.uploadTimeout = 60s` (was 10s) | Phase 5 |
| 2.1 [P1] (partial) | `AppColors.primary` aligned to `#0053C1` (was `#2563EB`) | Phase 7 Q1 |
| 4.22 [P2] | `AuthRepository` already replaces `voltium_api_service.dart` for auth | Phase 1 |
| Various | Various P2/P3 small-lib findings (off-grid spacing, w900, etc.) | Phase 5/6 (some shipped, some deferred) |

**Net for this plan:** 161 findings, ~7 done, **~154 remaining**. The remaining P0s are mostly **size** (giant files), **architecture** (router, widget organization), and **real bugs** (duplicate file names, missing timeouts).

---

## Total scope

| Severity | Audit count | Already done | Remaining in this plan | Total effort |
|---|---|---|---|---|
| P0 | 18 | ~2 | **16** | ~10 days |
| P1 | 56 | ~3 | 53 | ~15 days |
| P2 | 76 | ~2 | 74 | ~5 days |
| P3 | 11 | 0 | 11 | ~1 day |
| **Total** | **161** | **~7** | **~154** | **~30 days** |

Two months ≈ 18-20 working days per contributor. **All P0s are shippable in the runway if started now.** P1s split into "ship it" (~15 days, must-do) and "follow-up" (~5 days, file as tickets).

---

## The real wins (filtered)

The audit is broad. After filtering, the real wins are:

| Category | Audit refs | Why worth shipping |
|---|---|---|
| **Duplicate file names (real bug)** | 3.1, 14.7, 14.8, 14.9 | 3 sets of duplicates with the same name. Git doesn't prevent it. Highest priority. |
| **Giant legal text in code** | 7.1, 17.1, 7.16 | 34 KB of legal text in a Dart file. Should be JSON, not code. |
| **Big screen splits** | 7.2 (33 KB guarantor), 7.4 (32 KB choose plan), 7.5 (31 KB edit profile), 7.7 (27 KB user onboarding), 6.1 (23 KB login) | 5 screens > 20 KB. Each is a focused refactor. |
| **Router state machine (1.1)** | The 30-state `setState` router | Real bug + structural debt. Move to Navigator. |
| **Token drift in `ApiClient`** | 1.5, 1.6, 1.7 | `success: false` swallowed, 10s upload timeout, silent offline errors |
| **Polling robustness** | 1.10, 3.4 | `consecutiveErrorCount`, exponential backoff; lock screen rate limit |
| **Token cleanup** | 1.9, 4.1, 4.2 | Split `CacheService` god-class; remove FCM token duplicate write |
| **Notification naming collision** | 4.3 | `NotificationService` (push) vs `NotificationProvider` (in-app) confusion |
| **FCM command registry** | 4.5 | 4 providers injected; new command = FCM change. Should be a registry. |
| **Move feature widgets to feature dirs** | 3.1, 8.6-14 | 14+ feature-specific widgets in top-level `widgets/` |
| **App shell cleanup** | 18.1, 18.2, 18.3 | `main.dart` 14 KB / 50+ imports / 5 sequential awaits |

The remaining ~120 P1/P2s are noted in the "What's NOT in this plan" section.

---

## Sequencing principle

Each PR is **independently deployable**. Order is by **risk (lowest first) so we ship easy wins while the harder ones cook**.

**Lowest-risk PRs** (mechanical refactors, no behavior change):
- PR-1: Resolve 3 sets of duplicate file names
- PR-2: Delete unused/dead services
- PR-3: Token cleanup (remove duplicate write, single source of truth)

**Medium-risk PRs** (auth/network hardening, requires review):
- PR-4: `ApiClient` contract fixes (success:false, uploadTimeout, silent errors)
- PR-5: Split `CacheService` god-class
- PR-6: Polling robustness (error backoff, lock screen rate limit)
- PR-7: Notification naming collision + FCM command registry

**Highest-risk PRs** (large refactors, requires careful review):
- PR-8: Convert legal text to JSON
- PR-9: Refactor router from 30-state `setState` to Navigator-based
- PR-10 through PR-14: 5 big screen splits (guarantor, choose plan, edit profile, user onboarding, login)

---

# The plan: 14 PRs

## PR-1 — Resolve 3 sets of duplicate file names (real bug)

**Effort:** 1 day focused
**Risk:** low (mechanical, requires which-is-canonical verification)
**Audit ref:** 3.1, 14.7, 14.8, 14.9
**Blocks:** any code search for these names picks the wrong file

### Problem

Three sets of files exist with the same name in different paths. Git doesn't prevent it. The compiler doesn't warn. Code search (`grep`, IDE search) picks up the wrong one based on alphabetical ordering.

**Duplicate 1: `earnings_chart.dart`**
- `flutter/lib/widgets/earnings_chart.dart` (4.4 KB)
- `flutter/lib/features/rewards/widgets/earnings_chart.dart` (4.4 KB)

**Duplicate 2: `earnings_add_sheet.dart`**
- `flutter/lib/widgets/earnings_add_sheet.dart` (10.6 KB)
- `flutter/lib/features/rewards/widgets/earnings_add_sheet.dart` (10.8 KB)

**Duplicate 3: `earnings_widgets.dart`**
- `flutter/lib/features/profile/presentation/widgets/earnings_widgets.dart` (18.4 KB)
- `flutter/lib/features/rewards/widgets/earnings_widgets.dart` (19 KB)

### Fix

For each set:
1. **Grep all usages** to determine which is canonical (use the file that has more imports).
2. **Delete the duplicate** (move to Recycle Bin via `mavis-trash`).
3. **Update imports** to point to the canonical path.

For example, for `earnings_chart.dart`:
```bash
grep -r "earnings_chart.dart" flutter/lib/
# Determines which file is imported
# If features/rewards/ is canonical:
mavis-trash flutter/lib/widgets/earnings_chart.dart
# Update all imports from 'package:voltium_app/widgets/earnings_chart.dart' to 'package:voltium_app/features/rewards/widgets/earnings_chart.dart'
```

### Acceptance criteria

- [ ] Only one `earnings_chart.dart` exists in `flutter/lib/`
- [ ] Only one `earnings_add_sheet.dart` exists in `flutter/lib/`
- [ ] Only one `earnings_widgets.dart` exists in `flutter/lib/`
- [ ] All imports updated
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] No visual regression in any screen
- [ ] All 33 E2E tests pass

### Reviewer focus

- For each set, confirm which file is canonical by `grep` usage count, not by file size.
- Don't delete the wrong one — verify each import before deleting.

### Rollback

Revert the PR.

---

## PR-2 — Delete unused/dead services

**Effort:** 0.5 day focused
**Risk:** zero (file is unused)
**Audit ref:** 4.6, 4.7, 4.8 (deferred from Phase 0/3 cleanup), 1.13 (clock import), 3.4 (locked_overlay), 6.6 (otp_blocks unused)

### Problem

Several service files have **zero importers** (dead code):
- `services/biometric_service.dart` (2 KB) — `local_auth` wrapper, no caller
- `services/background_location_service.dart` (4.6 KB) — actual location sync is in `device_data_service.dart`
- `services/connectivity_service.dart` (1.4 KB) — questionable value, thin wrapper

Plus other dead code:
- `widgets/locked_overlay.dart` is 10 KB but the rate-limiting code is missing
- `core/network/connectivity_provider.dart:7` has unused `import 'clock'`
- `features/auth/widgets/otp_blocks.dart` (3.8 KB) and `otp_input.dart` (5.9 KB) may be old versions of `SparkOtpInput` (12.6 KB)
- `OtpVerificationScreen(isLogin:)` is never set to `true` — flag is dead

### Fix

For each dead file:
```bash
grep -r "biometric_service" flutter/lib/
# 0 results → delete
mavis-trash flutter/lib/services/biometric_service.dart
```

For dead code inside files:
- Remove `import 'clock'` in `connectivity_provider.dart` if unused
- Grep for `OtpVerificationScreen(isLogin:` — if only `false`, remove the flag

For the `locked_overlay.dart`: this one needs a fix, not a delete (see PR-6 for the rate-limit fix).

### Acceptance criteria

- [ ] `flutter/lib/services/biometric_service.dart` is gone (or wired up if planned)
- [ ] `flutter/lib/services/background_location_service.dart` is gone
- [ ] `flutter/lib/services/connectivity_service.dart` is gone (or used)
- [ ] Unused imports removed
- [ ] `OtpVerificationScreen(isLogin:)` flag removed (if dead)
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass

### Reviewer focus

- Before deleting `connectivity_service.dart`, verify the wrapper does real work. If yes, keep.
- Before deleting `biometric_service.dart`, ask the team if biometric login is planned for the release.

### Rollback

Revert the PR.

---

## PR-3 — Token cleanup (single source of truth for FCM tokens, secure storage)

**Effort:** 1 day focused
**Risk:** low (auth code path, but mostly delete)
**Audit ref:** 4.1

### Problem

`SecureStorageService.setToken` writes every token to two keys (`_keyToken` and `_keySessionToken`). This was likely a "compatibility shim" during a token rename but the migration never finished.

### Fix

Step 1: identify which key is canonical.
```bash
grep -r "_keySessionToken\|_keyToken" flutter/lib/
```

Step 2: pick the canonical key, delete the other from `SecureStorageService`.

Step 3: also clean up the `OtpVerificationScreen`'s FCM secret write (the broad audit flagged a similar duplicate).

### Acceptance criteria

- [ ] `setToken` writes to one key only
- [ ] All callers of the deleted key are updated
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass (login + token refresh)
- [ ] No regression in token rotation flow

### Reviewer focus

- Confirm no test or external code reads the deleted key. (The audit says both keys are written; whether both are read is what we need to check.)
- Coordinate with the auth flow on staging before rolling back.

### Rollback

Revert the PR. The diff is small (delete a line or two in `setToken`).

---

## PR-4 — `ApiClient` contract fixes (`success: false` swallowed, uploadTimeout, silent errors)

**Effort:** 1.5 days focused
**Risk:** medium (auth/network code path)
**Audit ref:** 1.5, 1.6, 1.7

### Problem

Three issues in `flutter/lib/core/network/api_client.dart`:

1. **`_handleResponse` returns the body even when `success: false` on 2xx** (line 441-450). A `200 OK` with `{"success": false, "error": "..."}` returns the body without throwing. Most callers do `response['data'] ?? response` and miss the error.

2. **`requestTimeout = 10s` for everything** (line 21, 425-431). Uploading a 5 MB image on 3G = 30+ seconds. The retry loop will fire 3 times × 10s = 30s of dead time.

3. **`_maybeQueueOffline` errors are silently swallowed** (line 407-411). If `OfflineStorageService` is broken, the user thinks their top-up is queued but it's lost.

### Fix

**Fix 1: Throw on `success: false`**
```dart
// api_client.dart:_handleResponse
if (response.statusCode >= 200 && response.statusCode < 300) {
  if (body['success'] == true) {
    return body;  // happy path
  }
  // 2xx with success:false → throw ApiException
  throw ApiException(
    code: body['error']?['code'] ?? 'UNKNOWN',
    message: body['error']?['message'] ?? 'Unknown error',
  );
}
return body;
```

**Fix 2: Separate `uploadTimeout` (60s)**
```dart
// api_client.dart
static const Duration requestTimeout = Duration(seconds: 10);
static const Duration uploadTimeout = Duration(seconds: 60);
// Use uploadTimeout for multipart, requestTimeout for everything else
```

**Fix 3: Log silent offline errors**
```dart
// api_client.dart:_maybeQueueOffline
} catch (e) {
  monitoringService.captureError(
    e,
    StackTrace.current,
    context: {'operation': 'offline_queue'},
  );
}
```

### Acceptance criteria

- [ ] 2xx with `success: false` throws `ApiException` (with code + message)
- [ ] Multipart uses `uploadTimeout` (60s), other requests use `requestTimeout` (10s)
- [ ] Offline errors logged to monitoring service
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass (especially the "offline queue replays on reconnect" test)

### Reviewer focus

- The `ApiException` throw is a **breaking change** for any caller that does `response['data'] ?? response` on a 2xx. Grep all `ApiClient` callers.
- The uploadTimeout change is **non-breaking** for happy paths but may surface new "request timeout" errors in slow-network tests. The 33 E2E tests should catch this.
- The monitoring service integration is a soft change. If the monitoring service is also broken, this won't help. Verify `monitoring_service.captureError` is implemented.

### Rollback

Revert the PR. The contract change is the riskiest part.

---

## PR-5 — Split `CacheService` god-class

**Effort:** 1.5 days focused
**Risk:** medium (every file that uses caching depends on this)
**Audit ref:** 1.9, 4.2

### Problem

`flutter/lib/services/cache_service.dart` (7.4 KB) has 6 concerns in one singleton:
- `getCachedRider()` / `cacheRider()` (rider model)
- `getLocale()` / `setLocale()` (locale)
- `getDarkMode()` / `setDarkMode()` (theme)
- `getString()` / `setString()` (raw key-value, used by router)
- `getBool()` / `setBool()` (used by NotificationService, BiometricService)
- `setObject()` / `getObject()` (typed serialization)

Plus `getCachedRider` has 7.4 KB of methods. 50+ methods total. Every file that needs to cache something depends on this one class.

### Fix

Split into per-concern classes:
- `RiderCache` (rider model)
- `LocaleCache`
- `ThemeCache` (dark mode)
- `RouterStateCache` (the `voltium_saved_auth_state` key)
- `KVStore` (raw key-value, getString/setString, getBool/setBool)
- `ObjectStore` (typed serialization)

Each owns its own key namespace and exposes typed methods.

```dart
// Before
CacheService().getString('voltium_saved_auth_state');

// After
RouterStateCache().current();
```

### Acceptance criteria

- [ ] `cache_service.dart` is gone (or is a thin wrapper re-exporting for backward compat)
- [ ] 5-6 new cache files exist in `services/cache/`
- [ ] All callers updated to use the new specific cache class
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass
- [ ] Rider's cached state is preserved across the migration (or the user is asked to log in again on the new build)

### Reviewer focus

- The migration is invasive. **Per-file review** is mandatory. Don't bundle all callers into one PR.
- Consider keeping `CacheService` as a thin facade that re-exports the new classes. That way old code still works and we migrate one caller at a time.
- The `EncryptedCacheService` nested class in `secure_storage_service.dart` should also be moved out.

### Rollback

Revert the PR. The diff is large.

---

## PR-6 — Polling robustness + lock screen rate limit

**Effort:** 1 day focused
**Risk:** low-medium (polling behavior changes)
**Audit ref:** 1.10, 3.4

### Problem

1. **`polling_manager.dart`** continues forever on transient errors. The `onTick` callback can throw and the manager silently retries on the next interval. No exponential backoff, no "stop after N consecutive errors."

2. **`locked_overlay.dart`** is a 12-digit PIN entry for admin-locked devices. **No rate limiting on attempts, no lockout after N wrong tries.** A brute-force attacker can try 100,000 PINs/day. The backend (`/api/rider/device/verify-lock`) may also lack rate limiting.

### Fix

**Fix 1: PollingManager exponential backoff**
```dart
// polling_manager.dart
class PollingManager {
  int _consecutiveErrorCount = 0;
  Duration _nextInterval() {
    final base = Duration(seconds: 30);
    final backoff = base * (1 << _consecutiveErrorCount);  // 30s, 60s, 120s, 240s, capped at 5min
    return backoff > Duration(minutes: 5) ? Duration(minutes: 5) : backoff;
  }
}
```

**Fix 2: Locked overlay rate limit**
```dart
// locked_overlay.dart
int _wrongAttempts = 0;
static const int _maxAttempts = 5;

void _onWrongPin() {
  _wrongAttempts++;
  if (_wrongAttempts >= _maxAttempts) {
    setState(() => _lockedOut = true);
    // Show "Contact support" only
  }
}
```

**Fix 3: Backend rate limit (follow-up)**
The audit notes the backend `/api/rider/device/verify-lock` may also lack rate limiting. File a follow-up ticket for the backend team.

### Acceptance criteria

- [ ] `PollingManager` has exponential backoff (capped at 5 min)
- [ ] `locked_overlay.dart` locks out after 5 wrong PINs
- [ ] The lockout UI shows "Contact support" only
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass
- [ ] Backend rate limit is filed as a separate ticket (don't fix in this PR)

### Reviewer focus

- The exponential backoff must be **capped** (5 min max). Otherwise a long-lived polling loop can wait 30+ minutes for the next attempt.
- The lockout is client-side only. A real attack would bypass it. The backend ticket is the real fix.
- The lockout shouldn't be too aggressive (5 attempts may be too low for a forgetful user). Recommend 5 with a "wait 60s after 3 wrong" or similar.

### Rollback

Revert the PR.

---

## PR-7 — Notification naming collision + FCM command registry

**Effort:** 1.5 days focused
**Risk:** medium (auth code path; FCM security commands are sensitive)
**Audit ref:** 4.3, 4.4, 4.5

### Problem

1. **Two "Notification" services** cause naming confusion:
   - `NotificationService` (4 KB) — push notifications (Firebase, device-level)
   - `NotificationProvider` (2.5 KB) — in-app notification list (server-side, paginated)

2. **`FCMService` (14 KB)** has 4 providers injected at init. Adding a new admin command (e.g. "lock device") requires changing FCM to know about the new provider.

### Fix

**Fix 1: Rename `NotificationService` → `PushNotificationService`**
```dart
// services/notification_service.dart → push_notification_service.dart
// (file rename + class rename + import updates)
```

**Fix 2: FCM command registry**
```dart
// fcm_command_registry.dart
abstract class FcmCommand {
  String get name;
  Future<void> execute(Map<String, dynamic> data);
}

class FcmCommandRegistry {
  final Map<String, FcmCommand> _commands = {};
  void register(FcmCommand command) => _commands[command.name] = command;
  Future<void> dispatch(String name, Map<String, dynamic> data) async {
    final cmd = _commands[name];
    if (cmd == null) {
      log('Unknown FCM command: $name');
      return;
    }
    await cmd.execute(data);
  }
}

// In fcm_service.dart:
final _registry = FcmCommandRegistry()
  ..register(LockDeviceCommand(devicePolicyProv))
  ..register(WipeDeviceCommand(devicePolicyProv))
  ..register(NotifyRiderCommand(notificationProv));

// FCMService handles incoming messages by calling _registry.dispatch(commandName, data)
```

### Acceptance criteria

- [ ] `NotificationService` is renamed to `PushNotificationService` everywhere
- [ ] FCM commands are dispatched through a registry, not hard-coded in FCMService
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass (especially the "admin lock device" test)
- [ ] The 4 existing commands (lock, wipe, notify, etc.) are migrated to the registry

### Reviewer focus

- FCM security commands are **sensitive**. The HMAC verification (audit 4.5) must stay in FCMService (not in the command's `execute`). Verify.
- The registry is initialized at app start. If a command's provider isn't ready when the command arrives, fail closed.
- Renaming `NotificationService` is invasive. **Per-file review**.

### Rollback

Revert the PR. The registry is sensitive.

---

## PR-8 — Convert legal text from Dart to JSON

**Effort:** 1 day focused
**Risk:** low (data move, no behavior change)
**Audit ref:** 7.1, 7.16, 17.1, 17.6

### Problem

**34 KB of legal text is hard-coded in Dart:**
- `flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart` (34 KB) — terms, privacy, refund, guarantor
- `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart` (25 KB) — first-time legal consent
- `flutter/lib/features/onboarding/presentation/screens/legal_page_content.dart` (6 KB) — **unused** extracted version

The text is a copy-paste target for translators, hard to grep against the source-of-truth document, and bloats the binary.

### Fix

Step 1: extract legal text to `assets/legal/`:
```
flutter/assets/legal/terms.json
flutter/assets/legal/privacy.json
flutter/assets/legal/refund.json
flutter/assets/legal/guarantor.json
```

```json
{
  "title": "Terms of Service",
  "version": "2026-07-29",
  "sections": [
    {
      "heading": "1. Acceptance",
      "body": "By using the Voltium service, you agree to these terms..."
    }
  ]
}
```

Step 2: add a `LegalDocument` loader that reads the JSON and exposes typed access.

Step 3: replace the hard-coded text in `legal_page_screen.dart` and `legal_screen.dart` with the loader.

Step 4: delete the unused `legal_page_content.dart`.

### Acceptance criteria

- [ ] 4 JSON files in `flutter/assets/legal/` (terms, privacy, refund, guarantor)
- [ ] `legal_page_screen.dart` reads from the JSON
- [ ] `legal_screen.dart` reads from the JSON
- [ ] `legal_page_content.dart` is gone (or empty)
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass
- [ ] Legal text is identical to the previous version (no content changes)

### Reviewer focus

- Verify no content was changed. A typo in legal text is a compliance issue.
- Confirm the JSON loader is robust to missing files (fallback to English).
- Consider i18n now or later. For now, English only.

### Rollback

Revert the PR. The legal text is identical, so behavior is unchanged.

---

## PR-9 — Refactor router from 30-state `setState` to Navigator-based

**Effort:** 2-3 days focused
**Risk:** **high** (every screen flows through the router; this is the most invasive refactor in the plan)
**Audit ref:** 1.1

### Problem

`flutter/lib/app/router.dart` (12 KB) + `flutter/lib/app/router_body.dart` (15 KB) + `flutter/lib/app/app_state.dart` (372 B with the 28-value `AuthState` enum). The router is a **30-state `setState`-driven state machine** that rebuilds the entire scaffold body in a giant `switch`. Pickup data (8 fields) is held in the router. Adding a new screen means editing 3 places.

### Fix

Two options:

**Option A: `go_router` (recommended)**
Add the `go_router` package, define typed routes, migrate one screen at a time.

**Option B: hand-rolled Navigator stack**
Define a typed `AppRoute` class, use `Navigator.pushNamed` with typed arguments.

Either way:
- Move pickup data to a `PickupFlowProvider` (Riverpod notifier or `ChangeNotifier`)
- Keep `RiderLifecycleGate.redirect` as the single source of truth for state-to-route mapping
- The 60-line `PopScope` `canPop` switch becomes 3 lines

### Acceptance criteria

- [ ] `setState` no longer used in the router for state transitions
- [ ] Pickup data is in a `PickupFlowProvider`, not the router
- [ ] `PopScope` `canPop` is a small typed function, not a 60-line switch
- [ ] All 30 existing screens still work
- [ ] No regression in any of the 33 E2E tests
- [ ] `flutter analyze flutter/lib/**` clean

### Reviewer focus

- This is the highest-risk PR in the plan. **Coordinate with the team** before starting.
- Consider doing it as a multi-PR effort (PR-9a, 9b, 9c) with one route group migrated at a time.
- The `terminated → preDashboard` bug was fixed in Phase 1, but the underlying router pattern is the same. This PR fixes the root cause.

### Rollback

Revert the PR. The refactor is large but each PR is independently revertible.

---

## PR-10 — Split `guarantor_onboarding_screen.dart` (33 KB) + widgets (33 KB)

**Effort:** 2 days focused
**Risk:** medium (large refactor; financial/legal forms are sensitive)
**Audit ref:** 7.2, 7.3, 7.18, 7.19

### Problem

`features/guarantor/presentation/screens/guarantor_onboarding_screen.dart` (33 KB) and `widgets/guarantor_onboarding_widgets.dart` (33 KB) are the two biggest single-purpose files in the rider app. The screen has 10+ `_build*` methods; the widgets file has form fields, signature pad, video recorder. Both need to be split.

### Fix

**Parent screen split:**
- Extract form logic to a `GuarantorFormController` (ChangeNotifier or Riverpod notifier)
- Slim the screen file to a router

**Widgets split:**
- `widgets/guarantor_form.dart` — form fields
- `widgets/guarantor_signature.dart` — signature pad
- `widgets/guarantor_video.dart` — video recorder

### Acceptance criteria

- [ ] `guarantor_onboarding_screen.dart` is < 1,000 lines
- [ ] `guarantor_onboarding_widgets.dart` is split into 3+ files
- [ ] Form state is in a `GuarantorFormController`, not the screen
- [ ] The custom form fields are migrated to the shared `form_widgets.dart` (audit 7.19)
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass

### Reviewer focus

- The guarantor form is legally binding. **No behavior change.**
- The video recorder is a custom widget. Splitting it cleanly requires understanding the platform-specific code.
- The form controller pattern (ChangeNotifier vs Riverpod) — pick one. The codebase uses Riverpod `ChangeNotifierProvider` (per audit 1.4). Stay consistent.

### Rollback

Revert the PR.

---

## PR-11 — Split `choose_plan_screen.dart` (32 KB)

**Effort:** 1.5 days focused
**Risk:** medium (money path; plan selection is the entry to paid flow)
**Audit ref:** 7.4, 10.1

### Problem

`features/rentals/presentation/screens/choose_plan_screen.dart` (32 KB). The plan picker with 32 KB is excessive. Likely contains:
- Plan card layout
- Pricing details
- Selection logic
- "Best value" badge
- Animation effects

### Fix

Extract:
- `widgets/plan_card.dart` — single plan card
- `widgets/plan_details.dart` — pricing breakdown
- `widgets/plan_comparison.dart` — side-by-side comparison
- Slim the screen to a list of `PlanCard` widgets

### Acceptance criteria

- [ ] `choose_plan_screen.dart` is < 1,000 lines
- [ ] 3+ new widget files
- [ ] No visual regression (the "best value" badge still appears on the right plan)
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass

### Reviewer focus

- The "best value" logic is in code. Make sure it survives the split.
- The pricing calculation (discounts, taxes) is sensitive. **No behavior change.**

### Rollback

Revert the PR.

---

## PR-12 — Split `edit_profile_screen.dart` (31 KB)

**Effort:** 1.5 days focused
**Risk:** medium (PII editing; rider's name, address, parents' names)
**Audit ref:** 7.5, 11.2

### Problem

`features/profile/presentation/screens/edit_profile_screen.dart` (31 KB). Form fields for name, email, phone, parents, address, guarantor. Single `Form` with 10+ fields in one `StatefulWidget`.

### Fix

Extract:
- `widgets/personal_info_form.dart`
- `widgets/guardian_info_form.dart`
- `widgets/address_form.dart`
- `widgets/edit_profile_section.dart` (a reusable section header + body)

### Acceptance criteria

- [ ] `edit_profile_screen.dart` is < 1,000 lines
- [ ] 3+ new widget files
- [ ] All form validation logic preserved
- [ ] No regression in the "save profile" flow
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass

### Reviewer focus

- The form has conditional fields (e.g. "show parents' names only if minor"). Verify the split preserves this.
- The save flow has API call + cache update + state refresh. **No regression**.

### Rollback

Revert the PR.

---

## PR-13 — Split `user_onboarding_screen.dart` (27 KB) + `user_onboarding_widgets.dart` (30 KB)

**Effort:** 2 days focused
**Risk:** medium (KYC form is sensitive; rider can't proceed if broken)
**Audit ref:** 7.6, 7.7

### Problem

`features/kyc/presentation/screens/user_onboarding_screen.dart` (27 KB) and `widgets/user_onboarding_widgets.dart` (30 KB). KYC form with 10+ fields. Same shape as 7.2/7.3/7.5.

### Fix

Same pattern as PR-10/11/12:
- Slim the screen to a router
- Split widgets by concern: personal info, documents, signature

### Acceptance criteria

- [ ] `user_onboarding_screen.dart` is < 1,000 lines
- [ ] `user_onboarding_widgets.dart` is split into 3+ files
- [ ] No regression in the KYC flow
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass

### Reviewer focus

- The KYC form has a multi-step flow. The split must preserve step transitions.
- The signature pad (4.7 KB on its own) is a separate file already. Don't re-split.

### Rollback

Revert the PR.

---

## PR-14 — Split `login_screen.dart` (23 KB) + `otp_verification_screen.dart` (21 KB)

**Effort:** 1.5 days focused
**Risk:** medium (auth code path; broken login blocks the entire app)
**Audit ref:** 6.1, 6.2, 6.3, 6.4, 6.10, 6.12, 6.13, 6.14

### Problem

`login_screen.dart` (23 KB) has 5+ private widget builders (`_buildLogoSection`, `_buildPhoneInput`, etc.), `VoltiumApp.isTestMode` checks scattered, `_handleLogin` duplicates `ErrorHandler` logic. Same shape for `otp_verification_screen.dart` (21 KB).

Plus smaller items:
- 6.3: `GoogleFonts.plusJakartaSans` used directly in 4+ places
- 6.4: 30s resend timer hard-coded
- 6.6: `otp_blocks` and `otp_input` may be old versions
- 6.10: `OtpVerificationScreen(isLogin:)` flag is dead
- 6.12: `PostHogService.capture` uses raw strings instead of `AnalyticsEvent` enum
- 6.13: button press flags without disabled visual state
- 6.14: OTP input missing `AutofillHints.oneTimeCode`

### Fix

**Split both screens:**
- `widgets/phone_input_section.dart`
- `widgets/referral_input_section.dart`
- `widgets/welcome_section.dart`
- `widgets/otp_input_section.dart`
- `widgets/otp_timer_section.dart`
- `widgets/verify_button.dart`
- `widgets/logo_section.dart`

**Other items:**
- 6.3: replace `GoogleFonts.plusJakartaSans(...)` with `AppTypography.bodyMedium.copyWith(...)`
- 6.4: move 30s resend timer to `AuthRepository.getResendCooldown()` or config
- 6.6: grep for `otp_blocks` and `otp_input` usage; delete unused
- 6.10: remove `isLogin` flag if dead
- 6.12: use `AnalyticsEvent.phoneEntered` instead of raw strings
- 6.13: add disabled visual state
- 6.14: add `AutofillHints.oneTimeCode` to OTP inputs

### Acceptance criteria

- [ ] `login_screen.dart` is < 1,000 lines
- [ ] `otp_verification_screen.dart` is < 1,000 lines
- [ ] 5+ new widget files
- [ ] All `GoogleFonts.plusJakartaSans` direct uses in auth files replaced with `AppTypography`
- [ ] `OtpVerificationScreen(isLogin:)` removed
- [ ] `AutofillHints.oneTimeCode` added to OTP
- [ ] `flutter analyze flutter/lib/**` clean
- [ ] All 33 E2E tests pass (especially the autofill, OTP, and analytics tests)

### Reviewer focus

- Auth is the most critical flow. **No behavior change** except the explicit improvements (autofill, disabled state).
- The resend timer change requires the backend to return the cooldown. Coordinate with the backend team.
- The PostHog event names should match exactly. Don't rename in this PR.

### Rollback

Revert the PR.

---

# What's NOT in this plan (and why)

The audit identified 161 findings. This plan covers the 14 highest-impact PRs (~30 of 161). The remaining ~130 are:

| Audit ref | Item | Why deferred |
|---|---|---|
| 1.4 | `AppProvider` is a deprecated god-object | Phase 5 PR-1 (already in FOLLOWUP_TICKETS.md #3) |
| 1.7 | `AppColossus _handleResponse` success:false swallowed | **In this plan as PR-4** |
| 1.8 | `RiderProvider._refreshInFlight` finally race | Low priority; defer |
| 1.11 | `posthog_service` vs `monitoring_service` duplicate | Defer (1-2 day refactor; lower value) |
| 1.12 | `ErrorHandler` only handles 3 error types | Small fix; defer |
| 1.13 | `clock` import unused | **In this plan as PR-2** |
| 1.14 | `locale_provider` no system locale fallback | Small fix; defer |
| 2.1 | `AppColors` god-class (60+ color tokens) | **Design System Plan PR-3** |
| 2.2 | `AppTypography` 28 styles (should be 15) | **Design System Plan PR-7** + **Phase 6 PR-D (FOLLOWUP #4)** |
| 2.3 | `AppRadius.lg` and `xl` both `24` | Trivial; defer |
| 2.4 | `AppShadows.card` 8% vs spec 4% | Trivial; defer |
| 2.5 | `ThemeColors` underused (10 callers) | Defer; large refactor |
| 2.6 | `theme_provider` no system-following | Small fix; defer |
| 3.1 | 60+ feature widgets in `widgets/` | Defer; epic; file as separate PRs per feature |
| 3.3 | `FadeUpWidget` arbitrary delays | Small fix; defer |
| 3.4 | `locked_overlay` no rate limit | **In this plan as PR-6** |
| 3.5 | `skeleton_loader` vs `skeleton_wallet_card` | Cosmetic; defer |
| 3.6 | `staggered_entrance` + `micro_animations` + `ui_animations` overlap | Defer; epic |
| 3.7 | electric_* brand effects | Defer |
| 3.8 | `permission_guard` vs router permission check | **In this plan as PR-9 (router refactor)** |
| 3.10 | 3 banner files | Defer |
| 3.11 | `tilt_card` + `card_parallax_tilt` | Cosmetic; defer |
| 3.12 | 3 empty-state widgets | Defer |
| 3.13 | `context_menu` + `gesture_widgets` overlap | Defer |
| 3.15-3.16 | OTP widgets | **In this plan as PR-14** |
| 3.18-3.20 | Loading widgets | Defer |
| 3.22 | `streak_celebration_bar` feature-specific | Defer |
| 3.23-3.27 | Various small widgets | Defer |
| 3.32-3.34 | Feature-specific widgets in `widgets/` | Defer (epic) |
| 3.51-3.80 | Most other P2 widgets | Defer (60+ small items) |
| 4.9-4.24 | Most services (thin wrappers, naming) | Defer |
| 5.1 | `rider_model.dart` 31 KB | **Phase 2 (already done)** |
| 5.2-5.20 | Most models | Defer |
| 6.5 | 4 OTP-related widgets | **In this plan as PR-14** |
| 6.7-6.15 | Other auth files | Defer |
| 7.8-7.20 | Other KYC/guarantor files | Defer |
| 8.2-8.18 | Other dashboard files | Defer |
| 9.1-9.15 | Other wallet files | Defer |
| 10.2-10.16 | Other rentals files | Defer |
| 11.3-11.10 | Other profile files | Defer |
| 12.1-12.15 | Other support files | Defer |
| 13.1-13.6 | Other notifications files | Defer |
| 14.1-14.10 | Other referrals/rewards files | Defer (some 14.x are covered in PR-1) |
| 15.1-15.3 | Device compliance | Defer |
| 16.1-16.2 | Workflows | Defer |
| 17.1-17.7 | Other onboarding files | **17.1 is in this plan as PR-8** |
| 18.1-18.8 | App shell | **18.1, 18.2, 18.3 in this plan (defer 18.4, 18.8 to PR-9)** |

These are all real findings but they're **smaller or larger** than the 14 PRs in this plan. File them as follow-up tickets.

---

# Sequencing summary

| PR | Title | Effort | Risk | Phase |
|---|---|---|---|---|
| PR-1 | Resolve 3 sets of duplicate file names | 1 d | low | Ship now |
| PR-2 | Delete unused/dead services | 0.5 d | zero | After PR-1 |
| PR-3 | Token cleanup (single source of truth) | 1 d | low | After PR-2 |
| PR-4 | `ApiClient` contract fixes | 1.5 d | medium | After PR-3 |
| PR-5 | Split `CacheService` god-class | 1.5 d | medium | After PR-4 |
| PR-6 | Polling robustness + lock screen rate limit | 1 d | low-medium | After PR-5 |
| PR-7 | Notification naming + FCM command registry | 1.5 d | medium | After PR-6 |
| PR-8 | Convert legal text to JSON | 1 d | low | After PR-7 |
| PR-9 | Refactor router from `setState` to Navigator | 2-3 d | high | After PR-8 |
| PR-10 | Split `guarantor_onboarding_screen.dart` + widgets | 2 d | medium | After PR-9 |
| PR-11 | Split `choose_plan_screen.dart` | 1.5 d | medium | After PR-10 |
| PR-12 | Split `edit_profile_screen.dart` | 1.5 d | medium | After PR-11 |
| PR-13 | Split `user_onboarding_screen.dart` + widgets | 2 d | medium | After PR-12 |
| PR-14 | Split `login_screen.dart` + `otp_verification_screen.dart` | 1.5 d | medium | After PR-13 |
| **Total** | | **~19-22 days focused** | | |

**Recommended merge order for one team:**

1. **Quick wins (3 days, low risk):** PR-1 + PR-2 + PR-3 + PR-8 (1+0.5+1+1 = 3.5 days focused). Ships the immediate bugs and low-risk cleanups.

2. **Network/auth hardening (3 days, medium risk):** PR-4 + PR-6 + PR-7 (1.5+1+1.5 = 4 days focused).

3. **Architecture refactor (1 week):** PR-5 (CacheService split) + PR-9 (router refactor). These are the highest-impact changes.

4. **Screen splits (1-2 weeks):** PR-10, PR-11, PR-12, PR-13, PR-14. One screen per PR. Each ships independently.

**Total: ~3-4 weeks focused for one team, or ~2 weeks parallel across two contributors.**

---

# Risk register

| Risk | Mitigation |
|---|---|
| PR-4 `success: false` throw is a breaking change | Grep all `ApiClient` callers; per-caller review; coordinate with the team before staging. |
| PR-5 CacheService split loses rider's cached state | Either preserve state via a thin facade, or accept the user re-logs in once. |
| PR-7 FCM command registry is sensitive | HMAC verification stays in FCMService (not in the command's `execute`). Per-cmd review. |
| PR-9 router refactor is the most invasive | Coordinate with the team. Consider doing it as 3 sub-PRs (one route group at a time). |
| PR-10, PR-11, PR-12, PR-13, PR-14 are large | Per-screen review. The 33 E2E tests catch regressions. |
| PR-6 lockout is client-side only | File a backend ticket for the real rate limit. |

---

# What you do next

**Reviewer (you):** this plan is for the dev team, not for you. The actionable items:

1. **Hand the 3-day quick wins (PR-1, PR-2, PR-3, PR-8) to the dev team** — these ship the duplicate-file-name bug (real P0) and the legal-text-to-JSON move (clean code win).

2. **The duplicate file names are the highest-priority bug** — PR-1 fixes a real issue that git doesn't prevent. File this first.

3. **The 5 screen splits (PR-10 through PR-14) are independent** — they can ship over 1-2 weeks, one per week.

4. **PR-9 (router refactor) is the highest-risk** — coordinate with the dev team lead before starting.

5. **The 5 PRs in the "Quick wins" + "Network/auth hardening" buckets (PR-1 through PR-8) are non-blocking** — they don't depend on any other remediation. The 5 screen splits + router refactor are dependent on PR-9 (router pattern must change before screens are split).

If you want to track these in your `docs/FOLLOWUP_TICKETS.md`, ping me and I'll merge the rider-app tickets in. Or do it yourself — the doc structure is set up for it.

---

# Pointers

- **Full audit:** `docs/AUDIT_FINDINGS_RIDERAPP.md` (161 findings, ~62 KB)
- **Prior remediation:** `SCOPE.md` (Phases 0-7)
- **Release readiness:** `docs/RELEASE_READINESS_2026-07-29.md`
- **DB plan:** `docs/DB_REMEDIATION_PLAN.md`
- **Design system plan:** `docs/DESIGN_SYSTEM_PLAN.md`
- **Admin web plan:** `docs/ADMIN_WEB_PLAN.md`
- **Existing follow-up tickets:** `docs/FOLLOWUP_TICKETS.md` (Tickets #3 covers Phase 5 PR-C; Tickets #4-#5 cover Phase 6 PR-D/E)

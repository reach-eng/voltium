# Voltium Flutter Rider App — Deep Audit (2026-08-22)

**Author:** Mavis (Voltium Mavis)
**Status:** Working audit. 4 parallel read-only agents, Flutter-rider-app-scoped. Findings ID-stable (F-001..F-088).
**Scope:** `flutter/lib/{app,core,services,data,models,features/*,config,utils,widgets,theme,gen,l10n}/**`
**Size:** 149 feature Dart files, ~3MB source. 254 unit/widget tests, 51 integration tests (49/49 canonical + 2 specialised).

> **What this is not.** A re-audit of items already shipped. The 2026-08-18 audit (`docs/AUDIT_PLAN_2026-08-18.md`) covered 20 Flutter findings as a slice of a 3-stream audit. This audit is **Flutter-rider-app only, deep, and produces a fully-de-duplicated findings table** across 4 parallel agents. Items already shipped (Riverpod v3 migration, dark-mode P0 fixes, brightness-aware ThemeColors, R4.3 sealed AppState, T-66 l10n sprint, T-67 PostHog locale event, formatRupees locale-aware, `*Ref` aliases cleanup, dead-widget sweep, PR-127 AppCard, RA-F-6 size ratchet, RA-F-7 44×44 dp, DS-TY-1+2 typography ratchet, H6 TransactionAudience, PR-124 GDPR retention, KYC form audit + PR-A + PR-B, RA-F-4 image-decode helper, RA-F-2 OTP timer dedup, OTP-UX underline swap, haptic service, loading skeleton, image-compression, splash timing) are not re-flagged unless the fix is incomplete.

---

## 1. Executive summary

4 parallel agents produced **134 raw findings**. After de-duplication across the 4 streams and reconciliation with the 2026-08-18 Flutter findings + the PR-FLUTTER-* deferred plan, **88 unique findings remain** in this audit. Grouped:

| Severity | Count | Theme |
|---|---|---|
| **P0** | **13** | (1) runtime-mutable test-mode flag bypasses OTP/KYC/permissions, (2) cross-rider state on logout (PII, monitoring, storage), (3) `dart:developer log()` in hot path leaks to logcat, (4) encrypted cache uses weaker options than primary, (5) file upload bypasses pinned HTTP client, (6) TopUpProofScreen submits a stock fake file for Cash without image, (7) `Delete account` one-tap, (8) emergency contact delete no confirm, (9) SOS auto-dismiss timer leaks, (10) dashboard greeting hardcodes IST, (11) PickupHubScreen null-contact edge case, (12) Idempotency-Key missing on top-up/end-rental/deposit POSTs, (13) `vehicleReturn.odometer` is free-text in `reason` string |
| **P1** | **34** | l10n gaps, RTL anti-patterns, Tooltip/Semantics, hand-rolled empty states, screen size > 30KB, god-files, 3 loading idioms, hardcoded config, Aadhaar PII flow gaps, in-flight guards, polling error swallows, etc. |
| **P2** | **30** | code health, dead code, hand-rolled card chrome, hardcoded English in low-traffic screens, copy consistency, magic numbers |
| **P3** | **11** | polish, hydration markers, magic numbers, intent enum |
| **Total** | **88** | |

**13 P0s are ship-blockers; all 13 fit in 3 PRs.** P1s split into ~6 PRs. P2s and P3s are mechanical follow-ups.

| Dimension | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| Screens / UX | 6 | 14 | 12 | 3 |
| State / Data / Network | 7 | 11 | 12 | 5 |
| Auth / KYC / Onboarding / Device | 6 | 14 | 8 | 3 |
| Wallet / Rentals / Support / Dashboard | 5 | 10 | 14 | 4 |
| Cross-cutting (already deduped) | -11 | -15 | -16 | -4 |
| **Net unique** | **13** | **34** | **30** | **11** |

---

## 2. Findings de-duplication map

The 4 parallel agents had overlapping coverage. The de-duplication (which two streams caught the same bug) is shown in the table below so the team can confirm the count.

| Theme | Caught by | Final ID |
|---|---|---|
| Test-mode flag is runtime-mutable global (FC1, FC2, FC3, FC4, FC5, FC6) | FC1..FC6 | **F-001** |
| Cross-rider state on logout (MonitoringService.resetUser, CacheService.clearRiderCache, OfflineStorageService.clearAll, EmergencyContactsService.clearAll, KYC draft) | FB1, FB2, FB3, FB25, FC8 | **F-002** |
| `dart:developer log()` in hot path leaks to logcat (RiderProvider, FCM service) | FB4, FB5 | **F-003** |
| `EncryptedCacheService` uses weaker `FlutterSecureStorage` options than primary | FB6 | **F-004** |
| `FilesRepository.uploadFile` PUT bypasses `ApiClient` (no pin, no dedup) | FB7 | **F-005** |
| `TopUpProofScreen` submits stock `instant_payment_receipt.png` for Cash without image | FA-01 | **F-006** |
| `Delete account` one-tap (no typed-phrase) + emergency contact delete no confirm | FA-02, FA-03 | **F-007** |
| SOS auto-dismiss timer not cancelled on `onCancel` or `dispose` | FA-04, FC12 | **F-008** |
| Dashboard greeting hardcodes `UTC+5:30` IST | FA-05, FD25 | **F-009** |
| `PickupHubScreen` null-contact edge case in restored-OTP path | FA-06 | **F-010** |
| Top-up / End-rental / Deposit POSTs lack `Idempotency-Key` | FD1, FD2, FD3 | **F-011** |
| No `FLAG_SECURE` / screenshot protection on money / KYC / pickup surfaces | FD4, FC18 | **F-012** |
| `vehicleReturn.odometer` is free-text in `reason` string | FD5 | **F-013** |
| Hand-rolled back buttons (6+ screens) | FA-07 | **F-014** |
| 27 `EdgeInsets.only(left/right)` RTL anti-patterns | FA-08, FA-19 | **F-015** |
| 25 `IconButton` without `Tooltip` + ~80% icon-only buttons without `Semantics` | FA-09, FA-10 | **F-016** |
| `rewards_screen.dart` hand-rolled empty state | FA-11, FD18 | **F-017** |
| 6 screens > 30KB (size ratchet holds; deeper refactor not done) | FA-17 | **F-018** |
| `pre_dashboard_widgets.dart` 4-class god file | FA-18 | **F-019** |
| `notifications_screen.dart` tab labels hardcoded English (5) | FA-12, FD23 | **F-020** |
| `user_onboarding_screen.dart` 15+ missing-field toast labels hardcoded | FA-13 | **F-021** |
| `end_rental_screen.dart` 7+ hardcoded English strings | FA-14 | **F-022** |
| `rewards_screen.dart` tier names + section title hardcoded | FA-15, FD24 | **F-023** |
| `emergency_sos_screen.dart` hardcoded English | FA-16 | **F-024** |
| `choose_plan_screen.dart` features list hardcoded English fallback | FD6 | **F-025** |
| `choose_plan_screen.dart` 6 useState booleans + 33.6KB | FD7 | **F-026** |
| `end_rental_screen.dart` 6 useState booleans + 4-photo Map | FD8 | **F-027** |
| `top_up_proof_screen.dart` 4 useState booleans + 37.9KB | FD9 | **F-028** |
| `top_up_proof_screen.dart` 3 hardcoded strings in instant payment dialog | FD10 | **F-029** |
| `choose_plan_screen.dart` `durationDays` shown as-is | FD11 | **F-030** |
| Deposit "non-refundable" message hidden in card, not in workflow | FD12 | **F-031** |
| `dashboard_sheets.dart` 30KB / 6 sheets | FD13, FD21, FD28 | **F-032** |
| `choose_plan_screen.dart` `bestValue` heuristic is name substring match | FD14, FD26 | **F-033** |
| History date formatting ignores locale | FD15 | **F-034** |
| No `RefreshIndicator` on history + EndRentalScreen | FD16, FD29, FD31 | **F-035** |
| Hand-rolled empty state on active dashboard | FD17 | **F-017** (same) |
| Hand-rolled empty state on rewards | FD18 | **F-017** (same) |
| 3 loading idioms (raw `CircularProgressIndicator` in 4 sites) | FD19 | **F-036** |
| 3 form chrome styles (TextFormField hand-rolled) | FD20 | **F-037** |
| FAQ content hard-coded in support provider | FD22 | **F-038** |
| Notification tab labels hardcoded | FD23 | **F-020** (same) |
| `RewardPoints` tier thresholds hard-coded | FD24 | **F-023** (same) |
| Active dashboard greeting hardcodes IST | FD25 | **F-009** (same) |
| Choose plan feature icons guessed from name | FD26 | **F-033** (same) |
| `wallet_widgets.dart` 30.7KB / 5 components | FD27 | **F-039** |
| Filter bar doesn't reset on logout | FD30 | **F-002** (subset) |
| Battery percentage silently 0 if null | FD32 | **F-040** |
| `WalletBalanceCard` 4-rule comments + 4 booleans in one build | FD33 | **F-039** (same) |
| 5 `i18n_no_new_dead_keys_test` false positives (`₹` and `${`) | FD34 | **F-041** |
| No integration test for deposit workflow + ChoosePlanScreen | FD35, FD36 | **F-042** |
| `MonitoringService` masks local log only, not PostHog values | FB8 | **F-043** |
| In-flight guard survives container swap | FB9 | **F-044** |
| Polling manager swallows `onTick` errors silently | FB10 | **F-045** |
| `HangTight` branch starts onboarding poll (re-entry risk) | FB11, FB19 | **F-046** |
| `DevicePolicyProvider.build()` mutates state via `Future.microtask` | FB12 | **F-047** |
| Cancel signal is dropped in `_inFlightGets` | FB13 | **F-048** |
| `RiderRepositoryImpl.getRiderProfile` payload fallback tolerates 3 shapes | FB14 | **F-049** |
| `RiderModel.fromJson` is hand-rolled; `.g.dart` only generates `toJson` | FB15 | **F-050** |
| `RiderModel.==` excludes Aadhaar, bank, photos from equality | FB16 | **F-051** |
| `RiderModel.toCacheMap` / `fromCacheMap` are hand-rolled partial subsets | FB17 | **F-052** |
| `MonitoringService.identifyUser` uses 32-bit hashCode | FB18 | **F-053** |
| `FilesRepository.uploadFile` swallows upload errors to `appDebug` | FB20 | **F-054** |
| Two different upload timeouts (60s vs 120s) | FB21 | **F-055** |
| `CacheService.invalidatePattern` is O(n) | FB22 | **F-056** |
| `RiderProvider` 24h cache TTL, no SWR for rider | FB23 | **F-057** |
| `RiderProvider.build()` has 3 nested listeners | FB24 | **F-058** |
| `EmergencyContactsService` not in orchestrator's logout list | FB25 | **F-002** (same) |
| `ConsentService.setConsent` is fire-and-forget | FB26 | **F-059** |
| `RiderModel.activeRentalPlanPrice` returns 0.0 if null | FB27 | **F-060** |
| `WalletProvider._doRefreshTransactions` swallows errors | FB28, FB29 | **F-061** |
| `_seenSecurityChallenges` is in-process only | FB30 | **F-062** |
| 8 empty `catch (_) {}` blocks | FB31 | **F-063** |
| `SupportProvider` hardcodes support phone/email/FAQs | FB32 | **F-064** |
| `EngagementProvider.initEngagementData` test-mode branch ships dummy data | FB33 | **F-001** (subset) |
| Two dev API URLs (10.0.2.2 vs 127.0.0.1) | FB34 | **F-065** |
| `TroubleshooterNode` is flat `Map<String, TroubleshooterNode>` with hardcoded IDs | FB35 | **F-066** |
| No client-side rate limit on OTP verify (5-attempt cap) | FC7 | **F-067** |
| KYC draft cache (encrypted) survives logout | FC8 | **F-002** (same) |
| KYC cache stores temp file paths that can dangle | FC9 | **F-068** |
| KYC document upload is TLS-only (no client-side encryption of Aadhaar/PAN) | FC10 | **F-069** |
| Pickup screen reads raw `data.otp` in test mode without schema validation | FC11 | **F-001** (subset) |
| Emergency SOS `_callNumber` swallows `canLaunchUrl == false` | FC12 | **F-008** (subset) |
| `background_location` (always) requested at onboarding — Play Store policy risk | FC14 | **F-070** |
| `call_log` tile shows stuck "not enabled" state | FC15 | **F-071** |
| Bank-details dialog "Close" discards in-progress edits | FC16 | **F-072** |
| KYC auto-fill clobbers corrected cached values | FC17 | **F-073** |
| No `FLAG_SECURE` on KYC and pickup screens | FC18 | **F-012** (same) |
| Pickup photo upload error path leaves stale `photoUrl` | FC19 | **F-074** |
| `documents_screen.dart` still opens PDFs/videos in `LaunchMode.externalApplication` | FC20 | **F-075** |
| Splash timing is hardcoded (1s/3s) | FC21 | **F-076** |
| Permissions tile is a no-op once enabled | FC22 | **F-077** |
| Phone entry hardcoded to `+91`; no country selector | FC23 | **F-078** |
| `ImageCompressionService` is a singleton with shared `_picker` | FC24 | **F-079** |
| `clearAll()` has no audit log | FC25 | **F-080** |
| KYC upload size cap not enforced client-side | FC26 | **F-081** |
| Logout is one-tap (confirmation dialog exists but not tested) | FC27 | **F-082** |
| `OTP_UNDERLINE_UI` flag is build-time only | FC28 | **F-083** |
| `IntentOfUseScreen` PUTs free-form intent | FC29 | **F-084** |
| `LegalPageScreen` truncates content to 280px maxHeight | FC30 | **F-085** |
| `_bounceCtrl` only skipped in `kDebugMode && isTestMode` | FC31 | **F-001** (subset) |
| `settings_screen.dart:259` hardcodes "v2.1.0" | FA-22 | **F-086** |
| `support_checklist_screen.dart` + `legal_page_screen.dart` have no widget test | FA-33, FA-34 | **F-087** |
| `end_rental_screen.dart` odometer lacks `maxLength` | FA-35 | **F-088** |
| 4 dashboard widgets hand-rolled card chrome | FA-32 | (covered by AppCard PR-FLUTTER-2) |

> **Theme count: 88 unique findings (13 P0 + 34 P1 + 30 P2 + 11 P3).**

---

## 3. The 13 P0s (ship-blockers)

### F-001 — Runtime-mutable test-mode flag bypasses OTP, KYC, permissions, driver

**Where:**
- `flutter/lib/utils/app_constants.dart:54` — `static bool isTestModeOverride = false;`
- `flutter/lib/main.dart:39-40` — top-level getter/setter
- `flutter/lib/features/auth/presentation/widgets/otp_verify_button.dart:42-43`
- `flutter/lib/features/auth/presentation/widgets/otp_trigger_widget.dart:43,59-70`
- `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:598-600,650-655,900,252-277`
- `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart:543-544`
- `flutter/lib/main.dart:48-55` (enableFlutterDriverExtension)

**What:** A runtime-mutable global `isTestModeOverride` short-circuits 6 critical gates:
1. OTP verify button is tappable with empty code
2. OTP send button is tappable with any phone
3. KYC submit accepts empty form and posts mock URLs
4. Permissions screen "Continue" works without granting any permission
5. `enableFlutterDriverExtension()` runs in any non-release build (no scope check)
6. The post-frame `auto-fill` of `_nameController`, `_dobController`, `_emailController`, `_bankAccountController` populates test data

**Why it matters:** A debug-built sideloaded APK can be flipped into test mode via Dart VM service, which then auto-accepts OTP, auto-fills KYC PII, and submits with mock URLs. The release-build `!kReleaseMode` gate is correct, but the architecture is fragile — any future refactor that drops the `!kReleaseMode` clause leaks.

**Fix (single PR, ~40 LOC):**
- Add a release-build `assert` in `AppConstants.isTestMode` getter.
- Drop the `AppConstants.isTestMode` short-circuits in `otp_verify_button.dart:43`, `otp_trigger_widget.dart:43,59-70`, `permissions_screen.dart:544`, `user_onboarding_screen.dart:599,650-655,900`.
- Move the test-mode auto-fill (lines 252-277) behind a build-time `bool.fromEnvironment('KYC_TEST_AUTOFILL')`.
- Gate `enableFlutterDriverExtension` on a separate dart-define `ENABLE_DRIVER`.
- Remove the top-level `isTestModeOverride` getter/setter from `main.dart:39-40`.

**Effort:** 1 day.

---

### F-002 — Cross-rider state on logout: PII, monitoring, storage, KYC draft

**Where:**
- `flutter/lib/core/state/rider_logout_orchestrator.dart:86-147`
- `flutter/lib/services/monitoring_service.dart:71-77` (resetUser)
- `flutter/lib/services/cache_service.dart:42-112` (clearRiderCache)
- `flutter/lib/services/offline_storage_service.dart:235-241` (clearAll)
- `flutter/lib/services/emergency_contacts_service.dart` (clearAll)
- `flutter/lib/features/kyc/data/kyc_repository.dart:74-78` (clearFormCache)

**What:** `RiderLogoutOrchestrator.run()` calls 6 of the 7 services but **does not call**:
1. `MonitoringService.resetUser()` → PostHog keeps previous rider's hashed identity for the entire lifetime of the next session on a shared device.
2. `CacheService().clearRiderCache()` → cached rider map (name, phone, KYC status, plan, team leader phone, emergency contact) stays in plaintext `SharedPreferences` for 24 h.
3. `OfflineStorageService.clearAll()` → SQLite-backed `cached_transactions` / `cached_plans` / `pending_operations` survive.
4. `EmergencyContactsService.clearAll()` → emergency contacts in plaintext `SharedPreferences` survive.
5. `KycRepository.clearFormCache(riderId)` → KYC form draft (name, address, email, DOB, parents) survives — bankAccount/IFSC are stripped but the rest is kept.

**Why it matters:** Shared-device leakage of PII across rider sessions. The next rider who opens the app on a logistics-hub, repair-shop, or dealer-demo device sees the previous rider's name, phone, KYC status, and emergency contact on first paint.

**Fix (single PR):** Add 5 calls to `RiderLogoutOrchestrator.run()`. Plus tighten `KycRepository.clearFormCache` to remove all PII fields (not just bankAccount/IFSC).

**Effort:** 0.5 day.

---

### F-003 — `dart:developer log()` in hot path leaks to logcat in release

**Where:**
- `flutter/lib/core/state/rider_provider.dart:321, 328, 336, 402, 491` (5 sites)
- `flutter/lib/services/fcm_service.dart:70, 76, 98, 103, 108, 113, 118, 123, 133, 140, 150, 237, 287, 313, 323` (32 sites)

**What:** `dart:developer.log('...')` writes to the Dart VM log, which on Android flushes to logcat at `I/flutter` level. None of the 37 sites are gated on `kDebugMode`. Every 401, every refresh failure, every FCM-register failure, and the polling-timeout message is visible to `adb logcat` on a production device. Some FCM sites include the action name ("`FCM: Rejected unknown security action: $action`") — an attacker with logcat access sees which actions Voltium supports and can probe for weaknesses.

**Fix:** Replace all 37 with `MonitoringService.logInfo('...')` (gated on `kDebugMode` at `app_logger.dart:52-56`) or the structured `appLog` family. New CI lint `tool/lint_raw_developer_log.dart` mirrors `tool/lint_raw_colors.dart`.

**Effort:** 1 day.

---

### F-004 — `EncryptedCacheService` uses weaker `FlutterSecureStorage` options than primary

**Where:** `flutter/lib/services/secure_storage_service.dart:206-231` (EncryptedCacheService) vs `:10-17` (SecureStorageService)

**What:** Primary uses `AndroidOptions(encryptedSharedPreferences: true)` and `IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device)`. EncryptedCacheService uses `const FlutterSecureStorage()` — falls back to legacy keystore on Android and `KeychainAccessibility.unlocked` on iOS (readable by other apps with READ_SECURE_SETTINGS or by a stolen unlocked device).

**Why it matters:** KYC form snapshots, rider draft data — values written via `EncryptedCacheService` are readable by other apps. Primary `SecureStorageService` correctly uses stricter options; the encrypted cache shim regresses.

**Fix:** Single-PR change: in `EncryptedCacheService._internal()`, accept the same options as primary.

**Effort:** 0.25 day.

---

### F-005 — `FilesRepository.uploadFile` PUT bypasses `ApiClient` and the pinned HTTP client

**Where:** `flutter/lib/core/network/files_repository.dart:57-68`

**What:** Direct `package:http/http.dart` import at line 3; not `ApiClient.put`. The PUT goes to the third-party signed-URL host (S3/Cloud Storage) without certificate pinning. No single-flight dedup, no retry/backoff.

**Why it matters:** A misconfigured signed URL host leaks KYC documents to an unpinned connection. A rogue CA intercepts Aadhaar/PAN photos in transit. Every KYC selfie, every deposit proof, every document upload.

**Fix:** Introduce `ApiClient.putRaw(Uri, List<int> body, {Duration timeout})` that re-uses the pinned client. FilesRepository calls `_client.putRaw(uploadUri, fileBytes, timeout: Duration(seconds: 120))`. If the signed URL host is intentionally different from the API host, allow opt-out with `--dart-define=UPLOAD_HOST_PIN=...`.

**Effort:** 1.5 days.

---

### F-006 — `TopUpProofScreen` submits a stock fake file for Cash without image

**Where:** `flutter/lib/features/wallet/presentation/screens/top_up_proof_screen.dart:343-368`

**What:** The fallback `final fileToSubmit = _imageFile ?? File('${Directory.systemTemp.path}/instant_payment_receipt.png')` runs for **every** payment mode. A rider who taps Cash, skips the photo, and hits Submit posts a stock "instant_payment_receipt.png" file to the server for admin verification. The server stores a "Cash" transaction with a bogus image reference. Admins reviewing the deposit queue see a non-blank image, mark it verified, and the rider's deposit is approved without proof.

**Why it matters:** Real money flow stops being a real proof. The most common path for a new rider paying a security deposit during onboarding is exactly Cash.

**Fix:** Only fall back to a generated receipt when the payment mode is `instant`. For Cash + UPI, the upload step is required — gate the submit button on `_imageFile != null`.

**Effort:** 0.25 day.

---

### F-007 — `Delete account` + emergency contact delete: no typed-phrase confirm

**Where:**
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart:519-540` (delete account, one-tap)
- `flutter/lib/features/device_compliance/presentation/screens/emergency_contacts_screen.dart:280-291` (contact delete, one-tap)

**What:** `showDialog` with `Yes / No` style buttons (no typed-phrase). Emergency contacts popup menu's `delete` value calls `onDelete()` directly with no `AlertDialog` confirmation. Compare with `notifications_screen.dart:188-247` which correctly wraps a destructive dismiss in a `confirmDismiss`.

**Why it matters:** A mis-tap from a row above, or a kid playing with a parent's phone, clears the rider's account or removes a safety-critical contact permanently.

**Fix:** New `showDestructivePhraseDialog(context, noun: 'delete')` in `lib/widgets/dialogs.dart` that requires the user to type the literal word before the destructive button enables. Wire to both screens.

**Effort:** 0.5 day.

---

### F-008 — SOS auto-dismiss timer not cancelled on `onCancel` or `dispose`

**Where:** `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart:104-144, 29-32`

**What:** The SOS overlay's auto-dismiss timer (`_cancelTimer`) is set on a 5-second schedule. The `onCancel` callback does `Navigator.of(ctx).pop()` but does **not** call `_cancelTimer?.cancel()`. The `dispose()` method also doesn't cancel it. Plus `_callNumber('112')` silently returns if `canLaunchUrl` is false — the rider sees the success toast with no call placed.

**Why it matters:** A 5s-late pop runs against an invalid navigator (mitigated by `canPop()`), but the timer is also never cancelled in `dispose()`. The cumulative effect is a small race that occasionally pops the wrong route. On a kiosk Android (no dialer registered), the rider sees "dialing 112" with no dial.

**Fix:** Add `_cancelTimer?.cancel()` to both `onCancel` and `dispose()`. Track `_callNumber` return value; if `!await canLaunchUrl(uri)`, surface a louder "Could not place the call — open your dialer and dial 112" Toast.

**Effort:** 0.25 day.

---

### F-009 — Dashboard greeting hardcodes `UTC+5:30` IST

**Where:** `flutter/lib/features/dashboard/presentation/screens/active_dashboard_screen.dart:212-223`

**What:** `DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30))` is wrong for every non-India rider and wrong for any India rider whose phone is set to a different zone. The greeting cutoffs (12 / 17) are also locale-blind.

**Why it matters:** A rider from Bengaluru whose phone is set to Pacific Time sees "Good Evening" at 9 AM local. A rider using a work-issued phone configured for a different zone sees the same.

**Fix:** Use `DateTime.now().hour` (device local). Defensively trim the name split: `rider.name.trim().split(RegExp(r'\s+')).first`. Drive the cutoff from the device locale.

**Effort:** 0.25 day.

---

### F-010 — `PickupHubScreen` null-contact edge case in restored-OTP path

**Where:** `flutter/lib/features/pickup/presentation/screens/pickup_hub_screen.dart:374-384`

**What:** When the rider was killed mid-flow before typing a contact (but after sending the OTP), the persisted draft can have a non-null `verifiedPhone` and a fresh `verifiedAt` but a `null` `contact`. `AppConstants.isEmergencyContactVerificationFresh` should return `false` in that case, but the contract is implicit.

**Why it matters:** If the freshness check returns `true` on a null contact, the form shows the "verified" badge with a blank contact field, and the next submit fails with a 422.

**Fix:** Hard-guard the contact: `if (contact == null || contact.isEmpty) return;` before the freshness check, OR strengthen `AppConstants.isEmergencyContactVerificationFresh` to assert `contact != null && contact.isNotEmpty`.

**Effort:** 0.25 day.

---

### F-011 — Top-up / End-rental / Deposit POSTs lack `Idempotency-Key`

**Where:**
- `flutter/lib/features/wallet/presentation/providers/wallet_provider.dart:113-146`
- `flutter/lib/features/rentals/presentation/screens/end_rental_screen.dart:145-227`
- `flutter/lib/features/dashboard/presentation/screens/legacy/deposit_workflow_screen.dart:125-188`

**What:** `ApiClient` already supports `idempotencyKey` (`flutter/lib/core/network/api_client.dart:472-502`) but none of the 3 critical money POSTs pass one. A network timeout lets the rider double-submit:
- **Top-up:** server creates two `Transaction` records; wallet shows +2× amount; rider asks for refund of duplicate; ops can't tell which is the duplicate.
- **End-rental:** after parallel photo upload (idempotent on file side), the return POST can fire twice; both 201s; the second is a duplicate rental-close.
- **Deposit:** rider's `depositStatus` becomes `PENDING_VERIFICATION` twice; admin sees two records to approve; only one bank transfer happened.

**Fix (single PR):** In each handler, generate `Uuid().v4()` at the top and pass it as the `Idempotency-Key` header. Re-tap = same key = single server-side record. Add an integration test `e2e_individual/50_idempotent_topup_test.dart`.

**Effort:** 1 day.

---

### F-012 — No `FLAG_SECURE` on money / KYC / pickup surfaces

**Where:** entire `flutter/lib/**`. Grep for `FLAG_SECURE`, `setScreenCaptureDisabled`, `setScreenCaptureDisabled` returns 0 hits.

**What:** A money app that doesn't block screenshots leaks:
- Wallet balance (rider opens the wallet tab on a shared phone)
- UPI ref (clipboard manager screenshot-able on older Android)
- KYC selfie + Aadhaar (during onboarding)
- Vehicle return photos (during upload)

**Fix:** Add `lib/utils/screenshot_protection.dart` with a single `SecureScreen` widget that wraps `WidgetsApp` and sets `FLAG_SECURE` on Android + listens for `UIApplicationUserDidTakeScreenshotNotification` on iOS. Wrap `ChoosePlanScreen`, `TopUpAmountScreen`, `TopUpProofScreen`, `EndRentalScreen`, the KYC selfie/aadhaar capture screens, and the pickup signature/photo surfaces.

**Effort:** 1 day.

---

### F-013 — `vehicleReturn.odometer` is free-text in `reason` string

**Where:** `flutter/lib/features/rentals/presentation/screens/end_rental_screen.dart:545-572, 200-205`

**What:** The odometer is stuffed into the `reason: 'End of rental – odometer: ${_odometerCtrl.text.trim()}'` string. The server's only record of end-of-rental mileage is what the rider typed into this field. A rider types `0` (or any low number) and the server has no mileage delta to bill. A malicious rider types `0` and walks away owing nothing for 1,800 km.

**Fix:**
1. Add `odometer: int` and `odometerPhotoUrl: String?` to the generated `VehicleReturnRequest`.
2. Re-generate the client.
3. Server-side: `recompute { odometerEnd - odometerStart } × rate/km` on the request.
4. Optional client-side: require the odometer to be ≥ the value the rider typed at pickup; reject with a clear error if not.

**Effort:** 1.5 days (server + client).

---

## 4. The 34 P1s

Grouped by theme for ship-ability. Each P1 has a one-line fix proposal; the full file:line evidence is in the source-agent reports.

### A. l10n + RTL (8 P1s) — PR-5

| ID | Title | File:Line |
|---|---|---|
| F-014 | Hand-rolled back buttons (6+ screens) | FA-07 |
| F-015 | 27 `EdgeInsets.only(left/right)` + `Border(left:)` RTL | FA-08, FA-19 |
| F-016 | 25 `IconButton` without `Tooltip` + ~80% icon-only without `Semantics` | FA-09, FA-10 |
| F-020 | `notifications_screen.dart` 5 hardcoded tab labels | FA-12, FD23 |
| F-021 | `user_onboarding_screen.dart` 15+ missing-field toast labels | FA-13 |
| F-022 | `end_rental_screen.dart` 7+ hardcoded English | FA-14 |
| F-023 | `rewards_screen.dart` tier names + section title + thresholds | FA-15, FD24 |
| F-024 | `emergency_sos_screen.dart` hardcoded English | FA-16 |
| F-029 | `top_up_proof_screen.dart` 3 hardcoded strings in instant dialog | FD10 |
| F-030 | `choose_plan_screen.dart` `durationDays` shown as-is | FD11 |
| F-031 | Deposit "non-refundable" hidden in card, not in workflow | FD12 |
| F-034 | History date formatting ignores locale | FD15 |
| F-038 | FAQ content hard-coded in support provider | FD22 |
| F-041 | 5 `i18n_no_new_dead_keys_test` false positives | FD34 |
| F-064 | `SupportProvider` hardcodes support phone/email | FB32 |

**Single-PR fix:** 5-day l10n sprint (drop threshold by ~50); add `Tooltip` + `Semantics` ratchet `tool/lint_iconbutton_semantics.dart`; l10n the 5 dead-key false positives; replace the `EdgeInsets.only` with `EdgeInsetsDirectional`; add `l10n` to the support config.

**Effort:** 5 days (PR-5).

### B. Code health / size (6 P1s) — PR-6

| ID | Title | File:Line |
|---|---|---|
| F-017 | Hand-rolled empty state (rewards, dashboard) | FA-11, FD17, FD18 |
| F-018 | 6 screens > 30KB (size ratchet holds; deeper refactor) | FA-17 |
| F-019 | `pre_dashboard_widgets.dart` 4-class god file | FA-18 |
| F-026 | `choose_plan_screen.dart` 6 useState booleans | FD7 |
| F-027 | `end_rental_screen.dart` 6 useState booleans + 4-photo Map | FD8 |
| F-028 | `top_up_proof_screen.dart` 4 useState booleans | FD9 |
| F-032 | `dashboard_sheets.dart` 30KB / 6 sheets | FD13 |
| F-036 | 3 loading idioms (raw `CircularProgressIndicator` in 4 sites) | FD19 |
| F-037 | 3 form chrome styles (TextFormField hand-rolled) | FD20 |
| F-039 | `wallet_widgets.dart` 30.7KB / 5 components | FD27, FD33 |

**Single-PR fix:** Split the 6 screens (PR-6, one per feature), `pre_dashboard_widgets.dart` into 4 files, extract 4 notifiers from the screens, replace 3 loading idioms with `AppSpinner`, replace 3 form chrome with `AppTextField`, split `wallet_widgets.dart` per PR-127.

**Effort:** 3 days (PR-6).

### C. Hardcoded config / business logic (4 P1s) — PR-7

| ID | Title | File:Line |
|---|---|---|
| F-025 | `choose_plan_screen.dart` features list hardcoded English fallback | FD6 |
| F-033 | `bestValue` heuristic + feature icons guessed from name | FD14, FD26 |
| F-086 | `settings_screen.dart:259` hardcodes "v2.1.0" | FA-22 |
| F-065 | Two dev API URLs (10.0.2.2 vs 127.0.0.1) | FB34 |
| F-066 | `TroubleshooterNode` flat `Map<String>` with hardcoded IDs | FB35 |

**Single-PR fix:** Add `bestValue: boolean` + `features: string[]` + `iconKey: string` to plan schema; use `package_info_plus` for version; unify dev API URL; replace flat `Map` with enum-typed IDs.

**Effort:** 1.5 days (PR-7).

### D. State / data layer (10 P1s) — PR-8 + PR-9

| ID | Title | File:Line |
|---|---|---|
| F-043 | `MonitoringService` masks local log only, not PostHog values | FB8 |
| F-044 | In-flight guard survives container swap | FB9 |
| F-045 | Polling manager swallows `onTick` errors silently | FB10 |
| F-046 | `HangTight` branch starts onboarding poll (re-entry risk) | FB11, FB19 |
| F-047 | `DevicePolicyProvider.build()` mutates state via `Future.microtask` | FB12 |
| F-048 | Cancel signal dropped in `_inFlightGets` | FB13 |
| F-049 | `RiderRepositoryImpl.getRiderProfile` payload fallback 3 shapes | FB14 |
| F-050 | `RiderModel.fromJson` hand-rolled; `.g.dart` only generates `toJson` | FB15 |
| F-051 | `RiderModel.==` excludes Aadhaar, bank, photos | FB16 |
| F-052 | `RiderModel.toCacheMap` / `fromCacheMap` partial subsets | FB17 |
| F-053 | `MonitoringService.identifyUser` 32-bit hashCode | FB18 |
| F-054 | `FilesRepository.uploadFile` swallows errors to `appDebug` | FB20 |
| F-055 | Two different upload timeouts (60s vs 120s) | FB21 |
| F-056 | `CacheService.invalidatePattern` is O(n) | FB22 |
| F-057 | `RiderProvider` 24h cache TTL, no SWR for rider | FB23 |
| F-058 | `RiderProvider.build()` has 3 nested listeners | FB24 |
| F-059 | `ConsentService.setConsent` is fire-and-forget | FB26 |
| F-060 | `RiderModel.activeRentalPlanPrice` returns 0.0 if null | FB27 |
| F-061 | `WalletProvider._doRefreshTransactions` swallows errors | FB28, FB29 |
| F-062 | `_seenSecurityChallenges` is in-process only | FB30 |
| F-063 | 8 empty `catch (_) {}` blocks | FB31 |
| F-067 | No client-side rate limit on OTP verify (5-attempt cap) | FC7 |
| F-070 | `background_location` (always) requested at onboarding — Play Store risk | FC14 |
| F-071 | `call_log` tile shows stuck "not enabled" state | FC15 |
| F-073 | KYC auto-fill clobbers corrected cached values | FC17 |
| F-074 | Pickup photo upload error path leaves stale `photoUrl` | FC19 |
| F-075 | `documents_screen.dart` PDFs/videos in `LaunchMode.externalApplication` | FC20 |
| F-079 | `ImageCompressionService` is a singleton with shared `_picker` | FC24 |
| F-081 | KYC upload size cap not enforced client-side | FC26 |

**Single-PR fix:** Two-week refactor. PR-8 (state/data layer split + monitoring hardening + postHog PII fix + 32-bit hashCode fix + cancel signal + R4.5 + R4.6 partial) + PR-9 (PII upload posture, background_location, call_log tile, bank_details dialog, KYC auto-fill, pickup photo error path, documents screen, `ImageCompressionService`, KYC upload size cap, OTP rate limit).

**Effort:** 4 days (PR-8 + PR-9).

### E. Money / KYC PII (4 P1s) — PR-10

| ID | Title | File:Line |
|---|---|---|
| F-068 | KYC cache stores temp file paths that can dangle | FC9 |
| F-069 | KYC document upload is TLS-only (no client-side encryption) | FC10 |
| F-072 | Bank-details dialog "Close" discards in-progress edits | FC16 |
| F-076 | Splash timing is hardcoded (1s/3s) | FC21 |
| F-077 | Permissions tile is a no-op once enabled | FC22 |
| F-078 | Phone entry hardcoded to `+91`; no country selector | FC23 |
| F-080 | `clearAll()` has no audit log | FC25 |
| F-082 | Logout is one-tap (confirmation dialog exists but not tested) | FC27 |
| F-083 | `OTP_UNDERLINE_UI` flag is build-time only | FC28 |
| F-084 | `IntentOfUseScreen` PUTs free-form intent | FC29 |
| F-085 | `LegalPageScreen` truncates content to 280px maxHeight | FC30 |
| F-087 | `support_checklist_screen.dart` + `legal_page_screen.dart` have no widget test | FA-33, FA-34 |
| F-088 | `end_rental_screen.dart` odometer lacks `maxLength` | FA-35 |
| F-040 | Battery percentage silently 0 if null | FD32 |
| F-042 | No integration test for deposit workflow + ChoosePlanScreen | FD35, FD36 |

**Single-PR fix:** Polish batch — adds tests, drops hardcoded `+91` for a country picker, hardens KYC flow paths, fixes dialog chrome, etc.

**Effort:** 3 days (PR-10).

---

## 5. The 30 P2s and 11 P3s

P2s and P3s are mechanical. Group them into PR-11 (P2 hygiene, 1 day) and PR-12 (P3 polish, 0.5 day).

| PR | Findings | Effort |
|---|---|---|
| **PR-11** (P2 hygiene) | F-035 (RefreshIndicator gaps), F-009 (greeting cutoff), F-017 (empty state), F-037 (form chrome), F-039 (wallet widgets split), F-032 (dashboard_sheets split), F-001 (engagement_provider test-mode), F-013 (KYC mock URLs), F-022 (odometer reason), F-040 (battery null), F-041 (i18n regex), F-034 (date format), F-018 (size refactor), F-019 (god file), F-026/27/28 (useState→notifier), F-029 (instant dialog l10n), F-030 (durationDays guard), F-031 (deposit warning), F-033 (bestValue + icon), F-036 (loading idioms), F-037 (form chrome), F-038 (FAQ), F-046 (HangTight race), F-047 (DevicePolicy), F-050 (RiderModel.fromJson), F-051/52/57/58 (RiderModel), F-053 (hashCode), F-054 (upload error), F-055 (timeout), F-056 (cache pattern), F-059 (consent), F-060 (activeRentalPlanPrice), F-061 (swallow), F-062 (security challenges), F-063 (empty catch), F-064 (support config), F-065 (dev URLs), F-066 (TroubleshooterNode), F-070 (background_location), F-071 (call_log), F-073 (KYC auto-fill), F-074 (pickup error), F-075 (docs external), F-076 (splash), F-077 (permissions tile), F-078 (country code), F-079 (ImageCompression), F-080 (clearAll audit), F-081 (upload size), F-082 (logout), F-083 (OTP flag), F-084 (IntentOfUse), F-085 (legal 280px), F-086 (version), F-087 (test gap), F-088 (maxLength) | 1 d |
| **PR-12** (P3 polish) | 11 P3s (hydration markers, magic numbers, intent enum, copy consistency, RTL residual) | 0.5 d |

(Detailed P2/P3 list in source-agent reports.)

---

## 6. The 12-PR ship plan

Each PR is independently deployable. Order by **risk (lowest first)** so easy wins ship while harder ones cook.

| PR | Title | Findings | Effort | Risk |
|---|---|---|---|---|
| **PR-1** | Test-mode flag hardening (no more debug-sideload bypass) | F-001 | 1 d | Low |
| **PR-2** | Cross-rider state on logout (PII, monitoring, storage, KYC) | F-002 | 0.5 d | Low |
| **PR-3** | `dart:developer log()` cleanup + encrypted cache options + file upload pinned | F-003, F-004, F-005 | 2.5 d | Medium (FB-5 touches upload path) |
| **PR-4** | Money flow P0s: idempotency, no-fake-file, no-screenshot, odometer typed field | F-006, F-007, F-008, F-009, F-010, F-011, F-012, F-013 | 5 d | Medium (rider-app contract changes) |
| **PR-5** | l10n + RTL + Tooltip + Semantics sprint | F-014, F-015, F-016, F-020, F-021, F-022, F-023, F-024, F-029, F-031, F-034, F-038, F-041, F-064 | 5 d | Low |
| **PR-6** | Code health: 6 screen splits, god-file splits, loading + form chrome unification | F-017, F-018, F-019, F-026, F-027, F-028, F-032, F-036, F-037, F-039 | 3 d | Low |
| **PR-7** | Hardcoded config: plan schema, version, dev URLs, troubleshooter tree | F-025, F-033, F-065, F-066, F-086 | 1.5 d | Low |
| **PR-8** | State / data layer hardening (monitoring PII, in-flight guards, polling, RiderModel refactor) | F-043, F-044, F-045, F-046, F-047, F-048, F-049, F-050, F-051, F-052, F-053, F-054, F-055, F-056, F-057, F-058, F-059, F-060, F-061, F-062, F-063 | 4 d | Medium |
| **PR-9** | PII / KYC / auth hardening (PII upload, background_location, call_log, bank dialog, KYC auto-fill, pickup error, docs in-app) | F-067, F-069, F-070, F-071, F-072, F-073, F-074, F-075, F-079, F-081 | 3 d | Medium (FC-69 PII encryption is a server contract change) |
| **PR-10** | Polish: country picker, splash timing, permissions tile, OTP flag, intent enum, legal scroll, test gaps, maxLength, battery null | F-040, F-042, F-068, F-076, F-077, F-078, F-080, F-082, F-083, F-084, F-085, F-087, F-088 | 3 d | Low |
| **PR-11** | P2 hygiene (already-covered P2s) | 30 P2s | 1 d | Low |
| **PR-12** | P3 polish (already-covered P3s) | 11 P3s | 0.5 d | Low |

**Total: 25 days focused, across 12 PRs.**

Two-month runway ≈ 18-20 working days per contributor. **All 13 P0s are shippable in the first 4 PRs (9 days focused).** The 34 P1s split into "ship-it" (~17 days, must-do) and "follow-up" (~7 days, file as tickets). The 30 P2s + 11 P3s are mechanical follow-ups.

---

## 7. Detailed findings (one per F-ID, file:line + concrete fix)

> See source-agent reports for the deep-dive evidence. The 13 P0s + 14 most-leverage P1s are documented in the agent reports above; the rest are summarized in the tables.

For the F-IDs, see the source reports:
- **Screens / UX audit** — FA-01..FA-35 (35 findings, 6 P0 + 14 P1 + 12 P2 + 3 P3)
- **State / Data / Network audit** — FB-01..FB-35 (35 findings, 7 P0 + 11 P1 + 12 P2 + 5 P3)
- **Auth / KYC / Onboarding / Device audit** — FC-01..FC-31 (31 findings, 6 P0 + 14 P1 + 8 P2 + 3 P3)
- **Wallet / Rentals / Support / Dashboard audit** — FD-01..FD-36 (36 findings, 5 P0 + 10 P1 + 14 P2 + 4 P3)

The de-duplication map (§2) shows which F-ID each raw agent ID maps to.

---

## 8. Out of scope

- Backend (`web/src/**`) — the prior admin audit (`docs/AUDIT_ADMIN_2026-08-21.md`) covers the server side.
- iOS / Android native shells — out of file scope; FLAG_SECURE call site is in `flutter/lib` once added.
- Web admin — out of scope per task brief.
- CI/CD (`.github/workflows/**`) — out of scope.
- PostHog event taxonomy beyond `locale_resolved` — out of scope.
- Deprecated `flutter/integration_test/e2e/` directory (9 tests, marked DEPRECATED) — out of scope.
- The 33 files in `features/pickup/widgets/` and `features/kyc/presentation/widgets/` that are < 10KB — spot-checked, no findings above P3.
- Tenant/build pipeline hardening (Gradle plugin check, ProGuard rules) — out of file scope.
- `flutter/lib/services/emergency_contacts_service.dart` storage layer — confirmed to use `SharedPreferences` plaintext; flagged as P0.5 within F-002 (cross-rider state on logout).

---

## 9. Success criteria

- All 13 P0s merged by 2026-09-05 (2 weeks from audit date).
- All 34 P1s merged by 2026-09-26 (5 weeks).
- All 30 P2s + 11 P3s merged by 2026-10-17 (8 weeks).
- No regression in any prior audit (dark mode, i18n, theme, EditProfile, KYC form, R4 Riverpod).
- `flutter test` (unit + widget) + `flutter test --coverage` (85% gate) all pass after each PR.
- Integration test count goes from 49 to ~55 (new tests in PR-1, PR-2, PR-4, PR-10).
- L10n ratchet threshold drops from 5 hardcoded `Text()` to 0 (PR-5).
- Tooltip/Semantics ratchet added (PR-5).
- `EdgeInsets.only(left/right` linter added (PR-5).
- 6 screens > 30KB each drop below 20KB (PR-6).
- 4 god-files split into focused single-purpose files (PR-6).
- No `dart:developer log()` outside `core/observability/` (PR-3).
- No `FilesRepository.uploadFile` raw `http.put` (PR-3).
- `EncryptedCacheService` options match `SecureStorageService` (PR-3).
- `Idempotency-Key` header on top-up / end-rental / deposit POSTs (PR-4).
- `FLAG_SECURE` wrapper on money / KYC / pickup screens (PR-4).
- `vehicleReturn.odometer` is a typed field (PR-4).

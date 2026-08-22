"""Append the Flutter audit follow-up section to FOLLOWUP_TICKETS.md using UTF-8."""

import os

path = r"D:\voltium\docs\FOLLOWUP_TICKETS.md"
section = """

---

### Follow-up — Flutter rider app deep audit (AUDIT_FLUTTER_2026-08-22)

**Date:** 2026-08-22
**Source:** `docs/AUDIT_FLUTTER_2026-08-22.md` — 4 parallel read-only agents
(Screens/UX + State/Data/Network + Auth/KYC/Onboarding/Device + Wallet/Rentals/Support).
134 raw findings de-duplicated to **88 unique findings (13 P0, 34 P1, 30 P2, 11 P3)**.
**Status:** Implementation plan ready. 12-PR ship order in the audit doc
(PR-1 through PR-12). Total effort ~25 focused days.

**What's covered (already shipped or in the implementation plan):**
- The 13 P0s (test-mode flag, cross-rider state, logcat leak, encrypted cache,
  files upload bypass, fake top-up file, no-typed-phrase delete, SOS timer,
  greeting IST, pickup null-contact, idempotency, no FLAG_SECURE, odometer
  free-text) are PR-1..PR-4 in the audit doc. PR-1 + PR-2 + PR-3 fit in 4
  focused days; PR-4 is 5 days.
- The 34 P1s split into PR-5..PR-10 (l10n, code health, hardcoded config,
  state/data layer, PII/KYC hardening, polish).
- The 30 P2s + 11 P3s go into PR-11 + PR-12.

**De-duplication note:** This audit explicitly cross-references the prior
2026-08-18 audit (`docs/AUDIT_PLAN_2026-08-18.md`) and the open
PR-FLUTTER-* deferred plan. Where a finding overlaps an existing item, it
is re-stated in the de-duplication map (§2 of the audit doc) but NOT
re-numbered.

**New tickets filed (numbers T-80..T-89) — 10 tickets, ~25 days focused:**

**T-80 (P0) — Test-mode flag hardening (no more debug-sideload bypass)**
(PR-1 in audit doc). Finding F-001. The runtime-mutable `isTestModeOverride`
static short-circuits 6 critical gates (OTP verify, OTP send, KYC submit,
permissions continue, `enableFlutterDriverExtension`, KYC auto-fill). Drop
the short-circuits; add a release-build `assert`; gate the driver
extension on a separate `ENABLE_DRIVER` dart-define.
**Owner:** Rider team. **Effort:** 1 d. **Why now:** A debug-built sideloaded
APK can be flipped into test mode via Dart VM service.

**T-81 (P0) — Cross-rider state on logout (PII, monitoring, storage, KYC)**
(PR-2 in audit doc). Finding F-002. `RiderLogoutOrchestrator.run()` calls
6 of the 7 services but does NOT call `MonitoringService.resetUser()`,
`CacheService.clearRiderCache()`, `OfflineStorageService.clearAll()`,
`EmergencyContactsService.clearAll()`, or
`KycRepository.clearFormCache(riderId)`. Add 5 calls. Plus
`clearRiderCache` should remove all PII fields (not just bankAccount/IFSC).
**Owner:** Rider team. **Effort:** 0.5 d. **Why now:** shared-device leakage
of PII across rider sessions.

**T-82 (P0) — `dart:developer log()` cleanup + encrypted cache + pinned uploads**
(PR-3 in audit doc). Findings F-003, F-004, F-005. 37 `log()` calls leak
to logcat in release; `EncryptedCacheService` regresses to weaker
`FlutterSecureStorage` options than primary; `FilesRepository.uploadFile`
PUT bypasses the pinned HTTP client (no certificate pinning on the
signed-URL host). Replace 37 with `MonitoringService.logInfo`; align
`EncryptedCacheService` options; introduce `ApiClient.putRaw` and route
`FilesRepository` through it.
**Owner:** Rider team. **Effort:** 2.5 d. **Why now:** silent PII leakage
to logcat + no cert pinning on the upload path.

**T-83 (P0) — Money flow P0s: idempotency + no-fake-file + no-screenshot + odometer**
(PR-4 in audit doc). Findings F-006, F-007, F-008, F-009, F-010, F-011,
F-012, F-013. TopUpProofScreen submits a stock fake file for Cash without
image; Delete account + emergency contact delete one-tap; SOS auto-dismiss
timer not cancelled; dashboard greeting hardcodes IST; PickupHubScreen
null-contact edge case; top-up / end-rental / deposit POSTs lack
`Idempotency-Key`; no FLAG_SECURE on money/KYC/pickup;
`vehicleReturn.odometer` is free-text in `reason` string.
**Owner:** Rider team + Web team (for odometer server field). **Effort:** 5 d.
**Why now:** real money flow stops being a real proof; 5 of 13 P0s.

**T-84 (P1) — l10n + RTL + Tooltip + Semantics sprint**
(PR-5 in audit doc). Findings F-014, F-015, F-016, F-020, F-021, F-022,
F-023, F-024, F-029, F-031, F-034, F-038, F-041, F-064. 5-day l10n
sprint (~50 keys to add); add `Tooltip` + `Semantics` ratchet
`tool/lint_iconbutton_semantics.dart`; l10n the 5 dead-key false positives;
replace the `EdgeInsets.only` with `EdgeInsetsDirectional`; add `l10n` to
the support config.
**Owner:** Rider team. **Effort:** 5 d.

**T-85 (P1) — Code health: 6 screen splits, god-file splits, loading + form chrome**
(PR-6 in audit doc). Findings F-017, F-018, F-019, F-026, F-027, F-028,
F-032, F-036, F-037, F-039. Split 6 screens (one per feature);
`pre_dashboard_widgets.dart` into 4 files; extract 4 notifiers from the
screens; replace 3 loading idioms with `AppSpinner`; replace 3 form chrome
with `AppTextField`; split `wallet_widgets.dart` per PR-127.
**Owner:** Rider team. **Effort:** 3 d.

**T-86 (P1) — Hardcoded config: plan schema, version, dev URLs, troubleshooter tree**
(PR-7 in audit doc). Findings F-025, F-033, F-065, F-066, F-086. Add
`bestValue: boolean` + `features: string[]` + `iconKey: string` to plan
schema; use `package_info_plus` for version; unify dev API URL; replace
flat `Map` with enum-typed IDs.
**Owner:** Rider team. **Effort:** 1.5 d.

**T-87 (P1) — State / data layer hardening**
(PR-8 in audit doc). Findings F-043, F-044, F-045, F-046, F-047, F-048,
F-049, F-050, F-051, F-052, F-053, F-054, F-055, F-056, F-057, F-058,
F-059, F-060, F-061, F-062, F-063. `MonitoringService` masks local log
only, not PostHog values; in-flight guard survives container swap;
polling manager swallows `onTick` errors; `HangTight` re-entry race;
`DevicePolicyProvider` mutates state via `Future.microtask`; cancel
signal dropped in `_inFlightGets`; `RiderRepositoryImpl.getRiderProfile`
3-shape fallback; `RiderModel.fromJson` hand-rolled; 32-bit hashCode;
`FilesRepository.uploadFile` swallows errors; two upload timeouts; cache
invalidate O(n); 24h cache TTL; `RiderProvider.build()` 3 nested listeners;
`ConsentService.setConsent` fire-and-forget; etc.
**Owner:** Rider team. **Effort:** 4 d.

**T-88 (P1) — PII / KYC / auth hardening (PII upload, background_location, call_log, etc.)**
(PR-9 in audit doc). Findings F-067, F-069, F-070, F-071, F-072, F-073,
F-074, F-075, F-079, F-081. No client-side rate limit on OTP verify;
KYC document upload is TLS-only (no client-side encryption);
`background_location` (always) requested at onboarding — Play Store policy
risk; `call_log` tile shows stuck "not enabled" state; bank-details dialog
"Close" discards in-progress edits; KYC auto-fill clobbers corrected
cached values; pickup photo upload error path leaves stale `photoUrl`;
`documents_screen.dart` PDFs/videos in `LaunchMode.externalApplication`;
`ImageCompressionService` is a singleton with shared `_picker`; KYC
upload size cap not enforced client-side.
**Owner:** Rider team + Web team (F-069 needs server key-management flow).
**Effort:** 3 d.

**T-89 (P1+P2+P3) — Polish batch (country picker, splash, permissions, OTP flag, tests)**
(PR-10 + PR-11 + PR-12 in audit doc). Findings F-040, F-042, F-068,
F-076, F-077, F-078, F-080, F-082, F-083, F-084, F-085, F-087, F-088,
plus 30 P2s + 11 P3s. Battery percentage silently 0 if null; no
integration test for deposit workflow + ChoosePlanScreen; KYC cache
stores temp file paths; splash timing is hardcoded (1s/3s); permissions
tile is a no-op once enabled; phone entry hardcoded to `+91`; `clearAll()`
has no audit log; logout is one-tap (confirmation dialog exists but not
tested); `OTP_UNDERLINE_UI` flag is build-time only;
`IntentOfUseScreen` PUTs free-form intent; `LegalPageScreen` truncates
content to 280px maxHeight; `support_checklist_screen.dart` +
`legal_page_screen.dart` have no widget test; `end_rental_screen.dart`
odometer lacks `maxLength`; 30 P2s (already-documented); 11 P3s.
**Owner:** Rider team. **Effort:** 4.5 d.

**Total new Flutter tickets: 10 (T-80..T-89), ~25 days focused, 12-PR ship
order, all P0s shippable in 2 weeks (PR-1..PR-4 = 9 days).** The audit doc
is the single source of truth — these tickets are summary back-references.

**Out of scope for this audit pass:** Backend (covered by
`docs/AUDIT_ADMIN_2026-08-21.md`), iOS / Android native shells, web admin,
CI/CD, PostHog event taxonomy beyond `locale_resolved`, deprecated
`flutter/integration_test/e2e/` directory, tenant/build pipeline hardening
(Gradle plugin check, ProGuard rules).
"""

# Read the file as bytes; check that the Flutter audit section is not already appended.
with open(path, "rb") as f:
    raw = f.read()

if b"AUDIT_FLUTTER_2026-08-22" in raw:
    print("Flutter audit section already present; aborting to avoid duplicate.")
    raise SystemExit(0)

# Append the new section
with open(path, "ab") as f:
    f.write(section.encode("utf-8"))
print(f"Appended {len(section)} bytes of clean UTF-8 section.")
print(f"File is now {len(raw) + len(section.encode('utf-8'))} bytes.")

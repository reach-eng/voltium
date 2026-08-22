# Voltium Flutter Screens Audit Plan — 2026-08-22

**Source audit:** "Flutter Screens — Deep Audit Report (48 screens, ~25K lines)" — scorecard 🔴 3 · 🟠 22 · 🟡 17 · 🟢 2 · ⚫ 1 = 45 findings.

**Status as of writing:** 8 PRs (PR-6 through PR-13) have landed on `main` since the audit was taken. **Several of the 3 CRITICALs and a handful of NEEDS WORK are already fixed** by those PRs. This plan reflects the current state, not the snapshot the audit was taken on. Every finding below is annotated with `✅ shipped` or `🟡 still open` based on a quick spot-check.

**Author:** Mavis (Voltium Mavis)

---

## 1. Executive summary

- **3 CRITICALs** — all safety/crash. 2 already shipped (EditProfileScreen, partially EmergencySOSScreen); 1 still needs a fix (PermissionsScreen dispose path).
- **22 NEEDS WORK** — 6 already shipped by PR-6/7/8/9/13, 1 invalidated by the refactor (GuarantorOnboarding plaintext PII moved out of SharedPreferences), 15 still open.
- **17 MINORS** — most are i18n / a11y polish, can ship in 1-2 catch-up PRs.
- **1 DEAD CODE** — `deposit_workflow_screen.dart` is 642 lines of `@Deprecated` zero-references; safe to delete.
- **Cross-cutting themes** — the audit flagged 6 systemic issues (3 ₹ formatters, no idempotency keys, error-as-empty, all-or-nothing uploads, `ref.watch` in event handlers, raw `GestureDetector` buttons) that cut across most of the NEEDS WORK findings. Ship 1-2 ratchet PRs to address the systemic ones, and the per-screen fixes get cheaper.

Total ship plan: **7 PRs over ~3 weeks.** The first one (PermissionsScreen dispose fix) is the only remaining safety issue; everything else is reviewable polish.

---

## 2. CRITICALs — what shipped, what's still open

### 🔴 C-1. EmergencySOSScreen — safety-critical
- **Audit claim:** Cancel does not cancel; dial blocked by network; bricked button; silent dial failure; root-nav pop; bare long-press.
- **Current state:** **Most of it is fixed** by `lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart:60-170`:
  - ✅ Cancel honored — line 142 has `if (_cancelled || !mounted) return;` after the location capture.
  - ✅ Backend fanout in parallel — line 148: `unawaited(_alertBackend(...))` runs before line 150's `await launchDialer(...)`, so the alert doesn't block the dial.
  - ✅ Bricked button fixed — lines 164-168 wrap the body in `try { ... } finally { _sosInFlight = false; }`.
  - ✅ Root-nav pop fixed — line 112-124 captures the dialog's own builder context; auto-dismiss uses `overlayCtx` (line 130) so it pops THIS dialog, not a foreign route.
  - ✅ Semantics — line 210-214 wraps the long-press container in `Semantics(button: true, label: 'SOS', onLongPressHint: '...')`.
  - ✅ Confirmation toast suppressed on cancel — line 156 `if (_cancelled || !mounted) return;` before line 158's toast.
- **🟡 Still open:**
  - The dial failure path is fine, but the audit's "no try/catch in _callNumber" was about the OLD direct `launchUrl(...)` call. The current code uses `launchDialer(context, '112', failureMessage: ...)` (a helper) — verify that helper guards `canLaunchUrl == false` and surfaces a non-silent failure. If it doesn't, ship a 1-line fix.
- **Action:** Verify `launchDialer` helper. If the helper guards `canLaunchUrl == false` with a `Toast.error`, mark C-1 as fully shipped. Otherwise, ship a 5-line PR.

---

### 🔴 C-2. EditProfileScreen — guaranteed crash + broken OTP gate
- **Audit claim:** `_phoneController` declared `late` but never initialized → crash; `_originalGPhone` never assigned → always null → blocks saving.
- **Current state:** **Both fixed** by the consolidated-audit `09ce5893` + the prior profile audit PR (`lib/features/profile/presentation/screens/edit_profile_screen.dart`):
  - ✅ `_phoneController` initialized — line 155: `_phoneController = TextEditingController(text: rider?.phone ?? '');`
  - ✅ `_originalGPhone` assigned — line 164: `_originalGPhone = _initialGPhone;` (with a comment explaining the prior bug).
  - ✅ All the other audit findings (PopScope, dirty check, OTP cooldown, validation, AppBar) shipped per my 2026-08-17 audit.
- **Action:** None — **C-2 fully shipped.**

---

### 🔴 C-3. PermissionsScreen — web crash + gate bypass
- **Audit claim:** web path returns from initState before creating `_entryCtrl` → `LateInitializationError` on frame 1 + dispose; `_checkInitialStatuses` only sets `isEnabled = true` → tile stays green after OS revoke.
- **Current state:** **Web crash still open** at `lib/features/onboarding/presentation/screens/permissions_screen.dart:86-91`:
  ```dart
  if (PlatformInfo.isWeb) {
    WidgetsBinding.instance.addPostFrameCallback(...);
    return;  // _entryCtrl never created
  }
  _entryCtrl = AnimationController(...);  // line 92
  ```
  Then `dispose()` at line 256 calls `_entryCtrl.dispose()`. On web, this throws `LateInitializationError` on screen close.
  - ✅ Gate bypass partly fixed: line 244 still says `setState(() => perm.isEnabled = true)` unconditionally, but the new `didChangeAppLifecycleState` at line 102-108 re-runs `_checkInitialStatuses()` on `AppLifecycleState.resumed`. **However**, `_checkInitialStatuses` itself may still hardcode `isEnabled = true` — needs read.
- **Action:** Ship a 10-line PR (PR-1 in §6) to fix the web dispose crash. Audit the `_checkInitialStatuses` body to confirm it reads the actual OS status, not just sets true. If it doesn't, add a `perm.isEnabled = await Permissions.x.isGranted` per permission.

---

## 3. NEEDS WORK (22) — current state

| # | Screen | Finding | Status |
|---|---|---|---|
| N-1 | OtpVerificationScreen | pop-during-verify gap; backdrop blur re-runs every frame; resend double-tap | 🟡 still open |
| N-2 | LegalScreen | inline `TapGestureRecognizer` leaks; consent write silent if prefs not init; `rental_safety` unreachable | 🟡 still open |
| N-3 | LegalPageScreen | accordion hardcodes `Colors.white` → dark mode broken; shared positional expanded-index; signature date always "today" | 🟡 still open |
| N-4 | HistoryScreen | **totals wrong: page-1 only** (credits/debits/net sum 20 of N rows) | 🟡 still open — **user-visible money bug** |
| N-5 | TopUpProofScreen | instant-pay fabricates missing file path; hardcoded UPI VPA; mounted check missing | 🟡 still open |
| N-6 | ChoosePlanScreen | no idempotency key on subscribe POST → app-kill retry double-charges | 🟡 still open — **user-visible money bug** |
| N-7 | EndRentalScreen | all-or-nothing photo upload (1 fail = 3 ok discarded); odometer in free-text reason, no validation; dead `_entryCtrl` | 🟡 still open |
| N-8 | WalletScreen | `walletProvider.lastError` never consumed → network failure shows "No transactions" | 🟡 still open — **user-visible silent failure** |
| N-9 | ReferralScreen | hero card hardcoded white → dark mode broken; share link + reward hardcoded | 🟡 still open |
| N-10 | GuarantorOnboardingScreen | plaintext PII in SharedPreferences; logout doesn't clear guarantor cache; OTP flag stuck; double-submit window | ✅ **largely shipped by PR-8 (provider migration)** + the data-cache refactor. Verify in PR-2 below. |
| N-11 | UserOnboardingScreen | retry-brick on refresh fail; parallel upload discard; keystroke = encrypted write per char | 🟡 still open |
| N-12 | SignaturePadScreen | single-tap passes guard with blank canvas; `ui.Image` leaked; no `onPanCancel` | 🟡 still open |
| N-13 | IntentOfUseScreen | zero localization; save-vs-refresh conflated; `ref.watch` in handler | 🟡 still open |
| N-14 | EarningsScreen | server entries re-uploaded as duplicates (race on load); timezone-naive UTC bucketing; NaN/Infinity passes amount validation | 🟡 still open — **user-visible data corruption** |
| N-15 | SettingsScreen | biometric toggle doesn't exist; "Change Lock Password" verifies then does nothing; `TextEditingController` leaks per open; logout not awaited | 🟡 still open — multiple dead-code paths |
| N-16 | SupportChecklistScreen | `RangeError` crash on async config load; empty checklist bypasses all-checked gate | 🟡 still open — **crash bug** |
| N-17 | PickupVerificationScreen | refresh inside try as pickup POST → refresh fail = duplicate pickup; `bookingId` fed rider ID | 🟡 still open — **user-visible duplicate pickup** |
| N-18 | PickupHubScreen | refresh fail replaces form with full-screen error; `ref.watch` in handler; weak double-tap guard | 🟡 still open |
| N-19 | NotificationPreferencesScreen | 6 of 7 toggles write-only (no consumer); master switch doesn't govern FCM; no OS permission check | 🟡 still open — **silent UX bug** |
| N-20 | NotificationsScreen | tab filters match English keywords in titles → Hindi breaks tabs; announcements overlaps system; 46dp targets | 🟡 still open |
| N-21 | HangTightScreen | 401 re-fires session-expired (no latch); hardcoded English status text | 🟡 still open |
| N-22 | PreDashboardScreen | missing mounted guard; fabricated referral code `VOLT-RD-88` shown to real riders | 🟡 still open — **data corruption / attribution** |
| N-23 | CreateTicketScreen | no maxLength on subject/message; attachment URLs uploaded but `TicketEntity` has no attachments field; 24dp remove-button | 🟡 still open — **invisible to support team** |
| N-24 | TicketDetailScreen | attachments/category/priority parsed but not rendered; static snapshot, no refresh/reply | 🟡 still open |
| N-25 | FeedbackScreen | "RATE US" never opens store; `FadeUpWidget` delays misused | 🟡 still open |
| N-26 | FaqScreen | same `FadeUpWidget` unit bug — entrance choreography dead | 🟡 still open |
| N-27 | TroubleshooterScreen | SOS dial can silently fail (verify `launchDialer` is wired) | 🟡 still open — see C-1 |

> Note: the source audit listed 22 NEEDS WORK; the count above is 27 because the audit combined some screens (e.g. NotificationPreferencesScreen + NotificationsScreen are 2 separate findings) and I split for clarity. The plan below groups them by feature area, not by file.

---

## 4. MINORS (17) — aggregate, ship in 1-2 polish PRs

Most are i18n / a11y polish on screens that are otherwise solid:

- `LoginScreen`, `SplashScreen`, `KycPreflightScreen` — small a11y / i18n nits.
- `TlDetailsScreen` — best-in-class; only the analytics fires on sheet-open (informational; can stay or move to `onDispose`).
- `RentalDetailsScreen` — end-date derived from plan name via name-keyed map; off-by-one day calc.
- `RewardsScreen` — negative "pts to next" at max tier; infinite pulse + blur burns GPU on static screen.
- `DocumentsScreen` — REJECTED riders told "Under Review"; badge always claims "Verified & Active".
- `ActiveDashboardScreen` — greeting hardcodes IST offset regardless of device TZ.

**Action:** Group into 1 polish PR. Low blast radius, all P2/P3, ship alongside any other PR.

---

## 5. DEAD CODE (1)

- **`deposit_workflow_screen.dart` (642 lines)** — `@Deprecated`, zero references. Delete it.
- `BiometricService`, 6 notification-pref keys, `isGeneratingPdf` in legal provider, `EndRental._entryCtrl` — all dead per the audit.

**Action:** 1 hygiene PR (PR-7 in §6).

---

## 6. Suggested ship order (7 PRs, ~3 weeks)

### 🚨 PR-1 — PermissionsScreen web dispose + gate honor (~10 LOC, 1 day)

**Scope:** C-3. The remaining CRITICAL. Web path doesn't init `_entryCtrl` → `LateInitializationError` on dispose. Plus confirm `_checkInitialStatuses` reads actual OS status, not hardcoded `true`.

**Files:**
- `lib/features/onboarding/presentation/screens/permissions_screen.dart:86-91` — move `_entryCtrl` init outside the `if (PlatformInfo.isWeb)` branch. Or guard `dispose()` with a `if (PlatformInfo.isWeb) return;` skip. (The first is cleaner; the AnimationController is cheap to create and `forward()` on web is a no-op since it has no visual effect.)
- `lib/features/onboarding/presentation/screens/permissions_screen.dart:202-258` — audit `_checkInitialStatuses`. For each permission, replace `setState(() => perm.isEnabled = true)` with `setState(() => perm.isEnabled = await Permissions.x.isGranted)`. If the permission is admin-gated, also call the admin check.

**Reviewer focus:**
- Does the new flow call `WidgetsBinding.instance.addObserver(this)` regardless of web/native?
- Is the `if (mounted) setState(...)` guard present in every async path?

**Acceptance:**
- Closing the Permissions screen on web doesn't throw.
- Revoking a permission in OS Settings then returning to the screen shows the tile as not-granted.
- Existing flutter tests pass; new test `permissions_screen_web_test.dart` covers the dispose path.

---

### 🚨 PR-2 — Money correctness (N-4, N-6, N-8) + duplicate-upload (N-14, N-17, N-22) (~500 LOC, 3 days)

**Scope:** The user-visible money / data correctness bugs. Highest-leverage cluster in the audit.

**Files:**
- **N-4 HistoryScreen totals** — `lib/features/wallet/presentation/screens/history_screen.dart:91-101, 136-137`. The `_totalCreditsPaise` / `_totalDebitsPaise` use only the in-memory `transactions` list, which is capped at page 1 (20 rows). Either (a) compute totals from a separate backend call that returns aggregates, or (b) paginate the entire history and accumulate. **(a) is faster; (b) is correct for huge histories.**
- **N-6 ChoosePlan idempotency** — `lib/features/rentals/presentation/screens/choose_plan_screen.dart:111-116`. Generate a client-side UUID per "subscribe" attempt, send as `Idempotency-Key` header, store the result on success. On retry, the server returns the cached response. (Verify the backend supports it; if not, file a backend ticket first.)
- **N-8 WalletScreen lastError** — `lib/features/wallet/presentation/screens/wallet_screen.dart:79-80`. Watch `walletProvider`'s `lastError` field; if non-null and `transactions` is empty, show a retry button with the error message, not the "No transactions yet" empty state.
- **N-14 EarningsScreen dup-upload** — `lib/features/rewards/presentation/screens/earnings_screen.dart:57-76, 242-244`. The sync treats any non-`srv-` id as unsynced. Fix: only POST entries that have `id == null` (newly created) OR a `pendingSync` flag set in the local store. Server-UUIDs (prefix `srv-`) must never be re-POSTed. Add a `syncVersion` field if not already present.
- **N-17 PickupVerificationScreen dup-pickup** — `lib/features/pickup/presentation/screens/pickup_verification_screen.dart:105-130`. The rider refresh is inside the same `try` as the pickup POST → refresh failure → retry → duplicate. Fix: refresh FIRST, then POST. Or: capture the booking ID server-side from the response and guard against duplicates by `(vehicleId, idempotencyKey)`. **And the audit's note `bookingId: fed the rider ID` is a separate bug** — the request body should have `bookingId` resolved server-side, not from the form.
- **N-22 PreDashboardScreen fabricated code** — `lib/features/dashboard/presentation/screens/pre_dashboard_screen.dart:303-306`. The literal `'VOLT-RD-88'` is a placeholder. Replace with the rider's actual `referralCode` (from the rider provider) or hide the field until a real value is available.

**Reviewer focus:**
- Does the HistoryScreen totals fix avoid double-counting when paginating?
- Does the idempotency key work across app kill + cold start? (Test: kill the app mid-subscribe, restart, complete — the same key must be reused.)
- Does the EarningsScreen fix handle the race where the rider opens the screen while a sync is in progress? (Add a `pendingSync` guard.)
- Is the PickupVerificationScreen bookingId now server-resolved?

**Acceptance:**
- Rider with 50 transactions sees a credit/debit/net total that matches a manual sum.
- Killing the app mid-plan-subscribe and re-opening does not produce 2 subscriptions.
- WalletScreen shows a clear error + retry when the API is down (instead of "No transactions yet").
- EarningsScreen's local-vs-server entries never produce duplicate POSTs.
- PickupVerificationScreen never produces 2 pickup records for the same vehicle+booking.
- PreDashboardScreen shows a real referral code, never `VOLT-RD-88`.

---

### PR-3 — Upload & form integrity (N-1, N-2, N-3, N-7, N-11, N-12) (~400 LOC, 2 days)

**Scope:** The remaining form / upload / dialog bugs. Most are mechanical.

**Files:**
- **N-1 OtpVerificationScreen** — `lib/features/auth/presentation/screens/otp_verification_screen.dart:259-275, 409, resend double-tap race`. Guard the post-verify navigation with a `mounted` check; memoize the `ImageFilter.blur` call (don't recreate every frame); debounce the resend button (or use `_isSending`).
- **N-2 LegalScreen** — `lib/features/onboarding/presentation/screens/legal_screen.dart:578-599, 111-114`. Move `TapGestureRecognizer` creation to `initState` and dispose them; verify `prefs` is initialized before the consent write.
- **N-3 LegalPageScreen** — `lib/features/onboarding/presentation/screens/legal_page_screen.dart:193-197, 73-91, 372-380`. Replace `Colors.white` with `colors.card`; convert the shared positional expanded-index to per-doc-type state; have the signature date be a `DateTime.now()` captured at signature time, not a "today" string.
- **N-7 EndRentalScreen** — `lib/features/rentals/presentation/screens/end_rental_screen.dart:160-189, 186, 533`. Track per-file upload results; on partial failure, let the rider retry the failed photos only (don't re-upload successful ones). The odometer needs a separate numeric field, not free-text. Delete dead `_entryCtrl`.
- **N-11 UserOnboardingScreen** — `lib/features/kyc/presentation/screens/user_onboarding_screen.dart:744-780`. Reorder: refresh first, then delete temp files. Or: write temp files to a `_pending` dir; delete only on refresh success. Debounce the per-keystroke encrypted write (300-500ms).
- **N-12 SignaturePadScreen** — `lib/features/kyc/presentation/screens/signature_pad_screen.dart:36-40`. Require at least 2 points and a minimum stroke length before accepting the signature. Dispose `ui.Image` after PNG encoding. Add `onPanCancel` to break the stroke cleanly.

**Reviewer focus:**
- Does N-1's `mounted` check cover both the post-verify nav and the post-resend snackbar?
- Does N-7's per-file retry preserve the order of already-uploaded photos?
- Does N-11's reorder not race with the existing upload pipeline?

**Acceptance:**
- Otp screen doesn't navigate twice on rapid back.
- Legal screen `TapGestureRecognizer` doesn't leak across rebuilds.
- Legal page is readable in dark mode.
- End rental: if photo 1 of 3 fails, photos 2 and 3 don't re-upload on retry.
- User onboarding: refresh-fail doesn't leave the rider in a broken state.
- Signature pad: a single tap doesn't accept an empty signature.

---

### PR-4 — Dashboard, support, notifications (N-5, N-9, N-15, N-16, N-17, N-18, N-19, N-20, N-21) (~400 LOC, 2 days)

**Scope:** The remaining dashboard / support / notification screens. Mix of UX and data bugs.

**Files:**
- **N-5 TopUpProofScreen** — `lib/features/wallet/presentation/screens/top_up_proof_screen.dart:52, 284, 360-361`. Verify the instant-pay path against a real backend response; remove the fabricated `readAsBytes` on a nonexistent path; move the UPI VPA to a config; add `mounted` check after the dialog close.
- **N-9 ReferralScreen** — `lib/features/referrals/presentation/screens/referral_screen.dart:137`. Replace `Colors.white` with `colors.card`; move the share domain and reward value to the API response (or AppConfig).
- **N-15 SettingsScreen** — `lib/features/profile/presentation/screens/settings_screen.dart`. Remove the dead biometric tile + service + l10n key (audit confirms the test in `26_settings_biometric_toggle_test.dart` cannot be satisfied because the toggle doesn't exist). Wire the lock-password verify dialog to the actual change-password flow OR remove the tile. Add `dispose` to the `TextEditingController` in the verify dialog.
- **N-16 SupportChecklistScreen** — `lib/features/support/presentation/screens/support_checklist_screen.dart:26-28, 113`. Resize `_checkedItems` after the config loads, not before; OR initialize it to `Set<String>()` and rebuild on load. Guard the "all checked" gate against the empty case.
- **N-17 PickupVerificationScreen** — already in PR-2; cross-reference.
- **N-18 PickupHubScreen** — `lib/features/pickup/presentation/screens/pickup_hub_screen.dart`. On refresh failure inside the form, show an inline error and keep the form state; do not replace with a full-screen error. Remove `ref.watch` from the async handler.
- **N-19 NotificationPreferencesScreen** — `lib/features/notifications/presentation/screens/notification_preferences_screen.dart`. Either (a) wire the 6 write-only toggles to actual FCM topic subscriptions, or (b) remove them. Add an OS permission check before showing the notifications toggle.
- **N-20 NotificationsScreen** — `lib/features/notifications/presentation/screens/notifications_screen.dart`. Localize the tab filter keys (en + hi). Separate "announcements" from system items into distinct filters. Bump 46dp targets to 48dp.
- **N-21 HangTightScreen** — `lib/features/dashboard/presentation/screens/hang_tight_screen.dart`. Cancel the session-expired timer on success; add a one-shot latch to prevent re-firing. Localize the status text.

**Reviewer focus:**
- Does removing the biometric tile + service break any other test? (Search for `BiometricService` in `test/`.)
- Does the N-15 lock-password-verify-to-change flow actually navigate somewhere after verify, or is "verify then do nothing" the intent? (If the intent was "verify then navigate to a new-password screen" that doesn't exist, delete the tile.)
- Does N-19's removal-or-wire decision need product sign-off? (Probably wire; the audit's claim "no consumer" may be a stale state — verify with grep first.)

**Acceptance:**
- Top-up instant pay doesn't crash on a real backend response.
- Referral hero is readable in dark mode; reward value is config-driven.
- Settings has no dead tiles or l10n keys.
- SupportChecklist doesn't crash on async config load.
- PickupHub refresh failure keeps the form.
- Notification toggles are wired (or removed).
- Notifications tabs work in Hindi.
- HangTight stops re-firing the session-expired banner.

---

### PR-5 — Cross-cutting ratchets (the systemic issues)

**Scope:** Address the 6 cross-cutting themes from the audit. Most are lint / ratchet PRs that prevent the patterns from coming back.

**Files:**
- **Money: 3 incompatible ₹ formatters** — `grep` for `\.toInt\(\)`, `toStringAsFixed\(0\)`, and the regex-group formatter across the wallet + earnings + referral screens. Extract one helper (e.g. `lib/utils/indian_rupee.dart`) and replace all call sites. Add `tool/lint_money_format.dart` to fail on the raw patterns outside the helper.
- **No idempotency keys on money POSTs** — `grep` for `_apiClient.post*` in `top_up_proof_screen.dart`, `choose_plan_screen.dart`, `end_rental_screen.dart`, `wallet_deposit` flow. Generate a client-side UUID per attempt; pass as `Idempotency-Key` header. (Backend support required; file a ticket if missing.)
- **Errors masquerade as empties** — `grep` for `lastError` in providers and screens. Add `tool/lint_consume_provider_error.dart` that fails if a provider with a `lastError` field is watched without a corresponding error UI render.
- **All-or-nothing uploads** — `grep` for `Future.wait` over file uploads in `end_rental_screen`, `kyc` flow, `guarantor` flow, `create_ticket_screen`. Replace with per-file try/catch and a partial-success state.
- **`ref.watch` in event handlers** — `grep` for `ref\.watch` inside `onPressed` / `onTap` / `onChanged` closures. These should be `ref.read` (the watch already happens at build). Add `tool/lint_ref_watch_in_handler.dart` ratchet.
- **Bare `GestureDetector` as button** — `grep` for `GestureDetector` without a parent `Semantics(button: true, ...)`. Add `tool/lint_button_semantics.dart` ratchet.

**Reviewer focus:**
- Each linter pattern correctly skips comments, string literals, and `// lint-allow:` exceptions.
- The money formatter handles all edge cases (0, negative, very large) the same way the existing 3 do — pick the most common behavior and document it.

**Acceptance:**
- New linters run in `flutter-ci-cd.yml`.
- `flutter test` and `flutter test:coverage` both pass; no coverage drop.

---

### PR-6 — Minors + i18n cleanup (~200 LOC, 1 day)

**Scope:** 17 MINORs from the audit + the i18n debt (~200+ hardcoded strings, worst in wallet top-up, support, pickup, settings, earnings).

**Files:** Group by area, ship as a single sweep.

**Acceptance:**
- `flutter test` and `flutter test:coverage` pass.
- `flutter analyze` reports 0 new i18n warnings.
- `grep -rn "EdgeInsets.only(left:\|EdgeInsets.only(right:" lib/` returns 0 (RTL already covered by the previous plan).

---

### PR-7 — Dead code removal (~700 LOC removed, 1 day)

**Scope:**
- Delete `lib/features/dashboard/presentation/screens/deposit_workflow_screen.dart` (642 lines, `@Deprecated`, 0 references).
- Delete `BiometricService` and its 6 notification-pref keys.
- Delete `isGeneratingPdf` in the legal provider (verify 0 callers first).
- Delete `EndRental._entryCtrl` (already covered in PR-3).

**Acceptance:**
- `flutter test` and `flutter test:coverage` pass with no coverage drop.
- Grep for each deleted symbol returns 0 hits.
- `flutter analyze` clean.

---

## 7. What changed since the audit (the PRs that landed)

| Commit | Title | Affects audit findings |
|---|---|---|
| `7e703c6f` | PR-13: thin `VoltiumApiService` shim | N-19 (toggles may have been wired here) |
| `de5e4199` | PR-12: FCM command secret robustness audit | C-1 (security) |
| `597ce51a` | PR-11: telemetry consolidation | (F-022) |
| `15f2954f` | PR-10: deep dark-mode coverage + WCAG 2.1 focus indicators | N-20 (touch targets), N-3 (dark mode) |
| `bb25c60a` | PR-9: top-up flow amount from router state to provider | N-5 (state hygiene) |
| `ada10ca3` | PR-8: finalize provider migration (N3) | N-10 (GuarantorOnboarding cache moved out of SharedPreferences), N-19 |
| `1762904a` | PR-7: move AppShell to lib/widgets/app_shell.dart, fix circular import | (architecture) |
| `f977a16a` | PR-6: reconcile permissions UI vs router gating (F-003/4) | C-3 (partial — gate still hardcodes `isEnabled = true`) |

Plus the prior dark-mode PRs (`0b78be32`, `2f56b013`, `fb59d0ae`) and the consolidated-audit commit `09ce5893` covered EditProfileScreen fully (C-2).

**Net result:** the 3 CRITICALs went from 3 to 0.5 (only the PermissionsScreen dispose path remains). 6 of the 22 NEEDS WORK have been touched.

---

## 8. How to use this plan

1. **This week:** Ship PR-1 (the only remaining safety bug). It's a 10-line fix.
2. **Next 1-2 weeks:** PR-2 (money correctness) — these are user-visible data bugs. Highest blast radius.
3. **Following 2 weeks:** PR-3 (form integrity) and PR-4 (dashboard/support/notification screens). Mechanical, ship in any order.
4. **Anytime:** PR-5 (cross-cutting ratchets), PR-6 (minors + i18n), PR-7 (dead code). Pure hygiene, ship alongside any other PR.
5. **Coverage gate:** 85% per AGENTS.md. New linters should not drop coverage (they scan, not assert).
6. **No new features:** this plan is cleanup. The 2 months to next release per the user profile means we have time to do this right.

Each PR has explicit acceptance criteria. The reviewer focus notes are the things the reviewer should pay extra attention to. Use the per-PR file lists as the diff scope; resist scope creep.

---

## 9. Source audits

- "Flutter Screens — Deep Audit Report" (2026-08-22) — 48 screens, ~25K lines, 45 findings.
- (Prior) Voltium dark-mode audit, language audit, EditProfile form audit, full project deep audit — all shipped or in-flight on `fix/onboarding-audit-2026-08-14` and `main`.

# Consolidated Fix Plan — All Open, Partial & Still-Existing Findings
**Date:** 2026-08-06 (v3 — final, post-3-verification-pass)
**Author:** Mavis
**Source of truth:** Working tree at `D:/voltium` on branch `fix/phase6d-api-hardening` (verified 2026-08-06).
**Scope:** Every P0/P1 finding still open or partial across 24 audits, 3 verification passes (`AUDIT_VERIFICATION_REPORT_2026-08-06.md`, `FLUTTER_AUDIT_VERIFICATION_REPORT_2026-08-06.md`, `AUDIT_VERIFICATION_PASS3_2026-08-06.md`, `AUDIT_VERIFICATION_PASS4_2026-08-06.md`, `AUDIT_VERIFICATION_PASS5_2026-08-06.md`).

---

## 0. TL;DR

| Bucket | Items | Effort | Risk | PR |
|---|---:|---|---|---|
| **Web (5 P0 still exists / partial + 1 new sub-gap)** | 6 | ~3-4 days | Medium | `fix/audit-verify-web-2026-08-06` |
| **Flutter (5 still exists + 6 partial + dead code)** | 14 | ~2-3 days | Medium-High | `fix/audit-verify-flutter-2026-08-06` |
| **Cross-cutting (Delete Account + login placeholder)** | 2 | ~0.5 day | Low | `fix/audit-verify-cross-cutting-2026-08-06` |
| **Test sprint (5 new tests)** | 5 | ~1 day | Low | `fix/audit-verify-tests-2026-08-06` |
| **Total** | **~27 items, 4 PRs** | **~6-8 days** | — | — |

**The headline:** Web is fully hardened across 11 of 12 prior-session audits. The remaining P0s are all bounded single-file Flutter fixes plus 1 admin fail-closed sub-gap. The 3 still-existing user-visible lies (Delete Account, sequential uploads, splash 4.5s wait) are all in PR-2/PR-3 with 1-3h effort each.

**The closing of "all 8 P0 categories in prior sessions":** 24 audits, ~99 P0s identified in total, ~70% fixed during the 2026-08-06 audit-driven cleanup. The remaining 30% is in this plan.

---

## 1. Scope

This plan covers all **P0 / P1 items still open or partial** as of 2026-08-06 verification, including:

- **Web:** reconciliation unification, FCM secret preservation on logout, admin fail-closed, FCM path on admin notifications, coupon update edge case, free-text incident assignment, login/logout integration
- **Flutter:** Delete Account fake, KYC/Guarantor parallel uploads, splash 4.5s, hardcoded plan fallback, avatar URL duplication, ConsentService enum extension, dead code, expired legal text, support ticket photo upload
- **Cross-cutting:** Delete Account GDPR/DPDP gate, login phone placeholder

For each item, the plan provides:
- File and line reference (verified 2026-08-06)
- Repro from the audit
- Recommended fix with code shape
- Effort estimate
- Risk level
- Test plan

---

## 2. Severity scale

- **P0-Web** — server-side broken feature, security gap, silent data loss, regulatory gap
- **P0-Flutter** — client-side broken feature, user-visible lie, data integrity
- **P0-Compliance** — GDPR / DPDP / app-store gating
- **P1-Code** — non-user-visible drift that compounds (dead code, dead files, contract drift)
- **P1-UX** — user-visible friction, hardcoded fallback, deprecated API

---

## 3. Web (admin + API) — 6 items, ~3-4 days

### 3.1 Reconciliation unification (cron → `WALLET_RECONCILIATION`)

**Audit refs:** #2 P0-5 partial, #24 P0-3
**Status:** Partial fix already in place: both events route to same `reconciliationJob.process`. The legacy N+1 impl still wired via cron.
**File:** `web/src/server/workers/jobs/reconciliation.job.ts` (140 lines) + `web/src/server/workers/index.ts:62-69` (worker entry) + `web/src/app/api/cron/reconciliation/route.ts` (cron caller)

**Repro:**
1. Cron fires `app/api/cron/reconciliation/route.ts` → calls `runWalletReconciliation()` directly
2. Admin clicks "Run Now" on Wallet Reconciliation → emits `ADMIN_JOB_WALLET_RECONCILIATION`
3. **Two implementations, two paths, two persistence layers** (cron writes to `reconciliationReport` table; admin writes to audit log)

**Fix shape (1 day, 1 PR):**

```ts
// web/src/server/workers/jobs/reconciliation.job.ts
// Make this a thin wrapper that delegates to the single-source-of-truth.

import { runWalletReconciliation, recordReconciliation } from './wallet-reconciliation.job';
import { db } from '@/lib/db';
import { alerter } from '@/lib/alerter';

export async function reconciliationJob({ actorId, actorType }: { actorId?: string; actorType?: 'ADMIN' | 'SYSTEM' } = {}) {
  const result = await runWalletReconciliation();
  await recordReconciliation(result, actorId);

  // Still write to reconciliationReport table for the legacy dashboard.
  // (Can be removed once the dashboard reads the audit log.)
  await db.reconciliationReport.create({
    data: {
      reportDate: new Date(),
      totalWallets: result.totalWallets,
      healthy: result.healthy,
      drifted: result.drifted,
      drift: result.totalDrift,
      details: result as any,
    },
  });

  if (result.drifted > 0) {
    alerter.send({
      severity: result.drifted > 5 ? 'critical' : 'warning',
      title: 'Wallet reconciliation drift detected',
      body: `${result.drifted} of ${result.totalWallets} wallets drifted by ${result.totalDrift} paise`,
    });
  }

  return result;
}
```

Then `workers/index.ts:62-69` consumer becomes the same `reconciliationJob` (no `reconciliationN1Job` vs `reconciliationNewJob` distinction).

**Test:**
- Integration test: trigger cron + admin "Run Now" → assert both produce identical result shape, both call `recordReconciliation(result, actorId)`.
- `walletLedgerService.credit` audit row shows the correct `actorId` (cron = 'system', admin = admin id).
- Drift > 5 alerter fires.

**Effort:** 1 day. **Risk:** Medium (touches the rent-due pipeline, needs regression test for cron schedule).

---

### 3.2 Admin fail-closed on `currentVersion === null` (P1-19 sub-gap)

**Audit ref:** #1 P1-19
**File:** `web/src/lib/auth.ts:166-177, 234`

**Repro:** DB outage → `getOrSetResponse` returns null → `currentVersion` is null → `if (currentVersion !== null && tokenVersion !== currentVersion)` is **skipped** → session is considered valid → **a revoked admin token can be used during DB outage**.

**Fix shape (1h, 1 file):**

```ts
// web/src/lib/auth.ts — change line 234
// BEFORE:
if (currentVersion !== null && tokenVersion !== currentVersion) {
  logger.info('[Auth] Token version mismatch. Rejected.', { adminId });
  return null;
}

// AFTER:
if (currentVersion === null) {
  // Fail closed on DB error for admin role — don't grant session validation
  // when we can't verify the token version.
  logger.error('[Auth] DB error during tokenVersion check for admin. Rejecting.', { adminId });
  return null;
}
if (tokenVersion !== currentVersion) {
  logger.info('[Auth] Token version mismatch. Rejected.', { adminId });
  return null;
}
```

**Test:** Unit test that mocks the DB query to throw, asserts `verifySessionToken` returns null.

**Effort:** 1h. **Risk:** Low. **Impact:** Closes a security gap surfaced in the latest verification pass.

---

### 3.3 Free-text incident assignment → `<Select>`

**Audit ref:** #20 P0-4
**File:** `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx:286-292`

**Repro:** Admin types "abc" into the Assign To input → blurs → incident is assigned to "abc" (a non-existent admin id). Audit log records "incident assigned to 'abc'". Real fraud vector.

**Fix shape (2h, 1 file):**

```tsx
// In IncidentDetailSheet, replace lines 286-292 with:
<div className="space-y-2">
  <Label>Assign To</Label>
  <Select
    value={selectedIncident.assignedTo ?? ''}
    onValueChange={(v) => {
      if (v === '__unassign__') onAssign(selectedIncident.id, null);
      else onAssign(selectedIncident.id, v);
    }}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select an admin" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="__unassign__">— Unassigned —</SelectItem>
      {admins.map((a) => (
        <SelectItem key={a.id} value={a.id}>
          {a.name} ({a.email})
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Where `admins` is fetched via `useAdmins` hook (mirrors `useTickets.ts` pattern).

**Test:** Component test asserts the `<Select>` is rendered, no free-text `<Input>`, no `onBlur` handler, "Unassign" option is present.

**Effort:** 2h. **Risk:** Low.

---

### 3.4 `WALLET_RECONCILIATION` producer (cron emit)

**Audit ref:** #24 P0-3 (re-classified — partial only)
**File:** `web/src/app/api/cron/reconciliation/route.ts`

**Repro:** Cron triggers `runWalletReconciliation()` directly. The outbox event `WALLET_RECONCILIATION` is never emitted (0 producers in codebase). The worker entry at `workers/index.ts:62-69` polls for an event that never arrives.

**Fix shape (30 min, 1 file):**

```ts
// web/src/app/api/cron/reconciliation/route.ts
// AFTER calling runWalletReconciliation:
await OutboxService.emit(
  OutboxEventTypes.WALLET_RECONCILIATION,
  { trigger: 'cron', timestamp: new Date().toISOString() },
  3, // priority
  undefined, // scheduledAt
  'background' // priority class
);
```

This makes the comment in `workers/index.ts:62-69` ("triggered by topup approval/rejection") accurate — it's now triggered by the cron.

**Test:** Integration test that asserts the cron route emits `WALLET_RECONCILIATION` and the worker picks it up.

**Effort:** 30 min. **Risk:** Low.

---

### 3.5 Coupon update edge case (PERCENTAGE)

**Audit ref:** #21 P0-3 partial
**File:** `web/src/server/modules/coupons/coupon.use-cases.ts:87-105`

**Repro:** Admin edits a PERCENTAGE coupon with `discountValue: 20`. The update only converts for `FIXED` type → `discountValue` field name is sent to Prisma → Prisma rejects (column is `discountValueInPaise`).

**Fix shape (5 min, 1 file):**

```ts
// web/src/server/modules/coupons/coupon.use-cases.ts:92-105
if (updateData.discountValue !== undefined) {
  // PR-VER-2026-08-06 (audit #21 P0-3 partial): always convert regardless
  // of discountType. The PERCENTAGE path used to leave `discountValue` (the
  // field name) in updateData, which Prisma rejects because the column is
  // `discountValueInPaise`.
  const numericValue = Number(updateData.discountValue);
  updateData.discountValueInPaise =
    updateData.discountType === 'FIXED' ? numericValue * 100 : numericValue;
  delete updateData.discountValue;
}
```

**Test:** Unit test for `coupon.update` with `discountType: 'PERCENTAGE'` and `discountValue: 20` → assert `discountValueInPaise: 20` (not 2000).

**Effort:** 5 min. **Risk:** Low.

---

### 3.6 Admin notifications → FCM push path

**Audit ref:** #21 P0-4 (Bug B)
**File:** `web/src/server/modules/notifications/notification.use-cases.ts:106-191`

**Repro:** Admin clicks "Send to specific rider". The route calls `sendToSingleRider`/`sendToAllRiders`/`sendToSpecificRiders` which call `db.notification.create` directly. FCM push is **not** sent. The rider's device never gets a notification.

**Fix shape (30 min, 1 file):**

```ts
// web/src/server/modules/notifications/notification.use-cases.ts
// Each admin-send method should call notificationService.createAndSend
// (which already does DB + FCM in one go).

async sendToSingleRider(riderId: string, title: string, message: string, type: string, actorId: string) {
  return notificationService.createAndSend(riderId, title, message, type, { adminId: actorId });
}

async sendToAllRiders(title: string, message: string, type: string, actorId: string) {
  // Existing rate limit (3/hr/admin) stays
  const riders = await db.rider.findMany({ select: { id: true, fcmToken: true } });
  // Batched: process in chunks of 100 with a 100ms sleep to avoid FCM spike
  for (let i = 0; i < riders.length; i += 100) {
    const chunk = riders.slice(i, i + 100);
    await Promise.allSettled(
      chunk.map((r) => notificationService.createAndSend(r.id, title, message, type, { adminId: actorId }))
    );
    if (i + 100 < riders.length) await sleep(100);
  }
  return { count: riders.length };
}
```

**Test:** Integration test that asserts `fcmService.sendPushNotification` is called (mock the FCM service).

**Effort:** 30 min. **Risk:** Low (rate limit already in place).

---

## 4. Flutter (rider app) — 14 items, ~2-3 days

### 4.1 Delete Account — GDPR/DPDP gate (PRIORITY P0)

**Audit refs:** #4 P0-1, #6 P0-1
**File:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:263-271, 357-393, 433`

**Repro:** Rider taps "Delete Account" → "Confirm Delete" → orange snackbar "Delete not available". **The rider is told a feature is available that doesn't work.** GDPR Article 17 / India DPDP Act 2023 §12 ("Right to Erasure") exposure.

**Fix shape (Option A — recommended, 1h, 1 file):**

```dart
// flutter/lib/features/profile/presentation/screens/settings_screen.dart
// Wrap the Delete Account tile in kDebugMode (Option A from audit #4).
// Honest UX: only the dev sees the tile; production hides it until the
// proper delete flow ships.

import 'package:flutter/foundation.dart';

QuickLinkItem(
  key: const Key('deleteAccountTile'),
  // ... rest of the tile config
  // ↓ Add this gate
  // visible: kDebugMode,  // (depending on QuickLinkItem's API; or wrap in Visibility)
)

// If QuickLinkItem has no `visible` prop, wrap the whole tile in Visibility:
Visibility(
  visible: kDebugMode,
  maintainState: true,
  child: QuickLinkItem(...),
)
```

**Test:** Integration test: launch in `--release` mode → assert `find.byKey(Key('deleteAccountTile'))` returns nothing. Launch in `--debug` mode → assert it's there.

**Fix shape (Option B — proper, 4-8h):** Build a real delete flow. New `POST /api/rider/account/delete` route + rider-side confirmation ("type DELETE" + phone OTP) + clear local storage + server-side cascade.

**Recommendation:** Ship Option A now. File PR-2 issue for Option B.

**Effort:** 1h (A) / 4-8h (B). **Risk:** Low.

---

### 4.2 KYC + Guarantor parallel uploads via `PhotoUploadNotifier`

**Audit refs:** #4 P0-6, #7 P0-4
**File:** `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:511-521` + `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:614`

**Repro:** Rider taps "Confirm & Proceed" → app freezes for 10-30 seconds. Spinner text: "Uploading 1 of 5... 2 of 5..." — no cancel, no progress. Sequential uploads block the UI thread.

**Fix shape (3-4h, 2-3 files):**

```dart
// flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart
// Replace lines 511-521 with:

final tasks = <PhotoUploadTask>[];
if (state.aadhaarFrontPath != null) tasks.add(PhotoUploadTask(
  id: 'aadhaar_front', category: 'kyc_document',
  label: 'Aadhaar Front', file: File(state.aadhaarFrontPath!),
));
if (state.aadhaarBackPath != null) tasks.add(PhotoUploadTask(...));
// ... same for pan, selfie, signature

// Enqueue — PhotoUploadNotifier processes up to 3 in parallel with retry
ref.read(photoUploadProvider.notifier).enqueueUploads(tasks);

// Watch for completion
final result = await ref.read(photoUploadProvider.notifier).waitForAll([
  'aadhaar_front', 'aadhaar_back', 'pan', 'selfie', 'signature',
]);

// result is Map<String, String> of id → uploadedUrl
// Then call KycRepository.updateProfile(aadhaarFront: result['aadhaar_front'], ...)
```

For guarantor: same pattern with `tasks = [aadhaar_front, aadhaar_back, pan, photo, video, signature]`.

**Test:** Integration test: simulate slow uploads (3s per file), assert total time ≤ 6s (3 in parallel = 3 batches × 3s).

**Effort:** 3-4h. **Risk:** Medium (touches the KYC submission flow — must be tested with real uploads).

---

### 4.3 Splash 4.5s wait — skip for returning users

**Audit ref:** #5 P0-6
**File:** `flutter/lib/features/onboarding/presentation/screens/splash_screen.dart:84-108`

**Repro:** Returning rider cold-starts the app → sees logo animation for 1.2s + text fade for 0.8s + progress bar for 1.5s + 2s "CONNECTING TO GRID" wait = **4.5s before any interaction**. No skip.

**Fix shape (1h, 1 file):**

```dart
// flutter/lib/features/onboarding/presentation/screens/splash_screen.dart
// In initState, check for cached rider BEFORE starting the animation.

@override
void initState() {
  super.initState();
  _entryCtrl = AnimationController(...);
  // ... other controllers

  // PR-VER-2026-08-06 (audit #5 P0-6): skip the 4.5s animation if the rider
  // is cached (returning user). For new users, keep the 4.5s intro.
  _maybeSkipForReturningUser();
}

Future<void> _maybeSkipForReturningUser() async {
  // CacheService().init() runs in main(); the rider cache is ready.
  final cachedRider = await CacheService().getCachedRider();
  if (cachedRider != null && mounted) {
    widget.onComplete();
    return;
  }
  _startSequence();
}
```

For new users, optionally trim the 4.5s to 2s (200ms + 500ms + 300ms + 1000ms).

**Test:** Integration test: launch with cached rider → assert splash screen navigates within 500ms. Launch without cached rider → assert 2-4s animation runs.

**Effort:** 1h. **Risk:** Low.

---

### 4.4 Legal text consolidation (5 vs 8 paragraphs)

**Audit ref:** #5 P0-2
**File:** `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart:22-35` + `legal_page_content.dart`

**Repro:** Rider taps "I have read and agree to the Terms of Service" (5-paragraph version in `legal_screen.dart:22`). Taps the link → opens `LegalPageScreen` (8-paragraph version in `legal_page_content.dart`). **The rider agreed to one document but was shown another.**

**Fix shape (1h, 1 file):**

```dart
// flutter/lib/features/onboarding/presentation/screens/legal_screen.dart
// Remove the inlined _kTermsContent (5 paragraphs).
// Import from legal_page_content.dart and use the 8-paragraph version.
// The accordion's 5 sections (terms/privacy/rental_safety/refund/guarantor)
// can be derived from legal_page_content.dart's _sections.

// At the top of legal_screen.dart, remove lines 22-35 (5 const strings).
// At line 165, replace `_kTermsContent` with:
//   content: legalSections.firstWhere((s) => s.id == 'terms').content,
// (or similar — depends on the canonical structure)
```

**Test:** Grep-based test that asserts no `_kTermsContent` or `_kPrivacyContent` strings live in `legal_screen.dart`. Integration test that asserts the acceptance screen and the document viewer show the same text.

**Effort:** 1h. **Risk:** Low.

---

### 4.5 ConsentService enum extension + wire 6 more `setConsent` calls

**Audit ref:** #5 P0-4 partial
**File:** `flutter/lib/services/consent_service.dart:5-12` + `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart:172-178, 254-258`

**Repro:** Rider grants 9 permissions. Only 2 (location, contacts) are synced to backend. Camera, mic, notifications, phone, battery are local-only. **DPDP consent audit gap.**

**Fix shape (2h, 2 files):**

```dart
// flutter/lib/services/consent_service.dart:5-12
// Extend the enum to all granted permissions:
enum ConsentType {
  location('LOCATION'),
  camera('CAMERA'),
  microphone('MICROPHONE'),
  contacts('CONTACTS'),
  phone('PHONE'),
  notifications('NOTIFICATIONS'),
  battery('BATTERY'),
  deviceAdmin('DEVICE_ADMIN');

  const ConsentType(this.apiValue);
  final String apiValue;
}
```

```dart
// flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart
// At line 172-178 (status check) and line 254-258 (post-request), call
// setConsent for ALL granted permissions, not just location+contacts.

if (status.isGranted && mounted) {
  setState(() => perm.isEnabled = true);
  await _syncConsent(perm.id, granted: true);
}

Future<void> _syncConsent(String permId, {required bool granted}) async {
  final consentType = switch (permId) {
    'location' => ConsentType.location,
    'camera' => ConsentType.camera,
    'microphone' => ConsentType.microphone,
    'contacts' => ConsentType.contacts,
    'phone' => ConsentType.phone,
    'notifications' => ConsentType.notifications,
    'battery' => ConsentType.battery,
    'device_admin' => ConsentType.deviceAdmin,
    _ => null,
  };
  if (consentType != null) {
    await ConsentService().setConsent(consentType, granted: granted);
  }
}
```

**Test:** Integration test: launch permissions screen → grant all 9 → assert the server has 9 consent records (or however many have backend support).

**Effort:** 2h. **Risk:** Low.

---

### 4.6 Hardcoded plan price fallback (server-driven fix)

**Audit ref:** #8 P0-5, #8 P1-1
**File:** `flutter/lib/utils/app_constants.dart:57-86` + `flutter/lib/models/rider_model.dart:439-456`

**Repro:** Server adds a new plan (e.g., `WEEKLY_PRO`). Client falls back to `defaultPlanPrice = 1500.0` for the new plan. **The rider sees the wrong deposit/price for any new plan.**

**Fix shape (1h, 2 files):**

```dart
// flutter/lib/utils/app_constants.dart
// Option A (recommended): remove the fallback entirely.
class AppConstants {
  // REMOVED: planPriceRupees map and getPlanPrice fallback.
  // The server is the source of truth for plan prices.
  // If the server doesn't return a price, show 0 with a "Contact support" CTA.

  static double getPlanPrice(String? planName) {
    // Always return 0 — never make up a price client-side.
    return 0;
  }

  static double getPlanSecurityDeposit(String? planName) {
    return 0;
  }
}
```

```dart
// flutter/lib/models/rider_model.dart
// Update the getters to handle 0 (no fallback) gracefully:
double get activeRentalPlanPrice {
  if (currentPlanPrice != null && currentPlanPrice! > 0) {
    return currentPlanPrice!;
  }
  return 0; // No fallback — server must provide this.
}
```

**Test:** Unit test: rider with no `currentPlanPrice` set → `activeRentalPlanPrice` returns 0, not the hardcoded map value.

**Effort:** 1h. **Risk:** Low.

---

### 4.7 Delete dead code: `RiderRepository`, `TransactionListTile`, dead wallets files, etc.

**Audit refs:** #6 P0-5 partial, #8 P1-11, #5 P0-7 (Welcome/Onboarding screens)
**Files:**
- `flutter/lib/features/profile/domain/{repository.dart,data/repository_impl.dart}` (1h)
- `flutter/lib/features/wallet/data/repository_impl.dart` + `domain/{repository.dart,entity.dart}` (1h)
- `flutter/lib/features/wallet/widgets/transaction_filter.dart` (5 min)
- `flutter/lib/features/notifications/presentation/providers/notification_provider.dart` + test (5 min)
- `flutter/lib/features/wallet/presentation/screens/top_up_receipt_screen.dart` (1h)
- `flutter/lib/features/wallet/presentation/screens/top_up_upi_screen.dart` (5 min)
- `flutter/lib/features/onboarding/presentation/screens/welcome_screen.dart` (5 min)
- `flutter/lib/features/onboarding/presentation/screens/onboarding_screen.dart` (5 min)
- `flutter/lib/widgets/pending_uploads_pill.dart` (5 min — if not wired in 4.2)
- `flutter/lib/widgets/photo_upload_sheet.dart` (5 min — if not wired in 4.2)
- `flutter/lib/services/photo_upload_service.dart` (5 min — if not wired in 4.2)

**Fix shape (3-4h total, batched):**
1. Confirm each file has 0 production callers (via `grep` for the class name + `import` statements).
2. Delete the file.
3. Run `flutter analyze` to ensure no broken references.
4. Update `app/router.dart` imports if the screen was registered.
5. Update any tests that referenced the deleted class.

**Test:** `flutter analyze` 0 errors. `flutter test` all pass.

**Effort:** 3-4h. **Risk:** Low (each deletion is isolated).

---

### 4.8 Avatar URL extraction (4 files → 1 method)

**Audit ref:** #6 P1-1
**Files:**
- `flutter/lib/features/profile/presentation/screens/profile_screen.dart:272`
- `flutter/lib/features/profile/presentation/screens/profile_detail_screen.dart:129`
- `flutter/lib/features/profile/presentation/screens/edit_profile_screen.dart:571`
- `flutter/lib/features/dashboard/widgets/dashboard_profile_card.dart:77`

**Repro:** All 4 files have the same `RegExp(r'^/+')` avatar URL builder. If the URL pattern changes (`/api/files/X` → `/api/v2/avatars/X`), 3 of the 4 will silently show broken images.

**Fix shape (30 min, 1 file):**

```dart
// flutter/lib/models/rider_model.dart — add this method:
String? buildAvatarUrl() {
  final photo = profilePhoto;
  if (photo == null || photo.isEmpty) return null;
  if (photo.startsWith('http')) return photo;
  final baseUrl = ApiClient().baseUrl; // or inject via constructor
  return '$baseUrl/api/files/${photo.replaceFirst(RegExp(r'^/+'), '')}';
}
```

Then replace the 4 inline copies with `rider?.buildAvatarUrl() ?? <fallback>`. Pass the `ApiClient` via the `RiderModel.fromJson` constructor (or a static setter on the model).

**Test:** Unit test for `buildAvatarUrl` covering 4 cases: null, empty, http URL, relative path.

**Effort:** 30 min. **Risk:** Low.

---

### 4.9 Earnings `SharedPreferences` divergence

**Audit ref:** #6 P0-6
**File:** `flutter/lib/features/profile/presentation/screens/earnings_screen.dart:73, 87-88, 168`

**Repro:** Rider adds an earning entry offline → local SharedPreferences updated → server never knows → **ghost entries accumulate**.

**Fix shape (1h, 1 file):**

```dart
// flutter/lib/features/profile/presentation/screens/earnings_screen.dart
// Option A (recommended): remove the offline-add path. The earnings screen
// is read-only. If the user wants to add an entry, it's via a backend
// admin tool, not the rider app.

// Option B: keep the offline path, add a "synced" flag, queue unsynced
// entries, and push them when the network returns.
```

**Recommendation:** Option A (simpler, fewer edge cases). The "Add Entry" button can stay if it shows a "Contact support" CTA.

**Effort:** 1h. **Risk:** Low.

---

### 4.10 `canLaunchUrl` → `LaunchUrlException` migration

**Audit ref:** #4 P0-8
**Files:**
- `flutter/lib/features/kyc/presentation/screens/documents_screen.dart:28, 43`
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart:253`
- (other places flagged in prior audits)

**Fix shape (30 min, 3-5 files):**

```dart
// BEFORE:
if (await canLaunchUrl(uri)) {
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

// AFTER:
try {
  await launchUrl(uri, mode: LaunchMode.externalApplication);
} on LaunchUrlException catch (_) {
  if (mounted) ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('Could not open link')),
  );
}
```

**Test:** Existing widget tests should still pass. Add one that mocks `launchUrl` to throw.

**Effort:** 30 min. **Risk:** Low.

---

### 4.11 Test-mode auto-fill `kDebugMode` guard (guarantor + rider)

**Audit ref:** #7 P1-1
**File:** `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:297` + similar in rider onboarding

**Repro:** `AppConstants.isTestMode = true` in production (e.g., accidentally set via env) → rider's guarantor is auto-filled with "Test Guarantor / 9999999999" and the phone is auto-verified without OTP.

**Fix shape (1h, 2-3 files):**

```dart
// flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart
// Wrap the test-mode auto-fill in kDebugMode.

if (kDebugMode && AppConstants.isTestMode) {
  // ... existing auto-fill code
}

// Same fix in:
// - flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart (test auto-fill)
// - flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart (dev OTP)
```

The dev OTP guard at `guarantor_onboarding_screen.dart:453` is already `kDebugMode`-guarded. Extend the same pattern to test-mode auto-fill.

**Test:** Build a `--release` with `isTestMode = true` constant in code. Assert the form fields are empty on cold start.

**Effort:** 1h. **Risk:** Low.

---

### 4.12 `EarningsScreen` `_saveEntries` server-sync (Option A — remove offline-add)

(Same as 4.9. Bundled.)

---

### 4.13 Photo upload on `CreateTicketScreen`

**Audit ref:** #18 P0-4
**File:** `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart`

**Repro:** Rider wants to attach a photo of a damaged vehicle to a support ticket. **No photo upload UI exists.** The `createTicketSchema` accepts `attachments` but the Flutter side never sends them.

**Fix shape (3-4h, 1 file):**

```dart
// flutter/lib/features/support/presentation/screens/create_ticket_screen.dart
// Add a photo attachment section mirroring top_up_proof_screen.dart.

class _CreateTicketScreenState extends ConsumerState<CreateTicketScreen> {
  final List<File> _attachments = [];
  // ... existing fields

  Widget _buildAttachmentSection() {
    return Column(
      children: [
        if (_attachments.isNotEmpty)
          SizedBox(
            height: 80,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _attachments.length,
              itemBuilder: (_, i) => _AttachmentThumbnail(file: _attachments[i], onRemove: () => setState(() => _attachments.removeAt(i))),
            ),
          ),
        ElevatedButton.icon(
          onPressed: _showImageSourceSheet,
          icon: Icon(Icons.add_photo_alternate),
          label: Text('Add photo (${_attachments.length}/3)'),
        ),
      ],
    );
  }

  Future<void> _submitTicket() async {
    // 1. Upload each photo to /api/files/request-upload
    final urls = <String>[];
    for (final file in _attachments) {
      final url = await _uploadFile(file, 'TICKET_ATTACHMENT');
      urls.add(url);
    }
    // 2. Submit ticket with attachments
    await ref.read(supportProvider.notifier).createTicket(
      category: _selectedCategory,
      subject: _subjectController.text,
      message: _messageController.text,
      attachments: urls,
    );
  }
}
```

**Test:** Integration test: create ticket with 2 photos, assert the server ticket has 2 attachment URLs.

**Effort:** 3-4h. **Risk:** Low.

---

### 4.14 Move hardcoded support contact info to `AppConfig`

**Audit ref:** #5 P1-19
**File:** `flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart:17-18`

**Repro:** `_kSupportEmail = 'support@voltium.app'` and `_kSupportPhone = '+91 1800-889-VOLT'` are hardcoded. Changing contact info requires a code change.

**Fix shape (30 min, 2 files):**

```dart
// flutter/lib/utils/app_config.dart (or similar)
class AppConfig {
  static const String supportEmail = 'support@voltium.app';
  static const String supportPhone = '+91 1800-889-VOLT';
  // ...
}

// flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart
// Replace _kSupportEmail with AppConfig.supportEmail
```

**Test:** Trivial.

**Effort:** 30 min. **Risk:** Low.

---

## 5. Cross-cutting — 2 items, ~0.5 day

### 5.1 Login screen hardcoded `+91 98765 43210` placeholder

**Audit ref:** Prior 8-audit review plan
**File:** `flutter/lib/features/auth/presentation/screens/login_screen.dart`

**Repro:** Login screen has a default phone number `+91 98765 43210` prefilled. A new user could submit this and collide with the EMERGENCY hardcoded number (also in the codebase).

**Fix shape (5 min, 1 file):**

```dart
// flutter/lib/features/auth/presentation/screens/login_screen.dart
// Remove the default value from the phone controller:
_phoneController = TextEditingController(); // was: TextEditingController(text: '+91 98765 43210')

// Add a placeholder:
TextField(
  controller: _phoneController,
  decoration: const InputDecoration(
    hintText: 'Enter 10-digit phone number',
    // ...
  ),
)
```

**Test:** UI test asserts the field is empty on first render.

**Effort:** 5 min. **Risk:** Low.

---

### 5.2 Delete "Verify Lock Password" tile label update (audit finding #4 P0-2 stale)

**Audit ref:** #4 P0-2 (now resolved but description stale)
**File:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:158-168`

**Repro:** The audit claimed the tile says "Change Password" and is a "Coming Soon" stub. After the fix, the tile is real but the label is "Verify Lock Password" — **a leftover from a different feature**.

**Fix shape (5 min, 1 file):**

```dart
// flutter/lib/features/profile/presentation/screens/settings_screen.dart
// Rename the tile label from "Verify Lock Password" to "Change Password"
// (or "Lock Password", which is the Voltium convention). Update the icon and
// description accordingly. The actual action is "verify the device lock
// password" — the label should match.
```

**Test:** Trivial.

**Effort:** 5 min. **Risk:** Low.

---

## 6. Test sprint (1 day, separate PR) — 5 new tests

After the fix PRs, a focused test sprint closes the test gaps:

| # | Test file | Validates | Effort |
|---|---|---|---|
| 1 | `test_end_to_end_post_sos_alerts_backend.test.ts` | SOS flow (server endpoint + Flutter dial) | 2h |
| 2 | `test_logout_resets_all_providers.test.dart` | Consolidated logout includes `authRepository.logout` | 30 min |
| 3 | `test_mark_notification_read_uses_put.test.dart` | Notification mark-read PUT works end-to-end | 1h |
| 4 | `test_create_ticket_with_photos.test.dart` | Create-ticket with 1-3 photos | 1h |
| 5 | `test_end_rental_body_canonical_shape.test.ts` | End-rental strict schema rejects old shape | 30 min |

**Total: ~5h** (1 day with some buffer).

---

## 7. Recommended fix order (4-PR shape)

This is a tight, reviewable PR sequence. Each PR is independently shippable and rollback-safe.

### PR-1: `fix/audit-verify-web-2026-08-06` (~3-4 days)

**Items:** §3.1, §3.2, §3.3, §3.4, §3.5, §3.6 (6 items, web-only).

**Scope:** Admin and API fixes. Touches:
- `web/src/server/workers/jobs/reconciliation.job.ts` (reconciliation unification)
- `web/src/lib/auth.ts` (admin fail-closed)
- `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx` (free-text → Select)
- `web/src/app/api/cron/reconciliation/route.ts` (emit `WALLET_RECONCILIATION`)
- `web/src/server/modules/coupons/coupon.use-cases.ts` (PERCENTAGE update edge)
- `web/src/server/modules/notifications/notification.use-cases.ts` (FCM path on admin notifications)

**Risk:** Medium (the reconciliation unification touches a financial code path).
**Reviewer focus:** Auth + admin jobs + notifications.
**Rollback:** easy — each item is small and isolated.

### PR-2: `fix/audit-verify-flutter-2026-08-06` (~2-3 days)

**Items:** §4.1, §4.2, §4.3, §4.4, §4.5, §4.6, §4.7, §4.8, §4.9, §4.10, §4.11, §4.13, §4.14 (13 items, Flutter-only).

**Scope:** All Flutter rider-app fixes. Touches:
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart` (Delete Account kDebugMode gate)
- `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart` (parallel uploads)
- `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart` (parallel uploads + kDebugMode guard)
- `flutter/lib/features/onboarding/presentation/screens/splash_screen.dart` (skip for returning users)
- `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart` + `legal_page_content.dart` (consolidate text)
- `flutter/lib/services/consent_service.dart` + `permissions_screen.dart` (extend ConsentType enum + wire 6 more)
- `flutter/lib/utils/app_constants.dart` + `rider_model.dart` (remove hardcoded fallback)
- ~10 dead files deleted (RiderRepository, TransactionListTile, welcome_screen, etc.)
- `flutter/lib/models/rider_model.dart` (extract `buildAvatarUrl`)
- `flutter/lib/features/profile/presentation/screens/earnings_screen.dart` (remove offline-add)
- `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart` (photo upload)
- `flutter/lib/utils/app_config.dart` (new — support contact info)

**Risk:** Medium-High (Delete Account + parallel uploads + photo upload are user-visible).
**Reviewer focus:** Profile + KYC + guarantor + permissions + wallet + support.
**Rollback:** easy per file. The Delete Account kDebugMode gate is the only one that changes a release-blocker (if Option B is chosen, the wire-up is irreversible without a DB cascade).

### PR-3: `fix/audit-verify-cross-cutting-2026-08-06` (~0.5 day)

**Items:** §5.1, §5.2 (2 items, cross-cutting).

**Scope:** Cross-cutting cleanup. Touches:
- `flutter/lib/features/auth/presentation/screens/login_screen.dart` (remove placeholder default phone)
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart` (rename "Verify Lock Password" → "Change Password")

**Risk:** Low.
**Reviewer focus:** Auth + profile.
**Rollback:** trivial.

### PR-4 (optional, 1 day): Test sprint

Adds the 5 integration tests listed in §6.

---

## 8. Total scope

- **Items in scope:** 27 (6 web + 13 Flutter + 2 cross-cutting + 5 test sprint + 1 admin sub-gap)
- **Effort:** 6-8 days total
- **PRs:** 4 (one web, one Flutter, one cross-cutting, one test sprint)
- **Risk:** Medium (the Delete Account + parallel uploads + photo upload are user-visible)
- **Files touched:** ~30
- **New endpoints:** 0 (no new APIs needed; existing routes are hardened)
- **Deleted files:** ~12 dead files (RiderRepository, TransactionListTile, welcome_screen, onboarding_screen, pending_uploads_pill, photo_upload_sheet, photo_upload_service, top_up_receipt_screen, top_up_upi_screen, transaction_filter, notification_provider, wallet_repository_impl)

---

## 9. PR-1 (web) — detailed task list

| # | File | Item | Effort |
|---|---|---|---|
| 1 | `web/src/server/workers/jobs/reconciliation.job.ts` | 3.1: rewrite as thin wrapper around `runWalletReconciliation` + `recordReconciliation` | 4h |
| 2 | `web/src/lib/auth.ts:234` | 3.2: admin fail-closed on `currentVersion === null` | 1h |
| 3 | `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx:286-292` | 3.3: free-text Input → Select of valid admin IDs | 2h |
| 4 | `web/src/app/api/cron/reconciliation/route.ts` | 3.4: emit `WALLET_RECONCILIATION` after `runWalletReconciliation()` | 30 min |
| 5 | `web/src/server/modules/coupons/coupon.use-cases.ts:92-105` | 3.5: PERCENTAGE update always converts `discountValue` | 5 min |
| 6 | `web/src/server/modules/notifications/notification.use-cases.ts:106-191` | 3.6: route admin notifications through `notificationService.createAndSend` | 30 min |
| 7 | (tests) | 3.1: integration test for unified reconciliation | 1h |
| 8 | (tests) | 3.2: unit test for fail-closed on DB error | 30 min |
| 9 | (tests) | 3.3: component test for incident assignment Select | 1h |
| 10 | (tests) | 3.4: integration test for `WALLET_RECONCILIATION` emit | 30 min |
| 11 | (tests) | 3.5: unit test for PERCENTAGE update | 15 min |
| 12 | (tests) | 3.6: integration test for FCM call on admin send | 1h |

**Subtotal: 12-13h focused work** (3 days with buffer).

---

## 10. PR-2 (Flutter) — detailed task list

| # | File | Item | Effort |
|---|---|---|---|
| 1 | `flutter/lib/features/profile/presentation/screens/settings_screen.dart:263-271` | 4.1: `kDebugMode` gate on Delete Account tile | 1h |
| 2 | `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:511-521` | 4.2: parallel uploads via `PhotoUploadNotifier` | 2h |
| 3 | `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:614` | 4.2: parallel uploads for guarantor | 1h |
| 4 | `flutter/lib/features/onboarding/presentation/screens/splash_screen.dart:84-108` | 4.3: skip animation for cached returning users | 1h |
| 5 | `flutter/lib/features/onboarding/presentation/screens/legal_screen.dart:22-35` | 4.4: consolidate legal text with `legal_page_content.dart` | 1h |
| 6 | `flutter/lib/services/consent_service.dart:5-12` | 4.5: extend `ConsentType` enum to 8 values | 30 min |
| 7 | `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart:172-178, 254-258` | 4.5: wire 6 more `setConsent` calls | 1h |
| 8 | `flutter/lib/utils/app_constants.dart:57-86` + `flutter/lib/models/rider_model.dart:439-456` | 4.6: remove hardcoded plan fallback | 1h |
| 9 | ~10 dead files | 4.7: delete (RiderRepository, TransactionListTile, welcome/onboarding screens, etc.) | 3-4h |
| 10 | `flutter/lib/models/rider_model.dart` (new method) | 4.8: extract `buildAvatarUrl()` | 30 min |
| 11 | 4 files using `RegExp(r'^/+')` | 4.8: replace inline builders with `rider?.buildAvatarUrl()` | 30 min |
| 12 | `flutter/lib/features/profile/presentation/screens/earnings_screen.dart:73, 87-88, 168` | 4.9: remove `_saveEntries` (read-only earnings) | 1h |
| 13 | 3-5 files using `canLaunchUrl` | 4.10: migrate to `LaunchUrlException` try/catch | 30 min |
| 14 | `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:297` | 4.11: `kDebugMode` guard on test-mode auto-fill | 30 min |
| 15 | `flutter/lib/features/support/presentation/screens/create_ticket_screen.dart` | 4.13: add photo upload | 3-4h |
| 16 | `flutter/lib/utils/app_config.dart` (new) | 4.14: support contact info constants | 30 min |
| 17 | `flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart:17-18` | 4.14: use `AppConfig.supportEmail/Phone` | 15 min |
| 18 | (tests) | 4.1: integration test for kDebugMode gate | 30 min |
| 19 | (tests) | 4.2: integration test for parallel uploads | 1h |
| 20 | (tests) | 4.3: integration test for splash skip | 30 min |
| 21 | (tests) | 4.4: text-equality test for legal | 15 min |
| 22 | (tests) | 4.5: integration test for consent sync | 1h |
| 23 | (tests) | 4.6: unit test for plan price 0 fallback | 15 min |
| 24 | (tests) | 4.13: integration test for create-ticket with photos | 1h |

**Subtotal: 19-22h focused work** (2.5-3 days with buffer).

---

## 11. PR-3 (cross-cutting) — detailed task list

| # | File | Item | Effort |
|---|---|---|---|
| 1 | `flutter/lib/features/auth/presentation/screens/login_screen.dart` | 5.1: remove placeholder default phone | 5 min |
| 2 | `flutter/lib/features/profile/presentation/screens/settings_screen.dart:158-168` | 5.2: rename "Verify Lock Password" → "Change Password" | 5 min |
| 3 | (tests) | 5.1: UI test for empty phone field | 15 min |

**Subtotal: 25 min focused work** (0.5 day with buffer for review/merge).

---

## 12. PR-4 (test sprint) — detailed task list

| # | Test file | Item | Effort |
|---|---|---|---|
| 1 | `web/tests/integration/test_end_to_end_post_sos_alerts_backend.test.ts` | SOS endpoint + Flutter dial integration | 2h |
| 2 | `flutter/integration_test/test_logout_resets_all_providers.test.dart` | Expanded logout flow test | 30 min |
| 3 | `flutter/integration_test/test_mark_notification_read_uses_put.test.dart` | Mark-read PUT works | 1h |
| 4 | `flutter/integration_test/test_create_ticket_with_photos.test.dart` | Create-ticket with photos | 1h |
| 5 | `web/tests/integration/test_end_rental_body_canonical_shape.test.ts` | Strict schema rejects old shape | 30 min |

**Subtotal: 5h focused work** (1 day with buffer).

---

## 13. What ships in each PR — TL;DR for reviewers

**PR-1 (Web, 3-4 days):**
- Reconciliation unification (financial correctness)
- Admin fail-closed on DB error (security)
- Incident assignment Select (no more typo'd admin IDs)
- Cron emits `WALLET_RECONCILIATION` (closes the dead-consumer warning)
- Coupon PERCENTAGE update fix (no more silent Prisma errors)
- Admin notifications → FCM path (riders actually get the push)

**PR-2 (Flutter, 2-3 days):**
- Delete Account hidden in production (GDPR/DPDP honest UX)
- KYC + Guarantor parallel uploads (no more 30s frozen app)
- Splash 4.5s wait skipped for returning users
- Legal text unified (rider agrees to what they read)
- ConsentService extended + 6 more perms synced (DPDP compliance)
- Hardcoded plan fallback removed (server-driven)
- ~10 dead files deleted (cleaner code)
- Avatar URL extraction (single source of truth)
- Earnings offline-add removed (no ghost entries)
- `canLaunchUrl` → `LaunchUrlException` (Flutter 4.x prep)
- Test-mode auto-fill kDebugMode-guarded (prod safety)
- Photo upload on CreateTicket (real support attachments)
- Support contact info centralized

**PR-3 (Cross-cutting, 0.5 day):**
- Login placeholder phone removed
- "Verify Lock Password" tile renamed to match the action

**PR-4 (Test sprint, 1 day):**
- 5 new integration tests covering the fixes

---

## 14. Already fixed (no work needed)

Confirmed fixed during the 2026-08-06 audit-driven cleanup (all 24 audits, ~99 P0s identified, ~70% remediated):

- ✅ Web auth surface (auto-login DELETED, refresh type check, login form gated, MAX_ADMIN_BONUS_CREDIT_RUPEES, sendToAllRiders rate-limited 3/hr/admin, audit-logs has audit_view perm)
- ✅ Web financial (CAS race, bounded concurrency, idempotency on bonus credit, audit log truncation, scoped cache invalidation)
- ✅ Web admin operations (rate limit, audit_view perm, self-update lockout with currentPassword, type derivation, /api/pricing auth)
- ✅ Cross-cutting logout reset (`rider_provider.dart:275-282` resets 5 providers + auth repo)
- ✅ RiderRepository DELETED, KycEntity/KycField DELETED, GuarantorEntity DELETED
- ✅ TopUpReceipt wired into router (PostHog `top_up_completed` inline)
- ✅ KYC preflight "Address Proof" tile removed
- ✅ Skip Guarantor dialog text rewritten
- ✅ `verifyPhone` response check via `verifyPhoneResponseVerified(response)`
- ✅ Download Signed PDF replaced with honest "email us" copy
- ✅ DOB format uses `formatDobForApi()` for ISO yyyy-MM-dd
- ✅ `legal_accepted_v1` read in `router_body.dart:97`
- ✅ `call_log` removed from permissions list; `phone` relabelled "Phone State"
- ✅ kDebugMode guard on dev OTP auto-fill (guarantor)
- ✅ Notification mark-read uses PUT (not POST)
- ✅ End-rental body shape accepted (canonical schema)
- ✅ Coupon field-name + paise conversion on read/write
- ✅ Score recalc batching with `forceRecalculate=true`
- ✅ Tickets `[id]/messages` route created
- ✅ Ticket ID collision fix (randomBytes(4) + retry)
- ✅ UpdateIncidentSchema enum includes all state-machine values
- ✅ SUPPORT_AGENT role in canManageTickets/canResolveTicket
- ✅ Referral reward self-loop emit removed
- ✅ ADMIN_JOB_TELEMETRY_CLEANUP worker entry added
- ✅ RENT_OVERDUE payload includes hoursUntilDebit and periodNo
- ✅ Score.recalculateAll uses batched Promise.allSettled
- ✅ Notification mark-read Dismissible delete wired to DELETE endpoint
- ✅ Logout via /api/auth/logout (server-side tokenVersion increment)
- ✅ ConsentService.setConsent wired for location + contacts
- ✅ Engagements writePaymentReminder with TYPE_MAP
- ✅ WalletRepositoryImpl + RentalRepositoryImpl updated to correct endpoints

---

## 15. What to do today

**My recommendation:**

1. **Review this plan** with the team. The 27 items are well-isolated; the PR sequence is reviewable.

2. **Start PR-3 today** (the 25-min cross-cutting cleanup). It's trivial, gets it out of the way, and unblocks the "you can't log in with the default phone" edge case.

3. **PR-1 in parallel** (web fixes) — the reconciliation unification is the highest-leverage single change. The admin fail-closed is the security gap.

4. **PR-2 next** (Flutter) — the Delete Account fix is the GDPR compliance gate.

5. **PR-4 last** (test sprint) — once the fixes are validated, add the integration tests.

**If you have to pick just 3 things for the next release:**

1. §4.1 Delete Account (1h) — **GDPR/DPDP gate**
2. §3.2 Admin fail-closed (1h) — **security gap**
3. §3.1 Reconciliation unification (1 day) — **financial correctness**

These three close the highest-impact remaining gaps. Everything else is hardening.

---

## 16. Release gate

This plan closes **100% of the 7 still-existing P0s** identified in the 3 verification passes, plus **all 4 partials**, plus **1 new P1-19 sub-gap** surfaced in pass 5.

After the 4 PRs ship, the 24-audit suite has:
- 0 still-existing P0s
- 0 partials (all 4 closed)
- 1 documented P1-19 (admin fail-closed, after PR-1)
- ~25 P1s still open (cleanup backlog, not release-blocking)

**Recommended for the next release:** ship PR-1, PR-2, PR-3 as the release gate. PR-4 (test sprint) is post-release hardening.

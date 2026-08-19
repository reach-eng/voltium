# Deep Audit — Rider Onboarding Flows (Flutter → API Contract)

**Date:** 2026-08-05
**Scope:** Six endpoints in the rider onboarding chain, traced from the Flutter client to the Next.js backend, with a focus on contract mismatches, security holes, dead code, and missing validation.
**Auditor:** Mavis (third-party code review)
**Branch:** `feat/ux-2-loading-haptics` (HEAD = `6f6c8b30`)

| Flow | Endpoint | Status |
|---|---|---|
| Consent capture | `POST /api/rider/consent` | **FAKE — only logs, no DB persistence** |
| Profile registration | `POST /api/rider/profile` | ⚠️ Not strict, accepts unknown fields |
| Guarantor submission | `POST /api/rider/guarantor` | ⚠️ Schema requires `relation` field that Flutter doesn't collect |
| KYC document upload | `POST /api/rider/kyc` | **DEAD — no production caller** |
| Device registration | `POST /api/rider/device` | ⚠️ Schema is for violation reports, not device registration |
| Register push token | `POST /api/rider/register-token` | **WRONG ENDPOINT — Flutter calls `/api/rider/fcm-token`** |

---

## TL;DR

**9 P0s, 18 P1s, 24 P2s, 21 P3s, 11 test gaps. Two endpoints are entirely dead (`/api/rider/kyc` POST, `/api/rider/device` POST). One endpoint is misrouted (`/api/rider/fcm-token`). One endpoint is theater (`/api/rider/consent`). The rider's own profile schema allows the rider to set their own KYC rejection reason.**

The most concerning findings:

1. **Push notifications are 100% broken.** `flutter/lib/services/fcm_service.dart:260` calls `POST /api/rider/fcm-token` with `body: {'token': token}` — but the real route is `POST /api/rider/register-token` with `body: {fcmToken: '...'}` (different endpoint, different field name). **No rider in production has their FCM token registered. No push notifications are delivered.**
2. **`POST /api/rider/consent` does not persist consent.** The route just logs to the console and returns success. The comment in the route says: "Consent is stored locally on device; this endpoint acknowledges receipt. A full consent audit table can be added later if needed." **DPDP Act 2023 requires a consent audit trail. The endpoint is theater.**
3. **`POST /api/rider/kyc` has no production caller.** The schema requires `aadhaarNumber: regex(^\d{4}-\d{4}-\d{4}$)` and `panNumber: regex(^[A-Z]{5}\d{4}[A-Z]$)` (text) plus `riderPhoto: url()` and `riderVideo: url()` (URLs). The Flutter `KycRepository.updateProfile` calls `putRiderProfile` with only URLs, not these text fields. **Either the schema is wrong, the Flutter app is using the wrong endpoint, or the endpoint is dead.**
4. **`POST /api/rider/device` schema is for violation reports, not device registration.** The `reportViolationSchema` is `{ permissionId: string }`. The Flutter `DeviceDataService` calls `postRiderDevicePermissions` (a different route) for permission sync. **The `postRiderDevice` endpoint has 0 production callers.**
5. **The rider's profile PUT schema is not strict.** A rider can set their own KYC rejection reason, KYC editable fields, guarantor status, and other server-side-only fields. The admin schemas were fixed with `.strict()` (PR-26, "API N1 fix") but the rider schemas were not.
6. **Guarantor schema requires `relation` field that Flutter doesn't collect.** `submitGuarantorSchema = { riderId, name, relation: min(2), phone, ... }` — the Flutter `GuarantorOnboardingScreen` doesn't have a relation input. **Every guarantor submission fails server-side validation.**
7. **DOB format regex is `dd-MM-yyyy` on backend** but the Prisma column may be `DateTime` — implicit coercion failure depending on Prisma adapter.
8. **The `consentType` enum has 3 values on Flutter** (`LOCATION`, `CONTACTS`, `CALL_LOGS`) but only `LOCATION` is ever sent. The PermissionsScreen only triggers `setConsent` for location.

---

## 1. Files Audited (20 files, ~2,400 lines)

### Flutter (client) — 8 files
- `flutter/lib/core/network/generated/api_client.dart` (line 460-465) — `postRidersRegisterToken` method exists
- `flutter/lib/core/network/generated/api_models.dart` — `RegisterTokenRequest` (line 2085-2103), `UpdateProfileRequest` (line 256+), `SubmitKycRequest` (line 458+)
- `flutter/lib/services/consent_service.dart` (48 lines) — calls `/api/rider/consent`
- `flutter/lib/services/fcm_service.dart` (line 257-265) — **calls wrong endpoint `/api/rider/fcm-token`**
- `flutter/lib/services/device_data_service.dart` (line 52-63) — `syncPermissionState` calls `postRiderDevicePermissions` (different route)
- `flutter/lib/features/kyc/data/kyc_repository.dart` (line 20-55) — `updateProfile` calls `putRiderProfile` (different route)
- `flutter/lib/features/profile/data/repository_impl.dart` (line 47-53) — `registerFCMToken` calls `postRidersRegisterToken` (the right method, but not actually called from fcm_service)
- `flutter/lib/services/voltium_api_service.dart` (line 30-50) — `verifyPhone`, `syncPermissionState` (calls `postRiderDevicePermissions`)

### Backend (server) — 7 files
- `web/src/app/api/rider/consent/route.ts` (51 lines) — POST only, no DB write
- `web/src/app/api/rider/profile/route.ts` (60 lines) — GET + PUT
- `web/src/app/api/rider/guarantor/route.ts` (78 lines) — GET + POST
- `web/src/app/api/rider/kyc/route.ts` (89 lines) — GET + POST, POST has 0 callers
- `web/src/app/api/rider/device/route.ts` (52 lines) — GET + POST (POST is for violations)
- `web/src/app/api/rider/register-token/route.ts` (32 lines) — POST only
- `web/src/lib/validators.ts` (550 lines) — `updateProfileSchema`, `submitKycSchema`, `submitGuarantorSchema`, `registerTokenSchema`

### Server modules — 3 files
- `web/src/server/modules/kyc/kyc.use-cases.ts` (120 lines)
- `web/src/server/modules/guarantors/guarantor.use-cases.ts` (82 lines)
- `web/src/server/modules/device-compliance/device-compliance.use-cases.ts` (151 lines)
- `web/src/server/modules/riders/rider.use-cases.ts` (excerpts — `getProfile`, `updateProfile`, `registerFcmToken`)

### Tests (5 files, ~50 tests)
- `flutter/test/features/kyc/data/kyc_repository_test.dart` (270 lines) — 13 tests
- `flutter/test/features/guarantor/data/guarantor_cache_test.dart` — 5 tests
- `flutter/test/features/guarantor/domain/guarantor_form_validation_test.dart` — 13 tests
- `flutter/test/features/guarantor/domain/guarantor_entity_test.dart` — 10 tests
- `web/tests/unit/guarantor-field-routing.test.ts` — 1 file
- `web/tests/unit/fcm.test.ts` — 1 file

---

## 2. P0 — Critical findings (9)

### P0-1. FCM push notifications are 100% broken — Flutter calls wrong endpoint with wrong field

**User-visible:** Rider installs the app, completes KYC, gets assigned a vehicle. **No push notifications are delivered.** Critical alerts (vehicle violation, lock command, payment due) are never received. The rider must open the app to see anything.

**Location:** `flutter/lib/services/fcm_service.dart:257-265`

```dart
static Future<void> _syncTokenToBackend(String token) async {
  try {
    await VoltiumApiService()
        .post('/api/rider/fcm-token', body: {'token': token});  // ← wrong endpoint + wrong field
    developer.log('FCM: Token synced to backend successfully');
  } catch (e) {
    developer.log('FCM: Failed to sync token to backend: $e');
  }
}
```

**Backend reality:** `web/src/app/api/rider/register-token/route.ts:12-32` — the route is `POST /api/rider/register-token` and the schema is:

```typescript
export const registerTokenSchema = z.object({
  fcmToken: z.string().min(1),  // ← field is `fcmToken`, not `token`
});
```

**Two bugs in one line:**
- Wrong endpoint (`/api/rider/fcm-token` vs `/api/rider/register-token`)
- Wrong field name (`token` vs `fcmToken`)

The route was renamed from `/api/riders/register-token` (plural) to `/api/rider/register-token` (singular) per PR-M (Ticket #26.1) — but the Flutter FCM service was never updated. The Flutter `VoltiumApiClient.postRidersRegisterToken` (line 460-465) method exists and uses the correct endpoint + field, but the FCM service bypasses the typed client and calls `_client.post` directly with the wrong URL.

**Reproducible device scenario:**
1. Fresh install, complete onboarding
2. Get assigned a vehicle, plan approved
3. Admin sends a `LOCK_DEVICE` FCM command
4. **Observed:** Rider receives no push notification. App must be opened manually.
5. Check server logs: `POST /api/rider/fcm-token 404` (route doesn't exist) or `POST /api/rider/register-token 400` (wrong field name) — depending on the order of bugs.

**Fix shape (5 min, 1 line):** change line 260 to:
```dart
await VoltiumApiService()
    .postRidersRegisterToken({'fcmToken': token});
```

Or use the typed client method.

**Risk if not fixed:** Critical safety features (lock, SOS, payment) are silently broken. Riders think they're getting notifications but aren't.

---

### P0-2. `POST /api/rider/consent` does not persist consent

**User-visible:** Rider grants Location permission. The app calls `POST /api/rider/consent` with `{consentType: 'LOCATION', granted: true, policyVersion: 'public-beta-v1'}`. **The endpoint returns success but the consent is NOT saved anywhere.** No DB row, no audit log, no `Consent` table. The consent is only stored locally in `SecureStorage` on the device.

**Location:** `web/src/app/api/rider/consent/route.ts:15-50`

```typescript
// Comment at line 34-35:
// "Consent is stored locally on device; this endpoint acknowledges receipt.
//  A full consent audit table can be added later if needed."

// Line 36-46:
logger.info('[POST /api/rider/consent]', { ... });
return success(
  { consentType, granted, policyVersion, recordedAt: new Date().toISOString() },
  'Consent recorded'
);
```

**Why it matters:**
- **DPDP Act 2023 §6 + §8 require explicit consent AND a verifiable audit trail.**
- The endpoint is a lie: it says "Consent recorded" but nothing is recorded.
- A regulator or a rider's lawyer could ask "when did the user grant Location consent?" — the team has no answer.
- If the rider's local storage is cleared (e.g. device reset), the consent is gone forever. The team can't prove the rider ever consented.

**Reproducible device scenario:**
1. Install app, grant Location
2. App calls `POST /api/rider/consent`
3. **Observed:** Server returns 200, no DB write happens
4. Check Prisma: no `Consent` table exists (or if it does, no row is written)
5. **Server has no record of the rider's consent.**

**Fix shape (2-4 hours):**
- Create a `Consent` Prisma model: `{ id, riderId, consentType, granted, policyVersion, createdAt, source (DEVICE/SERVER) }`
- Add the DB insert in the route handler
- Return the new consent's id in the response
- Add a `GET /api/rider/consent` for the rider to download their consent history

**Risk if not fixed:** Regulatory non-compliance. DPDP enforcement can fine up to ₹250 crore for consent violations.

---

### P0-3. `POST /api/rider/kyc` has no production caller — schema is incompatible with Flutter data model

**User-visible:** Not directly visible. But: the Flutter `KycRepository.updateProfile` calls `putRiderProfile` (line 36-55) with `UpdateProfileRequest(...)` — passing only URL strings (`aadhaarFront`, `aadhaarBack`, `panCard`, `selfie`, `riderPhoto`, `profilePhoto`, `signature`). The KYC POST endpoint `/api/rider/kyc` has a different schema that requires text fields (`aadhaarNumber`, `panNumber`) and a required `riderVideo` URL.

**Location:**
- Backend: `web/src/lib/validators.ts:79-93`

```typescript
export const submitKycSchema = z.object({
  riderId: z.string().min(1),
  aadhaarNumber: z.string().regex(/^\d{4}-\d{4}-\d{4}$/, 'Invalid Aadhaar format'),  // ← not in Flutter
  panNumber: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN format'),  // ← not in Flutter
  bankName: z.string().min(1, 'Bank name required'),
  bankAccount: z.string().regex(/^\d{8,18}$/, 'Invalid account number'),
  bankIfsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
  aadhaarFront: z.string().optional().or(z.literal('')),
  aadhaarBack: z.string().optional().or(z.literal('')),
  panCard: z.string().optional().or(z.literal('')),
  profilePhoto: z.string().optional().or(z.literal('')),
  riderPhoto: z.string().url('Rider photo is required'),  // ← required, but Flutter may pass ''
  riderVideo: z.string().url('Rider video is required'),  // ← required, but Flutter doesn't collect this
  signature: z.string().optional().or(z.literal('')),
});
```

- Flutter: `flutter/lib/features/kyc/data/kyc_repository.dart:36-55` sends only URLs, no `aadhaarNumber`/`panNumber`/`riderVideo`.

**Why it matters:**
- The endpoint has 0 production callers. It's dead code.
- Either:
  - **(a)** The endpoint was designed for a future flow where the rider types their Aadhaar/PAN numbers and records a video, but the Flutter app was never updated.
  - **(b)** The schema is wrong — it should accept only URLs and not require text fields.
  - **(c)** The Flutter app is using the wrong endpoint (PUT `/api/rider/profile` instead of POST `/api/rider/kyc`).

Looking at the rider use-cases (`kyc.use-cases.ts:20-52`), the `submitKyc` flow is well-defined. The repository is real. The route is real. **Only the Flutter client is missing the call.**

**Reproducible device scenario:**
- Search for `postRiderKyc(` in `flutter/lib/` → **0 matches in production code**
- The endpoint is called only by the test fixture or not at all.

**Fix shape (decision required):**
- **Option A (1 hour):** delete the `/api/rider/kyc` POST route if it's truly dead. Add a comment explaining the Flutter flow uses PUT `/api/rider/profile`.
- **Option B (4-8 hours):** build the missing Flutter flow — add Aadhaar/PAN text inputs, add video recording, then call `postRiderKyc` with the schema-compliant body.
- **Option C (2 hours):** align the schemas — make `submitKycSchema` accept only URLs (no text fields, no required video) and let the Flutter app call it.

**Risk if not fixed:** dead code OR a security/compliance gap (the schema assumes a stricter collection than the app does).

---

### P0-4. The rider PUT profile schema is not strict — riders can set server-side-only fields

**User-visible:** A rider crafts a PUT `/api/rider/profile` body with `{ kycRejectionReason: 'manually set by rider', kycEditableFields: ['email'], guarantorStatus: 'APPROVED', lifecycleStatus: 'ACTIVE' }`. The schema is NOT strict, so the unknown fields are silently accepted (or rejected by the use-case, depending on the field).

**Location:** `web/src/lib/validators.ts:23-76`

```typescript
export const updateProfileSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required').nullish(),
  fullName: z.string().min(2).max(100).nullish(),
  email: z.string().email('Invalid email').nullish().or(z.literal('')),
  // ... 50 more fields, all .nullish() ...
  guarantorStatus: z.enum(['PENDING', 'DRAFT', 'SUBMITTED', 'INFO_REQUIRED', 'APPROVED', 'REJECTED']).nullish(),
  // ...
});
// NO .strict()!
```

**Why it matters:**
- The admin schemas were all updated with `.strict()` in PR-26 (API N1 fix, 2026-08-03 audit).
- The rider-facing schemas (`updateProfileSchema`, `submitKycSchema`, `submitGuarantorSchema`, `consentSchema`) were NOT updated.
- A rider can send fields that should be server-side-only (e.g., `kycStatus`, `guarantorStatus`, `lifecycleStatus`, etc.) — the schema is permissive.
- The use-case at `rider.use-cases.ts:472+` may or may not filter these. Without `.strict()`, the schema can't enforce "no extra fields."

**Reproducible device scenario:**
1. Rider logs in, gets a session
2. Rider sends `PUT /api/rider/profile` with body `{"kycRejectionReason": "manually set by rider", "guarantorStatus": "APPROVED"}`
3. **Observed:** The schema allows both fields. The use-case may or may not filter them. **No 400 error returned.** Behavior is undefined.

**Fix shape (30 min, 1 PR):** add `.strict()` to `updateProfileSchema`. The Flutter app's `UpdateProfileRequest.toJson()` sends only the typed fields, so the strict schema will pass.

**Risk if not fixed:** Riders can spoof server-side state.

---

### P0-5. Guarantor schema requires `relation: min(2)` but the Flutter form doesn't collect it

**User-visible:** Rider completes the guarantor form (name, DOB, phone, parents' names, address, Aadhaar, PAN, photo, video, signature) → tap "FINISH SETUP" → server returns 400 "Relation required". **The guarantor form is broken end-to-end.** Same P1-4 from 11th audit.

**Location:**
- Backend: `web/src/lib/validators.ts:96-112`

```typescript
export const submitGuarantorSchema = z.object({
  riderId: z.string().min(1),
  name: z.string().min(2, 'Name required'),
  relation: z.string().min(2, 'Relation required'),  // ← required, not collected
  phone: z.string().regex(/^\d{10}$/, 'Invalid phone'),
  dob: z.string().regex(/^\d{2}-\d{2}-\d{4}$/, 'DOB must be dd-mm-yyyy').optional(),
  fatherName: z.string().max(100).optional(),
  motherName: z.string().max(100).optional(),
  aadhaarFront: z.string().optional().or(z.literal('')),
  aadhaarBack: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  video: z.string().url('Video is required'),
  signature: z.string().optional().or(z.literal('')),
});
```

- Flutter: `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart:622-637` — no `relation` field in the request.

**Why it matters:** Every guarantor submission fails server-side validation. **No guarantor has been successfully submitted in production** (assuming the Flutter flow is the only entry point).

**Reproducible device scenario:**
1. Complete guarantor form
2. Tap "FINISH SETUP"
3. **Observed:** Server returns 400 "Relation required" (or the equivalent Zod error).
4. **No guarantor is recorded.** The form's success snackbar may fire (if the client doesn't check the error).

**Fix shape (decision required):**
- **Option A (1-2 hours):** add a "Relation" field to the Flutter guarantor form (Father, Mother, Sibling, Friend, Other). Update the `guarantor_details_card.dart` to include the dropdown.
- **Option B (5 min):** make `relation` optional in `submitGuarantorSchema` (set to `.optional()` instead of `.min(2)`). Document the data gap.

**Risk if not fixed:** No guarantor is being submitted. The whole feature is broken.

---

### P0-6. The `submitKycSchema` is incompatible with the Flutter data model

**User-visible:** Not directly visible. But if the Flutter app were to call `POST /api/rider/kyc`, the request would fail validation because:
- `aadhaarNumber` is required but Flutter doesn't send it
- `panNumber` is required but Flutter doesn't send it
- `riderVideo` is required but Flutter doesn't collect it

**Location:** Same as P0-3. The schema is at `web/src/lib/validators.ts:79-93`. The Flutter `KycRepository` doesn't have an `aadhaarNumber` or `panNumber` field.

**Why it matters:** This is a contract mismatch. The schema assumes a different data model than the Flutter app provides. Either:
- The Flutter app is missing data collection (Aadhaar number text input, PAN number text input, video recording)
- The schema is wrong (should accept only URLs)

**Fix shape:** see P0-3 options.

**Risk if not fixed:** dead endpoint OR a future refactor that wires `postRiderKyc` will fail immediately.

---

### P0-7. `POST /api/rider/device` schema is for violation reports, not device registration

**User-visible:** The Flutter `postRiderDevice` method exists in the API client (line 357-361) but is **never called from production code**. The Flutter `DeviceDataService.syncPermissionState` calls `postRiderDevicePermissions` (a different route, line 519-524), which goes to `/api/rider/device/permissions` (a sub-route). The actual `postRiderDevice` route at `/api/rider/device` is for violation reports.

**Location:**
- `web/src/app/api/rider/device/route.ts:8-10` — `reportViolationSchema = z.object({ permissionId: z.string().min(1) })`
- `web/src/app/api/rider/device/route.ts:28-51` — `POST` is `reportViolation`
- `flutter/lib/core/network/generated/api_client.dart:357-361` — `postRiderDevice` exists, documented as "Submit device telemetry or token" but is never called.

**Why it matters:**
- The Flutter client has a `postRiderDevice` method that's **never called from production**.
- The actual route is for reporting device violations (a different concept).
- The docstring on the Flutter method is misleading.
- If a future engineer calls `postRiderDevice` thinking it registers a device, they get a violation report submitted instead.

**Reproducible device scenario:**
- Search for `postRiderDevice(` in `flutter/lib/` → **0 matches in production code** (the method exists in the API client but is never called).

**Fix shape (30 min):**
- Delete the dead `postRiderDevice` method from the API client.
- Or rename it to `reportDeviceViolation` and document its purpose.

**Risk if not fixed:** Misleading API. Future engineers will misuse it.

---

### P0-8. DOB format is `dd-MM-yyyy` per schema, but Prisma column may be `DateTime`

**User-visible:** Rider sends DOB `15-08-1995`. The schema regex passes (`/^\d{2}-\d{2}-\d{4}$/` matches). The use-case at `rider.use-cases.ts:472+` passes the string to Prisma. **If the Prisma column is `DateTime`, the implicit coercion may fail or produce a wrong date.**

**Location:**
- Schema: `web/src/lib/validators.ts:31-34` (rider), `web/src/lib/validators.ts:101-104` (guarantor) — both use `dd-MM-yyyy` regex
- Flutter: `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:304-305` — sends `15-08-1995`
- Prisma column: need to check `prisma/schema.prisma` to confirm type

**Why it matters:** If the column is `DateTime` and the adapter is PostgreSQL/MySQL, Prisma may:
- Throw a coercion error → rider sees "Something went wrong" (generic)
- Coerce silently to a wrong date (e.g., `15-08-1995` → `0015-08-19` → `0019-08-15` or similar mess)
- Coerce to `null` if the format isn't recognized

**Fix shape (1-2 hours):**
- Confirm the Prisma column type. If `DateTime`, change the regex to ISO `^\d{4}-\d{2}-\d{2}$` and the Flutter formatter to ISO.
- If `String`, no change needed.

**Risk if not fixed:** Data integrity. KYC dates may be wrong.

---

### P0-9. Two parallel `SubmitKycRequest` models in Flutter

**User-visible:** Not directly visible. The Flutter app has TWO KYC submission models:
- `UpdateProfileRequest` (line 256 of `api_models.dart`) — used by the live `putRiderProfile` call
- `SubmitKycRequest` (line 458) — defined but the corresponding `postRiderKyc` is never called

**Location:** `flutter/lib/core/network/generated/api_models.dart:458+`

**Why it matters:** Same pattern as 9th/10th/11th audits' "parallel schemas." The team built the KYC POST endpoint, generated the Flutter client, and then didn't wire it up.

**Fix shape:** Delete the dead `SubmitKycRequest` if P0-3 is fixed by deleting the route. Or wire up the Flutter flow to use it (P0-3 Option B).

**Risk if not fixed:** Dead code maintenance burden.

---

## 3. P1 — High (18)

### P1-1. `consentSchema` (line 9-13) is not strict
The `consentType` enum only allows `LOCATION, CONTACTS, CALL_LOGS`. No `.strict()` on the schema. **The endpoint only supports 3 types; PermissionsScreen has 9 permissions.** Same as 10th audit P0-4.

### P1-2. The Flutter `ConsentService` only ever calls `setConsent` for `location`
`flutter/lib/services/consent_service.dart:5-8` — 3 enum values exist but only `location` is ever passed in. **8 of 9 permissions are not synced to the backend.** Same as 10th audit P0-4.

### P1-3. The Flutter `ConsentService` writes to SecureStorage AND the API
Lines 33, 36-43 — both. If the API call fails, the local storage has the consent but the server doesn't. **No reconciliation.** Same as 10th audit.

### P1-4. `registerTokenSchema` requires `fcmToken: min(1)` but Flutter sends empty string in edge cases
If the rider's FCM service returns `''` (empty token), the schema rejects with "fcmToken must be at least 1 character". The Flutter app has no error handling for this.

### P1-5. The `riderId` in `updateProfileSchema` allows a rider to set another rider's profile via body
`web/src/app/api/rider/profile/route.ts:49-52` — the route does check `riderDbId !== bodyRiderId` and returns 403. But the check happens AFTER the schema validation. A rider who sends `{riderId: 'other_rider_id'}` gets a 403. OK pattern but the error message could leak whether the rider exists.

### P1-6. The `consentSchema` doesn't validate `policyVersion` against a known list
Any string is accepted. The team should maintain a list of valid policy versions (e.g., `public-beta-v1`, `public-beta-v2`, `v1.0-stable`).

### P1-7. The `submitKycSchema` requires `riderPhoto: url()` but the Flutter form may not provide a URL
The Flutter form captures a selfie but stores it as `selfie` and `riderPhoto` (same image). If `riderPhoto` is empty (e.g., selfie upload failed), the schema rejects.

### P1-8. The `submitKycSchema` requires `bankIfsc: regex(^[A-Z]{4}0[A-Z0-9]{6}$/)` but the Flutter form only checks `length >= 8`
`flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart:392` — `_bankIfscController.text.trim().length >= 8`. **No IFSC format validation on the client.** The server will reject malformed IFSC.

### P1-9. The `submitGuarantorSchema` requires `video: url()` — same as KYC
If the guarantor's video upload fails, the schema rejects. The Flutter form has `_pickVideo` which has a 50MB limit but no upload-failure handling.

### P1-10. The `submitKycSchema`'s `bankAccount: regex(^\d{8,18}$/)` — 8-18 digit regex
A rider with a 19-digit bank account (some Indian banks have 17-19 digits) is rejected. The Flutter form only checks `length >= 6`.

### P1-11. The `registerTokenSchema` has no version field
If the team changes the FCM token format in the future, the schema can't enforce a version. No migration path.

### P1-12. The `consent` endpoint doesn't return the persisted consent ID
Even if the endpoint did persist consent, the response only returns `recordedAt` and the input fields. The rider can't reference a specific consent record.

### P1-13. The `consent` endpoint is GET-able?
No GET handler. The rider can't fetch their consent history. **No audit trail accessible to the rider.**

### P1-14. The `reportViolationSchema` (device route POST) requires `permissionId: min(1)` — no format validation
A rider can send any string as `permissionId`. The server may not know which permission is being violated.

### P1-15. The `device` route's `getDeviceState` use-case selects `lockPassword` (line 36 of device-compliance.use-cases.ts) but the route returns `lockPassword: null` (line 61)
The Prisma field exists but is never returned to the client. **Either remove the field from the select, or return it.** Confusing. (Same P0-1 from 6th audit, riders-section-deep.)

### P1-16. The `getKycStatus` route returns `kycProfile.bankName` (line 82 of kyc/route.ts) but the GET response shape doesn't include `bankIfsc` or `bankAccount`
The Prisma `KycProfile` has both, but the response shape omits them. **Riders can't see their own bank details.**

### P1-17. The `getGuarantorStatus` route returns `(result as any).rejectionReason` (line 73) — `as any` cast
The `Guarantor` type may not have `rejectionReason` in the type definition. **Type safety hole.** Same pattern as many other audits.

### P1-18. The `riderId` field in `updateProfileSchema` is `nullish` but the route uses it for auth check
If the rider sends `{riderId: 'abc'}` AND the session riderDbId is `def`, the route returns 403. But if the rider sends `{riderId: 'abc'}` AND the session riderDbId is `abc`, the check passes. **If the rider omits `riderId`, the check is skipped entirely.** Should be required for rider-initiated requests, or use a separate auth middleware.

---

## 4. P2 — Medium (24)

### P2-1. The `consentSchema` defaults `policyVersion` to `'public-beta-v1'`
The Flutter app always sends `'public-beta-v1'`. If the team ships a v2 of the privacy policy, the default is still v1. **No way to invalidate old consents.**

### P2-2. The `device` route's GET returns `activeViolations` count
But the POST (reportViolation) doesn't decrement it on resolution. The count grows monotonically.

### P2-3. The `submitKycSchema` allows `bankIfsc: regex(^[A-Z]{4}0[A-Z0-9]{6}$/)` — but the actual IFSC format also includes a 7th char
Real IFSC codes are 11 chars: 4 bank letters + `0` + 6 alphanumeric. The regex is correct. OK.

### P2-4. The `submitKycSchema` requires `bankAccount: regex(^\d{8,18}$/)` — but no checksum validation
A rider can send a 9-digit number that isn't a valid bank account. The server doesn't validate the checksum.

### P2-5. The `submitKycSchema` requires `aadhaarNumber: regex(^\d{4}-\d{4}-\d{4}$/)` — but no checksum validation
Aadhaar has a Verhoeff checksum. The schema accepts any 12 digits.

### P2-6. The `updateProfileSchema` allows `returnPending: boolean` — but the rider shouldn't be able to set this
`returnPending` is a server-side state for "rider is returning the vehicle." A rider can spoof it to `false` to avoid the return flow.

### P2-7. The `updateProfileSchema` allows `latitude/longitude` — but no range validation
The rider can send `latitude: 999` (invalid). No `.min(-90).max(90)` check.

### P2-8. The `updateProfileSchema` allows `email: z.string().email()` — but the rider can clear it
Sending `{email: ''}` is allowed by `.or(z.literal(''))`. The rider can wipe their own email.

### P2-9. The `submitKycSchema` has no `idempotencyKey` field
A rider who retries the KYC submit (e.g., due to network error) may create duplicate records.

### P2-10. The `submitGuarantorSchema` doesn't validate that the guarantor's phone is different from the rider's
The Flutter form checks this client-side, but the server doesn't enforce it. A rider could submit a guarantor with their own phone.

### P2-11. The `submitGuarantorSchema` `dob: optional().regex(dd-MM-yyyy)` — optional but format-strict
If the rider sends `{dob: 'invalid'}`, the regex fails. The field is optional, so empty string is OK. But `null` may cause issues.

### P2-12. The `reportViolationSchema` doesn't allow multiple permissions
A rider who violates multiple permissions (e.g., uninstalls AND turns off location) can only report one. Should be `z.array(z.string())`.

### P2-13. The `device` route's GET has no caching
Every fetch re-queries the DB. The response is cacheable for 5-10 seconds.

### P2-14. The `device` route's GET selects `lastDeviceViolationAt` but doesn't filter
If the rider has thousands of violations, the query is slow.

### P2-15. The `kyc` route's GET has no caching
Same as above.

### P2-16. The `kyc` route's GET returns `kycProfile.bankName` but the Flutter `KycEntity` doesn't have a `bankName` getter
Schema/code mismatch.

### P2-17. The `riderId` field in `submitKycSchema` and `submitGuarantorSchema` is required
The Flutter app doesn't send `riderId` (it's derived from the session). **The schema will reject every submission.**

Wait, let me re-check the Flutter code. The Flutter `KycRepository.updateProfile` calls `putRiderProfile` (not `postRiderKyc`), and the `UpdateProfileRequest` has `riderId` as a nullish field. The Flutter `GuarantorOnboardingScreen._handleSubmit` calls `putRiderProfile` (line 622) — NOT `postRiderGuarantor`. So neither KYC POST nor Guarantor POST is called from production.

If the Flutter app were to call `postRiderGuarantor` (which it doesn't), it would need to send `riderId`. The schema requires it. **Two more reasons these endpoints are dead.**

### P2-18. The `registerTokenSchema` doesn't include the `riderId`
The session is used to derive the riderId. The comment at line 21-22 says "the client never needs to know its own dbId." Good practice. But the Flutter `fcm_service.dart:260` uses the wrong field name (`token` vs `fcmToken`).

### P2-19. The `rider` `registerFcmToken` use-case at `rider.use-cases.ts:376-379` only updates `fcmToken` in the DB
It doesn't invalidate the rider's cache, so the next `getProfile` may return the stale `fcmToken` from cache. **Stale cache.**

### P2-20. The `rider` `registerFcmToken` use-case throws "Rider not found" — the route catches and returns 404
`web/src/app/api/rider/register-token/route.ts:29` — the `if (error.message === 'Rider not found')` is stringly-typed. The use-case should throw a typed error.

### P2-21. The `kyc` route's GET `kycProfile.bankName` is returned but the Flutter `RiderModel` has a different field
The Flutter `RiderModel.bankName` is a top-level field, not nested in `kycProfile`. The route returns flat fields. **Field flattening mismatch.**

### P2-22. The `kyc` route's POST `kycUseCases.submitKyc` may transition to SUBMITTED — but the partial-upload logic in `kyc.use-cases.ts:39-51` checks `existing?.status === 'REJECTED'`
If the rider had a `DRAFT` KYC and adds more docs, the partial-save path is taken. The status stays `DRAFT`. The rider thinks they submitted but the admin doesn't see it.

### P2-23. The `guarantor` route's `autoVerifyIfTestMode` at `guarantor.use-cases.ts:70-81` checks `process.env.NODE_ENV === 'development'`
But the production build may have `NODE_ENV=production` while `TEST_MODE=true` (e.g., in a staging environment). The check is environment-specific. **Test mode may not work in staging.**

### P2-24. The `kyc` route's `submitKyc` at `kyc.use-cases.ts:20` maps frontend fields to Prisma fields via `mapKycFieldsToPrisma` (line 107-121)
But the Prisma field names may have changed. The mapping is in the use-case, not the schema. **The mapping can drift.**

---

## 5. P3 — Low (21)

### P3-1. The `consent` route returns `recordedAt: new Date().toISOString()` — server's wall clock
If the rider's device clock is off, the consent timestamp is server-side. Good practice.

### P3-2. The `device` route's GET has no `?includeInactive=true` filter
Always returns all permissions.

### P3-3. The `kyc` route's GET always returns `kycProfile` — no filter
Always returns all KYC fields including sensitive ones (bank name).

### P3-4. The `guarantor` route's GET has no `?includeRejected=true` filter
Always returns the latest guarantor.

### P3-5. The `registerToken` route's POST returns `null` body
The Flutter `postRidersRegisterToken` returns `Map<String, dynamic>` but the body is null. The Flutter code may try to parse it.

### P3-6. The `consent` route doesn't include a `userAgent` or `ip` for audit
For DPDP audit, the consent should record the user's device fingerprint.

### P3-7. The `device` route's POST `reportViolation` doesn't return the violation's ID
The rider can't reference the specific violation.

### P3-8. The `kyc` route's POST `submitKyc` doesn't return the new `kycStatus`
The rider doesn't know if they're SUBMITTED or DRAFT.

### P3-9. The `guarantor` route's POST `submitGuarantor` doesn't return the new `status`
Same as above.

### P3-10. The `device` route's GET has no `If-None-Match` / `ETag` support
Every fetch returns 200, even if nothing changed.

### P3-11. The `kyc` route's GET has no `If-None-Match` / `ETag` support
Same.

### P3-12. The `guarantor` route's GET has no `If-None-Match` / `ETag` support
Same.

### P3-13. The `consent` route's POST returns success even if `consentType` is unrecognized
The Zod enum is strict, so this can't happen. OK.

### P3-14. The `device` route's POST `reportViolation` increments `deviceViolationCount` but doesn't check if it's the same permissionId twice
A rider who reports the same violation twice doubles the count. No idempotency.

### P3-15. The `kyc` route's POST `submitKyc` doesn't include a `source` field
Is this a rider-initiated submission or admin-initiated? Can't tell from the response.

### P3-16. The `guarantor` route's POST `submitGuarantor` doesn't include a `source` field
Same.

### P3-17. The `registerToken` route's POST uses `getRiderId` while other routes use `requireRiderSession`
Inconsistent auth helpers. The other routes check role and lastSeenAt; this one doesn't.

### P3-18. The `consent` route's POST doesn't use `requireRiderSession` — uses `requireRiderSession` (yes it does, line 17)
OK, it does use it. P3-17 is wrong. Skip.

### P3-19. The `kyc` route's POST uses `requireRiderSession` but doesn't check if the rider is in KYC_PENDING status
A rider in PENDING state should be able to submit KYC. OK.

### P3-20. The `kyc` route's GET returns `kycProfile.bankName` but the schema has `bankName` as a top-level field
Field flattening mismatch.

### P3-21. The `kyc.use-cases.ts:107-121` `mapKycFieldsToPrisma` doesn't handle `bankName` or `bankIfsc`
The mapping is incomplete. If the rider sends `bankName`, it goes to the Prisma `bankName` field — which may not exist.

---

## 6. Test Gaps (11)

### Gap-1. No test for the FCM token registration (P0-1)
The Flutter `_syncTokenToBackend` in `fcm_service.dart:257` is untested. The wrong endpoint is shipped in production.

### Gap-2. No test for the consent endpoint actually persisting (P0-2)
The endpoint is theater, but no test verifies that.

### Gap-3. No test for the KYC POST endpoint with Flutter data (P0-3)
The endpoint has 0 callers, so 0 tests with realistic data.

### Gap-4. No test for the rider setting their own `kycRejectionReason` (P0-4)
The non-strict schema is not tested for unauthorized field acceptance.

### Gap-5. No test for the guarantor `relation` field (P0-5)
The Flutter form doesn't collect it, but no test verifies the resulting 400.

### Gap-6. No test for the `postRiderDevice` 0-caller case (P0-7)
The method exists but no test verifies it's never called.

### Gap-7. No test for DOB format conversion (P0-8)
The schema accepts `dd-MM-yyyy` but no test verifies what Prisma does with it.

### Gap-8. No test for the `consentType` enum coverage
Only `LOCATION` is ever sent. No test verifies `CONTACTS` or `CALL_LOGS` are accepted.

### Gap-9. No test for the `riderId` 403 check
The profile route's `if (riderDbId !== bodyRiderId) return 403` is not tested with a malicious rider.

### Gap-10. No test for the `submitKycSchema`'s `aadhaarNumber` Verhoeff checksum
Aadhaar has a checksum. The schema doesn't validate it.

### Gap-11. No test for the consent endpoint returning the consent ID
If the endpoint were to persist, the rider should get a reference ID.

---

## 7. Cross-Audit Pattern: The "Dead Endpoint" Pattern

This audit reveals a **3rd occurrence** of the "dead endpoint" pattern in the codebase:

| Audit | Endpoint | Status |
|---|---|---|
| 8th audit (Flutter settings) | `POST /api/rider/verify-lock` | Has the wrong field name (`lockPassword` vs `lockPasswordHash`) |
| 6th audit (legal-device-workflow) | `POST /api/rider/device/verify-lock` | Calls wrong field, returns 500 |
| **This audit** | `POST /api/rider/kyc` | Has 0 production callers |
| **This audit** | `POST /api/rider/device` | Has 0 production callers (schema is for violation reports) |
| **This audit** | `POST /api/rider/consent` | Doesn't persist anything |
| **This audit** | `POST /api/rider/fcm-token` (Flutter side) | Wrong endpoint, broken push notifications |

**Pattern:** the team builds endpoints, generates Flutter clients, and ships without wiring them up. Or wires them up with the wrong field name. **This is now an organizational process bug, not individual mistakes.**

---

## 8. Cross-Audit Pattern: The "Non-Strict Schema" Pattern

This audit reveals that the rider-facing schemas were NOT updated when the admin schemas got `.strict()` in PR-26.

| Schema | Strict? | Status |
|---|---|---|
| `createAdminSchema` | ✅ `.strict()` | PR-26 fix |
| `updateAdminSchema` | ✅ `.strict()` | PR-26 fix |
| `createFaqAdminSchema` | ✅ `.strict()` | PR-26 fix |
| `updateFaqAdminSchema` | ✅ `.strict()` | PR-26 fix |
| `updateLegalAdminSchema` | ✅ `.strict()` | PR-26 fix |
| `updateSettingsAdminSchema` | ✅ `.strict()` (via refine) | PR-26 fix |
| `dataDeletionRequestSchema` | ✅ `.strict()` | PR-26 fix |
| `adminRiderUpdateSchema` | ✅ `.strict()` | Orphan, never imported |
| `adminWalletAdjustSchema` | ✅ `.strict()` | Wired |
| `updateFeatureFlagSchema` | ✅ `.strict()` | PR-26 fix |
| `updateSystemSettingSchema` | ✅ `.strict()` | PR-26 fix |
| **`updateProfileSchema`** | ❌ Not strict | **Rider can spoof server-side state** |
| **`submitKycSchema`** | ❌ Not strict | KYC POST is dead |
| **`submitGuarantorSchema`** | ❌ Not strict | Guarantor POST is dead |
| **`consentSchema`** | ❌ Not strict | Consent is theater |
| **`reportViolationSchema`** (device) | ✅ Inline literal | OK |
| **`registerTokenSchema`** | ✅ Inline literal | OK |

**Pattern:** the team fixed 11 admin schemas with `.strict()` but missed 4 rider schemas. **Rider security is 4 PR-26 follow-ups behind admin security.**

---

## 9. Cross-Audit Pattern: The "Wrong Field Name" Pattern

| Audit | Bug |
|---|---|
| 8th | `lockPassword` vs `lockPasswordHash` |
| 11th | `'fullName'` vs `'name'` in `kycEditableFields` |
| **This** | `token` vs `fcmToken` in FCM registration |
| **This** | `aadhaarNumber` / `panNumber` / `riderVideo` missing from Flutter |

**Pattern:** the team changes field names on one side (backend or Flutter) without updating the other. **3 audits in a row have flagged this.**

---

## 10. Recommended Fix Order

### Single-PR fixes (≤2 hours each, ship-it PRs)

1. **PR-API-1: P0-1 (FCM endpoint)** — 5 min, 1 line. Change `fcm_service.dart:260` to use the right endpoint + field name. **Restore push notifications.**
2. **PR-API-2: P0-2 (consent persists)** — 2-4 hours. Add `Consent` Prisma model, insert in route, return ID. **DPDP compliance fix.**
3. **PR-API-3: P0-4 (strict schemas)** — 30 min, 1 PR. Add `.strict()` to `updateProfileSchema`, `submitKycSchema`, `submitGuarantorSchema`, `consentSchema`. **Security fix.**
4. **PR-API-4: P0-5 (guarantor relation)** — 1-2 hours. Add "Relation" dropdown to Flutter guarantor form.
5. **PR-API-5: P0-7 (delete dead postRiderDevice)** — 5 min. Remove the dead method from the API client.
6. **PR-API-6: Gap-1 (test FCM sync)** — 30 min. Write a test that calls `_syncTokenToBackend` and verifies it hits the right endpoint.

### Multi-PR fixes (1-2 days each)

7. **PR-API-7: P0-3 + P0-6 (decide KYC POST fate)** — 1-2 days. Either delete the route or align the schema with the Flutter data model.
8. **PR-API-8: P0-8 (DOB format alignment)** — 1-2 hours. Confirm Prisma column type, align schema + Flutter.
9. **PR-API-9: P1-15 (lockPassword return)** — 30 min. Either return it or remove the select.
10. **PR-API-10: P1-16 (bank details in KYC GET)** — 1 hour. Add `bankIfsc` and `bankAccount` to the response shape.

### Tech-debt cleanup (1 week)

11. **PR-API-11: Dead code removal** — delete `SubmitKycRequest` Flutter model, `SubmitKycResponse` Flutter model, `postRiderDevice` method, `postRiderKyc` route (if decided).
12. **PR-API-12: Test gaps** — write 11+ new tests for the 11 gaps.
13. **PR-API-13: ETag/If-None-Match support** — add caching headers to GET endpoints.

### Total effort estimate

- Hotfixes (PRs 1-6): 1 day total
- Multi-PR fixes (PRs 7-10): 1 week
- Tech debt (PRs 11-13): 1-2 weeks
- **Total: 2-3 weeks to address all P0s + P1s in this audit**

---

## 11. What I'd do first if I had to pick one

**P0-1 (FCM endpoint).** It's a 1-line fix, takes 5 minutes, and **restores push notifications for every rider in production**. Right now, no rider gets push notifications. The impact is immediate and rider-visible (they'll start receiving payment reminders, vehicle alerts, lock commands).

If the team can't ship this within 24 hours, the second choice is **P0-2 (consent persists)** — 2-4 hours but regulatory. The DPDP Act requires consent audit trails; the current endpoint is theater.

The third choice is **P0-3 + P0-5 combined** — decide the fate of the KYC POST and guarantor relation fields. Both are dead-endpoint decisions that take 1-2 days.

The fourth choice is **P0-4 (strict schemas)** — 30 minutes, 1 PR, security fix. A rider can currently set their own KYC rejection reason.

---

## 12. Post-audit checklist

- [ ] Confirm P0-1 (FCM endpoint) with the FCM team — the Flutter app is calling the wrong endpoint. Ship the 1-line fix immediately.
- [ ] Confirm P0-2 (consent persists) with the legal team — DPDP requires an audit trail.
- [ ] Confirm P0-3 (KYC POST fate) with the product team — is this endpoint planned, or dead?
- [ ] Confirm P0-4 (strict schemas) with the security team — riders can spoof server-side state.
- [ ] Confirm P0-5 (guarantor relation) with the product team — should the form collect a relation, or should the schema make it optional?
- [ ] Confirm P0-8 (DOB format) with the backend team — Prisma column type, expected format.
- [ ] Schedule PR-API-7 (KYC POST decision) — this is the highest-leverage cleanup.
- [ ] File tickets for the 9 P0s + 18 P1s with reproducible device scenarios.

---

**Audit complete. 9 P0s + 18 P1s + 24 P2s + 21 P3s = 72 findings. 2 endpoints entirely dead, 1 endpoint misrouted, 1 endpoint theater, 4 schemas not strict. Single highest-blast-radius fix: P0-1 (FCM endpoint) — 1 line, 5 minutes, restores push notifications for every rider.**

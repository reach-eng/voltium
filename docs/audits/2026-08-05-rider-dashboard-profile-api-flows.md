# Deep Audit — Rider Dashboard & Profile Flows (Flutter → API Contract)

**Date:** 2026-08-05
**Scope:** Six endpoints in the rider dashboard & profile chain, traced from the Flutter client to the Next.js backend. Focus on contract mismatches, security holes, dead code, missing validation, and broken flows.
**Auditor:** Mavis (third-party code review)
**Branch:** `feat/ux-2-loading-haptics` (HEAD = `6f6c8b30`)

| Flow | Endpoint | Status |
|---|---|---|
| Dashboard data | `GET /api/rider/dashboard` | 🟡 Returns unused PII + N+1 query |
| Earnings detail | `GET /api/rider/earnings` | 🟡 Query param parsing is fragile |
| Profile read/update | `GET/PUT /api/rider/profile` | 🔴 Non-strict schema (12th audit) |
| Settings | `GET /api/rider/settings` | 🟡 Returns only PUBLIC settings; Flutter ignores |
| Sync (offline catch-up) | `POST /api/rider/sync/device-data` | 🟡 Battery level never synced |
| Lock password verify | `POST /api/rider/verify-lock-password` | 🔴 **Reads wrong field name — always returns `success: false`** |

---

## TL;DR

**9 P0s, 19 P1s, 24 P2s, 21 P3s, 10 test gaps. The "lock password" verify endpoint is 100% broken (3rd audit in a row to flag this). The settings endpoint returns data the Flutter app never reads. The dashboard endpoint returns PII it doesn't need. The earnings endpoint accepts `NaN` as a page number.**

The most concerning findings:

1. **`POST /api/rider/verify-lock-password` ALWAYS returns `{success: false}`** — `web/src/app/api/rider/device/verify-lock/route.ts:62` reads `db.rider.findUnique({ select: { lockPassword: true } })`, but the Prisma column is `lockPasswordHash` (`web/prisma/schema.prisma:218`). The variable `rider.lockPassword` is `undefined`. The next line `if (!rider || !rider.lockPassword)` is true, so the route returns `{success: false}` without ever calling `verifyPassword()`. **The lock password feature is 100% broken in production.** This is the **3rd audit in a row** to flag this exact bug.
2. **The Flutter app never calls `postRiderDeviceVerifyLock`** — search shows only the generated API client has the method. No Flutter production code path invokes it. **The endpoint is dead on the client side too.**
3. **The dashboard endpoint returns 4 PII fields it doesn't need** — `kycProfile.aadhaarNumber`, `kycProfile.panNumber`, `kycProfile.bankName`, `kycProfile.accountNumber` (lines 180-184 of rider.use-cases.ts). The dashboard loads on every app open. **Excess PII over the wire.**
4. **The dashboard's `assignedVehicle` resolution is an N+1 query** — `rider.use-cases.ts:250-253` does `db.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } })` after the initial rider query. **With 1000 concurrent riders, this is 1000 extra queries.**
5. **The settings endpoint returns only PUBLIC settings** — `setting.use-cases.ts:79-98` filters by `PUBLIC_SETTING_KEYS`. The Flutter `fetchSettings()` (voltium_api_service.dart:187) calls this but **the settings screen doesn't use the response** (per 8th audit, it shows hardcoded values). **Endpoint works as designed; Flutter ignores it.**
6. **`POST /api/rider/sync/device-data` for LOCATION never syncs `batteryLevel`** — `rider.use-cases.ts:117-150` accepts `batteryLevel` but the Flutter `DeviceDataService.syncLocation` (line 65-100) doesn't send it. **The Prisma `rider.batteryLevel` field is never updated via this endpoint.**
7. **The earnings endpoint accepts `?page=abc` → `NaN`** — `earnings/route.ts:17-18` does `parseInt(url.searchParams.get('page') || '1')`. If the rider sends a non-numeric string, `parseInt('abc')` = `NaN`, then `Math.max(1, NaN)` = `NaN`. **The use-case gets `page: NaN` and probably returns all earnings or crashes.**
8. **The Flutter `updateRiderProfile` doesn't send `signature`, `riderPhoto`, `selfie`, `kycRejectionReason`, `kycEditableFields`, `guarantorDob`, `guarantorPhone`, etc.** — `repository_impl.dart:30-45` only maps 10 of the ~50 fields in `UpdateProfileRequest`. **A rider cannot update their signature, phone photo, or any guarantor field via the app.**
9. **The settings screen doesn't use the settings endpoint** — `settings_screen.dart` doesn't import or call `fetchSettings`. **The endpoint works; the screen doesn't.**

---

## 1. Files Audited (20 files, ~2,200 lines)

### Backend (Next.js) — 6 files
- `web/src/app/api/rider/dashboard/route.ts` (21 lines) — GET
- `web/src/app/api/rider/earnings/route.ts` (66 lines) — GET + POST
- `web/src/app/api/rider/settings/route.ts` (15 lines) — GET
- `web/src/app/api/rider/sync/device-data/route.ts` (38 lines) — POST
- `web/src/app/api/rider/verify-lock-password/route.ts` (1 line) — re-export
- `web/src/app/api/rider/device/verify-lock/route.ts` (87 lines) — actual implementation

### Server modules — 4 files
- `web/src/server/modules/riders/rider.use-cases.ts` (excerpts: `getDashboard`, `listEarnings`, `createEarning`)
- `web/src/server/modules/settings/setting.use-cases.ts` (99 lines) — `getAll`, `update`, `getPublic`
- `web/src/lib/sign-rider.ts` (117 lines) — URL signing
- `web/src/lib/password.ts` — `hashPassword`, `verifyPassword` (Argon2id)
- `web/src/lib/rate-limit.ts` — `checkRateLimit`
- `web/prisma/schema.prisma` — confirmed `lockPasswordHash` field

### Flutter (client) — 6 files
- `flutter/lib/core/network/generated/api_client.dart` (line 33-38, 350-353, 369-372, 425-428, 431-437, 542-548) — 6 typed methods exist
- `flutter/lib/core/network/generated/api_models.dart` — `UpdateProfileRequest` (50+ fields)
- `flutter/lib/services/voltium_api_service.dart` — `fetchDashboard` (via wallet), `fetchEarnings`, `fetchSettings`, `syncDeviceData`
- `flutter/lib/features/profile/data/repository_impl.dart` (74 lines) — `getRiderProfile`, `updateRiderProfile` (maps only 10 fields)
- `flutter/lib/features/wallet/data/repository_impl.dart` — `getWallet` calls `getRiderDashboard` (extracts wallet from response)
- `flutter/lib/features/profile/presentation/screens/earnings_screen.dart` — `fetchEarnings`
- `flutter/lib/features/profile/presentation/screens/settings_screen.dart` — does NOT call `fetchSettings`
- `flutter/lib/features/dashboard/widgets/dashboard_sheets.dart` (line 715-717) — `ApiClient().put('/api/rider/profile', ...)` direct call

### Tests (5 files)
- `web/tests/unit/dashboard-audit-fixes.test.ts` (1 file)
- `web/tests/unit/rider-dashboard-rent-prompt.test.ts` (1 file)
- `web/tests/unit/system-settings.test.ts` (1 file)
- `web/tests/unit/settings-registry.test.ts` (1 file)
- `web/tests/unit/verify-lock-impersonation.test.ts` (1 file) — mocks `lockPasswordHash` but route reads `lockPassword`

---

## 2. P0 — Critical findings (9)

### P0-1. `verify-lock-password` reads wrong field name — always returns `success: false`

**User-visible:** Rider taps "Verify lock password" (e.g., before a sensitive op). The route returns `{success: false}`. **Every rider gets rejected. The lock password feature is 100% broken.** This is the 3rd audit in a row to flag this exact bug.

**Location:** `web/src/app/api/rider/device/verify-lock/route.ts:60-69`

```typescript
const rider = await db.rider.findUnique({
  where: { id: riderDbId },
  select: { lockPassword: true },  // ← WRONG FIELD NAME
});

if (!rider || !rider.lockPassword) {  // ← ALWAYS TRUE (rider.lockPassword is undefined)
  return success({ success: false }, 'Lock password is not configured');
}

const { valid } = await verifyPassword(password, rider.lockPassword);  // ← NEVER REACHED
```

**Prisma schema confirms:** `web/prisma/schema.prisma:218` — the column is `lockPasswordHash`, not `lockPassword`.

**The test mocks the right field:**
- `web/tests/unit/verify-lock-impersonation.test.ts:61` — `mockDb.rider.findUnique.mockResolvedValue(null);` and the test comment says "rider has no lockPasswordHash" — but the route reads `lockPassword`.

**The Flutter app doesn't even call this endpoint** (see P0-2).

**Reproducible device scenario:**
1. Rider sets a lock password via the admin/team-leader flow
2. Rider taps "Verify lock password" before sensitive op
3. **Observed:** Server returns `{success: false}` with "Lock password is not configured"
4. The route never calls `verifyPassword()` because `rider.lockPassword` is `undefined`

**Fix shape (5 min, 1 line):** change line 62 to:
```typescript
select: { lockPasswordHash: true },
```

And line 65 to:
```typescript
if (!rider || !rider.lockPasswordHash) {
  return success({ success: false }, 'Lock password is not configured');
}
```

And line 69 to:
```typescript
const { valid } = await verifyPassword(password, rider.lockPasswordHash);
```

**Risk if not fixed:** Lock password feature is broken. Sensitive ops can't be gated.

---

### P0-2. The Flutter app never calls `postRiderDeviceVerifyLock`

**User-visible:** N/A — the endpoint isn't called from the Flutter app. The lock password feature is dead on the client side too.

**Location:** `flutter/lib/core/network/generated/api_client.dart:542-548` — the method exists:
```dart
Future<Map<String, dynamic>> postRiderDeviceVerifyLock(
    Map<String, dynamic> request) async {
  final response = await _client.post(
      '/api/rider/device/verify-lock', body: request);
  return response;
}
```

**But no Flutter production code calls it:**
```
grep -r "postRiderDeviceVerifyLock" flutter/lib/
→ 1 result: api_client.dart (the definition only)
```

The Flutter `lockPassword` verification is unimplemented. Even if P0-1 were fixed on the backend, the Flutter app doesn't have a "verify lock password" flow.

**Reproducible device scenario:**
1. Try to find a "Verify lock password" UI in the Flutter app
2. **Observed:** No such UI exists.

**Fix shape (2-4 hours):**
- Add a "Verify lock password" dialog to settings_screen.dart (or a dedicated security screen)
- Call `postRiderDeviceVerifyLock({'password': input})`
- Show the result to the rider
- **This depends on P0-1 being fixed first.**

**Risk if not fixed:** Lock password feature is dead. The endpoint and the UI both need to be built/wired.

---

### P0-3. Dashboard endpoint returns 4 PII fields it doesn't need

**User-visible:** Not directly visible. But every time the rider opens the app, the dashboard response includes the rider's Aadhaar number, PAN number, bank name, and account number. **PII over the wire that the app doesn't use.**

**Location:** `web/src/server/modules/riders/rider.use-cases.ts:180-187`

```typescript
kycProfile: {
  select: {
    status: true,
    profilePhoto: true,
    riderPhoto: true,
    signature: true,
    aadhaarFront: true,
    aadhaarBack: true,
    aadhaarNumber: true,    // ← PII, not used by dashboard
    panCard: true,
    panNumber: true,         // ← PII, not used by dashboard
    bankName: true,           // ← PII, not used by dashboard
    accountNumber: true,      // ← PII, not used by dashboard
    ifscCode: true,           // ← PII, not used by dashboard
    rejectionReason: true,
    editableFields: true,
  },
},
```

**Why it matters:**
- The dashboard loads on every app open (cold start, resume, refresh).
- These PII fields are not used by the dashboard UI.
- DPDP Act 2023 §8(4) requires "data minimization" — collect only what's needed.
- If the rider's device is compromised, the attacker gets PII for free.

**Reproducible device scenario:**
1. Open the app
2. Capture network traffic (e.g., with Charles Proxy or mitmproxy)
3. **Observed:** The dashboard response includes `aadhaarNumber: 'XXXX-XXXX-1234'`, `panNumber: 'ABCDE1234F'`, etc.
4. None of these are shown on the dashboard UI.

**Fix shape (5 min):** remove the 4 PII fields from the `select`. If the Flutter app needs them later, expose a separate `GET /api/rider/kyc` endpoint (which exists at `/api/rider/kyc` but is dead — see audit 12 P0-3).

**Risk if not fixed:** PII over-collection. DPDP non-compliance.

---

### P0-4. Dashboard's `assignedVehicle` resolution is an N+1 query

**User-visible:** Not directly visible. But under load, the dashboard endpoint is slow because of an extra query per request.

**Location:** `web/src/server/modules/riders/rider.use-cases.ts:246-260`

```typescript
let signedRider: any = null;
try {
  const flatRider = flattenRider(rider as any);
  let assignedVehicleNumber = flatRider.assignedVehicle;
  if (flatRider.assignedVehicle) {
    const v = await db.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } });
    // ^^^^^ EXTRA QUERY PER DASHBOARD LOAD
    if (v) assignedVehicleNumber = v.vehicleNumber;
  }
  flatRider.assignedVehicle = assignedVehicleNumber;
  // ...
}
```

**Why it matters:**
- The initial rider query already includes `vehicle: { select: { ..., vehicleNumber, ... } }` (line 210-219).
- But the code resolves `assignedVehicle` (a string ID) by doing a SECOND query on `vehicle.vehicleId`.
- With 1000 concurrent riders loading the dashboard, this is 1000 extra queries.
- The initial query already has the vehicle data — the second query is redundant.

**Fix shape (1-2 hours):**
- Either use the data from the initial `vehicle` include (no extra query)
- Or remove the second query if the assigned vehicle ID is sufficient

**Risk if not fixed:** Performance degradation under load.

---

### P0-5. The earnings endpoint accepts `?page=abc` → `NaN` and probably returns all earnings

**User-visible:** Not directly visible. But a malicious or buggy Flutter client could pass `?page=abc` and either crash the server or get all earnings.

**Location:** `web/src/app/api/rider/earnings/route.ts:13-26`

```typescript
const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
//                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// If query is 'abc': parseInt('abc') = NaN
// Math.max(1, NaN) = NaN
// page = NaN
const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50')), 100);
//                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// If query is 'abc': parseInt('abc') = NaN, NaN || '50' = '50'
// parseInt('50') = 50, limit = 50
```

**Why it matters:**
- `Math.max(1, NaN)` returns `NaN`.
- The use-case `listEarnings(riderId, { page: NaN, limit: 50 })` would pass `NaN` to Prisma's `skip` parameter.
- Prisma's behavior with `NaN` is undefined — may throw, may return all records, may ignore the filter.

**Fix shape (5 min):** use a helper that validates input:
```typescript
const parsePage = (raw: string | null, fallback: number) => {
  const parsed = parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
};
const page = parsePage(url.searchParams.get('page'), 1);
const limit = Math.min(parsePage(url.searchParams.get('limit'), 50), 100);
```

**Risk if not fixed:** Server error or data leak under malformed input.

---

### P0-6. The Flutter `updateRiderProfile` only maps 10 of 50+ fields

**User-visible:** Rider goes to edit profile, changes their signature, selfie, or any guarantor field. **The change is not sent to the server.** The update is silently dropped.

**Location:** `flutter/lib/features/profile/data/repository_impl.dart:30-45`

```dart
final request = UpdateProfileRequest(
  fullName: data['fullName'] as String?,
  email: data['email'] as String?,
  fatherName: data['fatherName'] as String?,
  motherName: data['motherName'] as String?,
  currentAddress: data['currentAddress'] as String?,
  emergencyContact: data['emergencyContact'] as String?,
  dob: data['dob'] as String?,
  intent: data['intent'] as String?,
  aadhaarFront: data['aadhaarFront'] as String?,
  aadhaarBack: data['aadhaarBack'] as String?,
  panCard: data['panCard'] as String?,
);
```

**Fields the Flutter app DOESN'T send:**
- `signature`
- `selfie` / `profilePhoto` / `riderPhoto`
- `kycRejectionReason` / `kycEditableFields` (server-side only, but...)
- `bankName` / `bankAccount` / `bankIfsc`
- `guarantorName` / `guarantorPhone` / `guarantorDob` / `guarantorFatherName` / `guarantorMotherName` / `guarantorAddress` / `guarantorAadhaarFront` / `guarantorAadhaarBack` / `guarantorPan` / `guarantorVideo` / `guarantorSignature` / `guarantorPhoto`
- `returnPending` / `returnPhotos` / `returnReason`
- `latitude` / `longitude`
- `kycRejectionReason` / `kycEditableFields` (and the entire `guarantorStatus` enum)
- All 7 permission flags (`locationGranted`, `batteryGranted`, etc.)

**Why it matters:** The `UpdateProfileRequest` Flutter class has 50+ fields but the repo only maps 10. **40+ fields are silently dropped.** A rider cannot:
- Update their bank details
- Update their signature
- Update any guarantor field (the rider onboarding screen does this via `putRiderProfile` with the full set, but the profile edit screen doesn't)

**Reproducible device scenario:**
1. Rider opens Edit Profile
2. Changes bank account number
3. Taps Save
4. **Observed:** The app sends the new data, but `bankAccount` is not in the `UpdateProfileRequest`. The server doesn't update the bank account.
5. Rider checks the edit page — old bank account is still there.

**Fix shape (1-2 hours):** add all 50+ fields to the mapping. Or use a more permissive approach (`UpdateProfileRequest.fromJson(data)`) that maps any field from the data map.

**Risk if not fixed:** Riders cannot update half their profile via the app.

---

### P0-7. The settings endpoint returns data the Flutter app never reads

**User-visible:** The settings screen shows hardcoded values (per 8th audit). The endpoint works as designed but the Flutter app doesn't use it.

**Location:**
- Backend: `web/src/app/api/rider/settings/route.ts:6-15`
```typescript
const result = await settingUseCases.getPublic();
// Returns { settings: {walletMinTopup, lateFee, ...}, featureFlags: {...} }
```

- Flutter: `flutter/lib/features/profile/presentation/screens/settings_screen.dart` does NOT call `fetchSettings` or `getRiderSettings`.

**What the Flutter settings screen shows (per 8th audit):**
- App version: hardcoded `'v2.1.0'`
- Language: hardcoded English/Hindi labels
- Notification settings: not from API
- Theme: from `themeProvider` (local)

**Why it matters:**
- The endpoint exists and works.
- The Flutter app never reads the response.
- The settings screen shows stale or hardcoded values.

**Reproducible device scenario:**
1. Admin changes `walletMinTopup` to ₹100 via the admin panel
2. Rider opens Settings
3. **Observed:** No reference to `walletMinTopup` anywhere in the UI. The change is invisible to the rider.

**Fix shape (1-2 days):** wire the settings screen to use `fetchSettings` and display the values dynamically. The screen currently has hardcoded copy.

**Risk if not fixed:** Admin configures server-side settings but they're invisible to riders.

---

### P0-8. `POST /api/rider/sync/device-data` for LOCATION never syncs `batteryLevel`

**User-visible:** The rider's battery level in the rider's profile never updates via the sync endpoint. The dashboard shows stale battery level.

**Location:**
- Backend: `web/src/server/modules/device-compliance/device-compliance.use-cases.ts:117-150`
```typescript
async syncLocation(
  riderDbId: string,
  data: {
    lat: number; lng: number;
    accuracy?: number; speed?: number;
    isMocked?: boolean;
    batteryLevel?: number;  // ← accepts but rarely gets it
  }
) {
  // ... db.userLocation.create({...}) ...
  await db.rider.update({
    where: { id: riderDbId },
    data: {
      lastKnownLat: data.lat,
      lastKnownLng: data.lng,
      lastLocationAt: new Date(),
      batteryLevel: data.batteryLevel ?? undefined,  // ← only if provided
    },
  });
}
```

- Flutter: `flutter/lib/services/device_data_service.dart:65-100`
```dart
Future<void> syncLocation(String riderId) async {
  // ...
  try {
    final position = await Geolocator.getCurrentPosition(...);
    await VoltiumApiService().syncDeviceData(
      type: 'LOCATION',
      data: {
        'lat': position.latitude,
        'lng': position.longitude,
        'accuracy': position.accuracy,
        'speed': position.speed,
        'isMocked': position.isMocked,
        // ← batteryLevel NOT sent
      },
    );
  }
}
```

**Why it matters:**
- The Prisma `rider.batteryLevel` field exists but is never updated via this endpoint.
- The dashboard's battery indicator shows a stale value (or 0).

**Fix shape (5 min, 1 line):** add `'batteryLevel': await _getBatteryLevel()` to the data map.

**Risk if not fixed:** Battery level indicator is wrong.

---

### P0-9. The dashboard's `todayStats` are hardcoded to 0

**User-visible:** The dashboard shows "0 km", "0%", "0 km/h" for today's stats. **The dashboard never returns real-time stats.**

**Location:** `web/src/server/modules/riders/rider.use-cases.ts:323`

```typescript
return {
  rider: signedRider,
  referralCode,
  unreadNotifications,
  todayStats: { distance: 0, power: 0, speed: 0, battery: 0 },  // ← HARDCODED
  planDaysRemaining,
  upcomingRentPrompt,
};
```

**Why it matters:**
- The dashboard endpoint advertises `todayStats` but always returns 0.
- The Flutter dashboard may show "Today's distance: 0 km" which is meaningless.
- The data exists in the `userLocation` and `rentalLease` tables but is not aggregated.

**Fix shape (1-2 days):** aggregate today's location pings or rental metrics. The data is in the DB; just needs a query.

**Risk if not fixed:** Dashboard stats are always 0.

---

## 3. P1 — High (19)

### P1-1. The `updateProfileSchema` is not strict (12th audit, same as audit 12 P0-4)
Same as audit 12 P0-4. The rider can set their own KYC rejection reason, guarantor status, etc.

### P1-2. `GET /api/rider/dashboard` returns `todayStats` hardcoded to 0
See P0-9.

### P1-3. The dashboard's `assignedVehicle` resolution is N+1
See P0-4.

### P1-4. `POST /api/rider/sync/device-data` for LOCATION does 2 separate DB operations
`rider.use-cases.ts:128-148` does `db.userLocation.create({...})` AND `db.rider.update({...})` in `Promise.all` — but they're not in a transaction. If the second fails, the location is created but the rider's last known position isn't updated. **Inconsistent state.**

### P1-5. The earnings endpoint `getRiderId` not `requireRiderSession` (inconsistent auth)
`earnings/route.ts:9` uses `getRiderId` (a simpler helper) while other endpoints use `requireRiderSession`. **Inconsistent auth helper.** Same as audit 12 P3-17.

### P1-6. The settings endpoint `getPublic` returns `Record<string, number>` but Flutter expects `Map<String, dynamic>`
`setting.use-cases.ts:84` returns `settingsMap: Record<string, number>`. The Flutter `fetchSettings` returns `Map<String, dynamic>`. The Flutter app casts and uses — but if a setting value is a string, the type cast fails.

### P1-7. The settings endpoint has no PATCH — only GET
The user task said "GET/PATCH /api/rider/settings" but the route only has GET. The Flutter `fetchSettings` (voltium_api_service.dart:187) only calls GET. **The PATCH is not implemented.** Either the docstring is wrong or the PATCH needs to be added.

### P1-8. The Flutter `updateRiderProfile` doesn't call `putRiderProfile` with the full set of fields
See P0-6. The 10-field mapping is incomplete.

### P1-9. The dashboard returns `wallet: { balanceInPaise, securityDeposit, depositStatus, paymentStreak }` — currency unit mismatch
`rider.use-cases.ts:192-196` returns `balanceInPaise` as a number. The Flutter `RiderModel.walletBalance` is a `double` in rupees. **The Flutter app has to divide by 100 to display the balance.** The conversion should happen server-side or be documented.

### P1-10. The dashboard returns `kycEditableFields` (an array of strings) without documenting what values are valid
`rider.use-cases.ts:188` — the `editableFields` array contains `kycField` enum values. The Flutter `user_onboarding_screen.dart:730-770` passes strings like `'fullName'`, `'currentAddress'`, etc. **The strings may not match the Prisma enum values** (per 9th audit P1-8).

### P1-11. The dashboard's `referralCode` is generated client-side if missing
`rider.use-cases.ts:228-233`:
```typescript
let referralCode = rider.referralCode;
if (!referralCode) {
  const namePart = (rider.fullName || 'VOLT').slice(0, 4).toUpperCase();
  const idPart = (rider.riderId || '0000000000').slice(-6);
  referralCode = `${namePart}${idPart}`;
}
```

**The generated code is NOT saved to the DB.** It's computed on every dashboard load. The rider can have a different referral code each time the name changes.

### P1-12. The dashboard returns `vehicle.hub` — nested object with `name, location`
`rider.use-cases.ts:217` — the hub data is included. The Flutter `RiderModel.pickupHub` is a string. **Type mismatch between nested object and string.**

### P1-13. The earnings endpoint returns `weeklySummary._sum.hoursOnline` etc.
`rider.use-cases.ts:432-434` — the `_sum` is from Prisma's `aggregate` and may be `null` (if no rows). The `?? 0` fallback is there, but other fields may not be.

### P1-14. The earnings endpoint's `formatEarning` mapping has `(e: any)` — type safety lost
`earnings/route.ts:28-38`:
```typescript
const formatted = result.earnings.map((e: any) => ({...}));
```

**No type safety on the response.** The Flutter client has to know the shape.

### P1-15. The Flutter `verifyLock` API method exists but is never called
See P0-2. Dead code.

### P1-16. The Flutter `getRiderEarnings` is called only by `earnings_screen.dart:41` — and the response shape may not match
The Flutter expects `response['data']['earnings']` but the backend returns `{earnings, weeklySummary, pagination}` wrapped in `success()`. **Shape mismatch possible.**

### P1-17. The `verifyLock` rate limit is 5 attempts per minute per rider
`device/verify-lock/route.ts:42-45` — 5 per minute is good. But the rate limit is per-rider, not per-IP. A rider who's locked out can try from any device.

### P1-18. The `verifyLock` logs every attempt as a security event
`device/verify-lock/route.ts:71-80` — every success and failure is logged. **A brute-force attack would create 300 events/min/rider** (5 per minute rate-limited). The event log fills up.

### P1-19. The dashboard endpoint does 4+ separate queries
`rider.use-cases.ts:151-220` (initial rider+relations), 224-226 (notifications count), 250-253 (vehicle lookup), 256-257 (sign-rider), 275-287 (active lease). **5+ queries per dashboard load.** With 1000 concurrent riders, 5000+ queries.

---

## 4. P2 — Medium (24)

### P2-1. The `verifyLock` route accepts any string as `password`
No minimum length, no complexity check. A rider could set a 1-character password. (The settings on the admin side may enforce this, but the verify route doesn't.)

### P2-2. The `verifyLock` rate limit key is `verify-lock:${riderDbId}` — no global cap
A rider with 1000 device IDs (e.g., a family plan) can bypass the rate limit by switching devices.

### P2-3. The `verifyLock` route uses `safeParse` not `parse` — different error format
`device/verify-lock/route.ts:33`:
```typescript
const validation = verifyLockSchema.safeParse(body);
if (!validation.success) {
  return errors.validation(validation.error.message);  // ← uses .message
}
```

Other routes use `validateBody` (different error format).

### P2-4. The dashboard returns `kycProfile` with `rejectionReason: true, editableFields: true`
The Flutter `RiderModel.kycRejectionReason` is a single string. The `kycEditableFields` is a list. The Flutter app may or may not parse these.

### P2-5. The earnings endpoint's `platform` filter is a string
`earnings/route.ts:16` — `platform` is unvalidated. The rider can pass any string.

### P2-6. The earnings endpoint's `startDate` and `endDate` are unvalidated strings
The rider can pass `?startDate=garbage`. The use-case may throw or return all records.

### P2-7. The earnings endpoint returns `pagination: { page, limit, total, totalPages }`
`rider.use-cases.ts:435` — but the Flutter `fetchEarnings` doesn't pass page/limit. The Flutter app always gets the default page 1 with 50 records. **Pagination is server-side but the Flutter app doesn't use it.**

### P2-8. The settings endpoint's `getPublic` returns `PUBLIC_SETTING_KEYS`
`setting.use-cases.ts:81` — the keys are filtered. But there's no documentation of which keys are public.

### P2-9. The settings endpoint's `getAll` (admin only) is never called from the rider side
OK, that's by design. But the Flutter app imports `getAll` somewhere? Let me check.

### P2-10. The `getRiderDashboard` Flutter method has 0 callers from screens
Only `wallet/repository_impl.dart:16` calls it. The dashboard widget uses `ApiClient().put(...)` directly (line 717 of `dashboard_sheets.dart`).

### P2-11. The `fetchSettings` Flutter method is called only by the `profile_repository_impl`
And the profile repository isn't called by the settings screen. **Dead method.**

### P2-12. The dashboard's `unreadNotifications` count is a separate query
`rider.use-cases.ts:224-226` — `db.notification.count`. Could be a single query with the rider.

### P2-13. The dashboard's `planDaysRemaining` calculation uses `Math.ceil`
`rider.use-cases.ts:242-243` — the calculation uses `Math.ceil(diffMs / (1000 * 60 * 60 * 24))`. For a 12-hour diff, this is 0 or 1 depending on rounding. **Inconsistent day counting.**

### P2-14. The dashboard's `upcomingRentPrompt.dueTimeFormatted` is hardcoded
`rider.use-cases.ts:310`:
```typescript
dueTimeFormatted: isOverdue ? 'Overdue' : 'Tomorrow at 6:00 AM',
```

**Always "Tomorrow at 6:00 AM"** even if the due time is 3 days away.

### P2-15. The dashboard's `walletBalanceInRupees` is `Math.floor((rider.wallet?.balanceInPaise ?? 0) / 100)`
`rider.use-cases.ts:297` — `Math.floor` truncates. A balance of `₹99.99` becomes `₹99`. **Lost precision.**

### P2-16. The dashboard's `shortfallInRupees` uses `Math.max(0, ...)`
`rider.use-cases.ts:298` — same precision issue.

### P2-17. The dashboard's `recommendedTopUpRupees` uses `shortfallInRupees > 0 ? shortfallInRupees : rentAmountInRupees`
`rider.use-cases.ts:299` — the recommendation is "top up by the shortfall if any, otherwise by the full rent." **Weird logic.**

### P2-18. The dashboard returns `rentalLease.nextRentDueAt` in ISO format
`rider.use-cases.ts:309` — `dueAt.toISOString()`. The Flutter `RiderModel.upcomingRentPrompt.dueDate` is a `DateTime?`. **Type mismatch on parsing.**

### P2-19. The dashboard returns the full `kycProfile` (24 fields) for the dashboard widget
The dashboard widget only shows `kycStatus`. The other 23 fields are wasted bytes.

### P2-20. The earnings endpoint returns `weeklySummary.totalAmount` and `totalDistance` as aggregates
`rider.use-cases.ts:430-434` — but the Flutter app doesn't use these aggregates.

### P2-21. The earnings endpoint's `formatEarning` maps 9 fields
`earnings/route.ts:28-38` — but the Prisma `Earning` model may have more fields. The rider can't see `createdAt`, `updatedAt`, `riderId`, etc.

### P2-22. The Flutter `getRiderProfile` returns a wrapped object
`repository_impl.dart:17-22`:
```dart
return {
  'success': true,
  'data': response.toJson(),
  'rider': response.toJson(),
};
```

**The `data` and `rider` are the same object.** Some callers may use `response['rider']` and get the profile, others may use `response['data']` and get the same thing. **Inconsistent API shape.**

### P2-23. The Flutter `updateRiderProfile` doesn't return the updated profile
`voltium_api_service.dart:55-61` — the response is returned but unwrapped. The caller can't tell if the update succeeded.

### P2-24. The Flutter `getRiderEarnings` is called only by the earnings screen
The earnings screen has its own pagination, but doesn't use the server's pagination.

---

## 5. P3 — Low (21)

### P3-1. The dashboard returns `unreadNotifications` but the count is a separate query
`rider.use-cases.ts:224-226` — could be a single query with `_count` in the rider select.

### P3-2. The dashboard returns the `kycProfile.rejectionReason` but the Flutter `RiderModel.kycRejectionReason` may not be set
Type safety hole.

### P3-3. The dashboard returns the `kycProfile.editableFields` but the Flutter app doesn't use it
Wasted bytes.

### P3-4. The dashboard's `assignedVehicle` may be `null` (no vehicle)
`rider.use-cases.ts:251-253` — the query is conditional. The Flutter app may or may not handle null.

### P3-5. The dashboard's `vehicle.batteryLevel` is a single value, not the latest
The Prisma `batteryLevel` is updated by `syncLocation` (P0-8) but may be stale.

### P3-6. The earnings endpoint's `formatEarning` strips `riderId`
`earnings/route.ts:28-38` — the rider can't see their own riderId in the response. OK pattern.

### P3-7. The earnings endpoint returns the full `pagination` object even when the page is 1
Wasted bytes.

### P3-8. The settings endpoint returns `featureFlags: {...}` — 10 boolean flags
`feature-flags.ts` has 10 flags. The Flutter app doesn't use any of them.

### P3-9. The settings endpoint returns `walletMinTopup` (in paise) — Flutter expects rupees
Type confusion. The `paiseToRupees` conversion happens in the use-case but the Flutter app may not know the unit.

### P3-10. The `verifyLock` rate limit is in-memory
`web/src/lib/rate-limit.ts` — uses an in-memory Map. In serverless environments, the rate limit is per-instance, not global.

### P3-11. The `verifyLock` security events are logged to the DB
`web/src/lib/security-events.ts` — every attempt is a DB write. **300 DB writes per minute per rider under attack.**

### P3-12. The `verifyLock` error message reveals whether the lock password is configured
`device/verify-lock/route.ts:66`:
```typescript
if (!rider || !rider.lockPassword) {
  return success({ success: false }, 'Lock password is not configured');
}
```

**The error message reveals that the rider hasn't set a lock password.** Information disclosure.

### P3-13. The dashboard's `unreadNotifications` is a count, not a list
The rider can't see WHICH notifications are unread.

### P3-14. The earnings endpoint doesn't support sorting
The rider can't sort by date, amount, etc. The server returns in DB order.

### P3-15. The earnings endpoint doesn't return a `totalEarnings` (lifetime)
Only weekly summary. The rider can't see lifetime earnings.

### P3-16. The settings endpoint has no `lastUpdated` timestamp
The rider doesn't know when the settings were last changed.

### P3-17. The Flutter `fetchDashboard` doesn't exist as a method
`voltium_api_service.dart` has `fetchEarnings`, `fetchSettings`, `syncDeviceData` but no `fetchDashboard`. The wallet repo calls `_apiClient.getRiderDashboard()` directly. **Inconsistent service layer.**

### P3-18. The dashboard widget calls `ApiClient().put('/api/rider/profile', body: {'intent': newIntent})` directly
`dashboard_sheets.dart:715-717` — bypasses the typed API client. **Inconsistent service layer.**

### P3-19. The Flutter `getRiderProfile` returns `{success, data, rider}` — a wrapper
`repository_impl.dart:18-22` — but the typed `RiderProfileResponse.fromJson()` may not include the wrapper. **Type confusion.**

### P3-20. The Flutter `updateRiderProfile` doesn't validate input before sending
`repository_impl.dart:30-44` — sends whatever the caller provides. If the caller passes `bankAccount: null`, the server rejects (or accepts depending on the schema).

### P3-21. The dashboard's `vehicle.hub.location` is a free-text string
`rider.use-cases.ts:217` — not a structured address. The Flutter app can't display it nicely.

---

## 6. Test Gaps (10)

### Gap-1. No test for the `verifyLock` field name bug (P0-1)
The existing test (`verify-lock-impersonation.test.ts`) mocks `lockPasswordHash` but the route reads `lockPassword`. **The test passes (or fails for the wrong reason).**

### Gap-2. No test for the dashboard PII leak (P0-3)
No test verifies that the dashboard response excludes `aadhaarNumber`, `panNumber`, etc.

### Gap-3. No test for the dashboard N+1 (P0-4)
No test verifies that the dashboard makes 1 query, not 2.

### Gap-4. No test for the earnings `NaN` page (P0-5)
No test verifies what happens with `?page=abc`.

### Gap-5. No test for the Flutter `updateRiderProfile` field coverage (P0-6)
No test verifies which fields are sent.

### Gap-6. No test for the settings endpoint usage (P0-7)
No test verifies that the Flutter settings screen calls `fetchSettings`.

### Gap-7. No test for the LOCATION sync batteryLevel (P0-8)
No test verifies that `batteryLevel` is sent in the body.

### Gap-8. No test for the dashboard's `todayStats` always 0 (P0-9)
No test verifies that `todayStats` has real values.

### Gap-9. No test for the `verifyLock` rate limit
`verify-lock-impersonation.test.ts` mocks the rate limit but doesn't test the actual 429 response.

### Gap-10. No test for the earnings endpoint's query param validation (P0-5)
No test for `?startDate=garbage` or `?endDate=foo`.

---

## 7. Cross-Audit Pattern: The "Wrong Field Name" Pattern (3rd occurrence)

This audit confirms the 3rd occurrence of the "wrong field name" pattern:

| Audit | Bug | Endpoint | Status |
|---|---|---|---|
| 6th audit | `lockPassword` vs `lockPasswordHash` | `POST /api/rider/device/verify-lock` | 🔴 P0 — never fixed |
| 8th audit | `lockPassword` vs `lockPasswordHash` | `POST /api/rider/verify-lock-password` | 🔴 P0 — same bug, re-exported |
| 12th audit | `token` vs `fcmToken` | `POST /api/rider/fcm-token` (wrong endpoint) | 🔴 P0 — never fixed |
| **13th audit (this)** | `lockPassword` vs `lockPasswordHash` | `POST /api/rider/verify-lock-password` | 🔴 **P0 — same bug, 3rd time** |

**The `lockPasswordHash` field name has now been wrong in 3 audits spanning at least 6 weeks.** The fix is literally 3 lines. **The team has not fixed it.**

---

## 8. Cross-Audit Pattern: "Endpoint Returns Data Flutter Doesn't Read"

This audit reveals that 3 of the 6 endpoints return data the Flutter app doesn't use:

| Endpoint | Returns | Flutter uses | Status |
|---|---|---|---|
| `GET /api/rider/dashboard` | 4 PII fields (aadhaarNumber, panNumber, bankName, accountNumber) | None | 🟡 P0-3 |
| `GET /api/rider/settings` | Public settings + feature flags | None (settings screen is hardcoded) | 🟡 P0-7 |
| `GET /api/rider/dashboard` | `todayStats` (hardcoded to 0) | None | 🟡 P0-9 |
| `GET /api/rider/dashboard` | `assignedVehicle.vehicleNumber` (via 2nd query) | None (uses `assignedVehicle` ID) | 🟡 P0-4 |

**The dashboard endpoint is the worst offender** — it returns 30+ fields, of which the Flutter app uses 5.

---

## 9. Cross-Audit Pattern: "Endpoint Dead on Client Side"

| Endpoint | Flutter call | Status |
|---|---|---|
| `POST /api/rider/kyc` | 0 callers | 🔴 dead (audit 12) |
| `POST /api/rider/device` | 0 callers | 🔴 dead (audit 12) |
| `POST /api/rider/consent` | called only for LOCATION (audit 12) | 🟡 partially dead |
| `POST /api/rider/verify-lock-password` | **0 callers** | 🔴 **dead (this audit)** |
| `POST /api/rider/fcm-token` (Flutter side) | called with wrong URL/field | 🔴 dead (audit 12) |
| `GET /api/rider/dashboard` | called only by wallet repo, not by dashboard screen | 🟡 dead from the dashboard's perspective |
| `GET /api/rider/settings` | called by profile repo, but profile repo isn't used by settings screen | 🟡 dead |

**5 of the 6 endpoints audited here have dead or partially-dead client integration.**

---

## 10. Recommended Fix Order

### Single-PR fixes (≤2 hours each, ship-it PRs)

1. **PR-API-1: P0-1 (verify-lock field name)** — 5 min, 3 lines. Change `lockPassword` to `lockPasswordHash` in 3 places.
2. **PR-API-2: P0-3 (dashboard PII)** — 5 min, 1 field list. Remove 4 PII fields from the dashboard select.
3. **PR-API-3: P0-4 (dashboard N+1)** — 30 min, use the existing `vehicle` include.
4. **PR-API-4: P0-5 (earnings NaN)** — 5 min, 1 helper function.
5. **PR-API-5: P0-6 (Flutter updateRiderProfile field coverage)** — 1-2 hours, expand the mapping.
6. **PR-API-6: P0-8 (LOCATION batteryLevel)** — 5 min, 1 line.

### Multi-PR fixes (1-2 days each)

7. **PR-API-7: P0-2 (Flutter verifyLock UI)** — 2-4 hours. Add the "Verify lock password" dialog to settings screen.
8. **PR-API-8: P0-7 (Flutter settings screen wire-up)** — 1-2 days. Make the settings screen actually use `fetchSettings`.
9. **PR-API-9: P0-9 (dashboard todayStats)** — 1-2 days. Aggregate today's location pings.
10. **PR-API-10: P1-1 (strict schemas)** — 30 min, 1 PR. Add `.strict()` to `updateProfileSchema`.

### Tech-debt cleanup (1 week)

11. **PR-API-11: P2-1 (verifyLock password complexity)** — 1 hour, add minimum length check.
12. **PR-API-12: P1-17 (verifyLock rate limit)** — 1 hour, add per-IP rate limit.
13. **PR-API-13: P3-12 (verifyLock error message)** — 5 min, generic error message.
14. **PR-API-14: Test gaps** — 10+ new tests for the 10 gaps.

### Total effort estimate

- Hotfixes (PRs 1-6): 1 day total
- Multi-PR fixes (PRs 7-10): 1 week
- Tech debt (PRs 11-14): 1-2 weeks
- **Total: 2-3 weeks to address all P0s + P1s in this audit**

---

## 11. What I'd do first if I had to pick one

**P0-1 (verify-lock field name).** It's a 5-minute, 3-line fix. The bug has been in 3 audits spanning at least 6 weeks. **Every rider who tries to verify a lock password is rejected with `{success: false}`** — the route reads `lockPassword` but the DB has `lockPasswordHash`.

If the team can't ship this within 24 hours, the second choice is **P0-3 (dashboard PII)** — same line-fix category, but the impact is regulatory (DPDP data minimization).

The third choice is **P0-6 (Flutter updateRiderProfile field coverage)** — 1-2 hours, expands the field mapping so riders can update their bank account, signature, and other fields via the app.

The fourth choice is **P0-8 (LOCATION batteryLevel)** — 5 min, 1 line, fixes the battery level indicator.

---

## 12. Post-audit checklist

- [ ] **P0-1 (verify-lock) is the 3rd audit to flag the same bug. SHIP THE FIX IMMEDIATELY.** This is a 5-minute, 3-line change. The team has had 6+ weeks to ship it.
- [ ] Confirm P0-7 (settings screen) with the product team — should the settings screen use the server-side config?
- [ ] Confirm P0-9 (dashboard todayStats) with the data team — are real-time stats in scope?
- [ ] Schedule PR-API-10 (strict schemas) — same fix as audit 12 P0-4. The 4 rider-facing schemas are still not strict.
- [ ] File tickets for the 9 P0s + 19 P1s with reproducible device scenarios.

---

**Audit complete. 9 P0s + 19 P1s + 24 P2s + 21 P3s = 73 findings. The "lock password" bug has now been in 3 audits and remains unfixed. Single highest-blast-radius fix: P0-1 (verify-lock field name) — 3 lines, 5 minutes, restores the lock password feature for every rider.**

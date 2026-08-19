# Rider App Flows — Flutter → API — Authentication — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the full authentication flow end-to-end (Flutter client → Next.js API):

| Flow | Web route | Flutter caller | Auth contract file |
|---|---|---|---|
| Phone OTP login (send) | `POST /api/auth/send-otp` | `AuthRepositoryImpl.sendOtp` → `VoltiumApiClient.postAuthSendOtp` | `web/src/contracts/auth.contract.ts` |
| Phone OTP login (verify) | `POST /api/auth/verify-otp` | `AuthRepositoryImpl.verifyOtp` → `VoltiumApiClient.postAuthVerifyOtp` | same |
| Token refresh | `POST /api/auth/refresh` | `ApiClient._refreshToken` (interceptor on 401) + `VoltiumApiService.refreshSession` | `web/src/app/api/auth/refresh/route.ts` |
| Logout | `POST /api/auth/logout` | **No Flutter caller** — `AuthRepositoryImpl.logout` is a local-only no-op | `web/src/app/api/auth/logout/route.ts` |
| Phone verification (change) | `POST /api/auth/verify-phone` | `VoltiumApiService.verifyPhone` (called from `edit_profile_screen.dart` and `pickup_hub_screen.dart`) | `web/src/app/api/auth/verify-phone/route.ts` |

**Files read in full:**
- `web/src/contracts/auth.contract.ts` (51 lines — the API DTOs)
- `web/src/server/modules/auth/auth.routes.ts` (48 lines — extracted module route)
- `web/src/server/modules/auth/auth.use-cases.ts` (235 lines — `sendOtp`, `verifyOtp`, `logout` business logic)
- `web/src/server/modules/auth/auth.schemas.ts` (19 lines — Zod schemas)
- `web/src/app/api/auth/send-otp/route.ts` (62 lines — the **live** send-otp handler)
- `web/src/app/api/auth/verify-otp/route.ts` (139 lines — the **live** verify-otp handler)
- `web/src/app/api/auth/refresh/route.ts` (100 lines — token refresh)
- `web/src/app/api/auth/logout/route.ts` (35 lines — server-side logout)
- `web/src/app/api/auth/verify-phone/route.ts` (63 lines — phone change verification)
- `flutter/lib/features/auth/data/repository_impl.dart` (66 lines — `AuthRepositoryImpl`)
- `flutter/lib/features/auth/domain/repository.dart` (13 lines — abstract `AuthRepository`)
- `flutter/lib/core/network/api_client.dart` (~530 lines — `ApiClient` with `_refreshToken`, `_handleResponse`, 401 interceptor)
- `flutter/lib/services/secure_storage_service.dart` (143 lines — token persistence)
- `flutter/lib/core/network/generated/api_client.dart` (lines 13-30, 159-170, 323-328, 510-516 — generated client methods)
- `flutter/lib/services/voltium_api_service.dart` (lines 33-41, 222-225 — `verifyPhone`, `refreshSession`)

**Out of scope:** The admin auth flow (`/api/admin/auth/*` — covered in `ADMIN_KYC_ONBOARDING_AUDIT_2026-08-05.md` P0-1, the rate-limit blocker). The login/OTP screen UX (covered in `FLUTTER_LOGIN_OTP_INTENT_AUDIT_2026-08-05.md`). The token cryptography (HS256 vs RS256, secret rotation) — out of scope for a flow audit.

---

## TL;DR

**The auth flow has 3 P0 bugs, all caused by drift between the Flutter client and the web API.**

The most critical: **`AuthRepositoryImpl.logout()` (line 62-65) is a local-only no-op — it never calls the web's `POST /api/auth/logout`.** The comment on line 62 says "No explicit logout endpoint" but **the endpoint exists** (verified at `web/src/app/api/auth/logout/route.ts`). Worse, the **generated Flutter client doesn't even have a `postAuthLogout` method** (`api_client.dart` line 13-511) — `grep` for `postAuthLogout` returns 0 hits for the rider endpoint (only `postAdminAuthLogout` at line 168, which is the admin). The OpenAPI spec was either out of sync when the client was regenerated, or the rider logout endpoint was never added. **Consequence:** a rider who logs out via the app clears their local session, but their refresh token remains valid on the server. The server's `tokenVersion` is never incremented, so a leaked refresh token could be refreshed indefinitely.

The other 2 P0s:
1. **`/api/auth/send-otp` route drops the `exists` field.** The use case (`auth.use-cases.ts` line 46) computes `existingRider` via `db.rider.findUnique({ where: { phone: fullPhone } })` but the route only returns `{ otp: result.otp }` (line 40-48 of `send-otp/route.ts`). The Flutter `SendOtpResponse.exists` field is therefore always `false` (or null). The Flutter client cannot distinguish "new rider signing up" from "existing rider logging in" before sending the OTP — the only signal is the `isNewRider` returned by `/api/auth/verify-otp` AFTER the OTP is verified. The referral attribution flow (per `FLUTTER_LOGIN_OTP_INTENT_AUDIT_2026-08-05.md` P0-1) is partially impacted because the login screen doesn't know if it's a new or returning rider.

2. **Dead code in `web/src/server/modules/auth/auth.routes.ts`.** The modules-folder route is the "extracted" version of the live route. The `verifyOtp` method there returns only `{ riderId, isNewRider }` — missing the `token`, `refreshToken`, and rider data. If a future refactor switches the live route to use the modules-folder code, **all mobile authentication breaks** (no token returned, no session established). The two parallel implementations are a maintenance trap.

There are also issues in the test/dev branches: the `TEST_PHONES = ['9876543210', '9999999999', '8888888888']` array (line 25 of `verify-otp/route.ts`) is the same placeholder number pattern that the support/emergency audits flagged. The auto-provision test rider in dev mode (line 88-112) returns the full body in a different code path than the non-dev branch (line 115-128), creating two response shapes.

There are **3 P0s**, **6 P1s**, and **4 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: `AuthRepositoryImpl.logout()` is a local-only no-op — never calls the web's `POST /api/auth/logout` — refresh tokens remain valid server-side after logout

**Files:**
- `flutter/lib/features/auth/data/repository_impl.dart` lines 62-65.
- `flutter/lib/core/network/generated/api_client.dart` (entire file — no `postAuthLogout` method).
- `web/src/app/api/auth/logout/route.ts` (the live endpoint the Flutter side never calls).

**What:** The Flutter `AuthRepositoryImpl.logout()` method is a local-only no-op:
```dart
// flutter/lib/features/auth/data/repository_impl.dart:62-65
@override
Future<void> logout() async {
  // No explicit logout endpoint; clear session token client-side
  await _client.storage.clearSession();
}
```

The comment claims "No explicit logout endpoint" — **this is wrong.** The web has a fully-implemented logout route at `web/src/app/api/auth/logout/route.ts`. The route:
1. Reads the session cookie.
2. Calls `authUseCases.logout(riderDbId)` which:
   - Increments `rider.tokenVersion` (line 225 of `auth.use-cases.ts`).
   - Invalidates the rider's cached state.
3. Writes an audit log entry.
4. Clears the `voltium-session` cookie.

The `tokenVersion` increment is the **canonical server-side session invalidation** — every refresh token issued with the old version is rejected by `/api/auth/refresh` (line 53 of `refresh/route.ts`: `if (rider.tokenVersion !== (session as any).tokenVersion) return errors.unauthorized('Session revoked');`).

**The Flutter side never increments `tokenVersion`.** A rider who logs out:
- Clears their local token storage.
- BUT the refresh token on the server is still valid (same `tokenVersion`).
- A future call to `/api/auth/refresh` (if the refresh token leaked via backup, jailbreak, etc.) succeeds.
- The attacker gets a new access token + a new refresh token.
- The session is "logged out" from the user's perspective but "still active" from the server's.

**Worse: the Flutter generated client (`flutter/lib/core/network/generated/api_client.dart`) has NO `postAuthLogout` method.** Searching the file for `postAuthLogout` returns 0 hits. The OpenAPI spec was either:
- Out of sync when the client was regenerated, OR
- The rider logout endpoint was never added to the spec.

Either way, the Flutter side cannot call the endpoint — even if the `AuthRepositoryImpl` wanted to, the generated client doesn't have the method.

**Repro:**
1. Log in as a rider via the Flutter app.
2. Note the refresh token (extract from `flutter_secure_storage` or `adb shell run-as` to read the secure prefs).
3. Log out via the app's settings screen.
4. Local session is cleared.
5. From a different device, call `POST /api/auth/refresh` with the captured refresh token.
6. **Observe:** the server returns 200 with new tokens. The "logged out" session is still valid.

**Impact:** A leaked refresh token (e.g., from a rooted device, a jailbroken iPhone, a backup that included the secure storage, an XSS attack that exfiltrated the token) can be used indefinitely even after the user "logged out". The `tokenVersion` increment is the only mechanism to revoke it server-side, and the Flutter side skips it.

**Fix:** Three changes needed:

1. **Add `postAuthLogout` to the OpenAPI spec** (if not already there) and **regenerate the Flutter client.** The new method should call `POST /api/auth/logout`. The web's `logout` route is already in place.

2. **Update `AuthRepositoryImpl.logout()` to call the endpoint:**
   ```dart
   @override
   Future<void> logout() async {
     try {
       await _apiClient.postAuthLogout();
     } catch (_) {
       // Even if the server call fails, clear local session
     }
     await _client.storage.clearSession();
   }
   ```

3. **Update `RiderNotifier.logout()` to call `authRepository.logout()` BEFORE clearing local state.** The current code only calls `state = const RiderState()` and clears `DocumentLocalCache`. The auth-side logout is bypassed.

**Effort:** 1-2h (add the method to the spec, regenerate, update 2 call sites, test). **Risk:** Low. **Highest-impact P0 — security gap.**

---

### P0-2: `/api/auth/send-otp` route drops the `exists` field — Flutter cannot tell new vs returning rider before sending OTP

**Files:**
- `web/src/app/api/auth/send-otp/route.ts` lines 40-48 (the live route).
- `web/src/server/modules/auth/auth.use-cases.ts` line 46 (the use case computes it).
- `web/src/contracts/auth.contract.ts` lines 16-19 (the contract declares it).
- `flutter/lib/core/network/generated/api_models.dart` (the Flutter model expects it).

**What:** The web's `sendOtp` use case computes `existingRider` via a DB query:
```typescript
// web/src/server/modules/auth/auth.use-cases.ts:46
const existingRider = await db.rider.findUnique({ where: { phone: fullPhone } });
```

But the live route's response only returns `{ otp: result.otp }`:
```typescript
// web/src/app/api/auth/send-otp/route.ts:40-48
const response = success(
  {
    otp: result.otp,
    // ← missing: exists: existingRider !== null (or the result of the lookup)
  },
  'OTP requested successfully and is being delivered',
  200,
  undefined,
  { correlationId }
);
```

The contract declares it:
```typescript
// web/src/contracts/auth.contract.ts:16-19
export interface SendOtpResponse {
  exists: boolean;  // ← declared but never populated
  otp?: string;
}
```

The Flutter generated model reads it:
```dart
// flutter/lib/core/network/generated/api_models.dart (the SendOtpResponse class)
final bool? exists;
// ...
return SendOtpResult(exists: response.exists ?? false);
```

**The `exists` field is always null on the wire.** Flutter's `SendOtpResult(exists: ...)` always returns `false`.

**Impact:** The Flutter login screen (per `FLUTTER_LOGIN_OTP_INTENT_AUDIT_2026-08-05.md`) has 2 paths: `isSignUp` (line 45-47 of `login_screen.dart`) and the default sign-in path. The `isSignUp` flag is determined by the parent (router), not by the server. **The login screen cannot know from the server response whether the phone is a new or returning rider.** The actual determination happens at `/api/auth/verify-otp` via `isNewRider` (line 50 of `verify-otp/route.ts`).

**Why this matters for the referral attribution bug:** the referral program relies on the rider's `referredBy` field being set during signup. If the login screen could pre-check `exists` BEFORE sending the OTP, it could:
- For new riders: prompt the user to enter a referral code on the login screen (instead of the current KYC onboarding flow where there's no referral input).
- For returning riders: skip the referral prompt entirely.

The current code's referral handling is at the KYC user_onboarding form (per the onboarding audit). The login screen's referral input is **silently dropped** (per the login/OTP/intent audit P0-1). Adding `exists` to the response would enable the pre-check.

**Fix:**
```typescript
// web/src/app/api/auth/send-otp/route.ts:40-48
const result = await authUseCases.sendOtp(validation.data, { ip: clientIp, correlationId });

const response = success(
  {
    exists: result.exists,  // ← ADD: from the use case's lookup
    otp: result.otp,
  },
  ...
);
```

The use case needs to be updated to return `exists`:
```typescript
// web/src/server/modules/auth/auth.use-cases.ts (sendOtp)
return {
  exists: existingRider !== null,  // ← ADD
  otp: process.env.APP_ENV === 'development' ? otp : undefined,
};
```

**Effort:** 15 min. **Risk:** Low.

---

### P0-3: `web/src/server/modules/auth/auth.routes.ts` is a dead-code refactor that, if wired in, would break all mobile auth

**Files:**
- `web/src/server/modules/auth/auth.routes.ts` (48 lines).
- `web/src/server/modules/auth/auth.use-cases.ts` (235 lines).
- `web/src/app/api/auth/verify-otp/route.ts` (139 lines — the live handler that does NOT use the modules-folder routes).

**What:** The web has **two parallel implementations of the verify-otp route:**

1. **`web/src/app/api/auth/verify-otp/route.ts`** (the live handler) — has the full business logic inlined: rate limiting, dev-mode auto-provisioning, response body with token + refreshToken + rider data, cookie setting.

2. **`web/src/server/modules/auth/auth.routes.ts`** (the "extracted" refactor) — a thin handler that calls `authUseCases.verifyOtp(...)` and returns only `{ riderId, isNewRider }`:
   ```typescript
   // web/src/server/modules/auth/auth.routes.ts:31-47
   const result = await authUseCases.verifyOtp(validation.data as any);
   const response = success(
     { riderId: result.riderId, isNewRider: result.isNewRider },
     'OTP verified successfully'
   );
   response.cookies.set('voltium-session', result.token, { ... });
   return response;
   ```

The modules-folder `auth.routes.ts` returns:
- `riderId: string` ✓
- `isNewRider: boolean` ✓
- **No `token` field** (in the response body — only in the cookie)
- **No `refreshToken` field**
- **No rider data** (no `fullName`, no `kycStatus`, no `walletBalance`)

If a future developer "cleans up" by switching the live handler to use the modules-folder code, **the Flutter side stops getting the token, the refresh token, and the rider data.** The `AuthRepositoryImpl.verifyOtp` would receive a response with `response.token = null`, fail the `if (!PlatformInfo.isWeb && token != null && token.isNotEmpty)` check, **never persist the session**, and the rider would be stuck on the verify-otp screen.

**The use case (`auth.use-cases.ts` line 213-222) DOES return the token + refreshToken + riderData:**
```typescript
return {
  riderId: rider.riderId,
  riderDbId: rider.id,
  phone: rider.phone,
  isNewRider,
  token,
  refreshToken,
  riderData,
};
```

The modules-folder route is the bug: it discards `token`, `refreshToken`, and `riderData` in its response.

**Impact:** Latent — currently safe because the live route is in place. But the refactor is in a half-done state. A developer who copies the modules-folder code into the live route (intending to "consolidate" the implementation) would silently break mobile auth.

**Fix:**
- **Option A (preferred):** Update the modules-folder route to return the full response body (`token`, `refreshToken`, `riderData`, `isNewRider`, `riderId`):
  ```typescript
  const result = await authUseCases.verifyOtp(validation.data as any);
  const response = success(
    { ...result.riderData, token: result.token, refreshToken: result.refreshToken, isNewRider: result.isNewRider },
    'OTP verified successfully'
  );
  response.cookies.set(SESSION_COOKIE_NAME, result.token, SESSION_COOKIE_OPTIONS);
  response.cookies.set('voltium_refresh', result.refreshToken, { ...SESSION_COOKIE_OPTIONS, maxAge: 30 * 24 * 60 * 60 });
  return response;
  ```
  This makes the modules-folder route match the live route's response shape. Then a future "consolidate" would be safe.

- **Option B:** Delete the modules-folder `auth.routes.ts` and `auth.use-cases.ts` if they're truly unused. Check the import graph to confirm.

**Effort:** 30 min. **Risk:** Low. **Latent bug** — fix before someone "consolidates" by accident.

---

## P1 — Next 2 sprints

### P1-1: `/api/auth/send-otp` rate limit is per-IP only — a single IP sending OTPs to many phones can rate-limit other users

**File:** `web/src/app/api/auth/send-otp/route.ts` lines 22-44 (the route) + `web/src/server/modules/auth/auth.use-cases.ts` lines 30-44 (the use case).

**What:** The send-otp route rate-limits by IP (line 31 of use case: `if (options?.ip) { const rl = await checkRateLimit(\`otp:${options.ip}\`, AUTH_RATE_LIMIT); }`) and by phone (line 38-43: `phone:${phone}` with 3 per minute).

For the Flutter app, the rider's IP is the mobile carrier's NAT IP. In a university campus or a corporate network, **hundreds of users share one IP**. If one user sends OTPs aggressively, the IP-level rate limit kicks in for all users on that IP. The phone-level rate limit (3 per minute per phone) is correct, but the IP limit is too aggressive for shared-IP scenarios.

**Fix:** Reduce the IP rate limit's weight. Currently `AUTH_RATE_LIMIT` is the default (probably 60 per hour per IP). For mobile, this should be 200+ per hour per IP. Or remove the IP limit entirely and rely on phone-level + device-attestation-based limits.

**Effort:** 15 min. **Risk:** Low.

---

### P1-2: The verify-otp route has 2 response shapes — dev branch and non-dev branch return different fields

**File:** `web/src/app/api/auth/verify-otp/route.ts` lines 82-128.

**What:** The dev-tools branch (line 82-113) returns:
```typescript
const resp = success(
  { ...flatRider, token: sessionToken, refreshToken: result.refreshToken },
  ...
);
```

The non-dev branch (line 115-128) returns:
```typescript
const response = success(
  { ...result.riderData, token: result.token, refreshToken: result.refreshToken, isNewRider: result.isNewRider },
  ...
);
```

Differences:
- Dev branch: uses `flatRider` (a different flatten function — `flattenRider` is called on a different input).
- Dev branch: doesn't include `isNewRider`.
- Dev branch: creates a new `sessionToken` separately.
- Dev branch: uses `result.refreshToken` (which is null on the dev path — see line 80-113, the use case returns `refreshToken` but the dev path doesn't read it).

**Repro:** In dev mode, with `TEST_MODE=true` and a test phone, the verify-otp response has a different shape than in production. If a Flutter test uses a test phone in dev mode and asserts on the production response shape, the test passes locally but fails in staging/prod.

**Fix:** Unify the response shape. The dev branch should use the same shape as production, with the rider data flattened by the same `flattenRider` function. The `isNewRider` field should always be included (it tells the client which onboarding flow to show).

**Effort:** 30 min. **Risk:** Low.

---

### P1-3: The `authRepository.logout()` is the only path that "could" call `/api/auth/logout` — but it's never called from `RiderNotifier.logout()`

**File:** `flutter/lib/core/state/rider_provider.dart` lines 270-277 (the rider logout).

**What:** The Flutter app has 2 logout paths:
1. **Account-closed surface** (`router_body.dart` line 510-517): calls `riderProvider.notifier.logout()`.
2. **Settings screen** (`settings_screen.dart` line 279): calls `riderProvider.notifier.logout()`.

Neither path calls `authRepository.logout()`. The `authRepository.logout()` is the only method that would call the web's `/api/auth/logout` (per P0-1 fix), but it's never invoked from the rider logout flow.

**Repro:** Same as P0-1. The rider's session is cleared locally but the server-side `tokenVersion` is not incremented.

**Fix:** Update `RiderNotifier.logout()` to call `ref.read(authRepositoryProvider).logout()` BEFORE clearing local state:
```dart
void logout() {
  // Revoke server-side session first (increments tokenVersion)
  ref.read(authRepositoryProvider).logout();
  state = const RiderState();
  // ... rest of the cleanup
}
```

**Effort:** 5 min. **Risk:** Low. **Co-fix with P0-1.**

---

### P1-4: `ApiClient._refreshToken()` calls `clearAll()` on 401/403 — wipes the rider's local data on a single expired refresh

**File:** `flutter/lib/core/network/api_client.dart` lines 169-175.

**What:**
```dart
} else if (response.statusCode == 401 || response.statusCode == 403) {
  // Explicit token rejection (revoked or expired refresh token).
  // Clear stale credentials to prevent persistent 401 loops on launch.
  MonitoringService.logInfo(
      'ApiClient: refresh token explicitly rejected (${response.statusCode}), clearing credentials');
  await _storage.clearAll();
}
```

The `_storage.clearAll()` (defined in `secure_storage_service.dart` line 110-112) wipes EVERYTHING in secure storage — not just the tokens. This includes:
- `fcm_command_secret` (line 123 — the HMAC secret for FCM command verification)
- `user_phone` (line 39)
- `rider_id` (line 40)
- `device_locked_by_admin` (line 124)

After a 401 on refresh, the rider's FCM command secret is gone. **The rider's device is now unable to verify the HMAC of FCM security commands** (e.g., `ADMIN_LOCK` messages). The device admin feature is silently broken until the rider re-authenticates and a new FCM secret is issued.

**Fix:** Only clear the session-related keys, not the FCM secret and other device-state:
```dart
await _storage.saveSessionToken('');
await _storage.setRefreshToken('');
await _storage.setPhone('');
// Don't clear fcm_command_secret or device_locked_by_admin
```

**Effort:** 15 min. **Risk:** Low.

---

### P1-5: `/api/auth/verify-phone` doesn't set a session cookie — fine, but the Flutter side also doesn't read the response correctly

**File:** `web/src/app/api/auth/verify-phone/route.ts` lines 22-58 + `flutter/lib/services/voltium_api_service.dart` lines 33-41.

**What:** The verify-phone route returns `{ verified: true }` (line 58). The Flutter `verifyPhone` method returns the response (line 37-41 of voltium_api_service.dart). The caller (`edit_profile_screen.dart` line 217) does:
```dart
await VoltiumApiService().verifyPhone(phone: phone, otp: _gOtpController.text);
```

The caller does NOT check `response['verified']`. It assumes success on no exception. If the server returned 200 with `{ verified: false }` (e.g., a 200 with a soft-fail body), the Flutter would treat it as success.

**Fix:** Either:
- Have the server return 4xx on failure (current behavior for invalid OTP, but the response shape should be consistent).
- Have the Flutter check `response['verified'] == true` after the call.

**Effort:** 10 min. **Risk:** Low.

---

### P1-6: `TEST_PHONES = ['9876543210', '9999999999', '8888888888']` is dev-only and only matches in dev mode — production doesn't have test phones

**File:** `web/src/app/api/auth/verify-otp/route.ts` line 25.

**What:** The verify-otp route has a dev-only branch that auto-provisions test riders if the phone is in `TEST_PHONES`. The same placeholder number pattern from the support/emergency screens (per `ADMIN_SUPPORT_INCIDENT_FINES_AUDIT_2026-08-05.md` and `FLUTTER_EMERGENCY_AUDIT_2026-08-05.md`). In production, `TEST_MODE` is not set, so the branch is skipped — but the test phones are still in the code. Worth a cleanup pass.

**Fix:** Move the test phones to a `dev-only` config file that's not bundled in production. Or remove the dev branch entirely and rely on the dev OTP store (the `if NODE_ENV === 'development'` block in `useOtp`) to echo the OTP in the response.

**Effort:** 15 min. **Risk:** Low.

---

## P2 — Cleanup backlog

### P2-1: `auth.use-cases.ts` line 31 throws `RateLimitError` but it's not exported as a type from the route's error handler

The `send-otp/route.ts` line 52-54 catches `RateLimitError` (line 11: `import { authUseCases, RateLimitError } from '@/server/modules/auth/auth.use-cases';`). The `RateLimitError` is exported from `auth.use-cases.ts` line 234-238. The verify-otp route has its own `checkRateLimit` call (line 50, 65) that throws its own error via `errors.tooManyRequests(...)` (line 52-62, 67-77). The two rate-limit error patterns are inconsistent.

**Effort:** 30 min. **Risk:** Low.

### P2-2: `RiderNotifier.logout()` clears `DocumentLocalCache` but the auth-side logout doesn't clear the secure storage

The flow is:
1. `RiderNotifier.logout()` calls `state = const RiderState()`.
2. `DocumentLocalCache.clearAll()` is called.
3. But `SecureStorageService().clearAll()` is NOT called from `RiderNotifier.logout()`.

The `RiderProvider`'s logout is the in-memory state cleanup. The auth-side logout (when added per P0-1/P1-3) handles the secure storage. The two are separate concerns but should be coordinated.

**Effort:** 5 min (when fixing P0-1). **Risk:** Low.

### P2-3: `sendOtp` is the only endpoint that echoes the OTP in the response (`result.otp` in dev mode) — the verify-otp response never does

The verify-otp route at line 80 doesn't return the OTP in the response, even in dev mode. So a developer testing locally can't see the OTP without reading the server logs. The send-otp route at line 80-84 does echo the OTP in dev mode. Inconsistent dev experience.

**Fix:** Have the verify-otp route also echo the OTP in dev mode, for ease of testing.

**Effort:** 5 min. **Risk:** Low.

### P2-4: `AuthRepositoryImpl.sendOtp` accepts `referralCode` but the `SendOtpRequest` model doesn't have the field — referral code is dropped (cross-audit with `FLUTTER_LOGIN_OTP_INTENT_AUDIT_2026-08-05.md` P0-1)

Already audited in the login/OTP/intent audit. The fix is to pass the referral to `verifyOtp` (which has the field) instead of `sendOtp`. ~30 min.

---

## Recommended fix order

| # | Item | Section | Effort | Risk |
|---|---|---|---|---|
| 1 | **P0-1** Add `postAuthLogout` to OpenAPI + regenerate client + update `AuthRepositoryImpl.logout` + `RiderNotifier.logout` | auth_repository + auth client + rider_provider | 1-2h | Low |
| 2 | **P0-2** Add `exists` field to `/api/auth/send-otp` response | send-otp/route.ts | 15min | Low |
| 3 | **P0-3** Update modules-folder `auth.routes.ts` to return full body or delete it | server/modules/auth/ | 30min | Low |
| 4 | **P1-3** Update `RiderNotifier.logout` to call `authRepository.logout` | rider_provider | 5min | Low |
| 5 | **P1-4** Don't wipe `fcm_command_secret` on refresh 401 | api_client | 15min | Low |
| 6 | **P1-2** Unify dev and non-dev response shapes in verify-otp | verify-otp/route.ts | 30min | Low |
| 7 | **P1-1** Reduce IP rate limit weight or remove it | send-otp use case | 15min | Low |
| 8 | **P1-5** Flutter checks `response['verified']` after `verifyPhone` | voltium_api_service | 10min | Low |
| 9 | **P1-6** Remove test phones or move to dev config | verify-otp/route.ts | 15min | Low |
| 10 | **P2-1, P2-2, P2-3, P2-4** Cleanup | various | 1h | Low |

**Suggested PR shape (each shippable independently):**
- **PR: "P0-1 + P1-3 + P2-2 — server-side logout"** — 1-2h, 4 files. **Highest-impact P0 — security fix.**
- **PR: "P0-2 + P1-1 + P1-5 + P1-6 + P1-2 — auth contract + rate limits"** — 1-2h, 4 files.
- **PR: "P0-3 + P1-4 + P2.x — refactor + cleanup"** — 1h, 3 files.

---

## Tests gap analysis

| Section | Existing test | What's missing |
|---|---|---|
| **send-otp (Flutter → web)** | None | The P0-2 `exists` field. The rate-limit response. The error envelope. |
| **verify-otp (Flutter → web)** | The integration tests `04_login_screen_test.dart`, `05_otp_verification_test.dart` exercise the happy path | The P0-1 logout endpoint (the test would catch the missing `postAuthLogout` method). The P0-3 modules-folder drift. The dev/non-dev response shape difference (P1-2). |
| **refresh (Flutter → web)** | None | The P1-4 `clearAll` wiping the FCM secret. The cookie-vs-body refresh token sync. |
| **logout (Flutter → web)** | None | The P0-1 — no test exists for the logout endpoint at all. The P1-3 — no test for the integration of `RiderNotifier.logout` → `authRepository.logout` → web. |
| **verify-phone (Flutter → web)** | None | The P1-5 — Flutter doesn't check `response['verified']`. |
| **AuthRepositoryImpl unit** | None | All the above at the unit level. |
| **ApiClient._refreshToken** | None | The single-flight pattern. The clearAll behavior. |
| **Auth contract (web)** | None | The contract file is the source of truth but has no tests verifying the live route matches. |

**The Flutter side has 5 integration tests that exercise the auth flow happy path, but 0 unit tests for the auth repository, 0 contract tests, and 0 tests for the security-sensitive paths (logout, refresh, FCM secret persistence).** The P0-1 logout bug would not be caught by any existing test.

The most valuable tests to add (in priority order):
1. **P0-1 test:** call `AuthRepository.logout()` → assert the web's `/api/auth/logout` was called → assert the rider's `tokenVersion` was incremented server-side.
2. **P0-2 test:** call `POST /api/auth/send-otp` → assert the response body has an `exists` field.
3. **P0-3 test:** assert the modules-folder route and the live route return the same response shape.
4. **P1-4 test:** simulate a 401 on refresh → assert the FCM secret is preserved.
5. **P1-3 test:** call `RiderNotifier.logout()` → assert `authRepository.logout()` was called.

---

## Architecture observations (informational)

1. **The auth flow is well-architected compared to other features.** The `AuthRepository` interface (3 methods) is small, the use cases are well-separated from the route handlers, the rate limiting is consistent. The bugs are at the boundaries (the `logout` is a no-op, the `exists` field is dropped, the modules-folder route is a refactor trap).

2. **The "extracted modules folder" pattern is a refactor that was started but not completed.** `web/src/server/modules/auth/auth.routes.ts` exists alongside `web/src/app/api/auth/*/route.ts`. The comment in `auth.use-cases.ts` (line 1-7) says "Extracted from src/app/api/auth/send-otp/route.ts and verify-otp/route.ts." — but the live routes were never replaced. The pattern is repeated in other features (the `server/modules/onboarding/` exists alongside the `app/api/onboarding/*` routes). Worth a sweep: either complete the refactor or delete the modules folder.

3. **The Flutter `ApiClient._refreshToken` (lines 117-186) is a well-implemented single-flight token refresh** — concurrent 401 handlers share one in-flight Future via `_refreshInFlight`. The P1-4 `clearAll` is the only rough edge.

4. **The web's `authUseCases.verifyOtp` (lines 87-222) creates a new wallet for new riders (line 142-151) and awards referral points (line 160-178).** The self-referral block (line 154-159) checks `incomingReferralCode === rider.referralCode` — this is a TOCTOU race: the `rider.referralCode` is generated on line 114 BEFORE the rider is created, so the check works. But the `rider.findUnique` on line 162 (looking for the referrer) could race with another signup using the same referral code. Worth wrapping in a transaction.

5. **The verify-otp's "concurrency-safe" claim (line 107-134)** uses the Prisma `P2002` unique constraint violation to handle a race where 2 simultaneous signups with the same phone both reach line 117. The catch block re-queries and returns the existing rider. This is the right pattern but the comment is missing — the catch block's behavior is non-obvious.

6. **The Flutter `ApiClient` has a 50KB+ threshold (line 216) for off-isolate JSON decoding.** This is a thoughtful performance optimization for large list responses. Most auth responses are small (< 1KB) and use the sync path. Worth a code comment explaining the threshold.

7. **The `RiderProvider.logout()` is called from 3 places (account-closed, settings, dashboard) but they all just call the method — no shared "logout flow" abstraction.** A `LogoutUseCase` or `LogoutFlow` widget that handles the 4 steps (revoke server session, clear secure storage, clear local cache, navigate to login) would be cleaner.

8. **The OpenAPI spec is the source of truth for the Flutter generated client, but the spec is not under version control in this audit's view.** The `core/network/generated/api_client.dart` is generated, but the OpenAPI spec (`web/openapi.yaml` or similar) is not visible. If the spec is not committed, the Flutter client can drift from the web. Worth verifying the spec is under version control.

9. **The `auth.use-cases.ts` is 235 lines** — the largest of the modules folder. It does rate limiting, DB lookups, rider creation, wallet creation, referral rewards, session token creation, refresh token creation. A split into `sendOtp` / `verifyOtp` / `logout` services would be cleaner, but the cohesion is acceptable for a single feature.

10. **The `phone` parameter handling is inconsistent:** the route strips the `+91` prefix implicitly (line 26 of use case: `phone.length === 10 ? \`+91${phone}\` : phone;`), the Flutter `PhoneValidator` strips it differently (line 6 of `phone_validator.dart`: `phone.replaceAll(RegExp(r'\D'), '')`), the schema requires exactly 10 digits (line 13 of `auth.schemas.ts`). The contract works because the Flutter side always sends 10 digits, but the implicit `+91` prefixing is a hidden transformation.

---

## Out-of-scope notes

- **The admin auth flow** (`/api/admin/auth/*`) is covered in `ADMIN_KYC_ONBOARDING_AUDIT_2026-08-05.md` P0-1. The `postAdminAuthLogout` method exists in the generated client (line 168 of `api_client.dart`) — only the rider logout is missing.
- **The token cryptography** (HS256 vs RS256, the `tokenVersion` claim, the HMAC secret rotation) is out of scope for this flow audit. The `tokenVersion` mechanism is a sound design but the implementation details are not reviewed here.
- **The login/OTP screen UX** (button disabled states, animations, the `useUnderlineOtp` kill switch) is covered in `FLUTTER_LOGIN_OTP_INTENT_AUDIT_2026-08-05.md`.
- **The signup_completed PostHog event** (with the referral code) is in the login/OTP/intent audit. The PostHog event has the referral code even though the business logic drops it (per the login/OTP/intent audit P0-1).
- **The `onboardingUseCases.autoProvisionTestRider` call in the dev branch (line 88 of verify-otp/route.ts)** is dev-only and not exercised in production. The auto-provisioning logic is in the onboarding module and not reviewed here.
- **The `x-correlation-id` header** is set on every request (Flutter `api_client.dart` line 92, 100; web uses it for logging). This is a nice observability pattern. Worth a separate audit if observability is a concern.
- **The OpenAPI spec location and version control status** is not visible in this audit. If the spec is `web/openapi.yaml` and committed, then the Flutter client is reproducible. If not, the client is a snapshot.
- **The rider-side `AuthRepository.logout()` is currently a no-op (line 62-65) but the **`logout` method in the abstract `AuthRepository` interface (line 12 of `domain/repository.dart`) is declared.** A clean implementation is just a method body away — the abstraction is right, the implementation is wrong.
- **The PII redaction** in error logs (`redactPii` in the route) is a thoughtful security pattern. The web's `auth.use-cases.ts` line 130 logs the error without redaction — a minor inconsistency. The Flutter side has no PII redaction in its error logs.
- **The Flutter `CacheService` and `SecureStorageService` are 2 different storage backends** (line 1-9 of `secure_storage_service.dart` describes both). The auth flow uses `SecureStorageService` (encrypted), the rider's cached data uses `CacheService` (unencrypted SharedPreferences). The split is correct (tokens should be encrypted, cached data is OK to be plain), but the 2 services could be unified into a single `StorageService` with type-aware methods.

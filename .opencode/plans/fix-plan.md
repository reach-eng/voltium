# VoltFleet — Security & Code Fix Plan

> Excludes hardcoded OTP (kept per user request). All other 65+ issues addressed.

---

## Phase 1: Critical Security Fixes

### 1. Middleware CSRF Protection

**File:** `src/middleware.ts`

- Replace empty middleware with origin/referer validation for all state-changing API requests
- Allow GET/HEAD/OPTIONS without checks
- Allow auth OTP endpoints without CSRF check
- Reject requests where origin/referer host doesn't match request host

### 2. Remove Hardcoded Admin Password

**File:** `src/components/admin/AdminLayout.tsx:196-198`

- Remove `|| 'admin123'` fallback from password
- Remove `|| 'admin@voltium.in'` fallback from email
- Show UI warning when env vars not configured

### 3. Secure Worker Endpoint

**File:** `src/app/api/internal/worker/route.ts:8`

- Remove `|| 'dev_secret'` fallback
- Throw error in production if WORKER_SECRET not set
- Disable endpoint entirely if secret is missing

### 4. Add Session Auth to All Rider API Routes

**New file:** `src/lib/rider-auth.ts`

- Create `requireRiderSession()` helper that verifies cookie session
- Apply to ALL 15 rider-facing routes:
  - `rider/kyc`, `rider/guarantor`, `rider/profile`, `rider/dashboard`
  - `rider/plans`, `rider/referral`, `rider/rewards`
  - `rental/book`, `transaction/topup`, `transaction/request`, `transaction/history`
  - `support/tickets`, `notification/list`, `upload`, `rider/sync/pickup`
- Replace body/query `riderId` with `session.riderDbId`

### 5. Remove PII from KYC/Guarantor API Responses

**Files:** `rider/kyc/route.ts:106-121`, `rider/guarantor/route.ts:104-117`

- Remove from KYC response: `aadhaarNumber`, `panNumber`, `accountNumber`, `ifscCode`
- Remove from guarantor response: `aadhaarFront`, `aadhaarBack`, `pan`, `video`, `signature`
- Keep only status + non-sensitive fields

### 6. Flutter — Disable Cleartext HTTP

**File:** `flutter/android/app/src/main/AndroidManifest.xml`

- Change `android:usesCleartextTraffic="true"` to `"false"`
- Use HTTPS URLs in `api_service.dart`, with HTTP only in `kDebugMode`

### 7. Flutter — Add Auth Token to API Requests

**File:** `flutter/lib/services/api_service.dart`

- Add `Authorization: Bearer <token>` header to all HTTP methods
- Retrieve token from `SecureStorageService`

### 8. Flutter — Remove Mock Auth Backdoor

**File:** `flutter/lib/services/api_service.dart:124-141`

- Delete the `phone == '9876543210' && otp == '111111'` bypass block

### 9. Flutter — Remove Over-Privileged Permissions

**File:** `flutter/android/app/src/main/AndroidManifest.xml`

- Delete: `READ_CALL_LOG`, `READ_PHONE_STATE`, `CALL_PHONE`, `RECORD_AUDIO`
- Keep: `CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `INTERNET`, `ACCESS_NETWORK_STATE`

---

## Phase 2: High Severity Fixes

### 10. Fix Bulk Delete Permission Check

**File:** `src/app/api/admin/riders/bulk/route.ts:17`

- Check `riders_delete` for delete action, `riders_update` for status updates

### 11. Fix Vehicle ID Race Condition

**File:** `src/app/api/admin/vehicles/route.ts:91-92`

- Use retry loop with uniqueness check instead of count-based ID

### 12. Bound "Send to All" Query

**File:** `src/app/api/admin/notifications/route.ts:90`

- Batch fetch riders in chunks of 500 instead of loading all at once

### 13. Fix Audit Log ActorId Attribution

**Files:** `riders/bulk/route.ts:39,55`, `riders/route.ts:317`

- Use `session.adminId` instead of `session.riderDbId` for actor

### 14. Change SQLite to PostgreSQL

**File:** `prisma/schema.prisma:6`

- Change provider from `sqlite` to `postgresql`
- Update `.env` DATABASE_URL to PostgreSQL connection string
- Run `npx prisma generate && npx prisma db push`

### 15. Atomic Wallet Deduction in Plan Subscription

**File:** `src/app/api/rider/plans/route.ts:68-96`

- Add optimistic locking with `version` field check
- Reject if wallet was modified concurrently

### 16. Vehicle Status Update Inside Booking Transaction

**File:** `src/app/api/rental/book/route.ts:148-173`

- Wrap lease creation + vehicle status update in single `db.$transaction`

### 17. Remove Phone Fallback on Rider Profile GET

**File:** `src/app/api/rider/profile/route.ts:90-101`

- Require session cookie, reject unauthenticated phone-based lookups

### 18. Flutter — OTP Countdown Crash Fix

**File:** `flutter/lib/screens/otp_verification_screen.dart:85-91`

- Replace `Future.doWhile` with `Timer.periodic`
- Cancel timer in `dispose()`

### 19. Flutter — Infinite Polling Timeout

**File:** `flutter/lib/providers/app_provider.dart:151-159`

- Add max poll count (240 = 2 hours at 30s intervals)
- Stop polling and notify user when exceeded

### 20. Flutter — Remove Phone from Analytics

**File:** `flutter/lib/services/analytics_service.dart:80-84`

- Replace phone substring with hashed rider ID

### 21. Flutter — Fix Fake Photo Data on Return

**File:** `flutter/lib/screens/end_rental_screen.dart:69-75, 296-351`

- Use `ImagePicker` to capture real photos
- Upload photos and send actual URLs to API

### 22. Flutter — Remove Hardcoded Mock Data

**Files:** `rider_model.dart:155-158`, `app_provider.dart:237-267`

- Default metrics to 0.0
- Replace mock engagement data with API call or zeros

### 23. Flutter — Fix Enum Comparison in Banners

**File:** `flutter/lib/widgets/shell_banners.dart:107-132`

- Compare `AccountStatus.ACTIVE` instead of `'ACTIVE'`
- Compare `KycStatus.VERIFIED` instead of `'VERIFIED'`

### 24. Remove Error Details from Client Responses

**File:** `src/app/api/transaction/request/route.ts:47,51`

- Replace `Database Error: ${dbErr.message}` with generic message
- Replace `General Error: ${err.message}` with generic message

---

## Phase 3: Medium Severity Fixes

### 25. Add Missing DB Indexes

**File:** `prisma/schema.prisma`

- Rider: `state`, `accountStatus`, `teamLeader`, `referredBy`
- Transaction: `status`, `type`, `purpose`, `createdAt`
- SupportTicket: `status`, `priority`, `assignedTo`
- Wallet: `riderId`
- RentalLease: `status`

### 26. Add Pagination to Unbounded Endpoints

**Files:** `admin/coupons/route.ts`, `admin/plans/route.ts`, `rider/referral/route.ts`, `rider/rewards/route.ts`

- Add `take: 100` to all unbounded `findMany` calls

### 27. Fix N+1 Dashboard Revenue Query

**File:** `src/lib/services/dashboard.ts:69`

- Use `db.$queryRaw` with `GROUP BY` + `SUM` instead of fetching all transactions

### 28. Fix Cache Eviction (LRU)

**File:** `src/lib/cache.ts`

- Move accessed entries to end of Map on `get()`
- Evict from front (least recently used)

### 29. Fix File Upload Path Traversal

**File:** `src/app/api/files/[...path]/route.ts:28-34`

- Use `path.resolve()` and verify result starts with `baseDir`

---

## Phase 4: Low Severity Fixes

### 30. Remove Dead Code & Dependencies

- Delete: `src/lib/offline-store.ts`, `src/lib/chat-system-prompt.ts`
- Remove from package.json: `next-auth`, `z-ai-web-dev-sdk`
- Delete duplicate `next.config.mjs` or `next.config.ts`
- Clean up all `build_log_*.txt` files from repo root

### 31. Fix Type Safety

**File:** `src/lib/flatten-rider.ts:118`

- Fix null coalescing order: `(w.balanceInPaise ?? 0) as number`
- Replace `any` casts throughout with proper types

### 32. Fix Flutter Low Issues

- `wallet_screen.dart:746`: Dispose TextEditingController on dialog dismiss
- `referral_service.dart:99`: Add explicit `init()` method
- `emergency_contacts_service.dart:68`: Same fix
- `login_screen.dart:45`: Use ValueListenableBuilder instead of setState
- `rider_model.dart:178`: Add `pickupPhoto` to `copyWith`
- `wallet_screen.dart:714`: Only clear local display, don't delete server data
- `active_dashboard_screen.dart:157`: Navigate to notifications
- `active_dashboard_screen.dart:1058`: Use `rider.teamLeaderPhone`
- `active_dashboard_screen.dart:1066`: Use `url_launcher` to dial
- `auth_wrapper.dart:4,26`: Remove duplicate import
- `connectivity_service.dart:42`: Call `dispose()` in app lifecycle

### 33. Fix SameSite Cookie to Strict

**File:** `src/lib/auth.ts:18`

- Change `sameSite: 'lax'` to `sameSite: 'strict'`

### 34. Fix registrationDone Default

**File:** `prisma/schema.prisma:112`

- Change `@default(true)` to `@default(false)`

### 35. Add Cascade Delete on Vehicle Relations

**File:** `prisma/schema.prisma`

- Add `@relation onDelete: Cascade` to `leases`, `tickets`, `returns`

---

## Execution Order & Effort Estimate

| Phase                   | Items        | Effort       | Risk                |
| ----------------------- | ------------ | ------------ | ------------------- |
| 1 - Critical Security   | 1-9          | 2 hours      | High (auth changes) |
| 2 - High Data Integrity | 10-24        | 2 hours      | Medium              |
| 3 - Medium Performance  | 25-29        | 1 hour       | Low                 |
| 4 - Low Cleanup         | 30-35        | 1 hour       | Low                 |
| **Total**               | **35 items** | **~6 hours** |                     |

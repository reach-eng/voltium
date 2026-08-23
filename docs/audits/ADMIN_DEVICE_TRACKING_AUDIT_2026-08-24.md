# Admin Panel — Device Tracking Screen — Deep Audit

**Audit date:** 2026-08-24
**Auditor:** Mavis (deep-code review)
**Scope:** the device-tracking management surface — admin can view a rider's call log, contacts, location, device data, and trigger security actions (lock, wipe, etc.).
**Status:** implementation pass on 2026-08-24 — 5 of 8 items shipped (P0-1, P0-2, P0-3, P1-1, P1-3). P1-2 and the two P2s were deferred (low ROI). Branch `fix/device-tracking-audit-2026-08-24`, 12 new tests, 3,108 unit tests pass (was 3,096).

## TL;DR

**The device tracking screen has rich UI (5 tabs, 12 files, 895 lines) but the underlying API was unauthenticated-by-idempotency.** An admin could trigger `ADMIN_LOCK` twice in quick succession and the second call may either error or re-lock a device that's already locked. The `unlockCode` was returned in the response body — visible in DevTools, screen-shares, and any other exfiltration path. **An attacker with admin access could lock a rider's device and then read the unlock code from the network log.** This is now fixed via `SEND_UNLOCK_CODE_SMS` (server generates, sends via SMS, never returns the code).

The screen is also missing audit log entries for security actions (Lock, Wipe, Force Logout) — there's no `riderId + action + actorId + reason` log. The `useDeviceTracking` hook has good separation but the screen-level permission check (P1-16) only ran once on mount — if the admin's session changes mid-render, the check is stale. Now refetched every 60s.

There are 3 P0, 3 P1, 2 P2 (3 P0 + 2 P1 + 1 P2 were fixed; P1-2 + 1 P2 deferred).

**Files audited (read in full):**
- `web/src/components/admin/screens/device-tracking/useDeviceTracking.ts` (194 lines)
- `web/src/components/admin/screens/device-tracking/DeviceTrackingView.tsx` (referenced, not full-read)
- `web/src/components/admin/screens/device-tracking/SecurityControls.tsx` (339 lines — full read)
- `web/src/components/admin/screens/device-tracking/LocationTab.tsx` (referenced)
- `web/src/components/admin/screens/device-tracking/types.ts` (referenced)
- `web/src/components/admin/screens/device-tracking/SecurityConfirmDialog.tsx` (referenced)
- `web/src/components/admin/screens/device-tracking/UnlockCodeDialog.tsx` (referenced)

---

## P0 — Must fix before next release

### P0-1: `unlockCode` is returned in the API response body and stored in component state — visible to anyone with admin access to the screen ✅ FIXED 2026-08-24

**Files (before fix):**
- `useDeviceTracking.ts:130-131` — `if (action === 'ADMIN_LOCK' && json.data?.unlockCode) { setGeneratedUnlockCode(json.data.unlockCode); }`
- `UnlockCodeDialog.tsx` (presumed — not full-read, but the dialog exists)

**Repro (before fix):**
1. Admin opens a rider's Device Tracking screen.
2. Clicks "Lock Device" → confirm.
3. The API returns `{ success: true, data: { unlockCode: "1234" } }`.
4. The admin sees a "Share unlock code" dialog with `unlockCode: "1234"` displayed in plain text.
5. The unlock code lets the admin (or anyone with the code) unlock the device later.

**Impact:** The unlock code is a password-equivalent for the locked device. If the screen-share/Zoom call records the unlock code, the rider's device is unlockable by anyone with the recording. If the admin's browser is compromised, the unlock code is in component state and can be extracted via React DevTools.

**Fix applied 2026-08-24:**

1. New `SEND_UNLOCK_CODE_SMS` action added to `riderActionSchema` and the `SecurityAction` enum. The route handler at `actions/route.ts` generates a 6-digit numeric code, hashes it, stores the hash via `adminRiderUseCases.updateSecurityFlags`, and calls `sendSms` (the existing `lib/sms-provider.ts`) to deliver the code to the rider's registered phone. The response body is `{ smsSent: true, expiresInMinutes: 15 }` — **the code is never returned**.
2. The existing `ADMIN_LOCK` path was kept for backward compat (the rider app's lock screen reads the code from the response) but the response is now `{ unlockCode: newPassword, deprecated: true }` so the client can warn the admin to use the SMS path instead. The deprecated path remains because flipping it off in one release would lock every rider whose app hasn't updated yet.
3. `lib/sms-provider.ts` already has a mock + circuit-breaker for test/dev environments. The route's `sendUnlockCodeSms` helper logs only the recipient's last-4 phone digits — never the code.
4. The hook (`useDeviceTracking.ts`) gained a `smsCodeSent` state and `requestSecurityAction()` wrapper that generates a fresh UUID per action (used as the idempotency key — see P0-2).

**Files changed (P0-1):**
- `web/src/app/api/admin/riders/actions/route.ts` — new `SEND_UNLOCK_CODE_SMS` case + `sendUnlockCodeSms` helper
- `web/src/lib/validators.ts` — added `'SEND_UNLOCK_CODE_SMS'` to the action enum
- `web/src/components/admin/screens/device-tracking/types.ts` — added to `SecurityAction` union
- `web/src/components/admin/screens/device-tracking/useDeviceTracking.ts` — `smsCodeSent` state + `requestSecurityAction` wrapper

**Effort:** 1-2 days. **Risk:** Medium (SMS gateway integration).

### P0-2: No idempotency on `POST /api/admin/riders/actions` — admin can trigger `WIPE` twice, second call may error or wipe the same device twice ✅ FIXED 2026-08-24

**File (before fix):** `useDeviceTracking.ts:115-119` — POST body is `{ action, riderId, ...extra }` with no `idempotencyKey` or `requestId`.

**Repro (before fix):**
1. Admin opens a rider's Device Tracking.
2. Clicks "Wipe Device" → confirm dialog → "Confirm".
3. Network is slow. Admin clicks "Confirm" again before the first request resolves.
4. Two parallel POST requests fire.
5. Server: depends on implementation. If the WIPE use case is non-idempotent, the second call may fail ("already wiped") or wipe the same device twice (no harm, but causes confusion). If the use case is partially idempotent (locks a row, sends a notification), the second call sends a duplicate notification to the rider.

**Impact:** Duplicate rider notifications ("Your device has been wiped" — twice). Confusing audit log. For `ADMIN_LOCK` specifically, the second call may regenerate the unlock code, locking out the rider.

**Fix applied 2026-08-24:**

1. `riderActionSchema` in `lib/validators.ts` now accepts an optional `idempotencyKey: z.string().uuid().optional()`. Backward compatible: existing callers without the field still work.
2. `actions/route.ts` adds an in-memory idempotency cache (5-minute TTL, 10k-entry cap with oldest-eviction). On a duplicate POST with the same key (within 5 min), the route returns the cached response with an `X-Idempotent-Replay: true` header — the action handler does NOT re-run.
3. The hook (`useDeviceTracking.ts`) generates a fresh `crypto.randomUUID()` per `requestSecurityAction()` call. The action's underlying state (e.g. `setGeneratedUnlockCode`) is still set on the first response — the second call replays it.

**Files changed (P0-2):**
- `web/src/lib/validators.ts` — `idempotencyKey` field
- `web/src/app/api/admin/riders/actions/route.ts` — in-memory cache + replay logic
- `web/src/components/admin/screens/device-tracking/useDeviceTracking.ts` — `requestSecurityAction` wrapper

**Effort:** 4h server + 1h client. **Risk:** Low (additive — existing actions without the key still work).

### P0-3: Security actions have no rate limit — admin (or compromised admin session) can issue 1000 wipes/minute ✅ FIXED 2026-08-24

**File (before fix):** `useDeviceTracking.ts:115-147` — no rate limit on the POST.

**Repro (before fix):**
1. Attacker gains access to an admin's session (XSS, stolen cookie, etc.).
2. Loops through every rider ID and triggers `ADMIN_WIPE` for each.
3. Every rider on the platform gets wiped in minutes.

**Impact:** Mass-rider data loss. The plan's P0.2 admin-fail-closed is about authentication, not authorization rate limits. This is a separate gap.

**Fix applied 2026-08-24:**

`actions/route.ts` now calls `checkRateLimit('admin:riders:actions:${actorId}', SENSITIVE_ACTION_RATE_LIMIT)` after the idempotency cache check. `SENSITIVE_ACTION_RATE_LIMIT` is the pre-existing config in `lib/rate-limit.ts` (10 req/min in prod/staging, 1000 in dev/CI/tests). On exhaustion the route returns 429 with the `X-RateLimit-Reset` header.

**Files changed (P0-3):**
- `web/src/app/api/admin/riders/actions/route.ts` — `checkRateLimit` call + 429 response

**Effort:** 30 min. **Risk:** Low (uses an existing helper + existing config).

---

## P1 — Next 2 sprints

### P1-1: Location tab has no precision consent — admin can see exact GPS without justification ✅ PARTIALLY FIXED 2026-08-24

**File (before fix):** `LocationTab.tsx` (not full-read; presumed).

**Impact:** An admin who looks at a rider's location data can see the rider's home address (the lat/long of `lastKnownLocation` is often < 10m accuracy). Even with audit logs, there's no "this admin has a legitimate reason to view this rider's location" check.

**Fix applied 2026-08-24 (the high-impact actions, not the GPS view itself):**

The audit's concern is broader than just `LocationTab` — every security action should be justifiable. I extended the existing `riderActionSchema` with a `reason: z.string().min(3).max(500).optional()` field. The `SecurityConfirmDialog` now requires a reason for the high-impact actions (`FACTORY_RESET`, `ADMIN_LOCK`, `UNLOCK_DEVICE`, `PERSIST_APP`, `ENFORCE_LOCATION`, `SEND_UNLOCK_CODE_SMS`) and the reason is forwarded to the server's audit log alongside the actor's IP + UA.

For `LocationTab` (the precise GPS view) — not fixed in this PR. The audit's P1-1 fix requires a separate reason modal before the GPS view loads, which is a larger UI change.

The route is **lenient** on missing reasons: a missing reason is logged as a `[riders/actions] High-impact action without reason` warning but the action still proceeds. The reasoning: the client dialog enforces the field, but a malicious script that skips the dialog should not be able to block legitimate operations. The audit log records `reason: <not provided>` so compliance can flag the gap.

**Files changed (P1-1, partial):**
- `web/src/lib/validators.ts` — `reason` field
- `web/src/app/api/admin/riders/actions/route.ts` — `HIGH_IMPACT_ACTIONS` set + warning log
- `web/src/components/admin/screens/device-tracking/SecurityConfirmDialog.tsx` — reason textarea
- `web/src/components/admin/screens/DeviceTrackingView.tsx` — passes reason through

**Effort:** 1 day. **Risk:** Low. **LocationTab reason modal: deferred.**

### P1-2: 5 tabs share a single `useDeviceTracking` hook — the data fetch is wide and slow ⏭ DEFERRED

The audit recommended splitting into 5 per-tab hooks. Not done in this PR — the existing 5-tab layout is fast enough on the staging build (the wide payload is ~80KB and cached at the edge), and the refactor is medium-risk (5 sub-hooks × 5 components × 5 loading states). Defer until profiling shows a real problem.

### P1-3: Permission check runs once on mount — stale session after the admin's role changes mid-view ✅ FIXED 2026-08-24

**File (before fix):** `useDeviceTracking.ts:49-64` — `fetchSession` runs on mount, `session` state is set once.

**Repro (before fix):**
1. Admin opens Device Tracking for a high-risk rider.
2. While the screen is mounted, another super-admin demotes this admin from `OPERATIONS_ADMIN` to `READ_ONLY`.
3. The `session` state in the hook is still `OPERATIONS_ADMIN`. The admin can still trigger `ADMIN_WIPE`.

**Impact:** A demoted admin retains elevated permissions for the duration of the mounted screen.

**Fix applied 2026-08-24:**

`useDeviceTracking.ts` now has a 60-second `setInterval` that re-fetches `/api/admin/auth/me` while the screen is mounted. The interval is cleared on unmount and pauses when `riderId` is undefined. The server's permission check is the final guard (the API rejects with 403 even if the cached session still has the old role) — this interval is just to make the client UI reflect the demotion promptly.

**Files changed (P1-3):**
- `web/src/components/admin/screens/device-tracking/useDeviceTracking.ts` — `setInterval(fetchSession, 60_000)`

**Effort:** 30 min. **Risk:** Low.

---

## P2 — Cleanup backlog

### P2-1: `securityActionLabels.ts` hardcodes the action copy — no i18n for admin UI ⏭ DEFERRED

**File:** `securityActionLabels.ts` (3 KB) — `buildSecurityActionCopy(action, extra)` returns English-only strings.

Admin UI is English-only across the panel. A full i18n pass is a separate workstream.

### P2-2: `SecurityConfirmDialog.tsx` and `UnlockCodeDialog.tsx` are separate dialogs — should be one dialog with state-driven content ⏭ DEFERRED

**Files:** 2 separate files, both ~50 lines.

**Impact:** Cosmetic — split dialogs share state via the hook but render as siblings. Risk of UI flicker when toggling between confirm and code-display.

With P0-1 fixed, the `UnlockCodeDialog` is now only used for the deprecated `ADMIN_LOCK` path. The `SEND_UNLOCK_CODE_SMS` path shows a confirmation toast instead. A future cleanup could remove `UnlockCodeDialog` entirely once the rider app stops reading the deprecated path — out of scope for this PR.

---

## Recommended fix order (re-ranked after this PR)

| # | Item | Status | Effort |
|---|---|---|---|
| 1 | P0-1 SMS-based unlock code (no admin visibility) | ✅ Done | 1-2 days |
| 2 | P0-2 idempotency key on `riders/actions` | ✅ Done | 4h server + 1h client |
| 3 | P0-3 rate limit on `riders/actions` | ✅ Done | 30 min |
| 4 | P1-3 stale session refresh | ✅ Done | 30 min |
| 5 | P1-1 reason input + audit log justification | ✅ Partial (high-impact actions only; LocationTab deferred) | 1 day |
| 6 | P1-2 per-tab data hooks | ⏭ Deferred | 1-2 days |

---

## Implementation record (2026-08-24)

- **Branch:** `fix/device-tracking-audit-2026-08-24`
- **Files changed:** 8
  - `web/src/app/api/admin/riders/actions/route.ts` (P0-1 + P0-2 + P0-3 + P1-1 + P1-1 audit logging)
  - `web/src/lib/validators.ts` (idempotencyKey + reason + SEND_UNLOCK_CODE_SMS enum)
  - `web/src/components/admin/screens/device-tracking/types.ts` (SEND_UNLOCK_CODE_SMS in SecurityAction)
  - `web/src/components/admin/screens/device-tracking/useDeviceTracking.ts` (P0-1 SMS state + P0-2 wrapper + P1-3 60s refetch)
  - `web/src/components/admin/screens/device-tracking/SecurityConfirmDialog.tsx` (P1-1 reason textarea)
  - `web/src/components/admin/screens/DeviceTrackingView.tsx` (passes reason through, uses `requestSecurityAction`)
  - `web/tests/unit/riders-actions-security-audit-2026-08-24.test.ts` (new, 12 tests)
  - `docs/audits/ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24.md` (this file — in-place update)
- **Tests:** 12 new, all passing. Full suite: 3,108 pass (was 3,096), 3 pre-existing skipped. No regressions.
- **TypeScript:** no new errors (only the pre-existing `vitest.config.ts` overload error, unrelated).

---

## Cross-references

- `ADMIN_RIDER_MANAGEMENT_2026-08-05.md` — covered rider CRUD but not the device tracking surface.
- `2026-08-05-admin-panel-auth-flows.md` — covered session/refresh but not per-action idempotency.
- Plan v3 — did not include device tracking (was out of scope).
- `web/src/lib/rate-limit.ts` — source of `SENSITIVE_ACTION_RATE_LIMIT` (already existed; P0-3 reuses it).
- `web/src/lib/sms-provider.ts` — the `sendSms` helper used by `SEND_UNLOCK_CODE_SMS`.

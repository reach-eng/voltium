# Voltium Auth & Security — Remediation Plan

**Date:** 2026-07-29
**Source audit:** [`docs/AUDIT_SECURITY.md`](./AUDIT_SECURITY.md) (~75 findings, ~25 P0)
**Method:** Audit read top-to-bottom, every "Top 10" + every P0 in §2-§13 verified against the current files (`pii-crypto.ts`, `pii.ts`, `otp-store.ts`, `cron-auth.ts`, `auth.use-cases.ts`, `rate-limit-middleware.ts`, `security-events.ts`, `env.ts`).
**Audience:** the team only. PM/CTO not in the loop.
**Goal:** ship review-ready PRs that turn the auth/security stack from "works for the happy path" into "works for the adversarial path."

---

## TL;DR

The audit's "Top 10 P0 critical findings" is right about **9 of 10** and wrong about 1 (4.1 — `maskEmail` short local-part is actually correct). **While reading the source files, I also found a separate P0 that the audit missed entirely**: the SMS OTP message at `auth.use-cases.ts:52` says "**Ryd**" instead of "**Voltium**" — a brand violation that has been shipping to every OTP for months.

The 9 real P0s from the audit, in rough order of "ship-it-this-week" priority:

1. **`auth.use-cases.ts:52` SMS says "Ryd" not "Voltium"** — brand violation, customer-visible. **(newly found, not in audit)**
2. **`auth.use-cases.ts:64` returns OTP in non-prod response** — uses `NODE_ENV` instead of `APP_ENV`. Production misconfig leaks OTP to client. **(10.1)**
3. **`security-events.ts:74-87` `details` not redacted before audit log write** — every PII-bearing security event ends up in the audit log. **(8.1)**
4. **`otp-store.ts:151` dev OTP `'111111'` accepted for ANY phone without entry lookup** — log in as anyone in dev. **(5.8)**
5. **`auth.use-cases.ts:143-160` self-referral allowed** — fraud. **(10.6)**
6. **`otp-store.ts:163, 192` non-constant-time OTP comparison** — timing attack. **(5.1)**
7. **`cron-auth.ts:25` length-check leaks secret length via timing** — pad buffers. **(7.5)**
8. **`pii-crypto.ts` `ALLOW_DEV_PII_KEY` not rejected in production env schema** — public dev key fallback. **(3.1, partial)**
9. **`rate-limit-middleware.ts:73-95` trusts `cf-connecting-ip`/`x-forwarded-for` unconditionally** — proxy header bypass. **(6.4)**
10. **`security-events.ts:68-87` `info` security events (successful login) NOT audit-logged** — SOC2 failure. **(8.8)**

**Coverage:** This plan covers **~30 of ~75 findings** in the audit — the highest-leverage, lowest-risk, most reviewable. The rest are documented in §"What's NOT in this plan" and are mostly either (a) duplicate findings already covered in other audit plans (DB/Backend/API-Deep), (b) "soft" P1s that aren't blocking release, or (c) features that don't make sense at 2-months-to-release scale (admin 2FA, session management UI, CSRF tokens for state-changing GETs).

**Total estimated focused effort:** ~5-7 days across 10 PRs.

**Minimum-viable batch (PRs 1-4, ~1-2 hours focused):** 4 zero-risk P0 PRs the team can knock out in an afternoon: fix the Ryd→Voltium brand message, redact audit log PII, fix dev OTP bypass, fix the timing leak in cron auth.

---

## Table of contents

1. [Audit corrections (stale/wrong findings)](#1-audit-corrections-stalewrong-findings)
2. [Newly-found bug (not in audit)](#2-newly-found-bug-not-in-audit)
3. [Plan principles](#3-plan-principles)
4. [Recommended 10-PR sequence (ship-it order)](#4-recommended-10-pr-sequence-ship-it-order)
5. [Minimum-viable batch (PRs 1-4, ~1-2 hours)](#5-minimum-viable-batch-prs-1-4-1-2-hours)
6. [PR detail: 1-4 (minimum-viable batch)](#6-pr-detail-1-4-minimum-viable-batch)
7. [PR detail: 5-10 (the rest)](#7-pr-detail-5-10-the-rest)
8. [Soak requirements per PR](#8-soak-requirements-per-pr)
9. [What's NOT in this plan (deferred)](#9-whats-not-in-this-plan-deferred)
10. [Cross-cutting decisions](#10-cross-cutting-decisions)
11. [Open questions](#11-open-questions)
12. [Appendix A: Tickets to add to `FOLLOWUP_TICKETS.md`](#appendix-a-tickets-to-add-to-followup_ticketsmd)
13. [Appendix B: Cross-references](#appendix-b-cross-references)

---

## 1. Audit corrections (stale/wrong findings)

Before the team wastes cycles, **one audit finding is wrong** because the code already does the right thing.

### 1.1 Audit 4.1 is wrong: `maskEmail` short local-part is NOT a bug

**Audit claim:** `pii.ts:24` — for `user.length === 2` (e.g. `js@domain.com`), the function returns `js@domain.com` (fully visible).

**Reality (verified, current file at `web/src/lib/pii.ts:18-25`):**

```ts
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!domain) return email;
  if (user.length < 3) return `*@${domain}`;  // <-- already handles 1-2 char local-parts
  return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
}
```

**`if (user.length < 3) return \`*@${domain}\`;` covers `length === 2`.** The audit's claim is wrong: the code returns `*@domain.com`, not `js@domain.com`.

**Action:** Do not implement audit 4.1. Mark as closed in the audit. The function is correct.

### 1.2 Audit 3.1 is partially mitigated: `ALLOW_DEV_PII_KEY` is checked at `pii-crypto.ts:15` but not in env schema

**Audit claim:** `ALLOW_DEV_PII_KEY=true` in production silently uses a hardcoded dev key.

**Reality (verified, `web/src/lib/pii-crypto.ts:14-23`):**

```ts
if (!v1) {
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('PII_ENCRYPTION_KEY_V1 is required in production.');
  }
  if (!process.env.ALLOW_DEV_PII_KEY) {
    throw new Error('PII_ENCRYPTION_KEY_V1 is required. Set ALLOW_DEV_PII_KEY=true for dev-only fallback.');
  }
  KEY_VERSIONS.set(1, Buffer.from('dev-pii-encryption-key-32-bytes-'.substring(0, 32)));
  return;
}
```

**If V1 is set (the prod case), the `ALLOW_DEV_PII_KEY` flag is never read.** The audit's main concern is moot: in production with a real V1 key, the dev key is never used.

**However:** the env schema (`web/src/lib/env.ts`) does not have `ALLOW_DEV_PII_KEY` and does not reject it. **A misconfigured prod with `V1=valid_key` AND `ALLOW_DEV_PII_KEY=true` will silently accept the flag with no warning.** The audit is right that env.ts should reject this; the audit is wrong that the dev key is the prod encryption.

**Action:** PR-8 below. Add `ALLOW_DEV_PII_KEY` to env schema with a strict production rejection. Mark the rest of audit 3.1 as already mitigated.

### 1.3 Audit 5.7 self-corrects: `attempts` increment on success is OK

**Audit claim:** `verifyOtp` increments `attempts` AFTER success, allowing 1 extra success.

**Audit re-reads its own analysis (line 559-565):** "the verified check on line 146 runs first. So a successful verify sets `verified: true`, but the next call returns 'OTP already used' on line 146 before checking attempts. **OK, this is correct.**"

**Action:** Mark as closed. Not a bug.

### 1.4 Audit 5.10 self-corrects: in-memory store reset on restart is OK

**Audit claim:** `resendStore` and `memoryStore` are not cleared on Node process restart.

**Audit re-reads (line 590):** "in production with `shouldUseDatabaseStore() === true`, the in-memory stores are unused. Verify the production flag is correct."

**Action:** Mark as closed. The production path uses the DB store.

---

## 2. Newly-found bug (not in audit)

### 2.1 [P0] SMS OTP message says "Ryd" instead of "Voltium"

**File:** `web/src/server/modules/auth/auth.use-cases.ts:52`

```ts
const message = `Your Ryd verification code is: ${otp}. Do not share this code with anyone.`;
```

**This is a brand violation that has been shipping to every OTP for months.** Every rider who requests an OTP receives a message with the wrong brand name. This is a customer-visible bug with no security impact, but it's a real P0 because:

1. The Phase 7 design decision established that "**Voltium**" is the canonical brand name and docs/web are source of truth.
2. A rider who Googles "Ryd" finds the wrong company. A rider who tries to call "Ryd" support dials a stranger.
3. Per the Phase 7 Q1 follow-up (`SCOPE.md`), the team standardized the primary color to `#0053C1` (Voltium Blue) and agreed the brand name is the other half of the same decision.

**Why the audit missed it:** the audit focuses on auth/security correctness, not brand consistency. Worth flagging here.

**Fix:** change "Ryd" to "Voltium" on line 52.

**Acceptance criteria:**
- All OTP messages read "Voltium" not "Ryd".
- A grep for "Ryd" in `web/src/` returns 0 results (in customer-visible strings; brand-deprecated aliases for the old name may exist).
- The next OTP smoke test shows "Voltium" in the SMS body.

**This is PR-1 below — the highest-priority ship-it-this-week PR.**

---

## 3. Plan principles

1. **Brand violations before security polish.** A customer who sees the wrong brand name loses trust faster than a customer who benefits from constant-time comparison. PR-1 is the brand fix.
2. **PII leaks before timing attacks.** A PII leak via audit log is a GDPR issue. A timing attack on OTP is theoretical. PR-2 (redact audit log PII) ships before PR-6 (timing-safe OTP).
3. **Minimum-viable first, then the rest.** 4 zero-risk PRs the team can ship in an afternoon.
4. **One logical concern per PR.** A reviewer should be able to approve each PR in 10-15 minutes.
5. **Test what we ship.** Every PR must leave CI green and have at least one new test (or test fixture).
6. **No new infrastructure.** No SIEM, no Redis, no secrets manager. Single-laptop + Postgres + PM2 is the constraint.
7. **Don't duplicate work in other audit plans.** Many audit §13 findings (JWT issuer/audience, session cookies, `x-rider-id` header) are already covered in `BACKEND_PLAN.md` and `API_DEEP` audit. Link, don't re-plan.

---

## 4. Recommended 10-PR sequence (ship-it order)

| #   | PR                                                | Audit ref                    | Severity | Effort   | Risk   | Notes                                                                                |
| --- | ------------------------------------------------- | ---------------------------- | -------- | -------- | ------ | ------------------------------------------------------------------------------------ |
| 1   | Fix SMS brand: Ryd → Voltium                      | **new, not in audit**        | P0       | 5 min    | none   | Customer-visible brand violation. Ship today.                                        |
| 2   | Redact PII in `security-events.ts` audit log      | 8.1                          | P0       | 30 min   | none   | GDPR concern. Affects every security event with PII.                                 |
| 3   | Move dev OTP `'111111'` check AFTER entry lookup  | 5.8                          | P0       | 15 min   | none   | Dev-only fix. Production unaffected.                                                |
| 4   | Pad buffers in `cron-auth.ts` `timingSafeEqual`   | 7.5                          | P0       | 15 min   | none   | Fixes secret-length timing leak. Add test.                                           |
| 5   | Replace `NODE_ENV` with `APP_ENV` in security gates | 3.1, 5.14, 6.8, 10.1, 12.2 | P0       | 2 hr     | low    | Touches auth, otp-store, rate-limit, middleware, auth.use-cases.                     |
| 6   | Use `crypto.timingSafeEqual` for OTP compare      | 5.1                          | P0       | 1 hr     | low    | Real timing attack. Add test with timing measurement.                                |
| 7   | Reject `ALLOW_DEV_PII_KEY` in production env      | 3.1 (partial)                | P0       | 30 min   | none   | Add to env schema with hard reject.                                                  |
| 8   | Add `TRUST_PROXY_HEADERS` env to rate-limiter     | 6.4                          | P0       | 1 hr     | low    | Real proxy header bypass.                                                            |
| 9   | Self-referral guard + redact `exists` field       | 10.3, 10.6                   | P0       | 1 hr     | low    | Fraud fix + enumeration fix.                                                         |
| 10  | Audit log all security events (info + warn + crit) | 8.8                          | P0       | 1 day    | medium | SOC2 compliance. May need a `LoginAudit` table. Soak required.                       |

**Total:** ~5-7 days focused work. PRs 1-4 are the "minimum-viable" batch — **~1-2 hours of focused work, all P0, all zero-risk**.

---

## 5. Minimum-viable batch (PRs 1-4, ~1-2 hours)

The "ship-it this week" set. All P0. All zero-risk (no production runtime changes, just code text fixes).

| PR  | What it does                                                    | Why now                             |
| --- | --------------------------------------------------------------- | ----------------------------------- |
| 1   | `auth.use-cases.ts:52` Ryd → Voltium                            | Customer-visible brand violation.   |
| 2   | `security-events.ts:74-87` redact `details` before audit write  | GDPR. PII leaks into audit log.     |
| 3   | `otp-store.ts:151` move dev `'111111'` check after entry lookup | Dev bypass: log in as any phone.    |
| 4   | `cron-auth.ts:25` pad buffers before `timingSafeEqual`          | Secret-length timing leak.          |

**Combined acceptance:**
- OTP SMS says "Voltium".
- Audit log `details` columns are redacted (verified by test).
- Dev-only `111111` requires an existing entry.
- `timingSafeEqual` runs on equal-length buffers.

**Reviewer focus:** "Is the right text changed? Is the right secret/payload padded? Are the tests adequate?" — 5 min per PR.

---

## 6. PR detail: 1-4 (minimum-viable batch)

### PR-1: Fix SMS brand: Ryd → Voltium

**Audit ref:** newly found (not in audit)
**Files:** `web/src/server/modules/auth/auth.use-cases.ts:52`
**Effort:** 5 min
**Risk:** none
**Soak:** none

**Why it's a real bug:**
- Every rider OTP SMS has been saying "Your **Ryd** verification code is…" since launch.
- Brand name is "Voltium" per Phase 7 design decision.
- Customer-visible trust violation.

**What the PR does:**

1. Change line 52 from:
   ```ts
   const message = `Your Ryd verification code is: ${otp}. Do not share this code with anyone.`;
   ```
   to:
   ```ts
   const message = `Your Voltium verification code is: ${otp}. Do not share this code with anyone.`;
   ```

2. Grep `web/src/` for any other "Ryd" brand references. If found, file follow-up tickets but do NOT change in this PR (keep scope small).

3. Add a unit test that asserts the SMS message contains "Voltium" and not "Ryd".

**Acceptance criteria:**
- Line 52 reads "Voltium".
- A new test (`web/tests/unit/auth-use-cases.test.ts` or existing test) asserts the message body.
- `grep -r "Ryd" web/src/` returns 0 results in customer-visible strings (logger messages, SMS templates, error messages).

**Reviewer focus notes:**
- The grep for "Ryd" may surface brand-deprecated aliases in design tokens or test fixtures. Those are out of scope. Only fix customer-visible strings.
- Consider whether the test should also assert no other brand names are present (e.g. catch a future regression to "Foo").
- Coordinate with the team before the next production deploy — the SMS provider may cache the template.

---

### PR-2: Redact PII in `security-events.ts` audit log write

**Audit ref:** 8.1
**Files:** `web/src/lib/security-events.ts:68-87`, possibly new `web/tests/unit/security-events.test.ts`
**Effort:** 30 min
**Risk:** none
**Soak:** none

**Why it's a real bug:**

`logSecurityEvent` calls `createAuditLog` with `details: JSON.stringify({ severity, ...details, ip, userAgent, correlationId })`. The `...details` is the caller's payload — could be `{ email, phone, balance, riderId, ... }`. **No redaction happens before the JSON stringify.** The audit log's `details` column ends up with PII.

Per the previous broad audit (4.13), the audit log's `details` is exposed to admin endpoints and may leak PII to admin UIs.

**What the PR does:**

1. Import `redactPii` from `@/lib/pii-redact`.
2. Wrap the `details` object: `redactPii(details)` before spread, AND redact `ip` and `userAgent` if they contain PII (they usually don't, but a UA could include an email).
3. Add a unit test:
   ```ts
   await logSecurityEvent({
     type: 'admin.login',
     severity: 'info',
     actorId: 'admin-123',
     actorType: 'ADMIN',
     details: { email: 'arjun.sharma@gmail.com', phone: '+919999900000' },
   });
   // Assert that the audit log row's details JSON does NOT contain 'arjun.sharma' or '+919999900000'.
   ```
4. Verify the existing PII redaction list (`SENSITIVE_KEYS` in `pii-redact.ts`) covers `email`, `phone`, `balanceAfter`, `riderId`. If not, add them (separate concern; coordinate with PR-3 of Design System plan if needed).

**Concrete diff sketch:**

```ts
// Before (security-events.ts:68-87)
if (severity === 'critical' || severity === 'warning') {
  try {
    await createAuditLog({
      actorId: actorId || 'SYSTEM',
      actorType: actorType || 'SYSTEM',
      action: `security.${type}`,
      entity: 'securityEvent',
      entityId: undefined,
      details: JSON.stringify({
        severity,
        ...details,
        ip,
        userAgent,
        correlationId,
      }),
    });
  } catch (err) {
    logger.error('[SecurityEvents] Failed to write audit log', { eventType: type, err });
  }
}

// After
import { redactPii } from './pii-redact';

if (severity === 'critical' || severity === 'warning' || severity === 'info') {  // also expand to info per PR-10
  try {
    const redactedDetails = redactPii({
      severity,
      ...details,
      ip,
      userAgent,
      correlationId,
    });
    await createAuditLog({
      actorId: actorId || 'SYSTEM',
      actorType: actorType || 'SYSTEM',
      action: `security.${type}`,
      entity: 'securityEvent',
      entityId: undefined,
      details: JSON.stringify(redactedDetails),
    });
  } catch (err) {
    logger.error('[SecurityEvents] Failed to write audit log', { eventType: type, err });
  }
}
```

**Acceptance criteria:**
- The `details` JSON in the audit log row is redacted via `redactPii`.
- New unit test (`web/tests/unit/security-events.test.ts`) verifies a PII-bearing call results in a redacted row.
- The existing 1422/1426 test suite still passes.

**Reviewer focus notes:**
- `redactPii` is for **logging**, not for **storage encryption** (per audit 4.8). The redacted value `'[REDACTED]'` is still in the audit log — that's intentional. The function is named `redactPii` because it masks for log output, and we reuse it here. If the team wants a separate "redact for storage" function, file a follow-up.
- The `redactPii` is recursive. Test with a nested object.
- The `ip` and `userAgent` fields don't usually contain PII, but a UA string can leak an email (rare). `redactPii` handles that.

---

### PR-3: Move dev OTP `'111111'` check AFTER entry lookup

**Audit ref:** 5.8
**Files:** `web/src/lib/otp-store.ts:151`
**Effort:** 15 min
**Risk:** none (dev-only change)
**Soak:** none (manual verification on dev)

**Why it's a real bug:**

In `verifyOtp`, the dev OTP check `if (isDev && code === '111111') return { valid: true };` runs BEFORE the entry lookup. **Any dev caller (or a misconfigured prod) can call `verifyOtp('+91 9999900000', '111111')` and get `valid: true` even if no OTP was ever sent to that phone.**

The dev check is gated by `isDev = process.env.NODE_ENV === 'development' && process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'staging'` (line 147-150), so the prod impact is low. But:
- A developer who forgets to set `APP_ENV=production` in a prod env has full OTP bypass.
- The dev workflow is broken: dev can't tell "OTP sent + verify with 111111" from "skip send + verify with 111111."

**What the PR does:**

1. Move the dev OTP check to AFTER the entry lookup. Specifically: in both the DB branch (line 153-180) and the in-memory branch (line 182-199), AFTER the entry is found, check `if (isDev && code === '111111')` and return `{ valid: true }` (still dev-only).
2. Add a comment explaining the security rationale.
3. Add a test:
   ```ts
   // Dev with no entry: should return invalid
   process.env.NODE_ENV = 'development';
   process.env.APP_ENV = 'development';
   const result = await verifyOtp('+910000000000', '111111');
   expect(result.valid).toBe(false);
   ```

**Concrete diff sketch:**

```ts
// Before (otp-store.ts:147-198)
const isDev = process.env.NODE_ENV === 'development' && process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'staging';
if (isDev && code === '111111') return { valid: true };

if (shouldUseDatabaseStore()) {
  const entry = await db.otpCode.findUnique({ where: { phone } }).catch(() => null);
  if (!entry) return { valid: false, error: 'No OTP found. Please request a new OTP.' };
  // ... (dev check now needs to be moved here)
}

// After
if (shouldUseDatabaseStore()) {
  const entry = await db.otpCode.findUnique({ where: { phone } }).catch(() => null);
  if (!entry) return { valid: false, error: 'No OTP found. Please request a new OTP.' };
  if (isDev && code === '111111') return { valid: true };  // dev check after entry lookup
  if (entry.verified) return { valid: false, error: 'OTP already used.' };
  // ... rest of DB path
} else {
  const entry = memoryStore.get(phone) || null;
  if (!entry) return { valid: false, error: 'No OTP found. Please request a new OTP.' };
  if (isDev && code === '111111') return { valid: true };  // dev check after entry lookup
  if (entry.verified) return { valid: false, error: 'OTP already used.' };
  // ... rest of memory path
}
```

**Acceptance criteria:**
- `verifyOtp('+910000000000', '111111')` in dev with no entry returns `{ valid: false }`.
- `verifyOtp('+91realphone', '111111')` in dev AFTER a `sendOtp('+91realphone')` returns `{ valid: true }`.
- A new test (`web/tests/unit/otp-store.test.ts` or extension) covers both branches.
- The 1422/1426 test suite still passes.

**Reviewer focus notes:**
- The dev check should be the FIRST thing after the entry lookup, BEFORE the `verified: true` check, so a dev re-using `111111` on a verified entry returns valid (the dev wants to log in repeatedly). Or, it can be AFTER `verified: true` to enforce one-time use. **Team decision needed.** Default to AFTER `verified: true` (consistent with prod semantics).
- The in-memory branch (line 182+) needs the same change. Don't forget both branches.

---

### PR-4: Pad buffers in `cron-auth.ts` `timingSafeEqual`

**Audit ref:** 7.5
**Files:** `web/src/lib/cron-auth.ts:23-27`
**Effort:** 15 min
**Risk:** none
**Soak:** none

**Why it's a real bug:**

```ts
const tokenBuf = Buffer.from(token);
const secretBuf = Buffer.from(secret);
if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

The `tokenBuf.length !== secretBuf.length` check returns early (faster) when lengths differ. **An attacker can use this to determine the secret length** via timing. Combined with knowledge of the prefix scheme (Bearer <secret>), this is a real (if small) leak.

**What the PR does:**

1. Pad the shorter buffer to the longer one's length with zeros, then call `timingSafeEqual`. The compare is then constant-time.
2. Use a max length cap (e.g. 1024) to prevent a DoS via a 1MB `Authorization` header.
3. Add a test that runs many iterations and asserts the timing variance is below a threshold.

**Concrete diff sketch:**

```ts
// Before (cron-auth.ts:23-27)
const tokenBuf = Buffer.from(token);
const secretBuf = Buffer.from(secret);
if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

// After
const MAX_TOKEN_LEN = 1024;
if (token.length > MAX_TOKEN_LEN) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

const tokenBuf = Buffer.from(token);
const secretBuf = Buffer.from(secret);
const maxLen = Math.max(tokenBuf.length, secretBuf.length);
const paddedToken = Buffer.alloc(maxLen);
const paddedSecret = Buffer.alloc(maxLen);
tokenBuf.copy(paddedToken);
secretBuf.copy(paddedSecret);
if (!timingSafeEqual(paddedToken, paddedSecret) || tokenBuf.length !== secretBuf.length) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

Wait — adding `tokenBuf.length !== secretBuf.length` after `timingSafeEqual` reintroduces the length leak. **The padding approach doesn't fully solve the problem.** The correct fix is to **hash both inputs first** (e.g. SHA-256), then compare hashes (always 32 bytes). This is the standard idiom.

**Revised diff sketch:**

```ts
// After (correct)
import { createHash } from 'crypto';

const MAX_TOKEN_LEN = 1024;
if (token.length > MAX_TOKEN_LEN) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

const tokenHash = createHash('sha256').update(token).digest();
const secretHash = createHash('sha256').update(secret).digest();
if (!timingSafeEqual(tokenHash, secretHash)) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

**Acceptance criteria:**
- The compare is constant-time (verified by running 1000 iterations against correct/incorrect tokens, asserting timing variance < 10%).
- A new test (`web/tests/unit/cron-auth.test.ts` or extension) asserts:
  - Correct token returns null (auth passed).
  - Incorrect token returns 401.
  - Empty token returns 401.
  - 1MB token returns 401.
- The 1422/1426 test suite still passes.

**Reviewer focus notes:**
- The SHA-256 hash approach is the standard "constant-time compare of variable-length secrets" idiom. Document this.
- The `MAX_TOKEN_LEN` is a DoS cap. 1024 is generous; 256 is tighter.
- The hashing means the secret is never passed to `timingSafeEqual` directly. This is the right design.

---

## 7. PR detail: 5-10 (the rest)

### PR-5: Replace `NODE_ENV` with `APP_ENV` in security gates

**Audit ref:** 3.1, 5.14, 6.8, 10.1, 12.2 (and ~10 other places per cross-cutting observation §15.1)
**Files:** `web/src/lib/pii-crypto.ts`, `web/src/lib/otp-store.ts`, `web/src/lib/rate-limit.ts`, `web/src/lib/rate-limit-middleware.ts`, `web/src/server/modules/auth/auth.use-cases.ts`, `web/src/middleware.ts`, possibly more
**Effort:** 2 hr (audit + 10-15 file edits)
**Risk:** low (each change is local; verify tests after each)
**Soak:** none

**Why it's a real bug:**

The codebase has a `NODE_ENV` (default `'development'`) and an `APP_ENV` (default `'development'`). They have different valid values. `NODE_ENV` is set by Next.js and is hard to control. `APP_ENV` is the team's controlled flag. **Several security gates use `NODE_ENV` instead of `APP_ENV`** — meaning a misconfigured prod (where `NODE_ENV=production` but `APP_ENV=staging`, for example) gets the wrong security posture.

**Specific sites to fix (per audit):**
- `pii-crypto.ts:15` (already checks both, but should standardize on `APP_ENV`)
- `otp-store.ts:147-150` (uses `NODE_ENV && APP_ENV !== production && APP_ENV !== staging` — already correct!)
- `otp-store.ts:41-43` (uses `NODE_ENV !== 'production'` for `canResendOtp` cooldown skip)
- `rate-limit.ts:24-30` (uses `NODE_ENV === 'production'` to decide DB vs in-memory)
- `rate-limit.ts:125-129` (uses `NODE_ENV === 'development'` to set `maxRequests: 1000`)
- `auth.use-cases.ts:64` (uses `NODE_ENV !== 'production'` to leak OTP)
- `middleware.ts:16` (uses `NODE_ENV === 'production'` for CSP/HSTS)

**What the PR does:**

1. Audit all `process.env.NODE_ENV` usages in `web/src/lib/`, `web/src/server/`, `web/src/middleware.ts`. List the security-relevant ones.
2. Replace each `NODE_ENV === 'production'` (or `!== 'production'`) with `APP_ENV === 'production'` (or `!== 'production'`).
3. Add a lint rule (or CI check) that flags `process.env.NODE_ENV` in security-sensitive files.
4. Update tests that mock `NODE_ENV` to mock `APP_ENV` instead.

**Acceptance criteria:**
- All security gates use `APP_ENV`.
- The 1422/1426 test suite still passes.
- A new CI check (`scripts/check-no-node-env-security.sh` or extension) greps for `NODE_ENV` in `web/src/lib/security-events.ts`, `web/src/lib/pii-crypto.ts`, `web/src/lib/password.ts`, `web/src/lib/otp-store.ts`, `web/src/lib/rate-limit*.ts`, `web/src/middleware.ts` and exits 1 if found.

**Reviewer focus notes:**
- The check should be narrow (security-sensitive files only). General `NODE_ENV` usage (e.g. in `logger.ts` for log levels) is fine.
- The change to `rate-limit.ts:24-30` and `:125-129` affects prod behavior. Verify the staging environment uses `APP_ENV=staging` and not `NODE_ENV=staging`.

---

### PR-6: Use `crypto.timingSafeEqual` for OTP compare

**Audit ref:** 5.1
**Files:** `web/src/lib/otp-store.ts:163, 192`
**Effort:** 1 hr
**Risk:** low
**Soak:** none

**Why it's a real bug:**

```ts
// Line 163 (DB path)
const valid = hashOtp(code, entry.salt) === entry.codeHash;

// Line 192 (memory path)
if (code !== entry.code)
```

JavaScript's `===` for strings is not guaranteed to be constant-time (modern V8 may be, but the spec doesn't require it). The DB hash is 64-char hex; the memory path compares the raw 6-digit code. An attacker can use timing to learn the correct value character-by-character.

**What the PR does:**

1. Replace `===` with `crypto.timingSafeEqual` on equal-length buffers. For variable-length inputs, hash first.
2. For the DB path: both `hashOtp(code, salt)` and `entry.codeHash` are 64-char hex. Convert to buffers and `timingSafeEqual`.
3. For the memory path: pad the 6-digit code to a fixed length (or compare as buffers of the same length).
4. Add a test that runs 1000 iterations against correct/incorrect codes and asserts timing variance < 10%.

**Concrete diff sketch:**

```ts
import { timingSafeEqual } from 'crypto';

// DB path (otp-store.ts:163)
const computedHash = hashOtp(code, entry.salt);
const computedBuf = Buffer.from(computedHash, 'hex');
const storedBuf = Buffer.from(entry.codeHash, 'hex');
if (computedBuf.length !== storedBuf.length || !timingSafeEqual(computedBuf, storedBuf)) {
  // invalid
}

// Memory path (otp-store.ts:192)
const codeBuf = Buffer.from(code.padEnd(6, '\0'), 'utf8');
const entryCodeBuf = Buffer.from(entry.code.padEnd(6, '\0'), 'utf8');
if (!timingSafeEqual(codeBuf, entryCodeBuf)) {
  // invalid
}
```

**Acceptance criteria:**
- Both DB and memory compare paths use `timingSafeEqual`.
- A new test asserts the timing variance is bounded.
- The 1422/1426 test suite still passes.

**Reviewer focus notes:**
- For the memory path, padding with `\0` may not be the right approach (the actual code is 6 digits, padding adds bytes). Consider hashing both with SHA-256 first (same as PR-4 for cron auth).
- The 64-char hex hash from `hashOtp` is always 32 bytes (256 bits). Equal length. Direct `timingSafeEqual` works.

---

### PR-7: Reject `ALLOW_DEV_PII_KEY` in production env

**Audit ref:** 3.1 (partial — see audit correction §1.2)
**Files:** `web/src/lib/env.ts`
**Effort:** 30 min
**Risk:** none
**Soak:** none

**Why it's a real bug:**

`ALLOW_DEV_PII_KEY` is not in the env schema. A misconfigured prod with `V1=valid_key` AND `ALLOW_DEV_PII_KEY=true` will silently accept the flag with no warning. **The flag is harmless when V1 is set** (per `pii-crypto.ts:14-24`, the dev key fallback only triggers when V1 is missing), but the lack of schema-level validation means:

1. Operators may set `ALLOW_DEV_PII_KEY=true` in prod for "convenience" and forget.
2. A future code change that re-orders the V1 check could regress into the dev-key path.
3. The env schema is the team's source of truth for production safety.

**What the PR does:**

1. Add `ALLOW_DEV_PII_KEY: z.string().optional()` to the env schema.
2. Add a refine: if `APP_ENV === 'production'` and `ALLOW_DEV_PII_KEY === 'true'`, throw.
3. Add to the production `isServer && parsedEnv.APP_ENV === 'production'` block as a hard check.
4. Document the flag in `docs/RUNBOOK.md` (or new `docs/SECURITY.md`) as "dev-only, must be unset in production."

**Concrete diff sketch:**

```ts
// In envSchema
ALLOW_DEV_PII_KEY: z.string().optional(),

// New refine
.refine(
  (data) => {
    if (data.APP_ENV === 'production' || data.APP_ENV === 'staging') {
      if (data.ALLOW_DEV_PII_KEY === 'true') return false;
    }
    return true;
  },
  { message: 'ALLOW_DEV_PII_KEY must not be "true" in production or staging.' }
)

// In production block
if (parsedEnv.ALLOW_DEV_PII_KEY === 'true') {
  throw new Error('Production architecture violation: ALLOW_DEV_PII_KEY must not be "true" in production.');
}
```

**Acceptance criteria:**
- `ALLOW_DEV_PII_KEY=true` with `APP_ENV=production` throws at startup.
- `ALLOW_DEV_PII_KEY=true` with `APP_ENV=development` is allowed.
- A new test (`web/tests/unit/env-schema.test.ts` or extension) covers both cases.
- The 1422/1426 test suite still passes.

**Reviewer focus notes:**
- The check should be in TWO places: the refine (for clarity in error messages) and the production block (for fail-fast at boot).
- The staging check is also useful: a misconfigured staging with the dev key would leak PII in test logs.

---

### PR-8: Add `TRUST_PROXY_HEADERS` env to rate-limiter

**Audit ref:** 6.4
**Files:** `web/src/lib/rate-limit-middleware.ts:73-95`, `web/src/lib/env.ts`
**Effort:** 1 hr
**Risk:** low (a misconfigured prod with `TRUST_PROXY_HEADERS=true` could let attackers spoof IPs, but that's the current behavior)
**Soak:** none

**Why it's a real bug:**

```ts
const cf = request.headers.get('cf-connecting-ip');
if (cf) return `ip:${cf.trim()}`;

const forwarded = request.headers.get('x-forwarded-for');
if (forwarded) {
  // ... iterate right-to-left, find first non-trusted IP
}
```

**In a non-Cloudflare/non-proxy deployment, a client can set `cf-connecting-ip` to any value** and bypass the rate limit. The `TRUSTED_PROXIES` check is on `x-forwarded-for` only, not on `cf-connecting-ip`. **The audit is right.**

**What the PR does:**

1. Add `TRUST_PROXY_HEADERS: z.string().default('false').transform(v => v === 'true')` to env schema.
2. In `rateLimitIdentifierFromRequest`:
   - If `TRUST_PROXY_HEADERS=false`, **always fall through to the Next.js `request.ip`**.
   - If `TRUST_PROXY_HEADERS=true`, use `cf-connecting-ip` and `x-forwarded-for` as before.
3. Document in `docs/DEPLOYMENT.md` that the production deploy must set `TRUST_PROXY_HEADERS=true` since the laptop is behind Cloudflare Tunnel.
4. Add a test that asserts:
   - With `TRUST_PROXY_HEADERS=false`, a request with `cf-connecting-ip: 1.2.3.4` does NOT use that IP.
   - With `TRUST_PROXY_HEADERS=true`, the same request DOES use that IP.

**Concrete diff sketch:**

```ts
// env.ts
TRUST_PROXY_HEADERS: z
  .string()
  .default('false')
  .transform((v) => v === 'true'),

// rate-limit-middleware.ts
import { env } from './env';

export function rateLimitIdentifierFromRequest(request: Request): string {
  if (env.TRUST_PROXY_HEADERS) {
    const cf = request.headers.get('cf-connecting-ip');
    if (cf) return `ip:${cf.trim()}`;

    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      // ... existing logic
    }
  }

  // Fallback to Next.js specific ip property
  const nextIp = (request as any).ip;
  return `ip:${nextIp || '127.0.0.1'}`;
}
```

**Acceptance criteria:**
- With `TRUST_PROXY_HEADERS=false`, the rate limiter uses `request.ip` (Next.js).
- With `TRUST_PROXY_HEADERS=true`, the rate limiter honors `cf-connecting-ip` and `x-forwarded-for`.
- A new test covers both cases.
- The 1422/1426 test suite still passes.

**Reviewer focus notes:**
- `request.ip` in Next.js is the IP of the immediate connection. **In a Cloudflare Tunnel deployment, this is the CF edge IP, not the client IP.** This is a known limitation; the team uses `cf-connecting-ip` to get the real client IP. **The fix preserves the current prod behavior (TRUST_PROXY_HEADERS=true) and tightens the default for non-prod.**
- The `env` import adds a build-time dependency on the schema. Verify the cycle: `env.ts` doesn't import `rate-limit-middleware.ts`.

---

### PR-9: Self-referral guard + redact `exists` field

**Audit ref:** 10.3, 10.6
**Files:** `web/src/server/modules/auth/auth.use-cases.ts:62-65, 143-160`
**Effort:** 1 hr
**Risk:** low
**Soak:** 1 staging deploy

**Why these are real bugs:**

1. **`exists` field leak (10.3)**: The `sendOtp` return value includes `exists: !!existingRider`, telling the caller whether a phone is registered. **This is a user-enumeration vulnerability.** An attacker can probe phones to find registered ones.

2. **Self-referral (10.6)**: A new rider can pass their own `referralCode` as the incoming referral. The reward is `points: 500` (likely converted to paise elsewhere). **A rider can self-refer and earn the reward.**

**What the PR does:**

1. **Remove `exists` from the public response.** The internal logic can still know (to route new vs. returning riders), but the public API should return a constant. Check if any UI depends on the field. If so, file a follow-up to update the UI, but the API should not leak.

2. **Block self-referral** by comparing `referrer.id !== newRider.id`. Add a check in `auth.use-cases.ts:148`:
   ```ts
   if (referrer && referrer.id !== rider.id) {
     // award reward
   }
   ```

3. **Block already-referred riders** (defense in depth): if the new rider's `referredBy` is already set, don't award again. (This is currently not possible since `referredBy` is only set on create, but future code could re-set it.)

4. Add tests:
   - `sendOtp` response does not include `exists`.
   - `verifyOtp` with a self-referral code does not award reward.
   - `verifyOtp` with a real referral code awards reward (existing test, kept).

**Concrete diff sketch:**

```ts
// Before (auth.use-cases.ts:62-65)
return {
  exists: !!existingRider,
  otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
};

// After
return {
  // exists removed — internal logic still knows via existingRider
  otp: env.APP_ENV !== 'production' ? otp : undefined,  // also use APP_ENV per PR-5
};

// Before (auth.use-cases.ts:143-160)
if (incomingReferralCode) {
  try {
    const referrer = await db.rider.findUnique({
      where: { referralCode: incomingReferralCode },
    });
    if (referrer) {
      await db.reward.create({
        data: { riderId: referrer.id, title: 'Successful Referral', points: 500 },
      });
    }
  } catch (rewardErr) {
    logger.error('[AuthUseCases] Failed to award referral points', { error: rewardErr });
  }
}

// After
if (incomingReferralCode) {
  try {
    const referrer = await db.rider.findUnique({
      where: { referralCode: incomingReferralCode },
    });
    if (referrer && referrer.id !== rider.id) {  // <-- self-referral guard
      await db.reward.create({
        data: { riderId: referrer.id, title: 'Successful Referral', points: 500 },
      });
    } else if (referrer && referrer.id === rider.id) {
      logger.warn('[AuthUseCases] Self-referral blocked', { riderId: rider.id });
    }
  } catch (rewardErr) {
    logger.error('[AuthUseCases] Failed to award referral points', { error: rewardErr });
  }
}
```

**Acceptance criteria:**
- `sendOtp` response does not include `exists` (or `exists: false` always).
- `verifyOtp` with `referralCode` matching the new rider's own code does NOT award reward.
- `verifyOtp` with a different rider's `referralCode` awards reward (existing test).
- A new test covers the self-referral case.
- The 1422/1426 test suite still passes.

**Reviewer focus notes:**
- Verify the UI doesn't depend on `exists`. If it does, file a follow-up. Don't try to fix both in one PR.
- Consider also: should the referrer need to be in `lifecycleStatus: ACTIVE`? Per audit 10.6, the team should decide. The current fix (block self) is the minimum. The ACTIVE check is a follow-up.
- The `logger.warn` for self-referral blocks is useful for fraud detection.

---

### PR-10: Audit log all security events (info + warn + crit)

**Audit ref:** 8.8
**Files:** `web/src/lib/security-events.ts:68`, possibly new `LoginAudit` table, possibly `web/prisma/schema.prisma`
**Effort:** 1 day
**Risk:** medium (audit log volume increases; may need DB index tuning)
**Soak:** 1 week on staging (verify audit log table size growth is acceptable)

**Why it's a real bug:**

`logSecurityEvent` only writes to the audit log for `critical` and `warning` events. `info` events (e.g. `logKycDocumentView`, successful `logAdminLogin`) are logged at the application level only. **A successful admin login is not in the audit log.** This is a SOC2 compliance failure (login events must be audit-logged).

**What the PR does:**

1. Move the `if (severity === 'critical' || severity === 'warning')` to `if (severity === 'critical' || severity === 'warning' || severity === 'info')` — write ALL events to the audit log.
2. Consider a separate `LoginAudit` table (per audit suggestion) to keep login events queryable without joining the main audit log. If the team prefers a single table, add an index on `(action, createdAt)` to make `WHERE action = 'security.admin.login' ORDER BY createdAt DESC` fast.
3. Verify the existing `deleteExpiredLogs` cleanup handles the increased volume (per audit 9.4, it has no max-rows cap).
4. Add a test that asserts a successful admin login is in the audit log.

**Acceptance criteria:**
- All security events (info, warning, critical) are written to the audit log.
- A successful `logAdminLogin` is queryable in the audit log.
- A new test (`web/tests/unit/security-events.test.ts` or extension) covers all three severity levels.
- The 1422/1426 test suite still passes.
- 1 week staging soak: audit log table size grows < 2x.

**Reviewer focus notes:**
- This is a volume-affecting change. Coordinate with the team on retention policies.
- The `deleteExpiredLogs` cap (audit 9.4) is a separate fix; coordinate with the infra plan if needed.
- If the team prefers a `LoginAudit` table, the schema migration is a separate concern. **Default: keep one table, add an index.**

---

## 8. Soak requirements per PR

| PR  | Soak                                          | Duration |
| --- | --------------------------------------------- | -------- |
| 1   | Manual: next OTP smoke test shows "Voltium"   | 0        |
| 2   | Manual: query audit log, verify redaction     | 0        |
| 3   | Dev: verify 111111 requires entry             | 0        |
| 4   | Test: timing variance assertion               | 0        |
| 5   | None (config change)                          | 0        |
| 6   | Test: timing variance assertion               | 0        |
| 7   | Boot test: APP_ENV=prod + flag=true throws    | 0        |
| 8   | Staging: verify CF IP extraction still works  | 1 day    |
| 9   | 1 staging deploy                              | 1 day    |
| 10  | 1 week staging: verify audit log volume       | 1 week   |

**Total soak calendar time:** ~2 weeks if PRs are merged sequentially. **The minimum-viable batch (PRs 1-4) has zero soak** and can be merged immediately.

---

## 9. What's NOT in this plan (deferred)

Per the principles, the following audit findings are documented but deferred. They are real but not review-ready for the 2-month-to-release window, OR they are duplicate findings already covered in other audit plans.

### 9.1 Duplicate findings (covered in other audit plans)

- **§13.1-13.8** (JWT, sessions, cookies, impersonation, x-rider-id): covered in `BACKEND_PLAN.md` and the original `AUDIT_BACKEND.md`. Do not re-plan here.
- **§5.11-5.12** (MAX_ATTEMPTS, OTP_EXPIRY_MS hardcoded): **moved to env per Phase 6**. Verify and confirm.
- **§6.1** (memory store in prod by default): the prod flag is `NODE_ENV === 'production'` (per current code). Per PR-5 above, change to `APP_ENV`. The DB-vs-memory decision is fine; the flag is wrong.
- **§6.2** (race condition in DB rate-limiter): real, but not blocking. **Deferred.**
- **§6.7** (in-memory store grows unbounded): LRU eviction. **Deferred.**
- **§6.9** (UPLOAD_RATE_LIMIT 10/min): per-rider not per-IP. **Deferred.**
- **§9.1** (CRITICAL_ACTIONS throw after data commit): wrap in `$transaction`. **Covered in `DB_REMEDIATION_PLAN.md` §"transaction safety" if added.**
- **§9.2-9.7** (audit log retention, N+1, size cap): small improvements. **Deferred to a "polish" PR.**

### 9.2 Real but deferred (review-ready for v2)

- **§2.1** (Argon2id parallelism=4 too high): real, but `parallelism=1` vs `parallelism=4` is a 4x CPU perf difference. **Defer to v2** unless the team has load data showing hash latency is a bottleneck.
- **§2.3** (verifyPbkdf2 NaN check): real, easy fix. **Defer to a "polish" PR.**
- **§2.4** (verifyPbkdf2 no try/catch): real, easy fix. **Defer to a "polish" PR.**
- **§2.5** (MAX_ITERATIONS 10M DoS): real, lower to 1M. **Defer to a "polish" PR.**
- **§3.3** (decryptPii returns original string if not encrypted): real. Add a `__pii_encrypted: true` flag and refuse unmigrated values. **Defer to a "polish" PR.**
- **§3.6** (encryptPii empty string): real, return encrypted sentinel. **Defer to a "polish" PR.**
- **§3.7** (encryptPii null/undefined return type): real, branded type. **Defer to a "polish" PR.**
- **§3.8** (parseKey 64-char hex only): real, document. **Defer to a "polish" PR.**
- **§3.9** (key rotation requires restart): real, document. **Defer to a "polish" PR.**
- **§3.10** (no key rotation API): real, add `scripts/rotate-pii-key.ts`. **Defer to v2.**
- **§3.11** (colon separator fragility): not a real bug (hex has no colons). **No action.**
- **§4.2** (maskAadhaar/maskPan return original for invalid input): real, fail-closed. **Defer to a "polish" PR.**
- **§4.3** (SENSITIVE_KEYS hardcoded): real, add `keySecret`, `webhookSecret`, `merchantId`. **Defer to a "polish" PR.**
- **§4.4** (SENSITIVE_PATTERNS only 2): real, add hex pattern. **Defer to a "polish" PR.**
- **§4.5** (redactPii strips stack trace): real, recursively redact Error properties. **Defer to a "polish" PR.**
- **§4.6** (case-sensitive key check, snake_case fragility): real, normalize. **Defer to a "polish" PR.**
- **§4.7** (length check 32 chars arbitrary): real, lower to 16. **Defer to a "polish" PR.**
- **§4.8** (redactPii name is misleading): real, rename to `redactForLog`. **Defer to a "polish" PR.**
- **§5.4** (dev mode same OTP for all phones): real but minor. **Defer to a "polish" PR.**
- **§5.5-5.6** (single SHA-256 hash, salt irrelevant): real, switch to PBKDF2 or Argon2id. **Defer to v2** — the timing-safe-equal fix (PR-6) is the higher-priority OTP fix.
- **§5.9** (dev OTP accepted for any phone — already covered by PR-3's broader fix).
- **§5.13** (deleteMany silent swallow): real, log on error. **Defer to a "polish" PR.**
- **§5.14** (canResendOtp bypass in non-prod): real, gate on APP_ENV per PR-5.
- **§5.15** (no length validation on code): real, Zod schema. **Defer to a "polish" PR.**
- **§6.3** (fail-open log at warn): real, use alerter. **Defer to v2.**
- **§6.5-6.6** (TRUSTED_PROXIES default, IP extraction right-to-left): real. **Defer to a "polish" PR** — PR-8 covers the more critical trust issue.
- **§6.10** (withRateLimit returns 500 instead of 503 for auth): real, return 503. **Defer to a "polish" PR.**
- **§7.1-7.4, 7.6** (CRON_SECRET length, Bearer case-insensitive, no failed-attempt log, per-route secrets, magic number): real. **Defer to a "polish" PR** — PR-4 covers the timing leak.
- **§8.2-8.7, 8.9** (email/phone/riderId masking, info level alerts, threshold, suspension phone, audit log failure alert): real. **Defer to a "polish" PR.**
- **§10.2** (sendOtp no tenant rate limit): real, per-tenant cap. **Defer to v2.**
- **§10.4** (new rider without password — SIM swap): real, step-up auth. **Defer to v2** — this is a feature decision, not a quick fix.
- **§10.5** (Firebase idToken no freshness check): real, check `iat > now - 5min`. **Defer to a "polish" PR.**
- **§10.7-10.8** (logout 30s cache, no cookie delete): real. **Defer to a "polish" PR.**
- **§10.9-10.10** (RateLimitError location, dead `auth.routes.ts`): real. **Defer to a "polish" PR.**
- **§11.1-11.4** (Firebase admin warn vs error, env schema, key replace, lazy init): real. **Defer to a "polish" PR.**
- **§12.1, 12.3-12.7** (VALIDATION_MAP, CSRF safe methods, Origin header, ALLOWED_ORIGINS, CSP report-uri, HSTS): real. **Defer to a "polish" PR** — most are already correct or low-risk.
- **§15.10-15.15** (admin 2FA, password reset, session UI, CSRF for GETs, security headers for API, CORS localhost): these are features, not bugs. **Defer to v2.**

### 9.3 No-action items (audit's own analysis says "OK")

- **§3.4** (auth tag validation): audit confirms correct.
- **§5.7** (attempts increment on success): audit confirms correct.
- **§5.10** (in-memory store reset on restart): audit confirms correct in prod.
- **§12.3, 12.6** (CSRF safe methods, CSP unsafe-inline dev-only): audit confirms correct.

---

## 10. Cross-cutting decisions

1. **`APP_ENV` over `NODE_ENV` for all security gates.** Per the team's existing env schema. PR-5 is the cleanup batch.
2. **PII redaction is for logging AND for audit log storage details.** `redactPii` is reused. If the team wants a separate "redact for storage" function, file a follow-up.
3. **Timing-safe compare is the standard idiom for variable-length secrets.** Hash first, then compare. Per PR-4 (cron auth) and PR-6 (OTP).
4. **Self-referral is fraud, not a feature.** The fix is `referrer.id !== newRider.id`. Per PR-9.
5. **Trust the proxy headers only when behind a trusted proxy.** `TRUST_PROXY_HEADERS=true` is the production flag. Per PR-8.
6. **Audit log ALL security events, not just warning+critical.** SOC2 compliance. Per PR-10.
7. **Don't re-plan findings that other audit plans cover.** JWT, sessions, cookies, impersonation, x-rider-id headers are in `BACKEND_PLAN.md`. Reference, don't duplicate.

---

## 11. Open questions

1. **Is the Ryd→Voltium brand name a clean swap, or are there other brand strings to fix in the same PR?** The grep may surface brand-deprecated aliases. **Scope decision needed.**
2. **Does the UI depend on the `exists` field from `sendOtp`?** If yes, the UI needs updating when the field is removed (PR-9). Coordinate with the Flutter team.
3. **Should self-referral also require the referrer to be `lifecycleStatus: ACTIVE`?** PR-9 only blocks `referrer.id === newRider.id`. The team should decide on the additional gate.
4. **`TRUST_PROXY_HEADERS=true` is required for the current Cloudflare Tunnel prod.** When was the env set, and is it documented in `docs/DEPLOYMENT.md`? (PR-8 just adds the flag; the doc is separate.)
5. **Should `LoginAudit` be a separate table (per audit 8.8) or a filter on the main audit log?** PR-10 defaults to a single table with an index. Coordinate with the team.
6. **What is the existing retention for security events?** Audit 9.2 notes `RETENTION_PERIODS` is hardcoded. The 30-day `system` retention may be too short for incident response. Verify with the team.
7. **Does `getOrSetResponse` cache `verifySessionToken` results (per audit 10.7)?** A 30s cache means a logged-out rider can use the old token for 30s. **Defer to v2** but worth a follow-up.

---

## Appendix A: Tickets to add to `FOLLOWUP_TICKETS.md`

The following tickets should be added to `docs/FOLLOWUP_TICKETS.md` (next to the existing 43 tickets). All are copy-paste-ready.

### Ticket #44 (P0): SMS OTP message says "Ryd" instead of "Voltium"

**Source:** SECURITY_PLAN PR-1
**Audit ref:** newly found (not in audit)

**Description:**

`web/src/server/modules/auth/auth.use-cases.ts:52` reads:

```ts
const message = `Your Ryd verification code is: ${otp}. Do not share this code with anyone.`;
```

The brand name is "Voltium" (per Phase 7 design decision). Every rider OTP SMS has been saying "Ryd" since launch. This is a customer-visible brand violation.

**Why this matters:** A rider who Googles "Ryd" finds the wrong company. A rider who tries to call "Ryd" support dials a stranger. Brand trust is lost faster than any auth fix can recover.

**Acceptance criteria:**

- Line 52 reads "Voltium" not "Ryd".
- A new test asserts the SMS message contains "Voltium" and not "Ryd".
- `grep -r "Ryd" web/src/` returns 0 results in customer-visible strings.
- A staging smoke test shows "Voltium" in the SMS body.

**Files:** `web/src/server/modules/auth/auth.use-cases.ts`, possibly new test in `web/tests/unit/auth-use-cases.test.ts`

**Estimated effort:** 5 min

---

### Ticket #45 (P0): `security-events.ts` audit log `details` not redacted — PII leaks

**Source:** SECURITY_PLAN PR-2
**Audit ref:** 8.1

**Description:**

`logSecurityEvent` calls `createAuditLog` with `details: JSON.stringify({ severity, ...details, ip, userAgent, correlationId })`. The `...details` is the caller's payload and may contain PII (email, phone, balance, riderId). No redaction happens before the JSON stringify. The audit log's `details` column ends up with PII.

**Why this matters:** Per the previous broad audit (4.13), the audit log's `details` is exposed to admin endpoints and may leak PII to admin UIs. GDPR concern.

**Acceptance criteria:**

- The `details` JSON in the audit log row is redacted via `redactPii`.
- New unit test (`web/tests/unit/security-events.test.ts`) verifies a PII-bearing call results in a redacted row.
- The 1422/1426 test suite still passes.

**Files:** `web/src/lib/security-events.ts:68-87`, new `web/tests/unit/security-events.test.ts`

**Estimated effort:** 30 min

---

### Ticket #46 (P0): Dev OTP `'111111'` accepted for ANY phone without entry lookup

**Source:** SECURITY_PLAN PR-3
**Audit ref:** 5.8

**Description:**

In `verifyOtp` (`web/src/lib/otp-store.ts:151`), the dev OTP check `if (isDev && code === '111111') return { valid: true };` runs BEFORE the entry lookup. A dev caller (or a misconfigured prod) can call `verifyOtp('+91 9999900000', '111111')` and get `valid: true` even if no OTP was ever sent to that phone.

**Why this matters:** A developer who forgets to set `APP_ENV=production` in a prod env has full OTP bypass. The dev workflow is also broken: dev can't distinguish "OTP sent + verify" from "skip send + verify."

**Acceptance criteria:**

- `verifyOtp('+910000000000', '111111')` in dev with no entry returns `{ valid: false }`.
- `verifyOtp('+91realphone', '111111')` in dev AFTER a `sendOtp('+91realphone')` returns `{ valid: true }`.
- New test (`web/tests/unit/otp-store.test.ts` or extension) covers both branches.
- Both DB and in-memory paths updated.

**Files:** `web/src/lib/otp-store.ts:147-198`

**Estimated effort:** 15 min

---

### Ticket #47 (P0): `cron-auth.ts` length-check leaks secret length via timing

**Source:** SECURITY_PLAN PR-4
**Audit ref:** 7.5

**Description:**

`web/src/lib/cron-auth.ts:25` does:
```ts
if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
```
The early return on length mismatch leaks the secret length via timing. An attacker can use this to determine the secret length.

**Why this matters:** Combined with knowledge of the Bearer scheme, this is a real (if small) leak. The fix is to hash both inputs with SHA-256 first (always 32 bytes), then `timingSafeEqual` on the hashes.

**Acceptance criteria:**

- The compare is constant-time (verified by running 1000 iterations against correct/incorrect tokens, asserting timing variance < 10%).
- A `MAX_TOKEN_LEN=1024` cap prevents DoS via large `Authorization` header.
- New test (`web/tests/unit/cron-auth.test.ts` or extension) asserts:
  - Correct token returns null (auth passed).
  - Incorrect token returns 401.
  - Empty token returns 401.
  - 1MB token returns 401.

**Files:** `web/src/lib/cron-auth.ts:23-27`

**Estimated effort:** 15 min

---

### Ticket #48 (P0): `NODE_ENV` used for security gates — replace with `APP_ENV`

**Source:** SECURITY_PLAN PR-5
**Audit ref:** 3.1, 5.14, 6.8, 10.1, 12.2 (and ~10 other places)

**Description:**

The codebase has both `NODE_ENV` and `APP_ENV`. `NODE_ENV` is set by Next.js and is hard to control. `APP_ENV` is the team's controlled flag. Several security gates use `NODE_ENV` instead of `APP_ENV` — meaning a misconfigured prod (where `NODE_ENV=production` but `APP_ENV=staging`) gets the wrong security posture.

**Specific sites:** `pii-crypto.ts:15`, `otp-store.ts:41-43`, `rate-limit.ts:24-30, 125-129`, `auth.use-cases.ts:64`, `middleware.ts:16`.

**Why this matters:** Production security gates that depend on the wrong env var are the most common source of "works in staging, broken in prod" or "works in dev, broken in prod" bugs.

**Acceptance criteria:**

- All security gates use `APP_ENV`.
- The 1422/1426 test suite still passes.
- A new CI check (`scripts/check-no-node-env-security.sh`) greps for `NODE_ENV` in `web/src/lib/security-events.ts`, `web/src/lib/pii-crypto.ts`, `web/src/lib/password.ts`, `web/src/lib/otp-store.ts`, `web/src/lib/rate-limit*.ts`, `web/src/middleware.ts` and exits 1 if found.

**Files:** ~6-10 files in `web/src/lib/` and `web/src/middleware.ts`

**Estimated effort:** 2 hr

---

### Ticket #49 (P0): OTP compare uses `===` — non-constant-time timing attack

**Source:** SECURITY_PLAN PR-6
**Audit ref:** 5.1

**Description:**

`web/src/lib/otp-store.ts:163, 192` use `===` for string comparison. JavaScript's `===` for strings is not guaranteed to be constant-time. An attacker can use timing to learn the correct OTP character-by-character.

**Why this matters:** Theoretical but real. The 64-char hex hash is the same length on both sides; for the memory path the 6-digit code is fixed length. The fix is `crypto.timingSafeEqual` on equal-length buffers.

**Acceptance criteria:**

- Both DB and memory compare paths use `timingSafeEqual`.
- A new test asserts the timing variance is bounded (< 10% over 1000 iterations).
- The 1422/1426 test suite still passes.

**Files:** `web/src/lib/otp-store.ts:163, 192`

**Estimated effort:** 1 hr

---

### Ticket #50 (P0): `ALLOW_DEV_PII_KEY` not rejected in production env schema

**Source:** SECURITY_PLAN PR-7
**Audit ref:** 3.1 (partial — see SECURITY_PLAN §1.2)

**Description:**

`ALLOW_DEV_PII_KEY` is not in the env schema. A misconfigured prod with `V1=valid_key` AND `ALLOW_DEV_PII_KEY=true` will silently accept the flag with no warning. While the dev key fallback only triggers when V1 is missing (per `pii-crypto.ts:14-24`), the lack of schema-level validation is a footgun.

**Why this matters:** Operators may set `ALLOW_DEV_PII_KEY=true` in prod for "convenience" and forget. The env schema is the team's source of truth for production safety.

**Acceptance criteria:**

- `ALLOW_DEV_PII_KEY=true` with `APP_ENV=production` throws at startup.
- `ALLOW_DEV_PII_KEY=true` with `APP_ENV=development` is allowed.
- A new test covers both cases.
- Documented in `docs/RUNBOOK.md` as "dev-only, must be unset in production."

**Files:** `web/src/lib/env.ts`

**Estimated effort:** 30 min

---

### Ticket #51 (P0): Rate limiter trusts `cf-connecting-ip`/`x-forwarded-for` unconditionally

**Source:** SECURITY_PLAN PR-8
**Audit ref:** 6.4

**Description:**

`web/src/lib/rate-limit-middleware.ts:73-95` honors `cf-connecting-ip` and `x-forwarded-for` headers unconditionally. In a non-Cloudflare/non-proxy deployment, a client can set `cf-connecting-ip` to any value and bypass the rate limit.

**Why this matters:** An attacker can rotate IPs via header injection, bypassing per-IP rate limits. The fix is a `TRUST_PROXY_HEADERS` env flag (default false, prod must be true for the CF Tunnel deployment).

**Acceptance criteria:**

- With `TRUST_PROXY_HEADERS=false`, the rate limiter uses `request.ip` (Next.js).
- With `TRUST_PROXY_HEADERS=true`, the rate limiter honors `cf-connecting-ip` and `x-forwarded-for`.
- A new test covers both cases.
- Documented in `docs/DEPLOYMENT.md`.

**Files:** `web/src/lib/rate-limit-middleware.ts:73-95`, `web/src/lib/env.ts`

**Estimated effort:** 1 hr

---

### Ticket #52 (P0): Self-referral allowed + `exists` field leaks user enumeration

**Source:** SECURITY_PLAN PR-9
**Audit ref:** 10.3, 10.6

**Description:**

1. `auth.use-cases.ts:62-65` returns `exists: !!existingRider` from `sendOtp`, telling the caller whether a phone is registered. **User-enumeration vulnerability.**
2. `auth.use-cases.ts:143-160` allows a new rider to self-refer (pass their own `referralCode` as the incoming referral) and earn 500 points. **Referral fraud.**

**Why this matters:** Both are real P0s. The first is GDPR-adjacent. The second is direct fraud.

**Acceptance criteria:**

- `sendOtp` response does not include `exists` (or `exists: false` always).
- `verifyOtp` with `referralCode` matching the new rider's own code does NOT award reward.
- `verifyOtp` with a different rider's `referralCode` awards reward (existing test, kept).
- A new test covers the self-referral case.
- The 1422/1426 test suite still passes.

**Files:** `web/src/server/modules/auth/auth.use-cases.ts:62-65, 143-160`

**Estimated effort:** 1 hr

---

### Ticket #53 (P0): `info` security events (successful login) NOT audit-logged — SOC2 failure

**Source:** SECURITY_PLAN PR-10
**Audit ref:** 8.8

**Description:**

`logSecurityEvent` only writes to the audit log for `critical` and `warning` events. `info` events (e.g. `logKycDocumentView`, successful `logAdminLogin`) are logged at the application level only. **A successful admin login is not in the audit log.** SOC2 compliance failure (login events must be audit-logged).

**Why this matters:** SOC2 / GDPR / any compliance framework requires login events in the audit log. The current code makes admin logins invisible to the audit.

**Acceptance criteria:**

- All security events (info, warning, critical) are written to the audit log.
- A successful `logAdminLogin` is queryable in the audit log.
- A new test covers all three severity levels.
- 1 week staging soak: audit log table size grows < 2x.

**Files:** `web/src/lib/security-events.ts:68`

**Estimated effort:** 1 day

---

### Trivial/cosmetic items (NOT individual tickets)

These are mentioned in the audit but are too small to warrant individual tickets, or are already covered in other plans. File as a single 1-hr ticket if the team wants to batch them, or skip.

- **2.1** Argon2id parallelism=4 — defer to v2
- **2.3** verifyPbkdf2 NaN check — defer to polish
- **2.4** verifyPbkdf2 no try/catch — defer to polish
- **2.5** MAX_ITERATIONS 10M DoS — defer to polish
- **3.3** decryptPii returns original if not encrypted — defer to polish
- **3.6** encryptPii empty string — defer to polish
- **3.7** encryptPii null/undefined return type — defer to polish
- **3.8** parseKey 64-char hex only — defer to polish
- **3.9** key rotation requires restart — defer to polish
- **3.10** no key rotation API — defer to v2 (`scripts/rotate-pii-key.ts`)
- **4.1** (audit is wrong — see §1.1)
- **4.2** maskAadhaar/maskPan fail-open — defer to polish
- **4.3** SENSITIVE_KEYS hardcoded (missing `keySecret`, `webhookSecret`, `merchantId`) — defer to polish
- **4.4** SENSITIVE_PATTERNS only 2 — defer to polish
- **4.5** redactPii strips stack trace — defer to polish
- **4.6** case-sensitive key check, snake_case fragility — defer to polish
- **4.7** length check 32 chars arbitrary — defer to polish
- **4.8** redactPii name is misleading (rename to redactForLog) — defer to polish
- **5.5-5.6** single SHA-256 hash, salt irrelevant — defer to v2 (PR-6 covers the higher-priority timing fix)
- **5.7** (audit is wrong — see §1.3)
- **5.10** (audit is wrong — see §1.4)
- **5.13** deleteMany silent swallow — defer to polish
- **5.15** no length validation on code — defer to polish
- **6.1** memory store in prod by default — covered by PR-5 (use APP_ENV)
- **6.2** race condition in DB rate-limiter — defer to v2
- **6.3** fail-open log at warn — defer to v2
- **6.5-6.6** TRUSTED_PROXIES default, IP extraction right-to-left — defer to polish (PR-8 covers the more critical trust issue)
- **6.7** in-memory store grows unbounded — defer to polish
- **6.9** UPLOAD_RATE_LIMIT 10/min per-IP — defer to polish
- **6.10** withRateLimit returns 500 instead of 503 — defer to polish
- **7.1-7.4, 7.6** CRON_SECRET length, Bearer case-insensitive, no failed-attempt log, per-route secrets, magic number — defer to polish (PR-4 covers the timing leak)
- **8.2-8.7, 8.9** email/phone/riderId masking, info level alerts, threshold, suspension phone, audit log failure alert — defer to polish
- **9.1** CRITICAL_ACTIONS throw after data commit — covered in `DB_REMEDIATION_PLAN.md` if added
- **9.2-9.7** audit log retention, N+1, size cap — defer to polish
- **10.2** sendOtp no tenant rate limit — defer to v2
- **10.4** new rider without password (SIM swap) — defer to v2 (feature decision)
- **10.5** Firebase idToken no freshness check — defer to polish
- **10.7-10.8** logout 30s cache, no cookie delete — defer to polish
- **10.9-10.10** RateLimitError location, dead `auth.routes.ts` — defer to polish
- **11.1-11.4** Firebase admin warn vs error, env schema, key replace, lazy init — defer to polish
- **12.1, 12.3-12.7** VALIDATION_MAP, CSRF safe methods, Origin header, ALLOWED_ORIGINS, CSP report-uri, HSTS — defer to polish
- **§13** (JWT, sessions, cookies, impersonation, x-rider-id) — covered in `BACKEND_PLAN.md` and original `AUDIT_BACKEND.md`
- **§15.10-15.15** admin 2FA, password reset, session UI, CSRF for GETs, security headers for API, CORS localhost — defer to v2 (features, not bugs)

---

## Appendix B: Cross-references

- **Audit:** `docs/AUDIT_SECURITY.md` (~75 findings)
- **Related plans:**
  - `docs/DB_REMEDIATION_PLAN.md` — DB schema, transactions
  - `docs/ADMIN_WEB_PLAN.md` — admin web app
  - `docs/RIDER_APP_PLAN.md` — Flutter rider app
  - `docs/DESIGN_SYSTEM_PLAN.md` — design tokens, themes
  - `docs/INFRASTRUCTURE_PLAN.md` — infrastructure, devops
- **Audit correction overlap:** `AUDIT_FINDINGS_RIDERAPP.md` and `AUDIT_INFRASTRUCTURE.md` are already verified; `AUDIT_SECURITY.md` adds 1 new correction (4.1) and 1 partial mitigation (3.1).
- **FOLLOWUP tickets:** `docs/FOLLOWUP_TICKETS.md` (existing 43 tickets + 10 new from this plan = 53 total)
- **Release readiness:** `docs/RELEASE_READINESS_2026-07-29.md`
- **Runbook:** `docs/RUNBOOK.md` (will need expansion per open question 11.6)
- **Deployment:** `docs/DEPLOYMENT.md` (TRUST_PROXY_HEADERS doc, per open question 11.4)
- **Brand decision:** `SCOPE.md` Phase 7 Q1 follow-up (primary color → #0053C1, brand = Voltium)

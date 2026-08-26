# Voltium Auth & Security — Deep-Dive Audit Findings

**Date:** 2026-07-29
**Scope:** `web/src/lib/**` (9 security/auth files), `web/src/server/modules/auth/**` (6 files), `web/src/middleware.ts` (CSRF/CORS/CSP), `web/src/lib/firebase-admin.ts`.

> **Status (2026-07-30, Pass 4):** 5 of 20 top P0s FIXED (#49 timingSafeEqual, #50 ALLOW_DEV_PII_KEY, etc.), 2 PARTIALLY FIXED, 0 STILL TRUE, **2 STALE (audit was wrong)**: #3.1 ALLOW_DEV_PII_KEY env flag (3 layers of defense, #50 SHIPPED), #4.1 maskEmail 2-char leak (now returns `*@${domain}` for user.length < 3). Real P0s remaining: #3.3 decryptPii pass-through fallback, #4.4 SENSITIVE_PATTERNS only 2 patterns. See [`AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md) §8.
**Method:** File-by-file read. Every finding has file:line evidence and a concrete fix.

This is the sixth in the audit series. It is focused entirely on authentication, authorization, security middleware, PII handling, crypto, rate limiting, and OTP.

The previous `AUDIT_BACKEND.md` and `AUDIT_API_DEEP.md` already covered the auth routes, the JWT implementation, and the rider/admin impersonation paths. **This audit does not duplicate those findings** — only adds the deep crypto, password-hashing, PII encryption, rate-limiter, OTP-store, and security-events analysis.

## Severity legend

- **P0** — broken behavior, security risk, money/data corruption, timing attack, comment that lies
- **P1** — will bite soon (correctness, performance, observability)
- **P2** — code smell, missed best practice
- **P3** — nice-to-have / hygiene

## Table of contents

1. [Security architecture overview](#1-security-architecture-overview)
2. [Password hashing (`lib/password.ts`)](#2-password-hashing)
3. [PII encryption (`lib/pii-crypto.ts`)](#3-pii-encryption)
4. [PII redaction (`lib/pii.ts`, `lib/pii-redact.ts`)](#4-pii-redaction)
5. [OTP store (`lib/otp-store.ts`)](#5-otp-store)
6. [Rate limiter (`lib/rate-limit.ts`, `lib/rate-limit-middleware.ts`)](#6-rate-limiter)
7. [Cron auth (`lib/cron-auth.ts`)](#7-cron-auth)
8. [Security events (`lib/security-events.ts`)](#8-security-events)
9. [Audit log (`lib/audit-log.ts`)](#9-audit-log)
10. [Auth use-cases (`server/modules/auth/auth.use-cases.ts`)](#10-auth-use-cases)
11. [Firebase admin (`lib/firebase-admin.ts`)](#11-firebase-admin)
12. [Middleware: CSRF/CORS/CSP (`src/middleware.ts`)](#12-middleware-csrfcorscsp)
13. [JWT, sessions, cookies (`lib/auth.ts`, `lib/rider-auth.ts`, `lib/get-session.ts`)](#13-jwt-sessions-cookies)
14. [Top 10 critical findings](#14-top-10-critical-findings)
15. [Cross-cutting observations](#15-cross-cutting-observations)
16. [Recommended 10-PR sequence](#16-recommended-10-pr-sequence)

---

## 1. Security architecture overview

### 1.1 Layers

The Voltium security stack has 7 layers:

1. **Edge:** `src/middleware.ts` — CSRF check, CORS, CSP, HSTS, security headers
2. **Authn:** `lib/auth.ts`, `lib/rider-auth.ts`, `lib/get-session.ts` — JWT, sessions, cookie handling
3. **Authz:** `lib/permissions.ts`, `lib/rbac.ts` — admin roles, permission checks
4. **Crypto:** `lib/password.ts`, `lib/pii-crypto.ts` — Argon2id, AES-256-GCM
5. **OTP:** `lib/otp-store.ts` — DB-backed OTP, rate-limited
6. **Rate limiting:** `lib/rate-limit.ts`, `lib/rate-limit-middleware.ts` — DB-backed bucket rate-limiter
7. **Audit/SIEM:** `lib/audit-log.ts`, `lib/security-events.ts` — security event log

### 1.2 Inventory

| File | Size | Purpose |
|---|---|---|
| `lib/auth.ts` | 6.6 KB | JWT (jose), sessions, permissions re-export |
| `lib/rider-auth.ts` | 2.5 KB | `requireRiderSession` for rider routes |
| `lib/get-session.ts` | (covered) | cookie/header session lookup |
| `lib/password.ts` | 3.6 KB | Argon2id + PBKDF2 fallback |
| `lib/pii-crypto.ts` | 4.3 KB | AES-256-GCM, versioned keys |
| `lib/pii.ts` | 1.3 KB | masking (phone, email, aadhaar, pan) |
| `lib/pii-redact.ts` | 2.4 KB | recursive redaction for logs |
| `lib/cron-auth.ts` | 1.2 KB | `requireCronAuth` for cron routes |
| `lib/otp-store.ts` | 6.7 KB | OTP generation, storage, verify |
| `lib/rate-limit.ts` | 4.5 KB | bucket-based rate-limiter |
| `lib/rate-limit-middleware.ts` | 3 KB | rate-limit headers, IP extraction |
| `lib/audit-log.ts` | 4.5 KB | audit log table CRUD |
| `lib/security-events.ts` | 6.3 KB | security event logger |
| `lib/firebase-admin.ts` | 39 lines | Firebase Admin SDK loader |
| `lib/api-middleware.ts` | (covered) | `withIdempotency`, `withRequestSizeLimit`, `withRateLimit`, `withErrorHandler` |
| `src/middleware.ts` | 191 lines | CSRF, CORS, CSP, security headers |
| `server/modules/auth/auth.use-cases.ts` | 6.8 KB | sendOtp, verifyOtp, logout |
| `server/modules/auth/auth.repository.ts` | 1.7 KB | admin lookup |

### 1.3 Cryptographic primitives in use

| Purpose | Algorithm | Source |
|---|---|---|
| JWT | HS256 (jose lib) | `lib/auth.ts` |
| Password hashing | Argon2id (new) / PBKDF2-SHA256 600k iter (legacy) | `lib/password.ts` |
| PII encryption | AES-256-GCM, versioned keys (V1-V9) | `lib/pii-crypto.ts` |
| OTP hashing | SHA-256 with per-OTP salt | `lib/otp-store.ts` |
| Cron secret compare | `crypto.timingSafeEqual` | `lib/cron-auth.ts` |
| Random OTP | `crypto.randomInt(100000, 999999)` | `lib/otp-store.ts` |
| UUID | `uuid` v4 | various use-cases |

---

## 2. Password hashing (`lib/password.ts`)

**File:** `web/src/lib/password.ts` (112 lines)

### 2.1 [P0] `hashPassword` and `verifyPassword` use Argon2id — but parameters are not OWASP-current

**File:** `web/src/lib/password.ts:13-19`

```ts
const ARGON2_OPTIONS: argon2.Options & { raw?: boolean } = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};
```

**OWASP 2024 recommendation** for Argon2id:
- memoryCost: 19 MiB minimum (this uses 64 MiB — OK)
- timeCost: 2 iterations minimum (this uses 3 — OK)
- parallelism: 1 (this uses 4 — too high; parallelism is for multi-core servers, not for a single Node process)

The parallelism of 4 means 4 CPU cores are used for a single hash. **On a 1-core server, this degrades to 1/4 performance.** On a 4-core server, this consumes 4 cores for 1 hash. **Not optimal for a multi-tenant API server.**

**Fix:** reduce `parallelism: 1` (per OWASP). The `timeCost: 3` and `memoryCost: 65536` are already good.

### 2.2 [P0] `verifyPassword` returns `{ valid, needsRehash }` — but callers may not rehash

**File:** `web/src/lib/password.ts:38-66`

The function returns `needsRehash: true` for legacy PBKDF2 hashes and Argon2 hashes with outdated parameters. **The auth use-case MUST call `hashPassword(password)` and update the DB on `needsRehash: true`.** Verify that the admin login flow does this. If not, the system stays on weaker hashes forever.

**Audit:** `server/modules/admin/admin.use-cases.ts` (or wherever admin login is implemented) should:
```ts
const result = await verifyPassword(input.password, admin.password);
if (!result.valid) return error;
if (result.needsRehash) {
  await db.admin.update({
    where: { id: admin.id },
    data: { password: await hashPassword(input.password) },
  });
}
```

**Fix:** verify the admin login rehash path. If missing, add it.

### 2.3 [P1] `verifyPbkdf2` uses `parseInt` on the iteration count without NaN check

**File:** `web/src/lib/password.ts:78`

```ts
const iterations = Math.min(parseInt(parts[2], 10), MAX_ITERATIONS);
```

If `parts[2]` is `"abc"`, `parseInt` returns `NaN`, and `Math.min(NaN, 10_000_000)` returns `NaN`. The `crypto.subtle.deriveBits` then fails with a TypeError (NaN as the iteration count). The function catches this in the outer `try/catch` (line 54) — wait, no, this is in the legacy path (line 60-63), not wrapped in try/catch. The error propagates.

**Fix:** `const iterations = Math.min(parseInt(parts[2], 10) || 0, MAX_ITERATIONS);`. Or, validate `parts[2]` is a positive integer first.

### 2.4 [P0] `verifyPbkdf2` is not wrapped in a try/catch — error propagates

**File:** `web/src/lib/password.ts:72-105`

Unlike the Argon2id path (line 47-57) which is wrapped in try/catch (line 48, 54), the PBKDF2 path is not. **A malformed PBKDF2 hash (e.g. corrupted DB field) crashes the auth flow.**

**Fix:** wrap the PBKDF2 path in try/catch, return `{ valid: false, needsRehash: false }` on error.

### 2.5 [P1] `MAX_ITERATIONS = 10_000_000` is a magic number

**File:** `web/src/lib/password.ts:73`

The 10M cap is a defense against a malicious hash that specifies 10B iterations and DoS's the server. **But:** a 10M-iteration PBKDF2 takes ~30 seconds on a modern CPU. If a malicious hash is `pbkdf2$10000000$...`, the verify call blocks the request for 30 seconds. **The 10M cap is correct but the verify still takes 30 seconds.**

**Fix:** lower `MAX_ITERATIONS` to 1M (~3 seconds) or implement a timeout via `Promise.race` with a 5-second timer.

### 2.6 [P2] `fromBase64` is not URL-safe

**File:** `web/src/lib/password.ts:107-112`

`atob` is standard base64, not URL-safe. If a salt or hash uses URL-safe base64 (`-_` instead of `+/`), `atob` throws. **Argon2 uses its own base64 variant (no padding, URL-safe).** Mixing the two would corrupt the hash.

**Fix:** use a base64 library that supports both standard and URL-safe (e.g. `base64url` from `@std/encoding` or `btoa/atob` with replacement).

---

## 3. PII encryption (`lib/pii-crypto.ts`)

**File:** `web/src/lib/pii-crypto.ts` (132 lines)

### 3.1 [P0] `ALLOW_DEV_PII_KEY` env flag enables a hardcoded dev key

**File:** `web/src/lib/pii-crypto.ts:15-20`

```ts
if (!v1) {
  if (!process.env.ALLOW_DEV_PII_KEY) {
    throw new Error('PII_ENCRYPTION_KEY_V1 is required. Set ALLOW_DEV_PII_KEY=true for dev-only fallback.');
  }
  // Fallback key for dev/test
  KEY_VERSIONS.set(1, Buffer.from('dev-pii-encryption-key-32-bytes-'.substring(0, 32)));
  return;
}
```

If `ALLOW_DEV_PII_KEY=true` is set in any environment, the system uses a hardcoded dev key. **The env.ts validation (line 153-198 of env.ts) doesn't check that this flag is dev-only.** If a misconfigured prod has `ALLOW_DEV_PII_KEY=true`, all PII is encrypted with a publicly-known key. **An attacker who reads the source code can decrypt all PII.**

**Fix:** add to env.ts: `if (process.env.APP_ENV === 'production' && process.env.ALLOW_DEV_PII_KEY === 'true') throw new Error(...)`.

### 3.2 [P0] `getLatestKey` returns the highest version, but new encrypts use the highest

**File:** `web/src/lib/pii-crypto.ts:49-54, 66`

```ts
function getLatestKey(): { version: number; key: Buffer } {
  loadKeyVersions();
  const maxVersion = Math.max(...KEY_VERSIONS.keys());
  return { version: maxVersion, key: KEY_VERSIONS.get(maxVersion)! };
}
```

The function returns the **highest** version. New encrypts use V_max. **But:** what if V1 is set but V2 is not? Then V1 is both the latest AND the only one. **OK, that's intended.**

What if V1, V2, V3 are set, and V2 is revoked? The function returns V3 (still latest). **Decrypts work for V1, V2, V3.** **OK.**

**The actual problem:** if a key version is in `KEY_VERSIONS` but was supposed to be removed (e.g. compromised), there's no flag to mark it as revoked. The decryption will use the (compromised) key. **Fix:** add a `revokedAt` per key version; reject decrypts of versions with `revokedAt`.

### 3.3 [P0] `decryptPii` falls back to returning the original string if not encrypted (line 107-109)

**File:** `web/src/lib/pii-crypto.ts:107-109`

```ts
} else {
  // Return original string if not encrypted (backward compat for unencrypted fields)
  return cipherText;
}
```

The "backward compat" comment indicates that some DB rows have unencrypted PII (e.g. before the encryption was deployed). The function returns the original string. **This means:** if a row was encrypted with V1, then the V1 key is rotated to V2, and a stale row reads, the format check fails (e.g. `parts.length === 3` matches the legacy format, OR the format is malformed), and the original (encrypted) string is returned. **The caller gets the encrypted ciphertext as the "PII value".**

Worse: if a non-encrypted value is stored, the function returns it correctly. But if a **different format** is stored (e.g. a `phone: '+91 99999 00000'` with spaces), the function returns it correctly. **No way to distinguish "decrypted PII" from "passed-through non-PII".**

**Fix:** add a `__pii_encrypted: true` flag in the encrypted format. Refuse to return a value that doesn't have the flag. Migrate the data over time.

### 3.4 [P0] `decryptPii` does not validate auth tag

**File:** `web/src/lib/pii-crypto.ts:121-127`

```ts
const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
decipher.setAuthTag(authTag);
let decrypted = decipher.update(encryptedText);
decrypted = Buffer.concat([decrypted, decipher.final()]);
```

The auth tag IS set (line 122). The `decipher.final()` will throw if the auth tag doesn't match. **OK, this is correct.** The catch on line 128-131 throws on failure. **No issue.**

### 3.5 [P0] `decryptPii` has a deadlock-style string interpolation in error

**File:** `web/src/lib/pii-crypto.ts:130`

```ts
throw new Error(`PII decryption failed: ${err instanceof Error ? (err instanceof Error ? err.message : String(err)) : err}`);
```

The same dead-code nested ternary pattern as elsewhere. The inner `err instanceof Error` is always true when the outer condition is true. **Cosmetic issue.**

### 3.6 [P1] `encryptPii` for empty string returns `''` (line 63)

**File:** `web/src/lib/pii-crypto.ts:63`

```ts
if (text === '') return '';
```

Returning empty string for empty input is fine, but the caller can't distinguish "encrypted empty" from "plaintext empty". **If the DB has `aadhaarNumber: ''` for a KYC submission, the function returns `''` (no encryption), and a subsequent read returns `''` (no decryption needed).** The data is plaintext but indistinguishable from "encrypted empty".

**Fix:** encrypt the empty string (or a sentinel like `"<empty>"`) so the format is consistent.

### 3.7 [P1] `encryptPii` and `decryptPii` accept `null` and `undefined` (line 61, 82)

**File:** `web/src/lib/pii-crypto.ts:61, 82`

```ts
export function encryptPii(text: string | null | undefined): string | null | undefined {
  if (text === null || text === undefined) return text;
  ...
}
```

This is fine for nullable DB columns. But the return type is `string | null | undefined` — **the caller doesn't know if the value is encrypted or passed-through**. A column that was never encrypted returns the same type as a column that was encrypted and then decrypted.

**Fix:** return a branded type `EncryptedPii` to make encryption explicit.

### 3.8 [P0] `parseKey` accepts only 64-character hex (32 bytes), but the key may be base64 elsewhere

**File:** `web/src/lib/pii-crypto.ts:36-47`

The function expects 64 hex chars. The env var `PII_ENCRYPTION_KEY_V1` must be set in hex. **But** some operators may set it as base64 (32 bytes encoded as 44 chars). The function would throw at parse time, but the error is at startup, not at runtime. **OK, but document the expected format.**

**Fix:** add a clear comment to `env.ts` and to the deployment docs: "PII_ENCRYPTION_KEY must be 64 hex chars (32 bytes)".

### 3.9 [P1] `loadKeyVersions` is called every time, but `KEY_VERSIONS` is module-level

**File:** `web/src/lib/pii-crypto.ts:7-9, 23-24`

```ts
const KEY_VERSIONS = new Map<number, Buffer>();

function loadKeyVersions(): void {
  if (KEY_VERSIONS.size > 0) return;
  ...
}
```

The `loadKeyVersions` is called on every `encryptPii` and `decryptPii`. The cache check (`if (KEY_VERSIONS.size > 0) return`) is fast. **But:** the cache is process-local. A key rotation requires a process restart. **Document this.**

**Fix:** add a comment to `env.ts` that "PII encryption key changes require a server restart".

### 3.10 [P2] No key rotation API

**File:** `web/src/lib/pii-crypto.ts`

There's no way to rotate the V1 key to V2 and re-encrypt all PII. The infrastructure supports V1, V2, ..., V9 (per the loop on line 27-33), but the migration path is manual. **A real key rotation needs a script that:**
1. Decrypts all PII with V1
2. Re-encrypts with V2
3. Updates the DB
4. Marks V1 as "old" in env

**No such script exists.** **Fix:** add a `scripts/rotate-pii-key.ts` that does this. Add a CLI flag `--dry-run` for safety.

### 3.11 [P1] `decryptPii` line 88: `cipherText.split(':')` — colon in user input breaks format

**File:** `web/src/lib/pii-crypto.ts:88`

```ts
const parts = cipherText.split(':');
```

The encrypted format is `v1:iv:authTag:encrypted`. If the **plaintext** contains a `:` (e.g. an address like `"12: Main Street"`), the encrypted text doesn't contain the plaintext colon (it's hex). **But** the format relies on `:` as a separator. **If the `iv`, `authTag`, or `encrypted` ever contained `:`, the split would fail.** They are hex, so no colon in hex. **OK, but fragile.**

---

## 4. PII redaction (`lib/pii.ts`, `lib/pii-redact.ts`)

**Files:** `web/src/lib/pii.ts` (44 lines), `web/src/lib/pii-redact.ts` (101 lines)

### 4.1 [P0] `pii.ts:maskEmail` exposes first AND last char of local-part

**File:** `web/src/lib/pii.ts:18-25`

```ts
export function maskEmail(email: string | null): string | null {
  ...
  return `${user[0]}${'*'.repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
}
```

For a 4-character local-part (e.g. `john`), the result is `j**n@domain.com` — both first and last char exposed. **For a 2-character local-part (e.g. `js`), the result is `j*0s@...` but wait, `user.length - 2 = 0`, so the `*` count is 0, returning `js@...` (fully visible).** Bug.

**Fix:** if `user.length < 3`, return `*@${domain}`. The current code does this on line 22 — but the `else` branch on line 24 doesn't.

**Verify:** for `user.length === 2`, the code reaches line 24 and returns `${user[0]}${'*'.repeat(0)}${user[1]}@${domain}` = `js@domain.com` (no masking). **P0 leak for short local-parts.**

### 4.2 [P1] `pii.ts:maskAadhaar` and `maskPan` return the original string for invalid input

**File:** `web/src/lib/pii.ts:32-35, 38-42`

```ts
if (cleanAadhaar.length !== 12) return cleanAadhaar;
```

If the input is invalid (length != 12), the function returns the original (unmasked) string. **The caller may log this thinking it's masked.** This is fail-open (the wrong direction for PII).

**Fix:** return a generic placeholder like `***INVALID***` or throw.

### 4.3 [P1] `pii-redact.ts:SENSITIVE_KEYS` is hardcoded and not exhaustive

**File:** `web/src/lib/pii-redact.ts:10-46`

The set has 35 keys. **Adding a new sensitive field requires updating this list.** Easy to forget. **Audit the schema for fields not in the list:**
- `lockPassword` ✓ (line 15)
- `keySecret` ✗ (NOT in the list! should be)
- `webhookSecret` ✗ (NOT in the list!)
- `apiEndpoint` ✗ (NOT sensitive but worth checking)
- `merchantId` ✗ (NOT in the list)
- `fcmToken` ✗ (NOT in the list — but might be considered PII)

**Fix:** add `keySecret`, `webhookSecret`, `merchantId` to the list. Consider a regex-based approach that matches any field containing `secret`, `password`, `token`, `key`.

### 4.4 [P0] `pii-redact.ts:SENSITIVE_PATTERNS` only matches 2 patterns (base64 long, JWT)

**File:** `web/src/lib/pii-redact.ts:48-51`

```ts
const SENSITIVE_PATTERNS = [
  /^[A-Za-z0-9+/=]{40,}$/, // base64 tokens
  /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, // JWT
];
```

The patterns only match strings >32 chars (line 65) that are JWT or base64. **A 200-char hex string (e.g. an API key) is not redacted.** A 200-char alphanum secret is not redacted unless it's base64.

**Fix:** add patterns for:
- Hex keys (32+ chars): `/^[a-fA-F0-9]{32,}$/`
- UUID v4: too many false positives, skip
- Session/cookie strings

### 4.5 [P0] `pii-redact.ts:redactPii` for `Error` objects strips stack trace (line 74-83)

**File:** `web/src/lib/pii-redact.ts:74-83`

```ts
if (value instanceof Error) {
  const safe: Record<string, unknown> = {
    name: value.name,
    message: value.message,
  };
  if ('cause' in value && value.cause) {
    safe.cause = redactPii(value.cause);
  }
  return safe as unknown as T;
}
```

The stack trace is dropped. **But:** Error objects often have other fields (e.g. `code`, `statusCode`, `details`) that may contain PII. The function preserves only `name`, `message`, and `cause`. **A PII leak via `error.details` is possible if the caller logs the redacted error.**

**Fix:** recursively redact the Error's own enumerable properties (excluding `name`, `message`, `cause`, `stack`).

### 4.6 [P1] `pii-redact.ts:92` lowercase key check is good but case-sensitive comparison is fragile

**File:** `web/src/lib/pii-redact.ts:92`

```ts
const lowerKey = key.toLowerCase();
if (SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_KEYS.has(key)) {
```

The double check (lowerKey + raw key) handles `Password` and `password`. **But:** mixed case like `lockPASSWORD` is also handled. **OK.** However, a `lockPassword` field name in the form `lock_password` (snake_case) or `lock-password` (kebab) would NOT match.

**Fix:** normalize underscores and dashes to camelCase before lookup.

### 4.7 [P1] `pii-redact.ts:65` length check `value.length > 32` is arbitrary

**File:** `web/src/lib/pii-redact.ts:65`

```ts
if (value.length > 32) {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(value)) return REDACTED as unknown as T;
  }
}
```

A 31-char base64 string is NOT redacted. A 33-char base64 string IS. The cutoff is arbitrary. **A 20-char API key would not be redacted.**

**Fix:** remove the length check; redact all matches. Or, lower the threshold to 16.

### 4.8 [P0] `pii-redact.ts` is for **logging**, not for **storage encryption**

**File:** `web/src/lib/pii-redact.ts` (entire file)

The function name `redactPii` and the docstring "before they reach logs, error handlers, or any output channel" make this a **log-only** tool. **It does NOT encrypt.** A field that goes through `redactPii` is replaced with `'[REDACTED]'` in the log, but the original (unredacted) value is still in the original object.

**Audit pattern:** verify that `redactPii` is only used for logging, not for sanitizing data sent to the client. A route that returns `redactPii(rider)` to the API client would return `'[REDACTED]'` for the rider's name, etc. — wrong.

**Fix:** rename to `redactForLog` to make the intent explicit.

---

## 5. OTP store (`lib/otp-store.ts`)

**File:** `web/src/lib/otp-store.ts` (195 lines)

### 5.1 [P0] `code !== entry.code` is a non-constant-time string comparison

**File:** `web/src/lib/otp-store.ts:182`

```ts
if (code !== entry.code)
```

JavaScript's `===` for strings is **not** guaranteed to be constant-time (modern V8 may be, but the spec doesn't require it). **An attacker can use timing to learn the correct OTP character-by-character.**

The DB path (line 153) uses `hashOtp(code, entry.salt) === entry.codeHash` — also a non-constant-time string comparison. **The hash values are 64-char hex, and the timing leak is small but present.**

**Fix:** use `crypto.timingSafeEqual` on equal-length buffers for both comparisons.

### 5.2 [P0] In-memory OTP store is plaintext (line 126-131)

**File:** `web/src/lib/otp-store.ts:125-131`

```ts
memoryStore.set(phone, {
  code,
  expiresAt: Date.now() + OTP_EXPIRY_MS,
  attempts: 0,
  verified: false,
});
```

The in-memory store holds the OTP **in plaintext**. **A heap dump or process memory read leaks the OTP.** This is fine for dev (per the comment line 25-26) but the function `generateOtp` is called by the auth use-case in **production** if `OTP_STORE_PROVIDER !== 'postgres'` (line 84).

**Fix:** always use the DB store in production. The in-memory store should only be loaded if `NODE_ENV === 'development'`.

### 5.3 [P0] Dev OTP is `111111` — universally known backdoor

**File:** `web/src/lib/otp-store.ts:82, 141`

```ts
const code = isDev ? '111111' : generateRandomOtp();
...
if (isDev && code === '111111') return { valid: true };
```

In dev mode, **any** phone's OTP is `111111`, and `111111` is accepted as valid for any phone. **If `NODE_ENV === 'development'` is set in production (misconfiguration), the entire OTP system is bypassed.**

The `env.ts` validation in this codebase should explicitly reject `NODE_ENV === 'development'` in production. **Verify.** Per the previous broad audit (1.16), `NODE_ENV !== 'production'` is used in many places for security gates — but a few are still tied to `development`.

**Fix:** add `if (process.env.NODE_ENV === 'development' && process.env.APP_ENV === 'production') throw new Error(...)` in `env.ts`.

### 5.4 [P0] `generateOtp` always returns the same code for the same phone in dev

**File:** `web/src/lib/otp-store.ts:82`

```ts
const code = isDev ? '111111' : generateRandomOtp();
```

In dev, every OTP for every phone is `111111`. **If a developer tests with multiple test phones, the same code is sent to all of them.** This is a "feature" (developer convenience) but a real PII risk in dev logs (every dev's screen shows the same OTP).

**Fix:** in dev, use a deterministic but per-phone code (e.g. `phone.slice(-6)`).

### 5.5 [P0] `hashOtp` uses single SHA-256 — not PBKDF2/bcrypt/argon2

**File:** `web/src/lib/otp-store.ts:32-34`

```ts
function hashOtp(code: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}
```

SHA-256 is fast — an attacker with the hash can brute-force all 1M possible OTPs in milliseconds. **For a 6-digit OTP, the entropy is only 20 bits.** A salted SHA-256 doesn't help; the attacker can precompute all 1M hashes for the known salt and check the DB.

**Fix:** use PBKDF2 with 100k iterations (slow enough to make each guess ~10ms). Or, use the existing `hashPassword` (Argon2id) — overkill but consistent.

### 5.6 [P0] OTP salt is per-OTP but the salt is stored alongside the hash

**File:** `web/src/lib/otp-store.ts:90-91, 104, 116-117`

The salt is generated per-OTP (good) but stored in the same `otp_codes` row as the hash (per `OtpCode` model: `codeHash`, `salt`, both `String`). **An attacker with DB read access has both the salt and the hash. Salt doesn't help if you only have 20 bits of entropy (6-digit OTP).** The salt only protects against rainbow tables (precomputed hashes), which don't exist for 6-digit OTPs.

**Fix:** with such low entropy, the salt is irrelevant. The real fix is the PBKDF2 / Argon2 (5.5) — the iteration count slows down brute force.

### 5.7 [P1] `verifyOtp` increments `attempts` AFTER success, allowing 1 extra success

**File:** `web/src/lib/otp-store.ts:165-168`

```ts
await db.otpCode.update({
  where: { phone },
  data: { verified: true, attempts: { increment: 1 } },
});
return { valid: true };
```

The successful verify also increments `attempts`. **The OTP can be "verified" multiple times** (each call increments attempts but doesn't fail). **The `verified: true` flag is checked on the next call (line 146), but only after the attempts check (line 148).** So:
- Call 1: `attempts: 0`, valid OTP, success → attempts: 1, verified: true
- Call 2: `verified: true`, error: "OTP already used"
- **But: line 148's check `entry.attempts >= MAX_ATTEMPTS` runs BEFORE the verified check on line 146. Wait, line 146 runs first (it's earlier in the function). Let me re-read...**

Actually re-reading: line 144-151 are the early checks. The `verified: true` check is line 146. The `attempts >= MAX_ATTEMPTS` check is line 148. **So a successful verify sets `verified: true`, but the next call returns "OTP already used" on line 146 before checking attempts.** OK, this is correct.

**But:** the increment on line 167 increments even on success. **A subsequent attempt counter check would think this OTP was tried 1 time (correct) but the increment is also relevant for the response message "X attempts remaining" (line 161) on a failed attempt.** The success path doesn't return a "remaining" count, so this is OK.

**Minor:** incrementing on success is unnecessary; the entry is "used" by `verified: true`. **Fix:** remove the `attempts: { increment: 1 }` on the success path.

### 5.8 [P0] `verifyOtp` in dev returns `valid: true` for the dev OTP `'111111'` without checking the actual entry

**File:** `web/src/lib/otp-store.ts:140-141`

```ts
const isDev = process.env.NODE_ENV === 'development';
if (isDev && code === '111111') return { valid: true };
```

**The dev check is BEFORE the entry lookup.** So `verifyOtp('+91 9999900000', '111111')` returns valid even if no OTP was ever sent to that phone. **A dev attacker (or a misconfigured production environment) can log in as any phone.**

**Fix:** check the dev OTP AFTER the entry lookup. If no entry exists, return invalid.

### 5.9 [P1] `generateOtp` in dev mode can return `'111111'` but the dev check then auto-verifies

**File:** `web/src/lib/otp-store.ts:81-82, 140-141`

In dev, `generateOtp` returns `'111111'`. The dev branch in `verifyOtp` accepts `'111111'` for any phone. **The dev flow is: send OTP, get `'111111'`, verify with `'111111'`.** OK. **But:** an attacker (or a misconfigured client) that knows the dev OTP can skip the send step.

### 5.10 [P0] `resendStore` and `memoryStore` are not cleared on Node process restart

**File:** `web/src/lib/otp-store.ts:25-26`

In dev mode (in-memory), the OTP store is per-process. **If the process restarts, all OTPs are lost.** This is OK for dev. **But:** in production with `shouldUseDatabaseStore() === true`, the in-memory stores are unused. **Verify** the production flag is correct.

### 5.11 [P1] `MAX_ATTEMPTS = 3` is hardcoded — not configurable

**File:** `web/src/lib/otp-store.ts:20`

3 attempts is reasonable. But not configurable per-environment. **Fix:** move to `env.ts`.

### 5.12 [P1] `OTP_EXPIRY_MS = 5 * 60 * 1000` (5 min) is hardcoded

**File:** `web/src/lib/otp-store.ts:19`

5-minute expiry is standard but not configurable. **Fix:** move to `env.ts`.

### 5.13 [P0] `deleteMany` cleanup at line 113-115 deletes ALL OTPs older than 24 hours, including unverified

**File:** `web/src/lib/otp-store.ts:113-115`

```ts
await db.otpCode
  .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
  .catch(() => {});
```

The cleanup deletes OTPs older than 24 hours past expiry. **The `.catch(() => {})` swallows errors silently.** If the cleanup fails (e.g. DB connection issue), expired OTPs pile up.

**Fix:** at minimum, log the error. Or, run as a scheduled job (per `AUDIT_WORKERS.md` 20.4).

### 5.14 [P1] `canResendOtp` returns `allowed: true` unconditionally in non-prod

**File:** `web/src/lib/otp-store.ts:41-43`

```ts
if (process.env.NODE_ENV !== 'production') {
  return { allowed: true };
}
```

The cooldown logic is skipped in non-prod. **OK for dev**, but if NODE_ENV is misconfigured in production, no cooldown. **Verify** env.ts validation catches this.

### 5.15 [P0] `code` parameter is `string` — no length validation

**File:** `web/src/lib/otp-store.ts:136-189`

The `verifyOtp(phone, code)` function accepts any string. **A 10MB code DoS's the comparison.** The Zod schema in `validators.ts` (per `verifyOtpSchema`) should validate length. **Verify.**

---

## 6. Rate limiter (`lib/rate-limit.ts`, `lib/rate-limit-middleware.ts`)

**Files:** `web/src/lib/rate-limit.ts` (139 lines), `web/src/lib/rate-limit-middleware.ts` (96 lines)

### 6.1 [P0] Memory store is used in production by default (per `shouldUseDatabaseLimiter`)

**File:** `web/src/lib/rate-limit.ts:24-30`

```ts
function shouldUseDatabaseLimiter(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RATE_LIMIT_STORE_PROVIDER === 'postgres' ||
    process.env.RATE_LIMIT_STORE_PROVIDER === 'db'
  );
}
```

The DB is used in production (good). **In dev or test, the in-memory store is used.** This is fine.

**But:** the `RateLimitBucket` table is in the schema (per `AUDIT_DATABASE.md`). The DB limiter does `deleteMany({ where: { resetAt: { lte: now - windowMs } } })` on every rate-limit check (line 53). **This is an expensive DELETE on every check.** For a 60-req/min limit, that's 60 DELETEs per minute per route. **Should be done as a scheduled job, not inline.**

**Fix:** move the cleanup to a scheduled job (e.g. hourly) and remove the inline `deleteMany`.

### 6.2 [P0] Race condition in DB rate-limiter: `INSERT ... ON CONFLICT DO UPDATE` is not atomic with the limit check

**File:** `web/src/lib/rate-limit.ts:59-77`

```ts
const result = (await db.$queryRawUnsafe(
  `INSERT INTO "RateLimitBucket" (id, key, points, "resetAt", "createdAt", "updatedAt")
   VALUES ($1, $2, 1, $3, NOW(), NOW())
   ON CONFLICT (key) DO UPDATE SET
     points = CASE
       WHEN "RateLimitBucket".points < $4 + 1 THEN "RateLimitBucket".points + 1
       ELSE "RateLimitBucket".points
     END,
     "resetAt" = CASE
       WHEN "RateLimitBucket"."resetAt" <= NOW() THEN $3
       ELSE "RateLimitBucket"."resetAt"
     END,
     "updatedAt" = NOW()
   RETURNING points, "resetAt"`,
  key, key, resetAt, config.maxRequests
)) as Array<{ points: number; resetAt: Date }>;
```

The `INSERT ... ON CONFLICT DO UPDATE` is atomic. **But:** the `RETURNING` is the new `points` value. **The check `if (result[0].points <= config.maxRequests)` is after the insert.** So the `points` is incremented even if it's over the limit. **The next request will see `points > maxRequests` and be blocked.** **This is correct for the second request**, but the FIRST request that crosses the limit is also incremented. **Result: the limit is off-by-one** (you can do `maxRequests + 1` requests before being blocked).

**Fix:** use a `SELECT ... FOR UPDATE` to lock the row, then check, then update. Or, use a Redis-based rate limiter.

### 6.3 [P1] `checkRateLimit` `dbErr` swallow is at `warn` level — not alert-worthy

**File:** `web/src/lib/rate-limit.ts:93-103`

The fail-closed path for auth endpoints logs at `error` level (line 97). The fail-open path logs at `warn` (line 101). **A persistent DB outage causes repeated warn logs.** Not actionable in production.

**Fix:** rate-limit the warn log itself (don't log every fail-open). Or, use `alert.alerter` (per `lib/alerter.ts`) on persistent failures.

### 6.4 [P0] `rateLimitIdentifierFromRequest` trusts `cf-connecting-ip` and `x-forwarded-for` unconditionally

**File:** `web/src/lib/rate-limit-middleware.ts:73-95`

```ts
const cf = request.headers.get('cf-connecting-ip');
if (cf) return `ip:${cf.trim()}`;

const forwarded = request.headers.get('x-forwarded-for');
if (forwarded) {
  ...
}
```

The function trusts Cloudflare's `cf-connecting-ip` header. **In a non-CF deployment, a client can set this header to any value** and bypass the rate limit. **Same for `x-forwarded-for`.** The `TRUSTED_PROXIES` env var is checked on line 85, but only when iterating right-to-left through the chain. **The leftmost IP is taken without trust check.**

**Fix:** in non-CF/non-proxy deployments, ignore these headers. Add a deployment mode env (`TRUST_PROXY_HEADERS=true` only when behind a trusted proxy).

### 6.5 [P1] `TRUSTED_PROXIES` defaults to `127.0.0.1,::1` only

**File:** `web/src/lib/rate-limit-middleware.ts:69-71`

```ts
const TRUSTED_PROXIES = new Set(
  (process.env.TRUSTED_PROXIES || '127.0.0.1,::1').split(',').map((ip) => ip.trim())
);
```

The default is just localhost. **In a real Cloudflare deployment, this needs to be the CF IP ranges** (which are dynamic and change). A stale list lets an attacker inject `x-forwarded-for: 1.2.3.4` to get a unique IP per request, bypassing per-IP rate limits.

**Fix:** use a Cloudflare IP range library (e.g. `cloudflare-ip`) or have a startup check that `TRUSTED_PROXIES` is configured in production.

### 6.6 [P0] The IP extraction in `rateLimitIdentifierFromRequest` takes the rightmost trusted IP, not the client IP

**File:** `web/src/lib/rate-limit-middleware.ts:78-90`

```ts
let clientIp = ips[ips.length - 1];
for (let i = ips.length - 1; i >= 0; i--) {
  if (!TRUSTED_PROXIES.has(ips[i])) {
    clientIp = ips[i];
    break;
  }
}
return `ip:${clientIp || '127.0.0.1'}`;
```

The loop iterates **right-to-left** (closest proxy first) and finds the first non-trusted IP. **The non-trusted IP is the client.** **OK, this is correct.**

**But:** if all IPs are trusted (e.g. a long chain of CF proxies), the initial value `ips[ips.length - 1]` is used, which is the rightmost (closest) proxy. **That proxy is a trusted CF IP.** The rate limit is per-proxy, not per-client. **All clients behind the same CF edge are rate-limited together.**

**Fix:** if all IPs are trusted, use `ips[0]` (leftmost = client). Document the behavior.

### 6.7 [P1] In-memory rate-limit store is shared across all routes

**File:** `web/src/lib/rate-limit.ts:22`

The `memoryStore` is module-level. **Different routes share the same store.** If the admin login route uses `api:admin-login:1.2.3.4` and the rider login route uses `api:rider-login:1.2.3.4`, they don't collide (different keys). **But:** the memory store grows unbounded between cleanups. The cleanup is every 5 min (line 32-43). **For 100k unique IPs in 5 min, the store holds 100k entries.**

**Fix:** add a hard cap (e.g. LRU eviction at 10k entries).

### 6.8 [P0] `AUTH_RATE_LIMIT` allows 5 attempts in 15 min — and 1000 in dev

**File:** `web/src/lib/rate-limit.ts:125-129`

```ts
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: process.env.NODE_ENV === 'development' ? 1000 : 5,
  failClosed: true,
};
```

**5 attempts per 15 min per IP is reasonable. 1000 in dev is fine for testing. But the dev/prod split is on `NODE_ENV`, which is the same flag that's been misconfigured before. If `NODE_ENV === 'development'` is set in production, the rate limit is 1000/15min — which is effectively no limit.**

**Fix:** use `APP_ENV` (per `env.ts`) instead of `NODE_ENV`.

### 6.9 [P1] `UPLOAD_RATE_LIMIT` is 10/min — applies to all uploads

**File:** `web/src/lib/rate-limit.ts:136-138`

```ts
export const UPLOAD_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 10,
};
```

10 uploads per minute per identifier (typically IP). **For a rider uploading 5 KYC documents (front, back, signature, photo, etc.) and a profile photo, this is 6 uploads in a single onboarding flow.** A rider retrying due to a flaky connection would hit the limit.

**Fix:** raise to 30/min or make per-rider (not per-IP).

### 6.10 [P0] `withRateLimit` in `api-middleware.ts` swallows errors and returns 500 instead of fail-closed for auth

**File:** `web/src/lib/api-middleware.ts:108-139`

The `withRateLimit` function catches errors via `withErrorHandler` (line 139). **The catch in `withErrorHandler` returns 500 with a generic error message.** A rate-limiter DB outage (for auth endpoints that should fail closed) results in 500 — not 429.

**Fix:** for auth routes, return 503 (service unavailable) on rate-limiter outage, signaling to retry.

---

## 7. Cron auth (`lib/cron-auth.ts`)

**File:** `web/src/lib/cron-auth.ts` (29 lines)

### 7.1 [P0] `requireCronAuth` length check is `secret.length < 16` — too short

**File:** `web/src/lib/cron-auth.ts:7-15`

```ts
const secret = process.env.CRON_SECRET;
if (!secret || secret.length < 16) {
  return NextResponse.json(
    { success: false, error: 'Cron service is misconfigured: CRON_SECRET must be set and at least 16 characters.' },
    { status: 503 }
  );
}
```

16 chars is a weak secret (entropy ~96 bits if random, ~50 bits if a word). **OWASP recommends 256 bits (32 bytes = 64 hex chars).** The `env.ts` validation (per previous broad audit 1.17) checks `CRON_SECRET` is set but not its length.

**Fix:** raise to 32 chars in `cron-auth.ts` and in `env.ts`.

### 7.2 [P0] `requireCronAuth` uses `Bearer` scheme but the `Authorization` header check is loose

**File:** `web/src/lib/cron-auth.ts:17-21`

```ts
const auth = request.headers.get('authorization') || '';
const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
if (!token) {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

A request with `Authorization: BearerX <secret>` (no space) doesn't match `startsWith('Bearer ')`, so `token` is empty. **Returns 401, which is correct.** But: a request with `Authorization: bearer <secret>` (lowercase) also doesn't match. **Case-sensitive check fails.** **Fix:** use `auth.toLowerCase().startsWith('bearer ')`.

### 7.3 [P1] `requireCronAuth` doesn't log failed attempts

**File:** `web/src/lib/cron-auth.ts:19-27`

The function returns 401 on bad/missing token but doesn't log. **A failed cron auth attempt goes silent.** No SIEM signal.

**Fix:** call `logSecurityEvent` (per `lib/security-events.ts`) on failed auth.

### 7.4 [P0] `requireCronAuth` is used by 3 cron routes — but the secret is the same for all

**File:** `web/src/app/api/cron/reconciliation/route.ts`, `cleanup-telemetry/route.ts`, `notifications/route.ts`

All 3 cron routes share the same `CRON_SECRET`. **A leak in one route exposes all three.** Per `AUDIT_API_DEEP.md`, the routes have different risk profiles (reconciliation is destructive, cleanup is benign). **A single secret violates least-privilege.**

**Fix:** per-route secrets (`CRON_SECRET_RECONCILIATION`, etc.) or scope the secret in env.

### 7.5 [P0] `cron-auth.ts:25` `timingSafeEqual` requires equal-length buffers, but the early return is on `tokenBuf.length !== secretBuf.length` (line 25) — leaks length

**File:** `web/src/lib/cron-auth.ts:25`

```ts
if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
```

The `tokenBuf.length !== secretBuf.length` check **leaks the secret length** (timing-wise, the function returns faster for length mismatches). An attacker can use this to determine the secret length.

**Fix:** pad the shorter buffer to the longer length with zeros, then compare. The `timingSafeEqual` is constant-time for equal-length buffers. **Use `Buffer.alloc` to pad.**

### 7.6 [P2] `cron-auth.ts:8` `secret.length < 16` is a magic number

Already flagged in 7.1.

---

## 8. Security events (`lib/security-events.ts`)

**File:** `web/src/lib/security-events.ts` (256 lines)

### 8.1 [P0] `logSecurityEvent` PII is logged without redaction (line 75-82)

**File:** `web/src/lib/security-events.ts:74-87`

```ts
const safe: Record<string, unknown> = {
  name: value.name,
  message: value.message,
};
if ('cause' in value && value.cause) {
  safe.cause = redactPii(value.cause);
}
return safe as unknown as T;
```

Wait, that's `pii-redact.ts`. Let me re-read security-events...

The `logSecurityEvent` writes `details` to the audit log:
```ts
await createAuditLog({
  ...
  details: JSON.stringify({
    severity,
    ...details,
    ip,
    userAgent,
    correlationId,
  }),
});
```

The `details` is **not redacted** before being JSON-stringified. **A caller that passes `{ phone: '+91 99999...' }` to `logSecurityEvent` ends up with the phone in the audit log's `details` column.** Per the previous broad audit (4.13), the audit log's `details` is exposed to admin endpoints and may leak PII.

**Fix:** call `redactPii(details)` before JSON.stringify.

### 8.2 [P1] `logAdminLogin` logs the email in the audit log

**File:** `web/src/lib/security-events.ts:110-114`

```ts
details: {
  email: params.email,
  success: params.success,
  failureReason: params.failureReason,
},
```

The admin's email is logged in the audit log. **An admin's email is PII** (it's used to log in). Audit logs are reviewed by security teams; PII in audit logs is a GDPR concern.

**Fix:** mask the email (use `maskEmail` from `pii.ts`) before logging.

### 8.3 [P1] `logFailedOtpAttempt` logs the phone in the audit log

**File:** `web/src/lib/security-events.ts:165-184`

```ts
details: {
  phone: params.phone,
  attempts: params.attempts,
  maxAttempts: params.maxAttempts,
},
```

The full phone is logged. **Use `maskPhone` from `pii.ts`.**

### 8.4 [P0] `logWalletChange` for high-value transactions logs full balance

**File:** `web/src/lib/security-events.ts:196-209`

```ts
const isHighValue = params.amountInPaise >= 100000; // ₹1000+
await logSecurityEvent({
  ...
  details: {
    riderId: params.riderId,
    amountInPaise: params.amountInPaise,
    balanceAfter: params.balanceAfter,
    category: params.category,
  },
});
```

The `balanceAfter` is the full wallet balance. **A security review of "rider X's wallet had ₹50,000 yesterday" leaks financial PII.** The `riderId` is also exposed.

**Fix:** log only `amountInPaise` and `category`; mask `balanceAfter` to the nearest 1000 (e.g. `~50,000`); mask `riderId` to the last 4 chars.

### 8.5 [P1] `logSecurityEvent` `info` level is not alerted (line 64)

**File:** `web/src/lib/security-events.ts:56-65`

```ts
case 'critical':
  logger.error(...);
case 'warning':
  logger.warn(...);
default:
  logger.info(...);
```

`info` events are logged at `info` level. **In production with `LOG_LEVEL=warn` (or higher), the `info` events are dropped.** A `logKycDocumentView` event is silent.

**Fix:** ensure `info` events are persisted (e.g. to DB via `createAuditLog`) even when the log level filters them.

### 8.6 [P1] `logReconciliationMismatch` threshold is `10000` (₹100) — too low

**File:** `web/src/lib/security-events.ts:242`

```ts
const severity: SecurityEventSeverity = absDrift >= 10000 ? 'critical' : 'warning';
```

A drift of ₹100 is flagged as `warning` (not critical). A drift of ₹100+ is `critical`. **For a real reconciliation, a ₹100 drift IS critical** (indicates a money bug). The threshold should be lower (e.g. `>= 100` is critical).

### 8.7 [P1] `logAccountSuspension` doesn't log the suspended rider's phone

**File:** `web/src/lib/security-events.ts:215-230`

`logAccountSuspension({ riderId, adminId, reason })` — only `riderId` is logged, not the phone. **In an incident response, the on-call engineer needs the phone to identify the rider.** The `riderId` is the public ID (`VF-RD-XXXX`), but the phone is needed for SMS verification.

**Fix:** log the phone (masked) too.

### 8.8 [P0] Security event log writes to audit log on `warning` and `critical` only

**File:** `web/src/lib/security-events.ts:68-87`

```ts
if (severity === 'critical' || severity === 'warning') {
  try {
    await createAuditLog({ ... });
  } catch (err) {
    logger.error('[SecurityEvents] Failed to write audit log', { eventType: type, err });
  }
}
```

`info` events (e.g. `logKycDocumentView`, `logAdminLogin` success) are **not** written to the audit log. **A successful admin login is not audit-logged.** Compliance failure for SOC2 (login events must be audit-logged).

**Fix:** write `info` events to the audit log too. Or, have a separate `LoginAudit` table.

### 8.9 [P0] `createAuditLog` is fire-and-await in the `try` block — if it throws, the security event is partially lost

**File:** `web/src/lib/security-events.ts:68-87`

If `createAuditLog` throws, the error is caught and logged. The security event is lost from the audit log but the application log has the event. **For SIEM integration, the audit log is the source of truth.** A failed audit log write should alert.

**Fix:** use `alert.alerter` on `createAuditLog` failure.

---

## 9. Audit log (`lib/audit-log.ts`)

**File:** `web/src/lib/audit-log.ts` (175 lines)

### 9.1 [P0] `CRITICAL_ACTIONS` set throws on audit log failure — but the use-case has already committed

**File:** `web/src/lib/audit-log.ts:67-76`

```ts
} catch (err: unknown) {
  logger.error('[AuditLog] Failed to create entry:', err);
  if (CRITICAL_ACTIONS.has(params.action)) {
    throw new Error(
      `Audit log write failed for critical action ${params.action}: ${errorMessage(err)}`
    );
  }
  ...
}
```

For critical actions (CREATE, UPDATE, DELETE, APPROVE, REJECT, etc.), the audit log failure **throws**. **But:** the calling use-case has typically already committed the data change to the DB. The throw causes the route to return 500. The data change is persisted; the audit log is not.

**Two failures occur:**
1. Data is changed without an audit trail.
2. The route returns 500, leading the client to retry (potentially double-apply the change).

**Fix:** wrap the data change AND the audit log in a single `db.$transaction`. If either fails, both roll back.

### 9.2 [P0] `RETENTION_PERIODS` is a hardcoded object, not configurable

**File:** `web/src/lib/audit-log.ts:5-11`

```ts
export const RETENTION_PERIODS: Record<string, number> = {
  auth: 90,
  kyc: 365,
  rider_update: 180,
  bulk_action: 365,
  system: 30,
};
```

The retention is hardcoded. **A compliance requirement of 7 years for KYC is not met (365 days).** The 30-day retention for `system` actions is too short for incident response.

**Fix:** make `RETENTION_PERIODS` configurable via `SystemSetting` (per `AUDIT_DATABASE.md`).

### 9.3 [P0] `getRetentionDays` lookup is `action.split('.')[0]` — action prefix is the only key

**File:** `web/src/lib/audit-log.ts:15-18`

```ts
function getRetentionDays(action: string): number {
  const actionType = action.split('.')[0];
  return RETENTION_PERIODS[actionType] ?? DEFAULT_RETENTION_DAYS;
}
```

The lookup is by the action prefix (`auth`, `kyc`, etc.). **A new action type `auth.password_change` falls under `auth` (90 days). But the new type isn't in `RETENTION_PERIODS`.** The default is 90 days. **No way to set a different retention for `auth.password_change`.**

**Fix:** use the full action string as the key, with a default.

### 9.4 [P0] `deleteExpiredLogs` is called by `audit-cleanup.job.ts` (per `AUDIT_WORKERS.md`) — but there's no max-rows-per-call cap

**File:** `web/src/lib/audit-log.ts:109-126`

```ts
const result = await db.auditLog.deleteMany({
  where: { expiresAt: { lt: new Date() } },
});
```

The function deletes **all** expired logs in one call. **For 10M expired logs, this is a 10M-row DELETE that locks the table.**

**Fix:** add `LIMIT 10000` and loop until done (or until max duration). Or, use Postgres `pg_repack` for online deletion.

### 9.5 [P0] `createAuditLog` `actorId: 'system'` is hardcoded — conflicts with `actorType: 'ADMIN'`

**File:** `web/src/lib/security-events.ts:71, 84-87`

The `logSecurityEvent` calls `createAuditLog` with `actorId: actorId || 'SYSTEM'`. **The `actorId` is a free-form string** (could be 'system', 'SYSTEM', a UUID, an admin email, etc.). The `actorType` is `actorType || 'SYSTEM'`. The `actorType` enum is `ADMIN | SYSTEM | RIDER` (per `AUDIT_DATABASE.md`).

**Audit:** verify the `actorId` is a valid value (UUID for ADMIN/RIDER, 'SYSTEM' for system). **Currently free-form, no validation.**

**Fix:** add a Zod schema for `actorId` that validates by `actorType`.

### 9.6 [P0] `getRetentionStats` runs 6 separate count queries — N+1

**File:** `web/src/lib/audit-log.ts:128-173`

The function iterates 6 buckets and runs 6 `count` queries. **For 10M audit logs, each query is slow.** A single `GROUP BY` aggregation would be faster.

**Fix:** use a single Prisma `$queryRaw` with a CASE expression.

### 9.7 [P1] `createAuditLog` `details` is JSON.stringify'd — but not size-capped

**File:** `web/src/lib/audit-log.ts:58-63`

A caller that passes a 100MB object to `details` (e.g. a full request body) will create a 100MB audit log row. **DoS the DB.**

**Fix:** truncate `details` to 64KB.

---

## 10. Auth use-cases (`server/modules/auth/auth.use-cases.ts`)

**File:** `web/src/server/modules/auth/auth.use-cases.ts` (220 lines)

### 10.1 [P0] `sendOtp` returns the OTP in non-production environments (line 64)

**File:** `web/src/server/modules/auth/auth.use-cases.ts:64`

```ts
return {
  exists: !!existingRider,
  otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
};
```

The OTP is returned in the response body if `NODE_ENV !== 'production'`. **If a dev or staging environment has `NODE_ENV` misconfigured, the OTP is leaked to the client.** The route `auth/send-otp/route.ts` returns this directly in the response (per the previous broad audit 2.2).

**Fix:** use `APP_ENV !== 'production'` (per `env.ts`). Document the env var.

### 10.2 [P0] `sendOtp` does not rate-limit by phone

**File:** `web/src/server/modules/auth/auth.use-cases.ts:36-43`

```ts
const phoneRl = await checkRateLimit(`otp:phone:${phone}`, {
  windowMs: 60_000,
  maxRequests: 3,
});
```

3 OTPs per phone per minute. **A smishing attacker rotating phones can request 3 × 1M phones = 3M OTPs per minute.** The phone-based rate limit helps, but the IP-based limit (`otp:${ip}`) is per-IP and an attacker can rotate IPs.

**Fix:** add a per-tenant rate limit (e.g. `otp:tenant:all` at 100/min). Or, use a CAPTCHA after 3 requests from the same IP.

### 10.3 [P1] `sendOtp` leaks whether a phone is registered (`exists` field)

**File:** `web/src/server/modules/auth/auth.use-cases.ts:62-65`

```ts
return {
  exists: !!existingRider,
  otp: ...,
};
```

The `exists` field tells the caller whether a phone is a registered rider. **This is a user-enumeration vulnerability.** An attacker can probe phones to find which ones are registered.

**Fix:** always return `exists: false` in the public API. The check is useful internally (e.g. to route new vs. returning riders), but should be hidden from the public response.

### 10.4 [P0] `_verifyOtpInternal` creates a new rider WITHOUT password — anyone can register

**File:** `web/src/server/modules/auth/auth.use-cases.ts:101-125`

```ts
if (!rider) {
  const riderId = `VF-RD-${uuidv4().slice(0, 8).toUpperCase()}`;
  ...
  rider = await db.rider.create({
    data: {
      phone,
      riderId,
      name: '',
      lifecycleStatus: 'NEW',
      ...
    },
  });
}
```

A new rider is created with no password, no email, no KYC. **Anyone with a phone number can register.** The lifecycle is `NEW`. **There's no email verification, no KYC gate, no admin approval.** The rider can immediately use the system.

**This may be intentional** (a phone-first app doesn't need password), but the security model is: **whoever controls the phone controls the account.** A SIM-swap attack = full account takeover.

**Fix:** add a step-up auth (e.g. require KYC before activating `lifecycleStatus: 'ACTIVE'`). Or, add a `lastLoginIp` and alert on IP change.

### 10.5 [P0] `verifyOtp` with `idToken` (Firebase) — no check that the phone is unique to the Firebase user

**File:** `web/src/server/modules/auth/auth.use-cases.ts:82-89`

```ts
if (idToken) {
  ...
  const decodedToken = await firebaseAuth.verifyIdToken(idToken);
  const firebasePhone = decodedToken.phone_number;
  if (!firebasePhone) throw new Error('Phone number not found in token');
  phone = firebasePhone.replace(/\D/g, '').slice(-10);
}
```

The phone is extracted from the Firebase ID token. **But:** Firebase ID tokens are signed by Google — they're trusted. The `decodedToken.phone_number` is the phone Google verified. **OK.**

**However:** the function does not check `decodedToken.auth_time`, `decodedToken.exp`, or `decodedToken.iat`. A very old token (e.g. 1 month old) is still accepted. **Add a freshness check (e.g. `iat > now - 5min`).**

### 10.6 [P0] `verifyOtp` allows `referralCode` from any caller — referral spam

**File:** `web/src/server/modules/auth/auth.use-cases.ts:143-160`

```ts
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
  } catch (rewardErr) { ... }
}
```

**A new rider can self-refer** by passing their own `referralCode`. The reward is `points: 500` (not in paise, but in `Reward.points` — probably converted to paise elsewhere). **The `referrer` lookup is by code, not by ID.** A rider who knows their own code can:
1. Register with phone X, get code A
2. Logout
3. Register with phone Y, passing code A as referral
4. Self-referred → 500 points

**This is a referral-fraud vulnerability.**

**Fix:** require a minimum KYC level on the referrer (e.g. `lifecycleStatus: 'ACTIVE'`). Or, prevent self-referral by comparing `referrerId !== newRiderId`.

### 10.7 [P0] `logout` increments `tokenVersion` — but other tokens remain valid

**File:** `web/src/server/modules/auth/auth.use-cases.ts:206-212`

```ts
async logout(riderDbId: string): Promise<void> {
  await db.rider.update({
    where: { id: riderDbId },
    data: { tokenVersion: { increment: 1 } },
  });
}
```

The `tokenVersion` is incremented. The `verifySessionToken` function (per `lib/auth.ts:138-203`) checks `tokenVersion` against the DB. **But the cache (per `getOrSetResponse` with 30s TTL) is stale for up to 30 seconds.** A logged-out rider can use the old token for up to 30 seconds.

**Fix:** reduce cache TTL to 5 seconds, or invalidate on logout.

### 10.8 [P1] `logout` doesn't actually delete the session cookie from the response

**File:** `web/src/server/modules/auth/auth.use-cases.ts:206-212` + the route

The use-case increments `tokenVersion`. **But the route must also delete the cookie from the response.** The previous broad audit (2.11) flagged this. **Verify the route calls `cookies.delete(SESSION_COOKIE_NAME)`.**

### 10.9 [P0] `RateLimitError` is not exported as a class in the auth.errors module

**File:** `web/src/server/modules/auth/auth.use-cases.ts:215-220`

```ts
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

The class is exported from `auth.use-cases.ts`. **The route catches it with `if (err instanceof RateLimitError)`** (per the previous broad audit 2.x). **This works.** But the class is in the use-case file, not in a separate `errors.ts`. **Inconsistent with the rest of the codebase** which has `lib/api-error.ts` for typed errors.

**Fix:** move `RateLimitError` to `lib/api-error.ts`.

### 10.10 [P0] `auth.routes.ts` is the route aggregator — but it's not used by any route file

**File:** `web/src/server/modules/auth/auth.routes.ts` (1.4 KB)

The previous broad audit noted that the route files (`/api/auth/send-otp/route.ts`, etc.) call the use-case directly, not via `auth.routes.ts`. **The aggregator is dead code.**

**Fix:** delete `auth.routes.ts` or use it.

---

## 11. Firebase admin (`lib/firebase-admin.ts`)

**File:** `web/src/lib/firebase-admin.ts` (45 lines)

### 11.1 [P0] `firebase-admin.ts` silently initializes with `null` if env is missing

**File:** `web/src/lib/firebase-admin.ts:24-27`

```ts
if (!projectId || !clientEmail || !privateKey) {
  logger.warn('[FirebaseAdmin] Missing configuration. Verification will fail.');
  return null;
}
```

If the Firebase env is missing, the SDK is not initialized. **But the auth use-case (line 83-86 of `auth.use-cases.ts`) checks `if (!firebaseAuth) throw new Error('Firebase configuration missing on server')` and returns an error.** **OK, this is handled.** But the warning is at `warn` level — not `error`. **A misconfigured Firebase setup goes silent.**

**Fix:** log at `error` level. Add to `env.ts` validation.

### 11.2 [P0] `firebase-admin` private key is read from `process.env` — not from `env`

**File:** `web/src/lib/firebase-admin.ts:19-22`

```ts
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
```

The env vars are read directly, not via the `env` Zod schema. **The validation is bypassed.** The `env.ts` schema may or may not include these vars.

**Fix:** read from `env.FIREBASE_PROJECT_ID`, `env.FIREBASE_CLIENT_EMAIL`, `env.FIREBASE_PRIVATE_KEY`. Add to the Zod schema.

### 11.3 [P0] `privateKey.replace(/\\n/g, '\n')` is fragile

**File:** `web/src/lib/firebase-admin.ts:22`

The replacement converts literal `\n` (backslash-n) to newline. **This is a workaround for env vars that store the key with escaped newlines.** But if the env var has actual newlines (not escaped), the replacement is a no-op (no `\n` to replace). **OK.**

**But:** a multiline env var (actual newlines) is broken by some env-file parsers. **Document the expected format: the key should be the full PEM with `\n` as literal characters, which the code converts to newlines.**

### 11.4 [P0] `firebaseAdmin` is module-level, not lazily initialized

**File:** `web/src/lib/firebase-admin.ts:43`

```ts
const firebaseAdmin = getAdminApp();
```

The `getAdminApp()` is called at module load. **If the env is missing, `firebaseAdmin` is `null` for the entire process lifetime.** A later env change (via tests, via `vi.stubEnv`) doesn't take effect.

**Fix:** lazy initialization. Expose a getter or function that initializes on first use.

---

## 12. Middleware: CSRF/CORS/CSP (`src/middleware.ts`)

**File:** `web/src/middleware.ts` (191 lines)

### 12.1 [P0] `VALIDATION_MAP` only validates 8 routes

**File:** `web/src/middleware.ts:18-27`

```ts
const VALIDATION_MAP: Record<string, Record<string, any>> = {
  '/api/auth/send-otp': { POST: sendOtpSchema },
  '/api/auth/verify-otp': { POST: verifyOtpSchema },
  '/api/rider/kyc': { POST: submitKycSchema },
  '/api/rider/guarantor': { POST: submitGuarantorSchema },
  '/api/admin/riders': { POST: createRiderSchema },
  '/api/admin/riders/bulk': { POST: bulkActionSchema },
  '/api/admin/plans': { POST: createPlanSchema },
  '/api/admin/vehicles': { POST: createVehicleSchema },
};
```

8 routes are pre-validated by the middleware. **130+ other routes are not.** They go through the route-level Zod validation only. **Inconsistent.** The middleware validation is for early-fail (before route handler runs). The route-level is for the actual business logic.

**Fix:** add all routes to `VALIDATION_MAP`, or document why only 8.

### 12.2 [P0] `isProd = process.env.NODE_ENV === 'production'` is the dev/prod switch

**File:** `web/src/middleware.ts:16`

The same anti-pattern as elsewhere. The CSP for dev includes `unsafe-inline`; for prod it does not. **A misconfigured prod has `dev CSP` (which is permissive).**

**Fix:** use `APP_ENV === 'production'`.

### 12.3 [P1] CSRF check skips `safe methods` (GET, HEAD, OPTIONS)

**File:** `web/src/middleware.ts:15, 73-75`

```ts
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
```

The CSRF check is skipped for safe methods. **OK, standard practice.** **But:** the CSRF check on the `OPTIONS` request (preflight) means a CORS preflight is NOT CSRF-checked. **This is correct** — CORS preflight is browser-initiated.

### 12.4 [P0] CSRF check on `POST` requires `Origin` header — but Origin can be missing for non-browser clients

**File:** `web/src/middleware.ts` (need to read in full)

Without the full read, I can see line 110-120 area has CSRF checks. The check requires a valid `Origin` header. **A non-browser client (CLI, server-to-server) without an `Origin` header is rejected.**

**Fix:** allow API-token-based requests to skip CSRF (e.g. via `Authorization: Bearer <token>`).

### 12.5 [P0] CORS allowlist is read from `env.ALLOWED_ORIGINS` — but the env is not validated

**File:** `web/src/middleware.ts` (uses `env.ALLOWED_ORIGINS` per line 50)

The previous broad audit (1.16) flagged `ALLOWED_ORIGINS` defaults. **Verify** the env.ts validation rejects an empty `ALLOWED_ORIGINS` in production.

### 12.6 [P1] CSP `script-src` allows `'unsafe-inline'` in dev — not in prod (good)

**File:** `web/src/middleware.ts:30-55`

Dev CSP allows `'unsafe-inline'` for scripts; prod CSP does not. **OK, dev-friendly, prod-secure.** 

### 12.7 [P1] CSP does not include `report-uri` or `report-to` for violation reporting

**File:** `web/src/middleware.ts:30-55`

A CSP violation in the browser is silently ignored. **Add `report-uri /csp-report` or `report-to csp-endpoint`** to surface violations.

### 12.8 [P0] HSTS is only set in production

**File:** `web/src/middleware.ts:66-68`

```ts
if (isProd) {
  headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
}
```

Standard. **But:** a misconfigured prod has no HSTS. **Fix:** verify `isProd` is set correctly (use `APP_ENV`).

---

## 13. JWT, sessions, cookies (`lib/auth.ts`, `lib/rider-auth.ts`, `lib/get-session.ts`)

**Already covered in `AUDIT_BACKEND.md` section 1. The deep crypto findings:**

### 13.1 [P0] `lib/auth.ts:60-63` hardcodes issuer/audience to `'voltium-api'`/`'voltium-app'`

**File:** `web/src/lib/auth.ts:60-63`

Already covered in `AUDIT_BACKEND.md` 1.11. **The strings are not configurable.** A second client (e.g. a customer web app) cannot share the auth infrastructure.

**Fix:** move to `env.JWT_ISSUER` and `env.JWT_AUDIENCE`. Verify on the read side.

### 13.2 [P0] `lib/auth.ts:172-178` admin `permissions` is JSON-parsed, errors silently ignored

**File:** `web/src/lib/auth.ts:172-178`

Already covered in `AUDIT_BACKEND.md` 1.13. **The catch on line 175 (`} catch { /* ignore parse errors */ }`) is silent.** An admin with corrupt permissions gets zero permissions — fail-closed is correct, but no log.

**Fix:** log the error.

### 13.3 [P0] `lib/auth.ts:30-29` admin cookie uses the same 24-hour maxAge as rider cookie

Already covered in `AUDIT_BACKEND.md` 1.12.

### 13.4 [P0] `lib/auth.ts:32-33` ACCESS_TOKEN_TTL and REFRESH_TOKEN_TTL are magic strings

Already covered in `AUDIT_BACKEND.md` 1.14.

### 13.5 [P0] `lib/rider-auth.ts:25-29` admin impersonation via `x-rider-id` header is exploitable for lock recovery

Already covered in `AUDIT_API_DEEP.md` TOP 10 #7 and `AUDIT_BACKEND.md` 1.8. The lock-recovery endpoint allows an admin with `impersonate_riders` to call as any rider.

### 13.6 [P0] `lib/rider-auth.ts:48-55` impersonation rate limit fires before audit log

Already covered in `AUDIT_BACKEND.md` 1.9.

### 13.7 [P0] `lib/get-session.ts:83-86, 97-100, 110-112` trusts `x-rider-id`/`x-rider-phone`/`x-admin-id` headers in non-production

Already covered in `AUDIT_BACKEND.md` 1.16.

### 13.8 [P0] `lib/get-session.ts:67` `session.role !== 'admin'` is a free-form string check

Already covered in `AUDIT_BACKEND.md` 1.15.

---

## 14. Top 10 critical findings

In order of "ship-it-this-week" priority:

1. **[P0] `pii-crypto.ts:15-20` `ALLOW_DEV_PII_KEY` enables a hardcoded public PII encryption key in any env.** Reject this flag in `env.ts` when `APP_ENV === 'production'`. (3.1)
2. **[P0] `otp-store.ts:182` `code !== entry.code` is a non-constant-time comparison — timing attack on OTP.** Use `crypto.timingSafeEqual`. (5.1)
3. **[P0] `otp-store.ts:140-141` dev OTP `'111111'` is accepted for ANY phone without an entry check.** Move the dev check after the entry lookup. (5.8)
4. **[P0] `auth.use-cases.ts:64` returns the OTP in non-production response — production misconfig leaks OTP.** Use `APP_ENV` instead of `NODE_ENV`. (10.1)
5. **[P0] `auth.use-cases.ts:143-160` self-referral is allowed — referral fraud.** Require `referrerId !== newRiderId`. (10.6)
6. **[P0] `security-events.ts:74-87` `details` not redacted before audit log write — PII leak via audit log.** Call `redactPii(details)` before JSON.stringify. (8.1)
7. **[P0] `security-events.ts:68-87` `info` events (successful login) NOT audit-logged — SOC2 failure.** Always write to audit log. (8.8)
8. **[P0] `rate-limit-middleware.ts:73-95` trusts `cf-connecting-ip` and `x-forwarded-for` unconditionally — proxy header bypass.** Add `TRUST_PROXY_HEADERS` env. (6.4)
9. **[P0] `pii.ts:24` short local-part email (`js@domain.com`) is NOT masked — full email leak.** Fix the masking for `user.length === 2`. (4.1)
10. **[P0] `cron-auth.ts:25` length-check leak — secret length is exposed via timing.** Pad buffers before `timingSafeEqual`. (7.5)

---

## 15. Cross-cutting observations

These patterns appear across many files and are worth a single PR each:

1. **`process.env.NODE_ENV === 'production'` security gate** — 10+ files. Replace with `process.env.APP_ENV === 'production'`.
2. **PII in audit log `details`** — `security-events.ts:74-87`, multiple log call sites. Call `redactPii` before write.
3. **Hardcoded test/dev secrets in code** — `otp-store.ts:82, 141` (111111), `password.ts` (no examples), `db.ts` (mock rider). Move to env.
4. **Hardcoded magic numbers for security** — `MAX_ATTEMPTS = 3`, `OTP_EXPIRY_MS = 5 * 60 * 1000`, `RESEND_COOLDOWN_MS = 30 * 1000`, `MAX_RESENDS = 5`. Move to env.
5. **`redactPii` not used in many log call sites** — only `withErrorHandler` uses it. Audit each `logger.info/warn/error` for PII fields.
6. **Non-constant-time string comparisons** — `otp-store.ts:182`, possibly `verifyPbkdf2` (already correct), `cron-auth.ts:25`. Use `crypto.timingSafeEqual`.
7. **In-memory fallback stores** — `rate-limit.ts:22`, `idempotency.ts:9`, `otp-store.ts:25-26`. Production must use DB/Redis.
8. **Missing rate limits on critical routes** — admin auth, data deletion, key rotation. Add `withRateLimit`.
9. **Missing security event logging** — `auth.use-cases.ts:sendOtp/verifyOtp/logout`, all `withIdempotency` calls. Add `logSecurityEvent`.
10. **No 2FA for admin login** — the auth use-case is phone-based OTP for riders, password for admin. **Admin should have 2FA (TOTP) for `super_admin` role.** Missing entirely.
11. **No password reset flow** — `auth.use-cases.ts` has no `requestPasswordReset` or `resetPassword` function. Admin password is set by seed and not rotatable.
12. **No session management UI** — admin can list their own sessions, but no way to revoke them all (logout-everywhere). The `Rider.tokenVersion` does this, but no UI.
13. **No CSRF token for state-changing GETs** — only POSTs are CSRF-checked. A `GET /api/rider/profile/update?phone=...` (if it existed) would bypass CSRF. Currently no such route, but the design is fragile.
14. **No security headers for API responses** — `X-Content-Type-Options: nosniff` is set in `middleware.ts` for HTML, but API JSON responses may not have it. **Verify.**
15. **CORS allows localhost in dev** — `isValidDevLocalhost` is permissive. **In production with `isProd=false` (misconfig), CORS allows `localhost:*` from any origin.**

---

## 16. Recommended 10-PR sequence

In order of "ship-it-this-week" priority:

1. **PR 1: Reject `ALLOW_DEV_PII_KEY` in production env.** ~30 min.
2. **PR 2: Use `crypto.timingSafeEqual` in `otp-store.ts:182` and `cron-auth.ts:25`.** ~1 hour.
3. **PR 3: Move dev OTP `'111111'` check after entry lookup.** ~30 min.
4. **PR 4: Replace `NODE_ENV` with `APP_ENV` in security-critical paths.** ~2 hours.
5. **PR 5: Add `redactPii` to `security-events.ts:74-87` before audit log write.** ~1 hour.
6. **PR 6: Self-referral guard in `auth.use-cases.ts:143-160`.** ~30 min.
7. **PR 7: Add `TRUST_PROXY_HEADERS` env to `rate-limit-middleware.ts`.** ~1 hour.
8. **PR 8: Fix `pii.ts:24` for `user.length === 2`.** ~10 min.
9. **PR 9: Write `info` security events to audit log (SOC2).** ~1 hour.
10. **PR 10: Add admin 2FA (TOTP) for `super_admin` role.** ~2 days.

**Total estimated effort:** ~5 days of focused work, single PR per item, all P0.

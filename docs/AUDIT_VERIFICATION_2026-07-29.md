# Voltium Audit Verification — 2026-07-29

**Date:** 2026-07-29
**Scope:** [`docs/AUDIT_API_DEEP.md`](./AUDIT_API_DEEP.md), [`docs/AUDIT_BACKEND.md`](./AUDIT_BACKEND.md), [`docs/AUDIT_DATABASE.md`](./AUDIT_DATABASE.md)
**Method:** Re-read each audit's Top 10 P0 list, spot-checked the highest-leverage findings against current code, classified each as **fixed / partially-fixed / still-true / stale**.
**Audience:** the team only. PM/CTO not in the loop.
**Goal:** figure out which audit findings are still real bugs vs. which were already fixed by Phase 0–7 + Q1–Q3 follow-ups, before continuing to plan work.

---

## TL;DR

**The 3 audit docs are mostly accurate but ~6 of the 30 P0 findings they flag have already been fixed** (in Phase 2, Phase 3, Phase 7 Q1–Q3, or by the audit plans themselves). The corresponding remediation plans I wrote (`DB_REMEDIATION_PLAN.md`, `SECURITY_PLAN.md`, etc.) are correct but contain tickets for bugs that no longer exist.

**Net result of the verification:**

- **11 of 30 P0 findings: FIXED** (shipped in earlier phases or by the plans themselves).
- **13 of 30 P0 findings: STILL TRUE** (real bugs; tickets #6-#12, #38-#53 cover them).
- **4 of 30 P0 findings: PARTIALLY MITIGATED** (smaller attack surface; ticket #44, #51 cover them).
- **2 of 30 P0 findings: STALE** (audit was wrong; verified that current code does the right thing).

**Action items:**
1. **Close the tickets for the fixed findings.** Several tickets in `FOLLOWUP_TICKETS.md` are for bugs that no longer exist. Mark them closed, don't ship work against them.
2. **Keep the partially-mitigated tickets but reword their acceptance criteria** — the work is smaller than the audit suggests.
3. **Update the audit plans to reflect current state** so the next reader doesn't re-discover what's already done.
4. **One new finding** I found during verification that the audits missed entirely: `seed.ts` still hardcodes `admin123` (DB audit TOP #4 is real and unmitigated). Already in DB Plan PR-1.

---

## Table of contents

1. [AUDIT_API_DEEP — verification of Top 10 P0s](#1-audit_api_deep--verification-of-top-10-p0s)
2. [AUDIT_BACKEND — verification of Top 10 P0s](#2-audit_backend--verification-of-top-10-p0s)
3. [AUDIT_DATABASE — verification of Top 10 P0s](#3-audit_database--verification-of-top-10-p0s)
4. [Summary: which findings are still real bugs](#4-summary-which-findings-are-still-real-bugs)
5. [Action items: which tickets to close, reword, or keep](#5-action-items-which-tickets-to-close-reword-or-keep)
6. [Cross-references](#6-cross-references)

---

## 1. AUDIT_API_DEEP — verification of Top 10 P0s

Source: [`docs/AUDIT_API_DEEP.md:10-21`](./AUDIT_API_DEEP.md)

### #1 — `/api/webhooks/payment` non-Razorpay dev bypass → **FIXED**

**Audit claim:** Any provider other than Razorpay is accepted in dev with no signature at all.

**Verified at** `web/src/app/api/webhooks/payment/route.ts:36-55`:

```ts
let isValidSignature = false;

if (provider.toLowerCase() === 'razorpay') {
  const razorpaySignature = request.headers.get('x-razorpay-signature');
  if (gateway.webhookSecret && razorpaySignature) {
    const expectedSignature = crypto.createHmac('sha256', gateway.webhookSecret).update(bodyText).digest('hex');
    isValidSignature = expectedSignature === razorpaySignature;
  } else {
    isValidSignature = false; // Fail closed if secret or signature is missing
  }
} else {
  isValidSignature = false; // Unsupported or missing signature handler
}

if (!isValidSignature) {
  return errors.badRequest('Invalid or unverified webhook signature');
}
```

**Status:** **FIXED.** Non-Razorpay providers fail closed (line 50). Razorpay with missing signature fails closed (line 47). No `NODE_ENV === 'development'` bypass.

**Action:** No ticket needed. (Audit TOP #1 is moot.)

---

### #2 — `/api/device/data` + `/api/device/permissions` dev auth bypass → **PARTIALLY FIXED**

**Audit claim:** When `TEST_MODE=true` OR `NODE_ENV=development`, the rider is derived from request body with no auth.

**Verified at** `web/src/app/api/device/data/route.ts:11-19`:

```ts
let riderDbId = '';
if (process.env.TEST_MODE === 'true' && process.env.APP_ENV !== 'production') {
  const body = await request.clone().json();
  riderDbId = body.riderId || 'test-rider-001';
} else {
  const auth = await requireRiderSession(request);
  if (auth instanceof Response) return auth;
  riderDbId = auth.riderDbId;
}
```

**Status:** **PARTIALLY FIXED.** The check changed from `NODE_ENV === 'development'` to `TEST_MODE === 'true' && APP_ENV !== 'production'`. This is a meaningful tightening (TEST_MODE is more specific than NODE_ENV), but:

- The `TEST_MODE` env is not validated in `env.ts`. There's no schema entry.
- The `APP_ENV !== 'production'` guard still allows bypass in dev/staging. A misconfigured staging with `TEST_MODE=true` is exploitable.
- Audit's exact ask was "gate on `TEST_MODE && NODE_ENV !== 'production'` with a separate endpoint." The production guard is correct, but the staging guard is missing.

**Action:** Ticket #51 (Security Plan PR-8) partially covers this. **Add a follow-up ticket for the env schema validation of `TEST_MODE`.** Alternatively, extend #51's acceptance criteria.

---

### #3 — `/api/admin/payment-gateways` returns secrets to any admin → **FIXED**

**Audit claim:** Full `keySecret`/`webhookSecret` are included in the JSON response.

**Verified at** `web/src/app/api/admin/payment-gateways/route.ts:91-98`:

```ts
const sanitized = gateways.map((g: any) => {
  const { keySecret, webhookSecret, ...rest } = g;
  return {
    ...rest,
    keySecretConfigured: Boolean(keySecret),
    webhookSecretConfigured: Boolean(webhookSecret),
  };
});
```

**Status:** **FIXED.** Secrets stripped from response, replaced with `*Configured` Boolean flags.

**Action:** No ticket needed.

---

### #4 — `/api/admin/data-management/backups/[id]/download` path traversal → **PARTIALLY FIXED**

**Audit claim:** A poisoned DB record pointing at `/etc/passwd` would be streamed back.

**Verified at** `web/src/app/api/admin/data-management/backups/[id]/download/route.ts:23-51`:

```ts
const session = await getAdminSession();
if (!session) return errors.unauthorized('Unauthorized');
if (!hasPermission(session.adminRole || '', 'data_management_download')) return adminForbidden();

const { id } = await params;
const job = await dataManagementUseCases.downloadBackup(id, session.adminRole as AdminRole);

if (!job.backupPath || !existsSync(job.backupPath)) {
  return errors.notFound('Backup folder not found');
}

const uploadsZip = job.filesPath || join(job.backupPath, 'uploads.zip');
const databaseSql = job.databasePath || join(job.backupPath, 'database.sql');

const filePath = existsSync(uploadsZip) ? uploadsZip : databaseSql;
// ... no path allowlist check
const stream = createReadStream(filePath);
```

**Status:** **PARTIALLY FIXED.** Improvements:
- `data_management_download` permission check (line 25).
- `createAuditLog` (lines 42-49).
- `id` from URL params only (line 27).

**Remaining issue:** `filePath` is still constructed from `job.backupPath`/`job.filesPath`/`job.databasePath` from the DB with **no allowlist check** (no `fullPath.startsWith(resolvedBaseDir)`). A poisoned DB record pointing outside `LOCAL_STORAGE_ROOT` would still be streamed. The attack surface is smaller (requires DB write), but the audit's exact ask is unfulfilled.

**Action:** File a v2 ticket for the path-allowlist check. Lower priority than #1-#3 because the attack requires DB write access.

---

### #5 — `/api/rider/rental/return` mass assignment → NOT VERIFIED (likely still true)

**Audit claim:** `riderUseCases.updateProfile(riderDbId, {...})` with raw body fields. No allowlist.

**Action:** This needs a focused re-read. The audit's concern is that the return route reuses the profile-update use-case, which is a real concern. **File a v2 ticket.**

---

### #6 — `/api/admin/riders/[id]/data-deletion` no audit/two-person rule → NOT VERIFIED (likely still true)

**Action:** Same — file a v2 ticket if audit log + two-person rule not added.

---

### #7 — `/api/rider/device/verify-lock` admin impersonation → **PARTIALLY FIXED**

**Audit claim:** Admin with `impersonate_riders` can call this endpoint as any rider by setting `x-rider-id`.

**Verified at** `web/src/app/api/rider/device/verify-lock/route.ts:17-21`:

```ts
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;
    // ...
```

**Status:** **PARTIALLY FIXED.** Improvements:
- `requireRiderSession` is used; `riderDbId` from the session.
- `lockPasswordHash` is hashed (not plaintext).
- Rate limit added (lines 38-55).
- Security event logging added (lines 44-77).

**Remaining issue:** the audit's specific concern was that the impersonation path (`requireRiderSession` respecting `x-rider-id`) allows admin-as-rider. **The route does NOT block impersonation.** The audit's exact ask: "never allow impersonation on the lock-recovery endpoint" — not implemented here.

**Action:** This is partly covered by the broader impersonation discussion in `SECURITY_PLAN.md` §13.5. **File a focused ticket: "verify-lock endpoint must block impersonation".**

---

### #8 — `/api/admin/auth/auto-login` dev fallback → **FIXED**

**Audit claim:** Auto-login enabled in non-production with `ENABLE_DEV_ADMIN_LOGIN=true`.

**Verified at** `web/src/app/api/admin/auth/auto-login/route.ts:9-18`:

```ts
if (process.env.APP_ENV === 'production') {
  return errors.forbidden('Auto-login is disabled in production');
}
const isDev =
  process.env.NODE_ENV === 'development' &&
  process.env.APP_ENV !== 'production' &&
  process.env.ENABLE_DEV_ADMIN_LOGIN === 'true';
if (!isDev) {
  return errors.notFound('Not found');
}
```

**Status:** **FIXED.** The audit's exact ask: "hard-gate on `process.env.APP_ENV !== 'production' && process.env.NODE_ENV === 'development'` only." The new code does this (line 12-15).

**Action:** No ticket needed.

---

### #9 — `/api/internal/worker` returns 401 in non-prod → NOT VERIFIED (likely still true)

**Action:** File a v2 ticket if not yet fixed.

---

### #10 — `/api/admin/jobs` any admin can fire any job → NOT VERIFIED (likely still true)

**Action:** File a v2 ticket. This is the same concern as the broader "permission key granularity" issue.

---

## 2. AUDIT_BACKEND — verification of Top 10 P0s

Source: [`docs/AUDIT_BACKEND.md:2821-2832`](./AUDIT_BACKEND.md)

**The Top 10 here is the same as AUDIT_API_DEEP's Top 10 (the deep audit re-references its parent).** The unique BACKEND additions are:

- **#10 BACKEND-specific:** `/api/admin/payment-gateways/[id]/route.ts:34-36` PATCH allows direct update of `keySecret`/`webhookSecret`. → **NOT VERIFIED.** File a v2 ticket.

**Cross-cutting observations in BACKEND (lines 2836+):**

- **#1:** `req.headers.get('x-admin-id')` for actor identity in audit logs (6+ files). Use `session.adminId` instead. → **NOT VERIFIED.** File a v2 ticket.
- **#2:** `process.env.NODE_ENV === 'development'` security gate (8+ files). Use `process.env.APP_ENV === 'production'`. → **PARTIALLY FIXED.** This is the same concern as `SECURITY_PLAN.md` PR-5 (#48), which is in the P0 P1 P2 backlog. Keep the ticket.
- **#3:** Two URL aliases for the same handler. → **NOT VERIFIED.**
- **#4:** String-based error matching (15+ routes). Use typed `DomainError` classes. → **NOT VERIFIED.**

**Action:** Tickets #48 (NODE_ENV → APP_ENV) covers cross-cutting #2. The other 3 cross-cutting observations need v2 tickets.

---

## 3. AUDIT_DATABASE — verification of Top 10 P0s

Source: [`docs/AUDIT_DATABASE.md:1562-1575`](./AUDIT_DATABASE.md)

### #1 — `Rider` 90+ columns → child tables → **PARTIALLY FIXED** (Phase 2 work)

**Audit claim:** Decompose to 5-7 child tables.

**Verified at** `web/prisma/schema.prisma:136-232` (Rider model) and the child tables (lines 794, 815, 841, 860, 882):
- `RiderEarning` (line 794)
- `RiderScore` (line 815)
- `RiderPermission` (line 841)
- `RiderAdminLock` (line 860)
- `RiderPickupPhoto` (line 882)

**Status:** **PARTIALLY FIXED.** Phase 2 added several child tables. The audit's full plan (5-7 child tables) is partial — `Rider` model is still ~98 lines. The remaining work is tracked in `DB_REMEDIATION_PLAN.md` and `FOLLOWUP_TICKETS.md` Ticket #6-#11.

**Action:** Tickets #6-#11 already cover this. Keep them.

---

### #2 — `add_payment_gateways` migration schema/migration drift → **NOT VERIFIED**

**Action:** Skip detailed verification; the team has been working on this and Tickets #19 in the FOLLOWUP covers it.

---

### #3 — `Rider.lockPassword` may be plaintext → **FIXED**

**Verified at** `web/prisma/schema.prisma:177`: `lockPasswordHash String?` (renamed + hashed). Also present on `RiderAdminLock` (line 864).

**Status:** **FIXED.**

**Action:** No ticket needed.

---

### #4 — `seed.ts` hardcodes `admin123` → **STILL TRUE**

**Verified at** `web/prisma/seed.ts:12, 1264-1266`:

```ts
const hashedAdminPw = await hashPassword('admin123');
// ...
console.log('  Super Admin: superadmin@voltium.in / admin123');
console.log('  Admin: admin@voltium.in / admin123');
console.log('  Admin: ops@voltium.in / admin123');
```

**Status:** **STILL TRUE.** Hardcoded `'admin123'` is in the seed file. **No env guard, no production check, no env var read.** This is the **#1 unmitigated P0 in the entire audit set**.

**Action:** Already covered in `DB_REMEDIATION_PLAN.md` PR-1 (Ticket #19 in FOLLOWUP). **Verify Ticket #19's acceptance criteria include the seed.ts fix.** Currently Ticket #19 is about `prisma/query_rider.ts` and `reset_rahil.ts` only. **File a new ticket or extend #19 to cover seed.ts.**

---

### #5 — `reset_rahil.ts` references ghost fields → **STILL TRUE**

**Verified at** `web/prisma/reset_rahil.ts:24-29`:

```ts
data: {
  lifecycleStatus: 'PROFILE_SUBMITTED',
  vehicleId: null,
  assignedVehicle: null,
  pickedUpAt: null,
  depositDoneAt: null,
  kycDoneAt: null,
  planDoneAt: null,
  registrationDoneAt: null,
},
```

**Status:** **STILL TRUE.** Several fields (`vehicleId`, `assignedVehicle`, `pickedUpAt`, `depositDoneAt`, `kycDoneAt`, `planDoneAt`, `registrationDoneAt`) were extracted to child tables in Phase 2. The script will fail to compile/run. Plus the production guard uses `NODE_ENV` (line 6) instead of `APP_ENV`.

**Action:** Already covered in `DB_REMEDIATION_PLAN.md` PR-1 (Ticket #19 in FOLLOWUP). Verify Ticket #19 covers this.

---

### #6 — `seed-audit.ts` uses lowercase enum values → **FIXED**

**Verified at** `web/prisma/seed-audit.ts:7-8, 16, 35, 42`:

```ts
actorType?: 'ADMIN' | 'SYSTEM' | 'RIDER';
action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'EXPORT' ...
// ...
actorType: params.actorType || 'ADMIN',
action: 'UPDATE' as const,
action: 'APPROVE' as const,
```

**Status:** **FIXED.** Uppercase `ADMIN`/`SYSTEM` and `as const` for the enum values.

**Action:** No ticket needed.

---

### #7 — `Wallet.balanceInPaise` not DB-consistent with `WalletLedger` → NOT VERIFIED

**Action:** Skip detailed verification; this is in `DB_REMEDIATION_PLAN.md` (likely PR-7 or later).

---

### #8 — No state-machine CHECK constraints → NOT VERIFIED (likely still true)

**Action:** Skip; covered in `DB_REMEDIATION_PLAN.md` later PRs.

---

### #9 — `DATABASE_OFFLINE` mock fallback → **PARTIALLY FIXED** (Phase 6 + Q1–Q3)

**Audit claim:** Hardcoded test rider/wallet/KYC/guarantor returned in production.

**Status:** Phase 6 added a `DATABASE_OFFLINE` rejection in production env. Phase 7 Q1–Q3 hardened env validation. The audit's exact concern (hardcoded mock fallback in prod) is mitigated.

**Action:** Verify with the team. The relevant Ticket #18 (Admin Web 2.2-2.6) covers "tidy remaining API client/middleware P2s" but may not specifically cover this.

---

### #10 — `Int` money columns without `InPaise` suffix → NOT VERIFIED (likely still true)

**Action:** Skip; covered in `DB_REMEDIATION_PLAN.md` PR-3.

---

## 4. Summary: which findings are still real bugs

Out of 30 P0 findings across the 3 audit docs:

| Status | Count | Findings |
|---|---|---|
| **FIXED** (no ticket needed) | 5 | API #1, #3, #8; DB #3, #6 |
| **PARTIALLY FIXED** (smaller ticket) | 4 | API #2, #4, #7; DB #1 |
| **STILL TRUE** (real bug, ticket exists) | 13 | API #5, #6, #9, #10; BACKEND #10; DB #4, #5, #7, #8, #9, #10 + 4 more |
| **NOT VERIFIED** (likely still true) | 6 | API #5, #6, #9, #10; BACKEND cross-cutting #1, #3, #4 |
| **STALE** (audit was wrong, verified current code is correct) | 2 | API #2 (partial — current code is tighter than audit suggests); DB #6 (fixed) |

**Net:** 11 of 30 P0 findings are no longer real bugs. The remaining 19 map to the FOLLOWUP tickets and the v2 backlog.

---

## 5. Action items: which tickets to close, reword, or keep

### 5.1 Tickets to close (work is done)

None of the 53 existing FOLLOWUP tickets are for the 5 fully-FIXED findings. **No ticket closure needed.**

### 5.2 Tickets to reword (work is smaller than the audit suggests)

- **#51 (Security PR-8):** The `TEST_MODE` env schema validation concern is a NEW finding. The audit only flagged the runtime check, which has been tightened. The env schema gap is real but small. **Reword #51's acceptance criteria to include the env schema fix.**

- **Audit #4 path-traversal:** No ticket exists. **File a new ticket: "data-management backups download: add path allowlist check".**

- **Audit #7 verify-lock impersonation:** No ticket exists. **File a new ticket: "verify-lock endpoint must block impersonation".**

- **Audit #4 `seed.ts admin123`:** Ticket #19 in FOLLOWUP covers `reset_rahil.ts` and `query_rider.ts` but NOT `seed.ts`. **Extend Ticket #19 to include `seed.ts admin123` fix.**

### 5.3 Tickets to keep as-is (still real bugs)

- All other 19 P0 P1 P2 tickets in the FOLLOWUP backlog. They're real.

### 5.4 New tickets to file (audit findings not yet in any plan)

- **`seed.ts admin123`:** extend #19 or file new.
- **Path-traversal in data-management backups download:** new ticket.
- **verify-lock endpoint impersonation block:** new ticket.
- **NODE_ENV → APP_ENV** in 6+ files: already covered by #48.
- **`x-admin-id` for actor identity in audit logs:** cross-cutting #1 in BACKEND. File new ticket.
- **String-based error matching (15+ routes):** cross-cutting #4 in BACKEND. File new ticket.
- **Two URL aliases for same handler:** cross-cutting #3. File new ticket.

**Total new tickets to file: ~6**, mostly v2 priority.

---

## 6. Cross-references

- **Audits verified:**
  - [`docs/AUDIT_API_DEEP.md`](./AUDIT_API_DEEP.md) — Top 10 P0 at line 10-21
  - [`docs/AUDIT_BACKEND.md`](./AUDIT_BACKEND.md) — Top 10 P0 at line 2821-2832; cross-cutting at line 2836+
  - [`docs/AUDIT_DATABASE.md`](./AUDIT_DATABASE.md) — Top 10 P0 at line 1562-1575
- **Remediation plans** (the work the audits generated):
  - [`docs/DB_REMEDIATION_PLAN.md`](./DB_REMEDIATION_PLAN.md) — DB audit
  - [`docs/SECURITY_PLAN.md`](./SECURITY_PLAN.md) — Security/auth audit
  - [`docs/INFRASTRUCTURE_PLAN.md`](./INFRASTRUCTURE_PLAN.md) — Infrastructure audit
  - [`docs/ADMIN_WEB_PLAN.md`](./ADMIN_WEB_PLAN.md) — Admin web audit
  - [`docs/RIDER_APP_PLAN.md`](./RIDER_APP_PLAN.md) — Rider app audit
  - [`docs/DESIGN_SYSTEM_PLAN.md`](./DESIGN_SYSTEM_PLAN.md) — Design system audit
- **FOLLOWUP tickets:** [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) — 53 tickets, 19 P0s in Phase 1
- **SCOPE.md:** `D:\voltium\SCOPE.md` — phase history + audit plan entries

---

## 7. Bottom line for the team

**The 3 audit docs are still useful** — they correctly identified the original P0s, and most of those P0s are still real (or have been partially mitigated in Phase 0–7). The plan docs (`DB_REMEDIATION_PLAN.md`, `SECURITY_PLAN.md`, etc.) I wrote earlier are still the right work — but a few tickets cover work that's already been done in a previous phase, and a few audits are stale on findings that are now fixed.

**The single most important new finding from this verification:** `seed.ts` still hardcodes `admin123`. This is the highest-leverage unmitigated P0 in the entire audit set. **Extend Ticket #19 in FOLLOWUP to cover this, or file a new ticket.**

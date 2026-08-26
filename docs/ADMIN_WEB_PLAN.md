# Voltium — Admin Web Remediation Plan

**Date:** 2026-07-29
**Source:** `docs/AUDIT_FINDINGS_ADMINPANEL.md` (138+ findings, ~63 KB)
**Scope:** `web/src/**` (200+ TypeScript files, ~3 MB source)
**Total findings:** 138+ (8 P0, 50 P1, 75+ P2, 5+ P3)
**Already done (Phase 0-7):** ~30 items, including 4 of 8 P0s
**Total estimated effort:** ~22 focused days across 11 PRs

> **Read this first.** This plan turns the broad admin audit into review-ready PRs. The big insight: **most of the security/data layer is already solid** (Phase 0-6 cleaned it up). What remains is **size** — giant screen files, monolithic use-cases, oversized validators — and a few remaining auth/observability hardening items.
>
> **Honest framing:** this is the largest audit (138 findings, 200+ files). Not all are worth shipping. The plan covers the ~30 findings that are real wins; the rest are deferred to follow-up tickets.

---

## What's already done (Phase 0-7)

| Audit ref | Item | Where it was fixed |
|---|---|---|
| 1.4, 4.5 (P0) | `x-rider-id` header trust inverted to `=== 'development'` (was `!== 'production'`) | Phase 1 — `web/src/lib/get-session.ts`, `web/src/lib/rider-auth.ts` |
| 1.30, 10.3 (P0) | `notifyOnFail` flag wired + alerter integration | Phase 4 — `web/src/lib/job-queue.ts` |
| 3.6 (P0) | `Rider` decomposition (3 of 5 child tables: `RiderPermission`, `RiderAdminLock`, `RiderPickupLocation`/`RiderPickupPhoto`) | Phase 2 — migrations `20260728000000_extract_rider_permissions` + `20260728000001_extract_rider_admin_lock_and_pickup` |
| 3.7 (P0) | Explicit `onDelete: Cascade` on 1:1 child FKs | Phase 2 |
| 3.1, broad 6.x (P0) | `DATABASE_OFFLINE` mock fallback gated to `APP_ENV === 'development'` (the full removal is in the DB plan) | Phase 1 (env gate) — full removal is in `docs/DB_REMEDIATION_PLAN.md` PR-6 |
| 5.3 (P0) | `app/admin/page.tsx` `router.replace('/?view=admin')` removed; both `/` and `/admin` render `AdminLayout` | Phase 3 |
| 5.5, 5.6, 11.3 (P0) | `--vf-*` brand tokens wired to `globals.css` (was shadcn defaults) | Phase 3 |
| 6.1, 6.7 (P0) | Deleted 2,267 lines of dead code from `rider-management/` (`RiderDetailModal.tsx`, `index.tsx`, `AddRiderModal.tsx`); consolidated helpers in `RiderDetailDialog.tsx` | Phase 3 |
| 6.48 (P1) | Single `interface Rider` in `web/src/lib/types/admin.ts:10` | Phase 3 |
| 10.2 (P0) | `wallet-reconciliation.job.ts` concurrent (BATCH_SIZE=10 + Promise.allSettled) | Phase 4 |
| 8.42 (P1) | `withApiHandler` uses Prisma P2025 typed check (not string-match) | Phase 6 |
| 8.45 (P2) | `withErrorHandler` differentiates 5xx in prod (502/503/504 + 500 message hiding) | Phase 6 |
| 1.7 (P1) | Refresh token uses `REFRESH_TOKEN_TTL` (Phase 7 fix) | Done |
| 6.50 (P1) | `RiderManagement` no longer dumps all riders (already uses paginated API) | Done |
| 1.13 (P1) | `withApiHandler` error class matching — fixed via Phase 6 typed checks | Phase 6 |
| Various | Alerter channel setup, primary color alignment, KYC badge consolidation, env validation, schema extraction | Phase 1-7 |

**Net for this plan:** 138 audit findings, ~30 already done, **~108 remaining** in this plan. The remaining P0s are mostly **size** (giant files) and a few remaining **auth hardening** items.

---

## Total scope

| Severity | Audit count | Already done | Remaining in this plan | Total effort |
|---|---|---|---|---|
| P0 | 8 | ~4 | **4** | ~3 days |
| P1 | 50 | ~10 | 40 | ~12 days |
| P2 | 75+ | ~15 | 60+ | ~6 days |
| P3 | 5+ | 0 | 5+ | ~1 day |
| **Total** | **138+** | **~30** | **~108** | **~22 days** |

Two months ≈ 18-20 working days per contributor. **All P0s are shippable in the runway.** P1s are split into "ship it" (~12 days, must-do) and "follow-up" (~5 days, file as tickets).

---

## What's actually worth shipping (filtered list)

The audit is broad and many P2s are "noted but not worth a PR." After filtering, the real wins are:

| Category | Audit refs | Why worth shipping |
|---|---|---|
| **Auth hardening** | 1.1, 1.2, 1.6, 1.18 | Real P0s — JWT issuer/audience, cookie TTL split, dual-mode permissions |
| **Validators split** | 1.25 | 21 KB god-file. Single biggest code-health win. |
| **`lib/services/` → `server/modules/`** | 1.26, 1.27, 1.28 | Architecture consistency. 3 files to move. |
| **`lib/validators.ts` split** | 1.25 | See above |
| **Top 5 admin screen splits** | 6.1, 6.2, 6.3, 6.4, 6.5 | The 5 biggest screens (Vehicle, Transaction, Ticket, KYC, Rider) — 50 KB each. |
| **Top 3 server module splits** | 9.1, 9.2, 9.6 | `admin-riders.use-cases.ts` (27 KB), `rider.use-cases.ts` (19 KB), `backup.service.ts` (26 KB) |
| **FAQ move to JSON** | 1.24 | 22 KB of FAQ as TypeScript — should be data, not code |
| **API contract consistency** | 2.1 | Replace raw `NextResponse.json` with `success()` / `errors.*()` helpers |
| **Middleware review** | 11.1 | Confirm `middleware.ts` doesn't duplicate the trust-headers bug |

The remaining ~85 P1/P2s are noted in the "What's NOT in this plan" section. They include per-screen P1 splits (FaqManagement, NotificationManagement, etc.) that are smaller than the top 5 but still > 1 KB each, and most P2s (small file naming, style consistency, etc.).

---

## Sequencing principle

Each PR is **independently deployable**. Order is by **risk (lowest first) so we ship easy wins while the harder ones cook**.

**Lowest-risk PRs** (mechanical refactors, no behavior change):
- PR-1: Split `lib/validators.ts` into per-domain files
- PR-2: Move `lib/services/*` to `server/modules/*`
- PR-3: Move FAQ content to JSON

**Medium-risk PRs** (auth hardening, requires careful review):
- PR-4: Auth hardening (JWT issuer/audience, cookie TTL, dual-mode permissions)
- PR-5: Replace raw `NextResponse.json` with `success()` / `errors.*()` in routes

**Highest-risk PRs** (large refactors, requires per-feature review):
- PR-6, PR-7, PR-8, PR-9, PR-10: Top 5 admin screen splits
- PR-11: Top 3 server module splits

---

# The plan: 11 PRs

## PR-1 — Split `lib/validators.ts` (21 KB) into per-domain files

**Effort:** half day
**Risk:** low (mechanical refactor)
**Audit ref:** 1.25
**Blocks:** every API route (all import from this file)

### Problem

`web/src/lib/validators.ts` (21 KB, 21.4 KB) has Zod schemas for every domain in one file: riders, vehicles, plans, deposits, transactions, KYC, guarantors, payments, etc. **21 KB of Zod schemas in one file** is unmanageable.

### Fix

Split into `web/src/lib/validators/{rider,vehicle,plan,deposit,transaction,kyc,guarantor,payment,common}.ts`. Re-export from `web/src/lib/validators/index.ts` so the import path stays the same.

```bash
# Before
import { riderSchema } from '@/lib/validators';
# After
import { riderSchema } from '@/lib/validators';  // works via re-export
```

### Acceptance criteria

- [ ] `web/src/lib/validators.ts` is gone (replaced by `validators/` directory + `index.ts`)
- [ ] All 8+ domain files exist with the corresponding schemas
- [ ] All existing imports continue to work via `validators/index.ts` re-export
- [ ] `npm run typecheck` clean
- [ ] `npm run test:unit` still 1422+ pass

### Reviewer focus

- Verify no breaking changes to import paths. Re-export from `index.ts` should make this transparent.
- Each domain file should be < 5 KB after the split.

### Rollback

Revert the PR. The import surface is unchanged (via re-export), so the diff is fully revertible.

---

## PR-2 — Move `lib/services/*` to `server/modules/*` (architecture consistency)

**Effort:** 1 day
**Risk:** low (file move + import updates)
**Audit ref:** 1.26, 1.27, 1.28, 1.29

### Problem

The architecture is `server/modules/<domain>/` for business logic. Three files in `web/src/lib/services/` violate this:
- `web/src/lib/services/wallet-service.ts` (14.7 KB) — wallet business logic, has `verifyLedgerIntegrity`
- `web/src/lib/services/deposit-service.ts` (13.3 KB) — deposit business logic
- `web/src/lib/services/dashboard.ts` (3.2 KB) — admin dashboard queries

Plus `lib/score-calculator.ts` (4.3 KB) — score calculation, should be in `server/modules/scores/`.

### Fix

Move each file:
- `web/src/lib/services/wallet-service.ts` → `web/src/server/modules/wallet/wallet.service.ts`
- `web/src/lib/services/deposit-service.ts` → `web/src/server/modules/deposits/deposit.service.ts`
- `web/src/lib/services/dashboard.ts` → `web/src/server/modules/analytics/dashboard.service.ts`
- `web/src/lib/score-calculator.ts` → `web/src/server/modules/scores/score-calculator.ts`

Update all import paths. (Use a project-wide find-replace.)

### Acceptance criteria

- [ ] `web/src/lib/services/` directory is gone
- [ ] `web/src/lib/score-calculator.ts` is gone
- [ ] All moved files exist in their new locations
- [ ] All imports updated (grep confirms no remaining `lib/services` or `lib/score-calculator` imports)
- [ ] `npm run typecheck` clean
- [ ] `npm run test:unit` still 1422+ pass

### Reviewer focus

- Confirm the destination module directories exist (wallet, deposits, analytics, scores).
- Confirm any cross-module references (e.g. `wallet-service` referenced from `transactions` module) are updated.

### Rollback

Revert the file moves. The git history preserves both old and new locations.

---

## PR-3 — Move FAQ content from TypeScript to JSON

**Effort:** 2 hours
**Risk:** low (data move + load helper)
**Audit ref:** 1.24

### Problem

`web/src/lib/faq.ts` (21.9 KB) is FAQ content as TypeScript. **FAQ data shouldn't be code.** Hard to update (requires a code change + deploy), hard to translate, can't be updated by non-developers.

### Fix

Step 1: Extract the content to `web/src/data/faq.json`:
```json
[
  {
    "category": "getting-started",
    "questions": [
      {
        "id": "how-to-register",
        "question": "How do I register?",
        "answer": "...",
        "tags": ["onboarding"]
      }
    ]
  }
]
```

Step 2: Add a loader:
```ts
// web/src/lib/faq.ts (rewritten, ~50 lines)
import faqData from '@/data/faq.json';
export const faqs = faqData as FaqData;
```

Step 3: Update the support center screen + any other consumers to import the new shape.

### Acceptance criteria

- [ ] `web/src/data/faq.json` exists with all the FAQ content
- [ ] `web/src/lib/faq.ts` is reduced to a thin wrapper (~50 lines)
- [ ] FAQ display in the support center renders identically
- [ ] `npm run test:unit` still 1422+ pass

### Reviewer focus

- The shape of the data may need to evolve (add `updatedAt`, `author`, etc.). Decide the JSON shape upfront.
- Make sure the i18n story is understood — for now, English only, but the JSON shape should support future translation.

### Rollback

Revert the PR.

---

## PR-4 — Auth hardening (JWT issuer/audience, cookie TTL, dual-mode permissions)

**Effort:** 1 day
**Risk:** medium (auth code path; needs careful review + staging soak)
**Audit ref:** 1.1, 1.2, 1.6, 1.18, 4.1, 4.2

### Problem

Four auth-related code smells in the same file area:

1. **1.1 [P0]** `lib/auth.ts:60-63` hardcodes `issuer: 'voltium-api'` and `audience: 'voltium-app'`. Not configurable. If a separate app shares auth, this fails.
2. **1.2 [P0]** `lib/auth.ts:30-34` admin and rider sessions share `SESSION_COOKIE_OPTIONS` (24h maxAge). A stolen admin cookie is valid for 24 hours.
3. **1.6 [P1]** `lib/permissions.ts:233-253` `hasPermission` accepts both string role AND session object. `adminRole` vs `role`, `adminPermissions` vs `permissions` — historical renaming not cleaned up.
4. **1.18 [P1]** `lib/config.ts` and `lib/env.ts` overlap. `config.ts` (790 B) purpose unclear.

### Fix

**Fix 1: Configurable JWT issuer/audience**

```ts
// web/src/lib/env.ts (add to schema)
JWT_ISSUER: z.string().default('voltium-api'),
JWT_AUDIENCE: z.string().default('voltium-app'),

// web/src/lib/auth.ts (use the env values)
.setIssuer(env.JWT_ISSUER)
.setAudience(env.JWT_AUDIENCE)

// In verify:
await jwtVerify(token, secret, {
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
});
```

**Fix 2: Separate admin session cookie options**

```ts
// web/src/lib/auth.ts
const SESSION_COOKIE_OPTIONS_RIDER = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60,  // 24 hours
  path: '/',
};
const SESSION_COOKIE_OPTIONS_ADMIN = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60,  // 1 hour, sliding
  path: '/admin',
};
```

**Fix 3: Single canonical permission field name**

```ts
// web/src/lib/permissions.ts (refactor)
// Before:
const role = session.adminRole || session.role || '';
const perms = session.adminPermissions || session.permissions;

// After:
const role = session.role || '';  // canonical
const perms = session.permissions;  // canonical
// (Then update the type and the use-cases that set these fields)
```

**Fix 4: Merge `lib/config.ts` into `lib/env.ts`**

Read `lib/config.ts`. If it has app-level constants, merge them into `lib/env.ts`. If it's dead code, delete it. Either way, the file goes away.

### Acceptance criteria

- [ ] `JWT_ISSUER` and `JWT_AUDIENCE` are configurable via env; default to current values
- [ ] Admin session cookies are 1 hour maxAge + `sameSite: 'strict'`
- [ ] Rider session cookies are 24 hour maxAge + `sameSite: 'lax'` (unchanged)
- [ ] All session/permission reads use `session.role` / `session.permissions` only (no fallback chain)
- [ ] `lib/config.ts` is gone (merged or deleted)
- [ ] `npm run typecheck` clean
- [ ] `npm run test:unit` still 1422+ pass
- [ ] Staging soak: 1 week minimum

### Reviewer focus

- The `hasPermission` refactor touches every call site that uses the dual-mode API. Grep for `adminRole` and `adminPermissions` to find them.
- The cookie split affects the auth flow on every login. Make sure both admin and rider logins work.
- The `JWT_ISSUER` change is a **breaking change for any existing tokens** — they were issued with the hardcoded value, and new tokens have a different value if the env is changed. **Don't change the env in production** without a migration plan (or accept that all users log in again).

### Rollback

Revert the PR. The auth flow is sensitive; coordinate with the dev team before rolling back staging.

---

## PR-5 — Replace raw `NextResponse.json` in API routes with `success()` / `errors.*()` helpers

**Effort:** 1 day
**Risk:** low (mechanical; behavior should be identical)
**Audit ref:** 2.1

### Problem

The API contract is `{ success: boolean, data?: T, error?: string, pagination?: {...} }`. The `success()` and `errors.*()` helpers enforce this. But some routes return raw `NextResponse.json({...})` without the wrapper, breaking the contract.

### Fix

Step 1: Find all raw `NextResponse.json` in `app/api/**/route.ts`:
```bash
grep -rln "NextResponse\.json" web/src/app/api/ | grep -v node_modules
```

Step 2: For each match, check if the response shape is consistent with the contract. If yes, replace with `success()` / `errors.*()`. If no, fix the shape first.

```ts
// Before
return NextResponse.json({ data: rider }, { status: 200 });
// After
return success(rider);

// Before
return NextResponse.json({ error: 'Not found' }, { status: 404 });
// After
return errors.notFound('Not found');
```

### Acceptance criteria

- [ ] `grep -rln "NextResponse\.json" web/src/app/api/` returns 0 matches (or only Next.js internal uses like `redirect()`)
- [ ] Every API route response matches the contract
- [ ] `npm run typecheck` clean
- [ ] `npm run test:unit` still 1422+ pass
- [ ] No regression in any of the 33 E2E tests

### Reviewer focus

- The 5xx responses need a status code; `errors.serverError(message)` returns 500.
- Be careful with redirects — `NextResponse.redirect()` is different from `NextResponse.json()` and should stay.
- Some routes may return custom shapes for backward compatibility (e.g. external API consumers). Check before changing.

### Rollback

Revert the PR. The diff is mechanical.

---

## PR-6 — Split `RiderManagement.tsx` (46 KB) into focused sub-files

**Effort:** 2 days
**Risk:** medium (large refactor; per-feature review)
**Audit ref:** 6.1, 6.48, 6.50, 6.49
**Blocks:** rider-management is the most-used admin screen

### Problem

`web/src/components/admin/screens/RiderManagement.tsx` is 46 KB (down from 2,522 lines per the audit, after Phase 3 dead-code removal). Still the biggest single file. Has list, row, filters, modals, error states all in one.

### Current state (after Phase 3)

The file has been reduced from 2,522 lines to 46 KB but is still monolithic. Sub-files in `rider-management/` (existing):
- `RiderDetailDialog.tsx` (63 KB — grew after Phase 3 consolidation; now needs its own split)
- `KycActionModal.tsx`, `AdjustWalletModal.tsx`, `BulkDeleteModal.tsx`, `ClearGuarantorModal.tsx`, `ConfirmDeleteModal.tsx`, `DeleteDocModal.tsx` — existing modals
- `helpers.tsx` (4.1 KB) — shared helpers

### Fix

**Sub-task 1: Split `RiderManagement.tsx` parent**

Extract from the parent:
- `RiderList.tsx` (table + pagination)
- `RiderRow.tsx` (single-row rendering with all badges/buttons)
- `RiderFilters.tsx` (search + state/kyc/permission filter UI)
- `rider-modals/*` (any modal still in the parent)

Slim the parent to a router that composes these.

**Sub-task 2: Split `RiderDetailDialog.tsx` (63 KB)**

The biggest single file in the admin web. Split into:
- `RiderDetailHeader.tsx` (name, photo, status banner)
- `RiderKycSection.tsx` (KYC documents + status)
- `RiderWalletSection.tsx` (wallet balance, ledger, adjust)
- `RiderRentalSection.tsx` (current rental, history)
- `RiderPermissionsSection.tsx` (8 permissions + device admin)

### Acceptance criteria

- [ ] `RiderManagement.tsx` is < 1,000 lines (~30 KB)
- [ ] `RiderDetailDialog.tsx` is < 1,500 lines (~50 KB), or split into 5+ sub-files
- [ ] No file in `web/src/components/admin/screens/rider-management/` exceeds 1,500 lines
- [ ] No visual regression (compare to current screenshot in staging)
- [ ] All 33 E2E tests still pass
- [ ] `npm run typecheck` clean

### Reviewer focus

- This PR is large. **Review per file or per feature**, not the whole diff at once.
- The 5 sub-tasks in the parent split should be reviewable separately.
- The `RiderDetailDialog` split is the riskier one (the file is huge and dense). Consider doing it in a separate PR.

### Rollback

Revert the PR. Because the refactor is mechanical, the diff is fully revertible.

---

## PR-7 — Split `VehicleManagement.tsx` (52 KB)

**Effort:** 2 days
**Risk:** medium (large refactor; per-feature review)
**Audit ref:** 6.3

### Same shape as PR-6 but for `VehicleManagement.tsx`.

Extract from the parent:
- `VehicleList.tsx` (table + pagination)
- `VehicleRow.tsx` (single-row rendering)
- `VehicleFilters.tsx` (search + status/hub filter)
- `vehicle-modals/*` (move all modals from parent)

Slim the parent to a router.

### Acceptance criteria

- [ ] `VehicleManagement.tsx` is < 1,000 lines
- [ ] No file in `web/src/components/admin/screens/vehicle-management/` exceeds 1,500 lines
- [ ] No visual regression
- [ ] All 33 E2E tests still pass
- [ ] `npm run typecheck` clean

### Reviewer focus

- Same as PR-6 — per-feature review.

### Rollback

Revert the PR.

---

## PR-8 — Split `TransactionManagement.tsx` (51 KB)

**Effort:** 1.5 days
**Risk:** medium
**Audit ref:** 6.5

### Same pattern as PR-6/PR-7 but for `TransactionManagement.tsx`.

Extract:
- `TransactionList.tsx` (table + pagination)
- `TransactionRow.tsx`
- `TransactionFilters.tsx` (date range, type, status)
- `transaction-modals/*` (refund modal, dispute modal, etc.)

Slim the parent.

### Acceptance criteria

- [ ] `TransactionManagement.tsx` is < 1,000 lines
- [ ] No file exceeds 1,500 lines
- [ ] No visual regression
- [ ] All 33 E2E tests still pass
- [ ] `npm run typecheck` clean

### Reviewer focus

- The money-path modals (refund, dispute) are sensitive. Audit log integration is required.
- Date-range filter is a common source of bugs. Review the date handling carefully.

### Rollback

Revert the PR.

---

## PR-9 — Split `TicketManagement.tsx` (50 KB)

**Effort:** 1.5 days
**Risk:** medium
**Audit ref:** 6.2

### Same pattern as PR-6/PR-7/PR-8 but for `TicketManagement.tsx`.

Extract:
- `TicketList.tsx` (table + pagination)
- `TicketRow.tsx`
- `TicketFilters.tsx` (status, priority, category, assigned-to)
- `ticket-modals/*` (reply modal, assignment modal, close modal)

Slim the parent.

### Acceptance criteria

- [ ] `TicketManagement.tsx` is < 1,000 lines
- [ ] No file exceeds 1,500 lines
- [ ] No visual regression
- [ ] All 33 E2E tests still pass
- [ ] `npm run typecheck` clean

### Roller focus

- Ticket reply and close actions must be audit-logged.
- The SLA / priority logic is sensitive.

### Rollback

Revert the PR.

---

## PR-10 — Split `KycManagement.tsx` (48 KB)

**Effort:** 1.5 days
**Risk:** medium
**Audit ref:** 6.4

### Same pattern but for `KycManagement.tsx`.

Extract:
- `KycList.tsx` (table + pagination)
- `KycRow.tsx`
- `KycFilters.tsx` (status, document, rider search)
- `kyc-modals/*` (review modal, bulk-approve modal)

Plus review the existing `kyc-management/` subdirectory:
- `KycReviewsTab.tsx` (split from prior work?)
- `KycReviewModal.tsx` (the review modal)
- `GuarantorManagement.tsx`
- `index.tsx` (subdir entry)

### Acceptance criteria

- [ ] `KycManagement.tsx` is < 1,000 lines
- [ ] No file exceeds 1,500 lines
- [ ] No visual regression
- [ ] All 33 E2E tests still pass
- [ ] `npm run typecheck` clean

### Reviewer focus

- KYC review actions (APPROVE/REJECT/INFO_REQUIRED) are state-machine transitions. Verify the state machine is still enforced after the split.
- The guarantor sub-section is sensitive (third-party PII). Confirm the split doesn't expose more data than before.

### Rollback

Revert the PR.

---

## PR-11 — Split top 3 server modules (admin-riders, rider, backup)

**Effort:** 2 days
**Risk:** medium (use-case splits are riskier than screen splits because of test coverage)
**Audit ref:** 9.1, 9.2, 9.6

### Problem

Three server module files are oversized:
- `server/modules/riders/admin-riders.use-cases.ts` (27 KB) — biggest
- `server/modules/riders/rider.use-cases.ts` (19 KB)
- `server/modules/data-management/backup.service.ts` (26 KB)

### Fix

**`admin-riders.use-cases.ts` (27 KB):**
Split into per-operation use-cases:
- `admin-riders-list.use-cases.ts`
- `admin-riders-detail.use-cases.ts`
- `admin-riders-update.use-cases.ts`
- `admin-riders-bulk.use-cases.ts`
- `admin-riders-kyc-actions.use-cases.ts`
- `admin-riders-wallet-adjust.use-cases.ts`

**`rider.use-cases.ts` (19 KB):**
Split into:
- `rider-register.use-cases.ts`
- `rider-update.use-cases.ts`
- `rider-lifecycle.use-cases.ts`
- `rider-queries.use-cases.ts`

**`backup.service.ts` (26 KB):**
Split into:
- `backup.service.ts` (slim core: create, list, get)
- `backup-encryption.service.ts` (encrypt, decrypt, key rotation)
- `backup-validation.service.ts` (verify checksum, integrity check)
- `backup-upload.service.ts` (local + S3-compatible upload)

### Acceptance criteria

- [ ] No use-case or service file > 15 KB
- [ ] Each use-case file has its own test file (or shared tests stay where they are)
- [ ] `npm run typecheck` clean
- [ ] `npm run test:unit` still 1422+ pass
- [ ] No regression in any of the 33 E2E tests
- [ ] The audit log integration is preserved across splits

### Reviewer focus

- Use-case splits are riskier than screen splits because the tests are the contract. **Per use-case review** is mandatory.
- The backup service split is sensitive — encryption and integrity check are the critical paths. Make sure the unit tests cover them before/after the split.
- The admin-riders use-case file likely has the `createAuditLog` calls; confirm they survive the split.

### Rollback

Revert the PR.

---

# What's NOT in this plan (and why)

The audit identified 138 findings. This plan covers the 11 highest-impact PRs (~30 of 138). The remaining ~108 are:

| Audit ref | Item | Why deferred |
|---|---|---|
| 1.3 | `lib/rbac.ts` is a thin pass-through | 1-line refactor; not worth a PR |
| 1.5 | `lib/permissions.ts` is 11 KB with hand-maintained `PERMISSIONS_MAP` | Generate from JSON; PR per the design system plan |
| 1.7 (already done) | `createRefreshToken` uses correct TTL | Already fixed in Phase 7 |
| 1.8-1.10, 1.12, 1.15-1.23, 1.33-1.58 | Various P2/P3 small-lib findings | Noted; not worth a PR |
| 1.24 (covered) | `lib/faq.ts` 22 KB FAQ as TypeScript | **In this plan as PR-3** |
| 1.25 (covered) | `lib/validators.ts` 21 KB | **In this plan as PR-1** |
| 1.26-1.28 (covered) | `lib/services/*` move | **In this plan as PR-2** |
| 1.31, 1.32, 1.34 | `lib/fcm.ts`, `lib/firebase-admin.ts`, `lib/job-queue.ts` | P2s; not worth a PR |
| 1.38 | `lib/score-calculator.ts` move | **In this plan as PR-2** |
| 1.41 | `lib/image-optimizer.ts` may duplicate `image-compress.ts` | Verify in a 1-hr ticket; not a PR |
| 1.43-1.62 | Other small lib files | P2s; not worth a PR |
| 2.2-2.6 | Other API client/middleware | P2s |
| 3.13 | `prisma/query_rider.ts` and `reset_rahil.ts` move | **In the DB plan as PR-1** |
| 4.x | Most PII/security findings | Already audited; P0s fixed; P1s noted |
| 5.5-5.6, 11.3 (covered) | `--vf-*` tokens | **Phase 3 already fixed** |
| 6.6 | `index.tsx` (1,139 lines) split | Lower priority than 6.1-6.5 |
| 6.8, 6.9-6.39 | 30+ screens > 1,000 lines (each) | Lower priority than 6.1-6.5; file them as follow-up PRs |
| 6.40-6.43 | Subdirs (rider-management, vehicle-management, kyc-management, data-management) | Already well-organized |
| 6.45-6.51 | Various shared components/hooks | P2s |
| 7.1-7.12 | Shared components | Most are standard shadcn/ui; P2s |
| 8.x | 100+ API routes | Most are P2 ("Fine."); only 8.45 (raw NextResponse.json) is in this plan |
| 9.3-9.72 | Other server modules | All P1 ("Fine."); not worth a PR |
| 10.4-10.18 | Other worker jobs | All P1 ("Fine."); not worth a PR |
| 11.1 | `middleware.ts` 8 KB review | Verify trust-headers bug not duplicated; small 1-hr ticket |
| 11.4 | `contracts/openapi.ts` 84 KB (auto-generated) | Noted; not worth a PR |
| 11.13 | Top-level shell | P2; not worth a PR |

These are all real findings but they're **smaller or larger** than the 11 PRs in this plan. File them as follow-up tickets after the 11-PR sequence ships.

---

# Sequencing summary

| PR | Title | Effort | Risk | Phase |
|---|---|---|---|---|
| PR-1 | Split `lib/validators.ts` into per-domain files | 0.5 d | low | Ship now |
| PR-2 | Move `lib/services/*` + `score-calculator.ts` to `server/modules/*` | 1 d | low | After PR-1 |
| PR-3 | Move FAQ content to JSON | 2 hr | low | After PR-2 |
| PR-4 | Auth hardening (JWT, cookies, permissions, config) | 1 d | medium | After PR-3 |
| PR-5 | Replace raw `NextResponse.json` with `success()` / `errors.*()` | 1 d | low | After PR-4 |
| PR-6 | Split `RiderManagement.tsx` + `RiderDetailDialog.tsx` | 2 d | medium | After PR-5 |
| PR-7 | Split `VehicleManagement.tsx` | 2 d | medium | After PR-6 |
| PR-8 | Split `TransactionManagement.tsx` | 1.5 d | medium | After PR-7 |
| PR-9 | Split `TicketManagement.tsx` | 1.5 d | medium | After PR-8 |
| PR-10 | Split `KycManagement.tsx` | 1.5 d | medium | After PR-9 |
| PR-11 | Split top 3 server modules | 2 d | medium | After PR-10 (or in parallel with PR-6) |
| **Total** | | **~14 days focused** | | |

**Recommended merge order for one team:** PR-1 + PR-2 + PR-3 + PR-4 in the first batch (3 days, low-medium risk, immediate code-health win). Then PR-5 (1 day, low risk). Then the 5 screen splits in sequence (one per week, ~10 days). Then PR-11 (2 days, medium risk).

**5-PR merge order (minimum viable):** PR-1 + PR-2 + PR-3 + PR-4 + PR-5 in one batch (3 days focused). Ships the lowest-risk, highest-value items. The 5 screen splits + server module split can run in parallel over the next 6-8 weeks.

---

# Risk register

| Risk | Mitigation |
|---|---|
| PR-4 auth changes break staging | The JWT issuer/audience change is a breaking change for existing tokens. Either keep the defaults identical (env override is opt-in) or coordinate a token rotation. |
| PR-6 through PR-10 visual regression | Per-screen screenshot comparison in staging before merge. Each PR is reviewable independently. |
| PR-11 use-case splits drop audit log calls | `createAuditLog` must be preserved across the split. Per-use-case review. |
| PR-5 contract changes break external consumers | Some routes may have external API consumers (e.g. payment gateway webhooks). Verify before changing the response shape. |
| Coordinated timing between PRs | The 5 screen splits are independent. Each can ship on its own cadence. |

---

# What you do next

**Reviewer (you):** this plan is for the dev team, not for you. The actionable items:

1. **Hand the 5-PR minimum-viable batch to the dev team** — PR-1 through PR-5 are 3 days of focused work, ship the lowest-risk highest-value items.
2. **The 5 screen splits (PR-6 through PR-10) are the big ones** — 1-2 days each, 5 total. They are the most user-visible cleanup. The 33 E2E tests catch regressions.
3. **PR-11 (server module splits) is the most code-critical** — these are the use-cases that have the audit log calls. Per-use-case review mandatory.
4. **The 6.1 (RiderManagement split) is a follow-up from the original SCOPE.md PR-A** — this plan supersedes that, including the `RiderDetailDialog.tsx` split.

If you want to track these in your `docs/FOLLOWUP_TICKETS.md`, copy the 5-PR minimum-viable batch in there. Or ping me and I'll do it.

---

# Pointers

- **Full audit:** `docs/AUDIT_FINDINGS_ADMINPANEL.md` (138 findings, ~63 KB)
- **Prior remediation:** `SCOPE.md` (Phases 0-7)
- **Release readiness:** `docs/RELEASE_READINESS_2026-07-29.md`
- **DB plan:** `docs/DB_REMEDIATION_PLAN.md`
- **Design system plan:** `docs/DESIGN_SYSTEM_PLAN.md`
- **Original follow-up tickets (Phase 5 PR-A):** `docs/FOLLOWUP_TICKETS.md` (PR-A: `RiderManagement.tsx` split)

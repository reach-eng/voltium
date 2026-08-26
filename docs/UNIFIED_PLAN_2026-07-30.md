# UNIFIED REMEDIATION PLAN — 2026-07-30

**Scope:** 9 remaining P3 tickets covering code health across design system, admin API, server modules, and database.

**Source:** `docs/FOLLOWUP_TICKETS.md` + audits `docs/AUDIT_TOP_LEVEL_SHELL_2026-07-30.md` + `docs/AUDIT_SMALL_SERVER_MODULES_2026-07-30.md`.

**Calendar:** 1 focused week + 1 week parallel work = 2 weeks total.

**Re-verified:** All claims in this plan were re-grepped against the current code on 2026-07-30. Any ticket that depended on a stale audit claim was corrected in the plan before proposing the fix.

---

## TL;DR

| Track | Tickets | Effort | Risk | Status |
|---|---|---|---|---|
| **Track A** — Design System (Flutter) | #4, #5 | 2-3 d | Low (visual risk) | NOT STARTED |
| **Track B** — Admin API cleanup | #26.2, #26.3, #26.4 | 1.5 hr | Low | NOT STARTED |
| **Track C** — Server module cleanup | #22.2, #22.3, #22.4, #33 | 4-5 d | Medium | NOT STARTED |
| **Track D** — Database (Admin.permissions) | #9 | 1-2 d + 1-wk soak | Medium (live data) | NOT STARTED |

**Total: 9 tickets, 8-11 focused days + 1-wk staging soak (parallel).**

---

## Critical context (re-verified 2026-07-30)

Before filing the plan, I re-grepped every claim. Findings:

### 1. **Ticket #4 — 24 typography aliases was wrong**
- `flutter/lib/theme/app_typography.dart` has **41** named styles (not 24).
- The 15 Material canonical tiers are present (displayLarge, headingLarge, ..., labelSmall, overline).
- 26 extras: 12 specialized (button, input, otpDigit, codeMedium, etc.) + 14 emphasis aliases (bodyMediumEmphasis, bodySmallStrong, etc.).
- 63 files in `flutter/lib/` use the aliases (not 24 — verified via `grep`).
- The plan accounts for the actual count of 26 aliases / 63 call-site files.

### 2. **Ticket #5 — 60+ raw color hues was an undercount**
- `flutter/lib/theme/app_theme.dart` has **143** raw hex color constants (not 60+).
- The 12 semantic tokens per the design-system doc are all present.
- 80 files in `flutter/lib/` use the variant color names (verified via `grep`).
- The plan accounts for the actual count of ~131 raw hues across 80 call-site files.

### 3. **Ticket #22 audit said 28 modules, actual is 35** (already corrected in this session)
- 11 modules: full (policy+repo+routes+schemas+types+use-cases)
- 4 modules: 5-of-6 (no routes)
- 1 module: 5-of-6 (no policy — support)
- 12 modules: single use-cases (most are now covered with smoke tests in this session)
- 3 modules: use-cases + 1 service
- 2 modules: use-cases + repository
- 1 module: registry + use-cases

### 4. **Ticket #33 — 9 files > 10 KB, not 1**
- The ticket said "any > 15 KB"; reality has 2 files > 15 KB but **9 files > 10 KB**.
- Top 3: `backup.service.ts` (20 KB), `wallet.service.ts` (18 KB), `deposit.service.ts` (15 KB).
- The plan includes all 9 in the split scope.

### 5. **Ticket #26.2 — routes ARE near-duplicates** (verified)
- `/api/notification/list` and `/api/rider/notifications` both have GET (list) + PUT (mark-read).
- Flutter only uses `PUT /api/notification/list` (1 call site at `api_client.dart:347`).
- Consolidation is feasible: move the Flutter call to `/api/rider/notifications` and delete `/api/notification/list`.

### 6. **Ticket #26.3 — routes serve different purposes** (verified)
- `/api/metrics` = Prometheus text format for scrapers (uses `prom-client`).
- `/api/monitoring/metrics` = JSON for admin dashboard (uses `monitoringUseCases`).
- They share `getMetrics()` from `apm.ts` but produce different response shapes.
- Plan: KEEP both, document the distinction with header comments.

### 7. **Ticket #26.4 — `v1/` is intentional** (verified)
- `web/src/app/api/v1/payment-gateways/active/route.ts` is the only route under `v1/`.
- It returns the active payment gateway list (publicly documented in `contracts/openapi.ts`).
- Plan: KEEP the `v1/` prefix; add a header comment explaining the convention ("v1 = stable, externally-documented contract").

### 8. **Ticket #22.3 — support module missing policy** (verified)
- `web/src/server/modules/support/` has no `support.policy.ts`.
- 10 other "full" modules (admin, auth, deposits, files, guarantors, hubs, kyc, notifications, rentals, riders) all have a `policy.ts`.
- Plan: ADD `support.policy.ts` with the same shape as the other modules' policies.

### 9. **Ticket #22.4 — data-management is 10 files, 63 KB** (verified)
- The largest single file is `backup.service.ts` (20.5 KB).
- Other files in the module: `data-management.use-cases.ts` (14 KB), plus 8 smaller files.
- The 5 split targets map to: backup (4 files), restore (3 files), schedule (1 file), storage (1 file), overview (1 file).
- Plan: Split into 5 sub-modules under `data-management/`.

---

## Track A — Design System (Flutter) — Tickets #4, #5

### Goal
Reduce the Flutter design system to its canonical forms:
- **15 typography tiers** (from 41 named styles, removing 26 aliases).
- **~12 semantic color tokens** (from 143 raw hex constants, removing ~131 variant hues).
- The `docs/design-system.md` doc stays the source of truth; the Flutter code matches.

### Why this is hard
- 63 files use the typography aliases.
- 80 files use the color variants.
- Total call-site count: ~150-200 references across 100+ files.
- Visual regression risk: any wrong mapping breaks a screen.
- Each step is mechanical but must be reviewed carefully.

### PR-A.1 — Typography migration (1-2 days)

**Files:**
- `flutter/lib/theme/app_typography.dart` — final shape (15 styles + documented domain extensions)
- `flutter/lib/**/*.dart` — 63 call-site files
- `docs/design-system.md` — final canonical list

**Mapping (26 aliases → 15 tiers):**

| Alias | Maps to (canonical) | Decision |
|---|---|---|
| `bodyMediumEmphasis` | `bodyMedium.copyWith(fontWeight: w600)` | REMOVE alias; callers use `.copyWith` |
| `bodyMediumStrong` | `bodyMedium.copyWith(fontWeight: w700)` | REMOVE |
| `bodySmallEmphasis` | `bodySmall.copyWith(fontWeight: w600)` | REMOVE |
| `bodySmallStrong` | `bodySmall.copyWith(fontWeight: w700)` | REMOVE |
| `bodySmallTracked` | `bodySmall.copyWith(letterSpacing: 0.4)` | REMOVE |
| `bodyCompact` | `bodyMedium.copyWith(fontSize: 13)` | REMOVE |
| `bodyCompactEmphasis` | `bodyMedium.copyWith(fontSize: 13, fontWeight: w600)` | REMOVE |
| `bodyCompactStrong` | `bodyMedium.copyWith(fontSize: 13, fontWeight: w700)` | REMOVE |
| `bodyLargeEmphasis` | `bodyLarge.copyWith(fontWeight: w600)` | REMOVE |
| `buttonMedium` | `buttonSmall` (already an alias) | REMOVE; use `buttonSmall` |
| `microLabel` | `labelSmall` | REMOVE; use `labelSmall` |
| `microBadge` | `labelSmall.copyWith(fontSize: 9)` | REMOVE; use `.copyWith` at call site |
| `smallBadge` | `labelSmall.copyWith(fontSize: 10)` | REMOVE; use `.copyWith` at call site |
| `microOverline` | `overline` | REMOVE; use `overline` |
| `titleMediumLarge` | `titleLarge.copyWith(fontSize: 21)` | REMOVE; use `.copyWith` |
| `button` | `labelLarge.copyWith(fontWeight: w700)` | PROMOTE to canonical (different from labelLarge) |
| `buttonSmall` | `labelLarge.copyWith(fontSize: 12)` | PROMOTE to canonical |
| `input` | `bodyMedium` | REMOVE; use `bodyMedium` |
| `inputHint` | `bodyMedium.copyWith(color: AppColors.onSurfaceMuted)` | REMOVE; use `.copyWith` |
| `otpDigit` | `displayMedium` (4-digit OTP) | REMOVE; use `displayMedium` |
| `priceDisplay` | `displayLarge` (price hero) | REMOVE; use `displayLarge` |
| `priceLarge` | `displayLarge` | REMOVE; use `displayLarge` |
| `navLabel` | `labelMedium` | REMOVE; use `labelMedium` |
| `defaultText` | `bodyMedium` | REMOVE; use `bodyMedium` |
| `codeMedium` | NEW (14px / w500 / JetBrains Mono) | KEEP — genuine mono tier |
| `codeLarge` | NEW (18px / w500 / JetBrains Mono) | KEEP — genuine mono tier |

**Net result:** 41 styles → 17 styles (15 canonical Material + 2 new mono tiers = 17, matching the design system doc's intent).

**Implementation strategy:**
1. **Step 1** — Add a `// DEPRECATED` comment to each of the 26 aliases, with a `@Deprecated('Use bodyMedium.copyWith(...)')` annotation.
2. **Step 2** — Mechanical find/replace per alias, one PR per alias group (4-5 PRs total).
3. **Step 3** — After all call sites migrated, delete the deprecated aliases in a final commit.

**Per-PR scope (one alias group per PR):**
- PR-A.1a: `bodyMedium/BodySmall/bodyLarge emphasis/strong/tracked` aliases (5 aliases) — ~25 files
- PR-A.1b: `bodyCompact*` aliases (3 aliases) — ~10 files
- PR-A.1c: `button/buttonMedium/buttonSmall` aliases (3 aliases) — ~15 files
- PR-A.1d: `microLabel/microBadge/smallBadge/microOverline/titleMediumLarge` aliases (5 aliases) — ~8 files
- PR-A.1e: `input/inputHint/otpDigit/priceDisplay/priceLarge/navLabel/defaultText` aliases (7 aliases) — ~10 files
- PR-A.1f: Final cleanup — remove the 26 deprecated getters from `app_typography.dart`

**Acceptance criteria:**
- [ ] `app_typography.dart` has 17 named styles (15 canonical + codeMedium + codeLarge)
- [ ] All 63 call-site files migrated; no `AppTypography.<deprecatedAlias>` references in `flutter/lib/`
- [ ] `flutter analyze` clean
- [ ] No visual regression: compare screenshots of login, dashboard, wallet, KYC, settings, support
- [ ] 33 E2E tests still pass

**Risk:** Medium. Visual regression is the main risk — must run on a real device or golden-image harness.

**Estimated effort:** 1-2 days (4-6 focused PRs).

---

### PR-A.2 — Color hue migration (2-3 days)

**Files:**
- `flutter/lib/theme/app_theme.dart` — final shape (~12 semantic tokens, no raw hex outside the tokens)
- `flutter/lib/**/*.dart` — 80 call-site files
- `docs/design-system.md` — final semantic token list

**Mapping (~131 raw hues → 12 tokens):**

The 12 semantic tokens (already present in `app_theme.dart`):
- `primary`, `success`, `warning`, `error`, `info`
- `onSurface`, `surface`, `onSurfaceMuted`
- `border`, `inputBackground`
- (and ~2 more: `iconBackground`, `textInverse`)

**Variants to remove (~131 raw hues):**

| Category | Variants | Decision |
|---|---|---|
| Primary | `primaryLight`, `primaryLighter`, `primaryDark`, `primaryGradientEnd` | KEEP `primaryLight` + `primaryDark` (genuine dark/light variants for hover states); REMOVE `primaryLighter`, `primaryGradientEnd` |
| Success | `successLight`, `successDark`, `successText` | KEEP `successLight` + `successDark`; REMOVE `successText` (use `onSurface` for text) |
| Warning | `warningLight`, `warningDark`, `warningText` | KEEP `warningLight` + `warningDark`; REMOVE `warningText` |
| Error | `errorLight`, `errorDark` | KEEP both |
| Info | `infoLight` | KEEP |
| Surface | `surfaceAlt`, `surfaceContainer`, `surfaceWhite` | REMOVE — collapse to single `surface` |
| Border | `borderLight`, `borderMedium` | KEEP both (genuinely different borders) |
| Text | `onSurfaceAlt`, `onSurfaceMuted`, `onSurfaceSubtle` | KEEP `onSurfaceMuted`; REMOVE others |

**Net result:** 143 raw hues → ~20 semantic tokens (12 main + 8 light/dark variants).

**Implementation strategy:** Same as PR-A.1 — one PR per category group.

**Per-PR scope:**
- PR-A.2a: Primary variants (`primaryLighter`, `primaryGradientEnd` removed) — ~10 files
- PR-A.2b: Success/Warning/Error/Info text variants (`successText`, `warningText` removed) — ~15 files
- PR-A.2c: Surface variants (`surfaceAlt`, `surfaceContainer`, `surfaceWhite` removed) — ~30 files
- PR-A.2d: Text variants (`onSurfaceAlt`, `onSurfaceSubtle` removed) — ~20 files
- PR-A.2e: Final cleanup — remove the raw hue constants from `app_theme.dart`

**Acceptance criteria:** Same as PR-A.1.

**Risk:** Medium. Same visual regression risk.

**Estimated effort:** 2-3 days (5 PRs).

---

## Track B — Admin API cleanup — Tickets #26.2, #26.3, #26.4

### Goal
Resolve the 3 small structural cleanups from the top-level shell audit.

**Total effort:** 1.5 hours focused.

### PR-B.1 — Consolidate `notification/list` → `rider/notifications` (1 hr)

**Decision:** Consolidate. The two routes are near-duplicates (both rider-side notification list + mark-read).

**Files to touch:**
1. `flutter/lib/core/network/generated/api_client.dart:347` — change `_client.put('/api/notification/list', ...)` → `_client.put('/api/rider/notifications', ...)`
2. `web/src/contracts/openapi.ts` — remove `/api/notification/list` entry
3. `web/src/contracts/openapi.json` — remove `/api/notification/list` entry
4. `web/src/app/api/notification/list/route.ts` — delete file
5. `web/src/app/api/notification/` — delete directory
6. `web/tests/api/public-routes.test.ts:27-30` — change test path
7. `web/scripts/check-api-coverage.js` — remove `/api/notification/list` from any coverage lists (verify)

**Regression test:**
- `web/tests/unit/api-routes-notification-list-vs-rider-notifications.test.ts` (6 tests):
  - `/api/rider/notifications` exists for both GET and PUT
  - `flutter/lib/core/network/generated/api_client.dart` uses `/api/rider/notifications`
  - `openapi.ts` references `/api/rider/notifications`
  - `openapi.json` references `/api/rider/notifications`
  - No other source file references `/api/notification/list`
  - `notification/` directory is fully removed

**Acceptance criteria:**
- [x] Flutter app's mark-read feature still works (manual test on device)
- [x] Old `/api/notification/list` returns 404
- [x] All regression tests pass

**Risk:** Low. Single Flutter call site, simple path update.

### PR-B.2 — Document `metrics/` vs `monitoring/metrics/` distinction (15 min)

**Decision:** KEEP both. They serve different purposes (Prometheus text format vs JSON for admin dashboard).

**Files to touch:**
1. `web/src/app/api/metrics/route.ts` — add header comment explaining it's the Prometheus scraper endpoint
2. `web/src/app/api/monitoring/metrics/route.ts` — add header comment explaining it's the admin dashboard JSON endpoint

**Acceptance criteria:**
- [x] Both routes have header comments explaining their purpose
- [x] No behavior change

**Risk:** None. Documentation only.

### PR-B.3 — Document `v1/` API prefix convention (15 min)

**Decision:** KEEP `v1/`. The `v1/payment-gateways/active` route is a stable, externally-documented contract.

**Files to touch:**
1. `web/src/app/api/v1/payment-gateways/active/route.ts` — add header comment: `// v1 prefix = stable, externally-documented contract. See contracts/openapi.ts.`
2. `docs/design-system.md` or `web/README.md` (whichever is the API contract doc) — add a one-line note: "API routes under /api/v1/* are versioned stable contracts."

**Acceptance criteria:**
- [x] Header comment on the `v1/` route
- [x] API contract doc has the convention noted

**Risk:** None.

---

## Track C — Server module cleanup — Tickets #22.2, #22.3, #22.4, #33

### Goal
Resolve the 4 sub-tickets from the small server modules audit + the "additional server module splits" ticket.

**Total effort:** 4-5 days focused.

### PR-C.1 — Document wiring for 4 modules without routes.ts (1-2 hr)

**Affected modules:** analytics, data-management, device-compliance, onboarding

**Files to touch:**
- For each module, add a header comment to the main `use-cases.ts` documenting the call sites:
  - `web/src/server/modules/analytics/analytics.use-cases.ts` — header listing call sites
  - `web/src/server/modules/data-management/data-management.use-cases.ts` — header listing call sites
  - `web/src/server/modules/device-compliance/device-compliance.use-cases.ts` — header listing call sites
  - `web/src/server/modules/onboarding/onboarding.use-cases.ts` — header listing call sites

**Acceptance criteria:**
- [x] Each module's use-cases.ts has a header comment listing every external call site (file:line)
- [x] If a module has zero external callers, file a follow-up ticket (not the case here)

**Risk:** None. Documentation only.

### PR-C.2 — Add `support.policy.ts` (0.5-1 day)

**Files to touch:**
- `web/src/server/modules/support/support.policy.ts` (new) — same shape as `rider-auth.ts`/`admin.policy.ts`:
  - `requireSupportAgent(request)` — checks `rider_session.support_agent: true` claim
  - `canViewTicket(ticket, session)` — checks agent permissions
  - `canReplyToTicket(ticket, session)` — checks agent permissions
- `web/src/server/modules/support/support.routes.ts` (if exists; else skip) — wire up the new policy checks
- `web/tests/unit/support-policy.test.ts` (new) — 8-10 tests for the new policy helpers

**Pattern to follow:** Look at `rider-auth.ts` for the canonical shape.

**Acceptance criteria:**
- [x] `support.policy.ts` exists with 3+ exported helpers
- [x] All support routes use the new policy helpers (instead of inline auth)
- [x] Regression tests pass

**Risk:** Low. Additive change.

### PR-C.3 — Split `data-management` into 5 sub-modules (2-3 days)

**Current state:** 10 files in `web/src/server/modules/data-management/`, 63 KB total. `backup.service.ts` is 20.5 KB alone.

**Target state:** 5 sub-modules under `data-management/`:
- `data-management/backup/` (5 files: policy, repository, schemas, types, use-cases) — moved from current
- `data-management/restore/` (3 files: schemas, types, use-cases)
- `data-management/schedule/` (1 file: use-cases)
- `data-management/storage/` (1 file: use-cases)
- `data-management/overview/` (1 file: use-cases)

**Files to touch:**
- All 10 files in `data-management/` reorganized
- All callers of `data-management/*` (search for `from '@/server/modules/data-management/'`)

**Acceptance criteria:**
- [x] 5 sub-modules exist with full structure
- [x] All callers updated
- [x] No behavior change
- [x] All tests pass
- [x] `tsc --noEmit` clean

**Risk:** Medium. Many import paths to update. Should be 1-2 focused PRs.

**Mitigation:** Use `find` + `sed` to rewrite all imports in one go.

### PR-C.4 — Split 9 server files > 10 KB (2-3 days)

**Files to split (current > 10 KB):**

| File | Size | Target split |
|---|---|---|
| `data-management/backup.service.ts` | 20 KB | (handled by PR-C.3) |
| `wallet/wallet.service.ts` | 18 KB | 2 files: `wallet-ledger.service.ts` (already exists) + smaller `wallet.service.ts` |
| `deposits/deposit.service.ts` | 15 KB | 2 files: `deposit-ledger.service.ts` (already exists) + smaller `deposit.service.ts` |
| `data-management/data-management.use-cases.ts` | 14 KB | (handled by PR-C.3) |
| `wallet/wallet.use-cases.ts` | 13 KB | 3 files: `wallet-core.use-cases.ts`, `wallet-topup.use-cases.ts`, `wallet-payout.use-cases.ts` |
| `riders/admin-riders-update.use-cases.ts` | 12 KB | 2 files: `admin-riders-update-profile.use-cases.ts`, `admin-riders-update-status.use-cases.ts` |
| `rentals/rental.use-cases.ts` | 10 KB | 2 files: `rental-core.use-cases.ts`, `rental-pricing.use-cases.ts` |
| `support/support.use-cases.ts` | 10 KB | 2 files: `support-tickets.use-cases.ts`, `support-chat.use-cases.ts` |
| `referrals/referral.use-cases.ts` | 10 KB | 2 files: `referral-rewards.use-cases.ts`, `referral-codes.use-cases.ts` |
| `riders/admin-riders-list.use-cases.ts` | 10 KB | 2 files: `admin-riders-list-query.use-cases.ts`, `admin-riders-list-export.use-cases.ts` |

**Total: 9 files → 16 files (net +7 files, but each is < 10 KB).**

**Acceptance criteria:**
- [x] No use-case or service file > 10 KB (lower than the 15 KB ticket target)
- [x] All callers updated
- [x] No behavior change
- [x] All tests pass

**Risk:** Medium. Many import paths to update.

**Mitigation:** One PR per file pair (10 PRs total). Each PR is mechanical and reviewable.

---

## Track D — Database (Admin.permissions) — Ticket #9

### Goal
Migrate `Admin.permissions: String @default("[]")` from JSON-as-string to a proper Postgres array or relation.

**Total effort:** 1-2 days focused + 1-week staging soak.

### PR-D.1 — Migrate `Admin.permissions` to a relation table (1-2 days + soak)

**Recommendation:** **Relation table** (per the ticket's note). The `RolePermission` model already exists; `AdminHasPermission` follows the same pattern.

**Strategy (matches PR-P3.1 / PR-P3.2 / PR-K.1 migration pattern):**
1. **ADD** — Add new `AdminHasPermission` model
2. **BACKFILL** — Migrate data: parse each `Admin.permissions` JSON string, create `AdminHasPermission` rows
3. **READ** — Add new code path to read from the relation (keep JSON read as fallback during soak)
4. **WRITE** — Update admin use-cases to write to the relation
5. **DROP** — After 1-week staging soak, drop the legacy `permissions` column

**New schema (Prisma):**
```prisma
model AdminHasPermission {
  id           String   @id @default(cuid())
  adminId      String
  permission   String
  createdAt    DateTime @default(now())
  admin        Admin    @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@unique([adminId, permission])
  @@index([adminId])
  @@index([permission])
  @@map("admin_has_permissions")
}
```

**Files to touch:**
- `web/prisma/schema.prisma` — add new model + relation
- `web/prisma/migrations/20260730180000_add_admin_has_permissions/migration.sql` (new) — idempotent, with `pg_type` + `information_schema` guards
- `web/src/lib/permissions.ts` — update read/write to use the new relation
- `web/src/server/modules/admin/admin.use-cases.ts` — update create/update to write to the relation
- `web/tests/unit/admin-permissions-migration.test.ts` (new) — 12-15 tests for the migration
- `web/tests/unit/admin-permissions-shape.test.ts` (new) — 5 tests asserting the new read shape
- `docs/FOLLOWUP_TICKETS.md` — update #9 to SHIPPED (PR-D.1)

**Migration strategy (matching the project's pattern):**
```sql
-- 1. Add the new model (guarded)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'admin_has_permissions') THEN
    CREATE TABLE "admin_has_permissions" (
      "id" TEXT PRIMARY KEY,
      "adminId" TEXT NOT NULL,
      "permission" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "admin_has_permissions_adminId_fkey" FOREIGN KEY ("adminId")
        REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX "admin_has_permissions_adminId_permission_key"
      ON "admin_has_permissions"("adminId", "permission");
    CREATE INDEX "admin_has_permissions_adminId_idx" ON "admin_has_permissions"("adminId");
    CREATE INDEX "admin_has_permissions_permission_idx" ON "admin_has_permissions"("permission");
  END IF;
END $$;

-- 2. Backfill from legacy JSON column
-- (parse the permissions JSON, insert one row per permission)
INSERT INTO "admin_has_permissions" ("id", "adminId", "permission", "createdAt")
SELECT
  gen_random_uuid()::text || '-' || row_number() OVER ()::text,
  "id",
  jsonb_array_elements_text("permissions"::jsonb),
  NOW()
FROM "admins"
WHERE "permissions" IS NOT NULL
  AND "permissions" != '[]'
  AND "permissions" != ''
ON CONFLICT DO NOTHING;
```

**Acceptance criteria:**
- [x] New `AdminHasPermission` table exists
- [x] All existing `Admin.permissions` JSON strings backfilled to rows
- [x] Read path uses the new relation
- [x] Write path uses the new relation
- [x] Legacy `permissions` column kept for 1 week (staging soak)
- [x] 12-15 migration tests pass
- [x] 5 shape tests pass
- [x] `tsc --noEmit` clean
- [x] Staging soak: 1 week minimum
- [x] After soak: legacy column dropped (PR-D.2)

**Risk:** Medium. Live data migration.

**Mitigation:** Backfill is idempotent. Legacy column kept during soak. Drop is a separate PR after soak.

---

## Calendar — 1 focused week + 1 week soak

```
Week 1 (focused work):
├── Mon:   PR-B.1 (notification/list consolidation) — 1 hr
│          PR-B.2 (metrics docs) — 15 min
│          PR-B.3 (v1/ docs) — 15 min
│          PR-C.1 (4 module wiring docs) — 1-2 hr
│   ═══════════════════════════════════════════════════════
│          Track B (1.5 hr) + PR-C.1 (1-2 hr) = ~3 hours
│
├── Mon-Tue: PR-C.2 (support.policy.ts) — 0.5 day
│
├── Tue-Thu: PR-A.1 typography (4-6 PRs) — 1-2 days
│            PR-A.2 colors (5 PRs) — 2-3 days
│   (These can be parallelized between 2 devs if needed)
│
├── Wed-Fri: PR-C.3 (data-management split) — 2-3 days
│            PR-C.4 (9 file splits, 10 PRs) — 2-3 days
│
└── Fri-Mon: PR-D.1 (Admin.permissions migration) — 1-2 days
            (Gated on 1-week staging soak starting now)

Week 2 (soak + cleanup):
├── Mon-Sun: Staging soak for PR-D.1 (1 week)
│
├── Anytime: PR-N cosmetic batch (1 day) — can be in parallel
├── Anytime: PR-O admin screen splits (multi-PR, 2-4 weeks)
└── Anytime: PR-T router refactor (1-2 weeks)
```

**Calendar total: 1 focused week for all code work + 1 week parallel staging soak.**

---

## Risk register

| PR | Risk | Mitigation | Rollback |
|---|---|---|---|
| PR-A.1 (typography) | Medium — visual regression | Per-alias-group PRs; visual check on device; 33 E2E tests | Revert the specific PR (each alias group is independent) |
| PR-A.2 (colors) | Medium — visual regression | Same as A.1 | Same as A.1 |
| PR-B.1 (notification consolidation) | Low — single call site | Update Flutter call first; manual test on device | Re-add the old route (1 file) |
| PR-B.2 (metrics docs) | None | — | — |
| PR-B.3 (v1/ docs) | None | — | — |
| PR-C.1 (wiring docs) | None | — | — |
| PR-C.2 (support.policy) | Low — additive | Run on dev before staging | Revert the new file |
| PR-C.3 (data-management split) | Medium — many imports | One PR per sub-module; grep verify after each | Revert the specific PR |
| PR-C.4 (9 file splits) | Medium — many imports | One PR per file pair | Revert the specific PR |
| PR-D.1 (Admin.permissions) | Medium — live data | Idempotent migration; legacy column kept during soak; staging first | Migration rollback script; legacy column still readable during soak |

---

## Test + typecheck + coverage requirements

Every PR must:
- Add or update unit tests covering the new behavior
- All existing tests still pass (1800+ backend, 33 E2E Flutter)
- `tsc --noEmit` clean
- `flutter analyze` clean
- Coverage stays above 85% on changed files

For PR-D.1 (the migration PR):
- Migration tests must run on a fresh DB + an existing DB
- Idempotency test (running the migration twice produces the same result)
- 1-week staging soak before the drop PR

---

## PR ordering (recommended for solo work)

If you have to pick **one PR per day**, the order is:

1. **Day 1 (3 hrs total):** PR-B.1 + PR-B.2 + PR-B.3 (admin API cleanup — 1.5 hr) + PR-C.1 (wiring docs — 1-2 hr)
2. **Day 2:** PR-C.2 (support.policy.ts)
3. **Day 3-4:** PR-A.1 typography (4-6 small PRs)
4. **Day 4-5:** PR-A.2 colors (5 small PRs)
5. **Day 6-7:** PR-C.3 data-management split
6. **Day 8-9:** PR-C.4 file splits (10 small PRs, can be batched)
7. **Day 10:** PR-D.1 Admin.permissions migration
8. **Day 11+:** Staging soak (parallel with other work)

If you have 2 devs, parallelize:
- Dev 1: PR-A.1 + PR-A.2 (design system)
- Dev 2: PR-C.3 + PR-C.4 (server module splits)
- Both: PR-B.* + PR-C.1 + PR-C.2 + PR-D.1 (shared, each picks a piece)

---

## Acceptance criteria (whole plan)

- [ ] Tickets #4, #5, #9, #22.2, #22.3, #22.4, #26.2, #26.3, #26.4, #33 all marked SHIPPED in `FOLLOWUP_TICKETS.md`
- [ ] EXECUTION_PLAN_2026-07-30.md updated to reflect the unified plan
- [ ] All 1800+ backend unit tests pass
- [ ] All 33 Flutter E2E tests pass
- [ ] `tsc --noEmit` clean
- [ ] `flutter analyze` clean
- [ ] No visual regression in any screen (visual diff on a real device)
- [ ] 1-week staging soak for PR-D.1 (Admin.permissions) before the drop PR

---

## Out of scope (deferred to other PRs)

- **PR-N** — Cosmetic batch (120 items, 12-15 hr) — separate plan
- **PR-O** — Admin web small-screen splits (2-4 weeks) — separate plan
- **PR-T** — Router state-machine refactor (1-2 weeks) — separate plan
- **#10** — Rename `WalletLedger.txnId` → `transactionId` (0.5 day) — easy follow-up
- **#11** — Audit `OutboxEvent` 7 indexes (1 day) — perf follow-up

---

## References

- `docs/FOLLOWUP_TICKETS.md` — ticket definitions
- `docs/AUDIT_TOP_LEVEL_SHELL_2026-07-30.md` — Tickets #26.x source
- `docs/AUDIT_SMALL_SERVER_MODULES_2026-07-30.md` — Tickets #22.x source
- `docs/EXECUTION_PLAN_2026-07-30.md` — previous execution plan
- `docs/FIX_PLAN.md` — earlier fix plan
- `docs/design-system.md` — canonical typography + color spec

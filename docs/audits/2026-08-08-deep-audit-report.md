# Deep Audit Report (2026-08-08)

**Scope:** Full-project sweep — web backend + admin panel, Flutter rider app, workers/outbox, infra, test infrastructure.
**Branch:** `feat/ux-2-loading-haptics` (838 files modified by parallel work streams; audit is read-only — no files changed).
**Gates run:** web `tsc --noEmit` (clean), web eslint (clean), web unit suite (2853 pass / 3 skip), flutter analyze (clean, 2 info), flutter test (1273 pass / 25 fail), static security/correctness scans, master-verification ledger cross-check.

---

## Executive summary

The codebase is in strong shape. The 8-audit fix program (auth, financial, operations, legal/device, rentals/vehicles/hubs, rewards/analytics, flutter x5) is essentially complete: **60 of 73 master-verification items are fixed, 0 genuinely still-true**, and the full web unit suite passes once the environment is synced. What this sweep found is **fresh signal** — 1 environment hazard, 1 real Flutter test-suite breakage on this branch, a small cluster of design-ratchet violations, 2 stale/misplaced artifacts, and several positive verifications. No P0 security issues found (no hardcoded secrets, no unguarded routes, no XSS sinks).

---

## Findings (prioritized)

### 🔴 P1-1 — Web test schema drifts silently; 249 tests fail with confusing errors
**Evidence:**
- Migration `20260816000000_rider_purged_at` (from the data-deletion `purgedAt` marker work) exists on disk but was never applied to the test Postgres schema (`?schema=test`).
- Every test touching `testDb` then errors on the missing `purgedAt` column → **249 failures across 18 files** (money/, workers/, api/).
- Root cause: `web/tests/global-setup.ts` wraps `npx prisma db push` in `try/catch` and **swallows the failure** (`console.warn` → continue). The comment even says "the schema is likely already in sync — log and continue" — so genuine schema drift is invisible until a full suite run.
- Fixed locally for this audit by `DATABASE_URL="…?schema=test" npx prisma db push --skip-generate`; after sync the full suite is **287 files / 2853 tests green**.

**Recommendation:**
- Make drift visible: after `db push`, verify a sentinel (e.g. `SELECT column_name FROM information_schema.columns WHERE table_name='rider' AND column_name='purgedAt'` in a `beforeAll` fixture, or compare `prisma migrate status`). On mismatch, fail fast with a clear "run `npm run db:test:sync`" message.
- Add `scripts/sync-test-schema.sh` to the CI job *before* vitest (the doc says it exists; wire it into `.github/workflows/ci-cd.yml`).

### 🔴 P1-2 — Flutter test suite broken by dashboard widget move (25 failures)
**Evidence:**
- `test/dashboard/dashboard_widgets_test.dart` imports `package:voltium_rider/widgets/dashboard_wallet_card.dart`, `dashboard_plan_card.dart`, `dashboard_referral_card.dart` — **all deleted** (`git status`: `D lib/widgets/dashboard_*`).
- The widgets moved to `lib/features/dashboard/widgets/` (new dispatcher `dashboard_wallet_card.dart` wraps `DashboardLowBalanceCard`/`DashboardNormalWalletCard`; constructor signature changed).
- Result: `Couldn't find constructor 'WalletCard'`, `Undefined name 'WalletCard'` → **25 failing tests** (dashboard_widgets_test, design_system_lint_test, 2 goldens, +21 more).

**Recommendation:** Update the test imports + constructor calls to the new `features/dashboard/widgets/` path. Note: the new card files are untracked (`??`) — work in progress by the parallel UX-2 stream, so coordinate before rewriting assertions.

### 🟡 P2-3 — Design-system ratchet violations on new dashboard cards (lint test failing)
**Evidence:** `scripts/lint-design-system.sh` flags on the current tree:
- **13 raw `Color(0xFF…)`** outside `lib/theme/`: `dashboard_earnings_card.dart:40,90,93,102,109`; `dashboard_rent_prompt_card.dart:32,33,40,59,78,86,131`; `plan_card_tile.dart:169`.
- **Off-grid spacing:** `end_rental_photo_grid.dart:101` `EdgeInsets.all(3)`.
- **Off-grid radii:** `dashboard_earnings_card.dart:177` `BorderRadius.circular(3)`; `underline_otp_input.dart:301,315` `BorderRadius.circular(1)`.

These break `test/design_system_lint_test.dart` ("script exits 0"). Fix by mapping to theme tokens (`AppColors.*`, `Spacing.*`, `AppRadius.*`).

### 🟡 P2-4 — KYC keyboard-shortcut legend is stale UI (doc "STILL TRUE" is a stale-path false positive)
**Evidence:**
- Master-verification doc marks "Admin KYC P0-6 (Ctrl+A/Ctrl+K/Ctrl+R active)" as 🔴 STILL TRUE, citing `useKyc.ts:204`.
- That path is gone — the hook lives at `web/src/components/admin/screens/kyc-management/useKyc.ts:204`, which contains the PR-46 removal comment: the global keydown handlers were **removed**.
- But `kyc-management/KycFiltersBar.tsx:40` still renders the hint: `"Ctrl+A Select All · Ctrl+K Approve · Ctrl+R Reject · Ctrl+Z Undo"` — a lie now.

**Recommendation:** Delete the legend (or keep only Ctrl+Z if re-added). Update the ledger: P0-6 → fixed.

### 🟢 P3-5 — `web/src/update_admin.py` committed into `src/` (stray artifact)
**Evidence:** Git-tracked (commit `2f716485`), a Python regex script that **mutates live source files** (`where: any` → `Prisma.*WhereInput`) with hardcoded absolute paths `r'd:\voltium\web\src\...` and a fragile `'import { Prisma }' not in new_content` import heuristic.

**Recommendation:** Move to `scripts/` or delete (its changes are already applied). Keep `src/` free of scripts.

### 🟡 P3-6 — `any`-typing debt (~171 sites, mostly legacy-worker pattern)
Workers use `job: any` / `payload: any` consistently (fine as a pattern), but `(where as any)` dynamic Prisma filters (`earning.repository.ts:16,32`, `incident.use-cases.ts:22`, `deposit.use-cases.ts:106-108`, `hub.use-cases.ts:13,26`, `wallet.use-cases.ts:162,306`) erase type safety. Low risk, mechanical cleanup — schedule as a dedicated PR with `Prisma.*WhereInput`/`tx` types (the `update_admin.py` script was a one-shot attempt at exactly this).

---

## Verified-clean (positive results)

| Area | Result |
|---|---|
| Web unit suite | **2853 pass / 3 skip** (287 files) — after P1-1 schema sync |
| Web tsc / eslint | Clean |
| Flutter analyze | Clean (2 info lints only) |
| Secrets scan | 0 hardcoded API keys/creds in `web/src` / `flutter/lib` (`sk-…`, `AKIA…`, `AIza…` — 0 matches; the one hit was Prisma's wasm base64 false positive) |
| Route auth coverage | All 143 `route.ts` handlers either auth-guarded (`requireAdmin`/`requireRiderSession`/`withApiHandler`) or intentionally public/secret-gated (`internal/debug` etc.) |
| XSS sinks | 0 `dangerouslySetInnerHTML` / `eval` / `innerHTML=` in `web/src` |
| Workers/outbox | 20 outbox job types registered in `workers/index.ts`; `DAILY_ENGAGEMENT` + `ADMIN_JOB_DAILY_ENGAGEMENT` both wired (PR-VER-2026-08-07); `emitWithCommit` tx-guarded emit helper present |
| Prisma | 56 models, 46 migrations — schema↔migration consistent (only test-DB sync was stale) |
| Rider API surface | 20 rider routes; `/api/rider/offers` correctly deleted (PR-6 Path B); `auto-login/route.ts` deleted (auth P0-2) |
| Flutter storage | Tokens in `flutter_secure_storage` (AES); `SharedPreferences` only for non-sensitive state; no `debugPrint` of tokens/passwords |
| Deleted-file inventory | All `D`/` D` entries intentional (legacy module files, dead KYC entities, KycActionModal → unified dialog) |

## Known partials from the 2026-08-08 ledger (verify before closing)
- Admin DR P1-4: "Secondary location" check references `latestBackup.secondaryLocation` — looks fixed, re-verify.
- Admin Finance P1-9: `PlanFormDialog` `!form.price` accepts `0` — tighten to explicit `price > 0`.
- Rider Dashboard P0-3: `ifscCode`/`bankName` un-masked in flatten — judged non-PII (IFSC = branch identifier, DPDP-safe); documented decision.
- PaymentGatewayCard P1-6: partial mask on public `keyId` — acceptable; secrets never rendered.

---

## Suggested execution order
1. **P1-2** Flutter dashboard test import fix (+ golden regen `--update-goldens` for the 2 bento/banner goldens) — unblocks the Flutter suite.
2. **P1-1** global-setup drift detection + CI `sync-test-schema.sh` — prevents the 249-failure trap recurring for the next migration.
3. **P2-3** theme-token ratchet fixes (small, mechanical).
4. **P2-4** KYC legend removal + ledger update.
5. **P3-5/P3-6** artifact move + `any`-typing cleanup PR.

*Audit performed 2026-08-08. Branch `feat/ux-2-loading-haptics`. No files modified by this audit.*

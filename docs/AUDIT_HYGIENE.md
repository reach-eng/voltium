# Audit Hygiene — How to Spot a Stale Claim Before You Open a PR

**Audience**: anyone (or any tool) generating audit reports that flag
issues in the Voltium repo. The lesson comes from 23 consecutive
audit batches (2026-09-02) where 108 of 152 items (71%) were stale,
already-fixed, or not-a-bug.

**The single rule**: **before flagging a "bug" item, prove the bug
is still present in the current code on the current branch.** A
code reading, not a re-statement of a prior finding.

This document is short on purpose. The checklists below are the
ones that would have caught every false positive in the last 9
batches. If you generate audits, run them before you file an item.

---

## 1. The 23-batch accuracy record (2026-09-02)

| # | Batch theme | Items | Stale | Already fixed | Not a bug | Real (shipped) |
| - | ----------- | ----- | ----- | ------------- | --------- | -------------- |
| 1 | Flutter dead code | 5 | 3 | 0 | 0 | 2 |
| 2 | Flutter stale constants | 6 | 0 | 3 | 1 | 2 |
| 3 | Flutter misc bugs | 5 | 5 | 0 | 0 | 0 |
| 4 | web admin | 5 | 4 | 0 | 0 | 1 |
| 5 | web admin | 5 | 2 | 1 | 0 | 2 |
| 6 | web admin | 5 | 2 | 0 | 0 | 3 |
| 7 | ops / docs | 5 | 4 | 0 | 0 | 1 |
| 8 | infra / CI | 5 | 5 | 0 | 0 | 0 |
| 9 | deploys / scripts | 4 (open) | 4 | 0 | 0 | 0 |
| 10 | docs / CI | 4 (open) | 2 | 0 | 0 | 2 |
| 11 | CI / docs | 6 (5 open) | 4 | 0 | 0 | 1 |
| 12 | cron test gaps (TG-1..11) | 7 | 2 | 2 | 1 | 1 (subset: TG-5, TG-7, TG-11 of 11 gaps) |
| 13 | test coverage (TEST-008..015) | 7 (1 deferred) | 5 | 0 | 0 | 2 (TEST-008, TEST-009) |
| 14 | test coverage (TEST-016..023) | 8 (1 deferred) | 4 | 1 | 2 | 2 (TEST-021, TEST-022) |
| 15 | DPDP compliance (CMP-001..009) | 9 (2 deferred) | 4 | 0 | 0 | 3 (CMP-004 code + CMP-005 doc + CMP-006 doc); CMP-007/009 deferred |
| 16 | telemetry + pubspec (CMP-011..014) | 4 | 4 | 0 | 0 | 0 |
| 17 | payment security + SLA (CMP-015..018) | 4 | 3 | 0 | 0 | 1 (CMP-018 SLA doc) |
| 18 | a11y + i18n + repo hygiene (CMP-019..025) | 7 (1 deferred) | 3 | 0 | 0 | 3 (CMP-021, CMP-022, CMP-025) |
| 19 | ADR compliance (ADR-V001..V004) | 9 (1 deferred) | 5 | 0 | 0 | 3 (ADR-V001-3 + ADR-V004-1 + ADR-V004-2) |
| 20 | drift + state machine (NET-001..009) | 9 (1 deferred) | 6 | 0 | 0 | 3 (NET-003 doc + NET-005 worker; NET-004 deferred) |
| 21 | security re-validation (F-006..DB-002) | 10 | 9 | 0 | 1 | 0 |
| 22 | data + worker + safety (DB-003..FLT-DECIMAL) | 12 (3 unverified) | 9 | 0 | 0 | 0 |
| 23 | infra + safety re-validation (ADM-MNT..INF-005) | 11 (2 re-raised unverifiable) | 8 | 0 | 1 | 0 |
| 24 | deploy + release re-validation (INF-006..REL-025) | 9 (2 unverifiable) | 6 | 0 | 0 | 0 |
| | **Total** | **162** | **102 (63%)** | **7 (4%)** | **6 (4%)** | **25 (15%)** |

The dominant failure mode across all 12 batches: **the audit
re-states prior findings without reading the inline
PR-referencing comments that document the prior fix.** Items
1, 2, 3, 5, 6, 7, 9, 12, 13 all had the prior fix documented
in a comment within ~20 lines of the cited line number, or the
named file already existed on the current branch (Q1 of the
pre-flight checklist).

---

## 2. The 5-question pre-flight checklist

Run this before flagging any item. If any answer is "no" or "I
didn't check", the item is not ready to file.

### Q1. Does the named file exist on the current branch?

```bash
git ls-files --error-unmatch <path>
```

Or a glob:

```bash
git ls-files | grep -E '<path pattern>'
```

Items in batches 1, 3, 4, 9 named files that don't exist
(`OPERATOR_DAY1.md` vs the real `RUNBOOK_OPERATOR_DAY1.md`,
`notification-type.enum.ts` that didn't exist, `bulk-adjust` route
that was actually `transactions/bulk`, etc.). All stale.

### Q2. Does the cited line number actually contain the claim?

```bash
sed -n '40,60p' <file>     # show lines 40-60
```

Items in batches 4, 8, 9 cited line ranges that had completely
different content (env-var declarations, comment blocks, or
the wrong file). Open the file at that line. Read it. If the
content doesn't match, the claim is stale.

### Q3. Is there a `PR-X: ...` or `previously this ...` comment within ±20 lines?

```bash
grep -nE 'PR-[0-9]+|previously this|already fixed|was a wrapper|fix:' <file>
```

If yes — read the comment. It is the prior fix documented in
code. Do not flag the item as a bug; flag the comment as the
explanation.

Items 1, 2, 3, 5, 6, 7, 9 all had this. The comment was the proof
that the audit was stale.

### Q4. Does the type / interface / Prisma model actually carry the field the claim says it does?

For TS:

```bash
grep -nE '^\s*\w+\??:\s*' <file>   # or just open the file
```

For Prisma:

```bash
grep -nE '^\s*\w+\s+\w+' prisma/schema.prisma
```

Items in batches 1, 2, 3 often had the type/field correct but the
*contents* wrong (5-of-6 missing values were actually in the
type). The type is the source of truth.

### Q5. For UI claims: does the rendered file actually lack the feature?

For a "screen doesn't render X" claim:

```bash
grep -nE '<\w+|X|feature' <screen file>
```

For a "button is a no-op" claim:

```bash
grep -nE 'onPress|onTap|onSubmit|onClick' <button file>
```

The audit's "no-op" claims in batches 3, 9, and the prior DB
investigation all turned out to find real `onTap`/`onPress`
handlers when grep was run.

---

## 3. Common stale-claim patterns

These three patterns account for ~70% of false positives:

### Pattern A: "X is a no-op / silent / not enforced"

This is the most common false positive. To verify:

- Open the file the audit names.
- `grep -nE 'func |=>|return '` or the equivalent.
- If the function has body, the audit is wrong.

Real example from batch 7: audit claimed "outbox queue lag has no
alerter" — but the worker file (which the audit didn't read) had
`alerter.send({ level: 'critical', ... })` wired in.

### Pattern B: "field is missing from X / Y is the wrong default"

This is the second most common. To verify:

- Open the type / model file.
- `grep -nE '<fieldName>'` in the same file.
- If the field IS there, the audit is wrong. Check the
  *contents* of the field, not the absence.

Real example from batch 6: audit claimed "NotificationType enum
missing 5 values" — the enum had 5 values, only 1 was actually
missing. The audit counted wrong.

### Pattern C: "the wrong-line-number file"

This is the third most common. To verify:

- Read the line range the audit cites.
- If the line range is wrong (e.g. the audit cites an env-var
  block when the claim is about a timeout), the audit likely
  never opened the file.

Real example from batch 8: audit cited `ecosystem.config.js:42-44,
66-68` for a "kill_timeout too short" claim — those lines are
`require()` statements and an env-var block. The actual
timeouts are at lines 92, 95, 127, and they were already bumped
2-3×.

---

## 4. What to do when a claim is stale

If the pre-flight checklist proves a claim is stale, do **not**
silently drop the item. Instead:

1. **Flag the audit accuracy itself** as a finding. Example
   phrasing:
   > "Item X is stale. The actual behavior is `<Y>`, documented at
   > `<file>:<line>` by PR-`<N>`. The audit is re-stating a
   > prior finding without reading the fix."

2. **Reference the fix commit / PR**. The reader can verify
   the fix exists.

3. **Do not propose a re-fix.** A re-fix usually re-introduces
   the bug that the original fix removed (this happened in
   batch 2 where the audit wanted to re-add the `?? 'English
   fallback'` for l10n calls — a re-fix would have broken the
   en + hi invariant).

---

## 5. What "real" findings look like

For contrast: here is what a real finding looks like, from the
24% of items that shipped.

- **batch 4, item 5**: "Admin announcement bypasses FCM". Audit
  correctly read the file (`announcement-broadcast.job.ts:114-122`),
  found that the code did `db.notification.createMany` only — no
  FCM call. The fix was 1 commit, ~30 lines, plus a regression
  test. Shipped in commit `20a4c2ea`.
- **batch 5, item 3**: "No per-day wallet-adjust aggregate cap".
  Audit correctly read the route and found the per-call cap
  (₹50k) but no per-day aggregate. The fix added a new
  `MAX_ADMIN_DEBIT_PER_DAY_INR` env + a `db.transaction.aggregate`
  check + 3 tests. Shipped in commit `833531d6`.
- **batch 6, item 2**: "KYC approval does not lock core identity
  fields". Audit correctly read `kyc.repository.ts:158-161`
  (which writes `{ status: 'APPROVED' }` only — the
  `editableFields` column was only set on rejection at line 209).
  The fix appended `editableFields: []` + 1 new test. Shipped
  in commit `a26a83ff`.

In each case the audit:
- named the correct file
- cited the correct line number
- described the actual code, not a paraphrase
- proposed a fix that matched the actual surface area

---

## 6. Audit-tool recommendations

If the audit is generated by a tool (LLM, static analyzer,
linter), the tool's prompt should include:

> Before flagging an item, read the file at the cited line and
> prove the bug is present. If you can't see the bug in the
> current code, the item is stale — flag the audit accuracy
> instead of the bug.

The Voltium project's "verify before flagging" expectation is
codified in `DEAD_CODE_AUDIT_RECONCILIATION.md` § "Suggestions
for the next audit pass" (added in commit `bd5957a7`). This
file is the formal expansion of that note.

---

## 7. Single one-liner to use right now

If you only have time to run one command before filing an item:

```bash
git grep -nE 'PR-[0-9]+|previously this|already fixed|was a wrapper|fix plan' -- <file>
```

---

## 8. Per-batch stale-claim evidence (the receipts)

The following table records the exact line refs that prove each
stale claim in batches 8-24. Future audit passes can use this
section as a reference for "the audit got this wrong before —
don't repeat it".

### Batch 10 (`.github/workflows/...yml` claims)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| 1 | `nightly-load.yml` k6 has `continue-on-error: true` (broken) | Line 84: `continue-on-error: true` is intentional with an `if: always()` Slack notification (lines 99-109) and artifact upload (lines 86-90). The inline comment at line 84 explains: "Do not fail the whole build if SLO fails, we want to review artifact". | **Stale** — design is correct |
| 2 | `e2e-windows.yml` hardcodes psql password | Lines 34-36 (R10 polish #15) document: "generate a per-run random postgres password instead of hardcoding 'postgres'". Lines 48, 118 use a 24-char random password per run. | **Stale** — already random per-run |
| 3 | `daily-smoke-tests.yml` Android emulator requires KVM | The `reactivecircus/android-emulator-runner` at line 97 uses `emulator-options: -no-window -gpu swiftshader_indirect` (line 103) — explicit software rendering that does NOT require KVM. | **Stale** — software rendering already configured |
| 4 | `flutter-ci-cd.yml` paths filter excludes `web/**` (Prisma schema regen) | The paths filter (lines 6-17) includes `flutter/**`, `web/src/contracts/**` (OpenAPI spec), `web/prisma/**` (Prisma schema), and `.github/workflows/flutter-ci-cd.yml`. The Flutter pipeline correctly triggers on all 3 sources it depends on. | **Stale** — paths filter is correctly scoped |
| 6 | `RUNBOOK_OPERATOR_DAY1.md:88` outbox queue-lag has no alerter | Already shipped in commit `a804eb63` (batch 7) — the new `outbox-queue-lag.job.ts` posts to the Slack webhook every 5 minutes when the threshold is crossed. The runbook was updated in the same commit. | **Already fixed** — re-raised |

### Batch 11 (`docs/RUNBOOK_OPERATOR_DAY1.md` claims)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| 5 | RUNBOOK_OPERATOR_DAY1.md says 8 cron tasks, RUNBOOK lists 11 | `RUNBOOK_OPERATOR_DAY1.md:61` said "8 system cron tasks"; `RUNBOOK.md:146-156` listed 11 worker types. | **Real** — fixed in `12f4c650` |
| 6 | `RUNBOOK_OPERATOR_DAY1.md:88` outbox queue-lag has no alerter | Already shipped in commit `a804eb63` (batch 7). | **Already fixed** — re-raised |

The "item 6 re-raised" pattern is the single biggest source of
audit noise — the same finding was shipped in batch 7 and re-flagged
in batches 10 and 11. The audit tool/source should cross-reference
prior batch results before re-filing a "no alerter" claim.

### Batch 12 (cron test gaps from `audits/2026-08-05-scheduled-cron-tasks.md`)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| TG-2 | worker job tests missing | `web/tests/unit/workers/` already has 6 job test files (audit-cleanup, outbox-flush, outbox-queue-lag, reconciliation, scheduled-backup, start-workers) — gaps are partial, not zero. | **Stale** — partial coverage exists |
| TG-3 | idempotency tests missing | Already covered in `outbox-flush.job.test.ts` and `audit-cleanup.job.test.ts`. | **Already fixed** — partial coverage |
| TG-9 | cron schedule drift detection missing | The audit drift detection lives in `scripts/check-schedule-drift.sh` + a CI step at `.github/workflows/ci-cd.yml:188-194` — not in the worker test suite. | **Not a bug** — covered by a different test layer |
| TG-5 / TG-7 / TG-11 | 3 of 11 test gaps | Shipped in `c8be44c7` — `outbox-cleanup-completed`, `scheduled-backup-restore-lock`, `start-workers-idempotent` (10 new test cases, 386 lines). | **Real** — 3 fixed, 8 deferred |

### Batch 13 (test coverage from `COVERAGE_PLAN.md`, `INTEGRATION_TEST_COVERAGE_PLAN.md`, `FLUTTER_AUDIT_VERIFICATION_REPORT`)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| TEST-011 | `tests/scripts/check-migration-safety.test.sh` does not exist | The test file is `web/tests/unit/check-migration-safety.test.ts` (spawnSync-based vitest, not a `.sh` test). The audit's cited path is wrong; the real file exists with multiple test cases. | **Stale** — wrong path, file exists |
| TEST-012 | Pickup module has zero integration tests | `flutter/integration_test/e2e_individual/46_pickup_screen_test.dart` (62 lines, PR-8 PICKUP P0-1) — first pickup integration test, self-described as "the seed". | **Stale** — file exists |
| TEST-013 | Emergency feature has zero integration tests | `flutter/integration_test/e2e_individual/48_emergency_sos_test.dart` (54 lines, PR-9 EMERGENCY P0-5) — first emergency integration test, self-described as "the seed". | **Stale** — file exists |
| TEST-014 | Wallet top-up has zero integration tests | `flutter/integration_test/e2e_individual/12_wallet_topup_test.dart` (50 lines) + `37_wallet_topup_balance_test.dart` (5203 bytes) — two top-up tests. | **Stale** — 2 files exist |
| TEST-015 | `audits/PRIOR_AUDIT_REVIEW_PLAN_2026-08-06.md` lists 13 MISSING test files | The `audits/` directory does not exist on the current branch at all (`Get-ChildItem audits` returns nothing). The audit is citing a file from a tree that is no longer present. | **Stale** — source file gone |
| TEST-008 | Money-path testcontainers only 38% complete | Originally 38% on 2026-06-29 (~62 tests). Testcontainer per-file model was replaced by global-setup schema isolation (`?schema=test`) to prevent pool exhaustion. All 10/10 planned money-path files now exist in `tests/unit/money/` with 234 tests (144% of the 162 planned tests) passing against real Postgres. | **Fixed / Stale** — 10/10 files implemented, 234 tests passing |
| TEST-009 | Worker job tests Phase 2 only 22 of 101 planned | Originally 22 tests on 2026-06-29. Phase 2 now has 284 passing tests across 33 test files (281% of the 101 planned tests) covering all 20 worker jobs, cron timing schedules, outbox queue lag alerts, and idempotency guarantees. | **Fixed / Stale** — 33 files implemented, 284 tests passing |

### Batch 14 (TEST-016..023 test coverage / docs claims)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| TEST-016 | `flutter_coverage.sh` 85% line gate not re-run in latest readiness | `RELEASE_READINESS_2026-07-29.md:87,101` explicitly says "were not re-run in this session. Both pipelines have been historically green; the gate is not blocking release." Audit misread "not re-run in this session" as "missing". | **Stale / not-a-bug** — intentional gap |
| TEST-017 | `npm run test:coverage:combined` 85% gate not re-run | Same as TEST-016 — same doc lines. | **Stale / not-a-bug** — intentional gap |
| TEST-018 | Per-day wallet-adjust cap not enforced (per-call ₹50K only) | Already shipped in `833531d6` (batch 5). `web/src/lib/env.ts:128` has `MAX_ADMIN_DEBIT_PER_DAY_INR: 200000`; `web/tests/unit/api/admin-wallet-adjust-caps.test.ts:277-287` has the per-day aggregate test ("AUDIT-RECON 2026-09-02 batch 5 P0-1: per-day aggregate cap"). | **Already fixed** — re-raised |
| TEST-019 | 155 ops × 10 tests = 1,550+ new integration tests not yet landed | **Real, deferred** — `INTEGRATION_TEST_COVERAGE_PLAN.md` itself says "Plan ready, awaiting execution approval". Multi-day work, not in this batch. | **Deferred** — out of scope |
| TEST-020 | 3 of 5 audit-verification passes report ≤70% P0 fix rate | Only 4 `AUDIT_VERIFICATION_*` files exist (no "5" pass — file count is 4: `_2026-07-29`, `_2_2026-07-29`, `_3_2026-07-30`, `_4_2026-07-30`). The audit cited "PASS3-7" but those files don't exist. | **Stale** — wrong file count |
| TEST-021 | `SCREEN_WORKFLOW_COVERAGE.md` lists all screens "Implemented" — no test traceability | **Real** — fixed in `4ca28384`. Added a `Test coverage` column to both admin and rider tables with concrete file paths. Updated the public-beta rule to require the column on new rows. | **Real** — fixed |
| TEST-022 | `DEVICE_TEST_PLAYBOOK.md` is manual-only; no Firebase Test Lab automation | Automation harness created (`.github/workflows/firebase-test-lab.yml`, `flutter/scripts/run_firebase_test_lab.sh`, Android instrumentation runner `MainActivityTest.java`, and `build.gradle.kts` configuration). Live cloud execution requires repo secrets `GCP_SA_KEY` and `FIREBASE_PROJECT_ID`. | **Fixed / Scaffolding Landed** — ready for cloud credentials |
| TEST-023 | 3 skipped tests need design decisions (rate-limit DB / restore-safety / use-case stub) | `FAILED_TESTS_2026-08-01.md:225-226` lists the 3 design questions correctly, but the test-count header (35 failed, 1830 passing) is stale — actual is 0 failed / 2,958 passing. Design questions remain open and unowned. | **Stale (test counts) + Real (3 design questions open)** |

### Batch 15 (DPDP compliance / CMP-001..009)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| CMP-001 | KYC PII plain-text in admin detail sheet | `web/src/components/admin/screens/kyc-management/KycDetailDialog.tsx:31` has a `maskString()` helper; lines 110, 118, 255, 263 use it on aadhaar / pan / accountNumber / ifscCode. Aadhaar + PAN are already masked. | **Stale** — PII is masked |
| CMP-002 | Payment gateway credentials plain text | `web/src/components/admin/screens/payment-gateway/PaymentGatewayEditDialog.tsx:43-45, 110-114, 149-150, 217, 238` — explicit "never pre-populated" / "blank to keep the existing secret unchanged" / `type="password"` / auto-clears the secret from form. Write-only secret pattern, correct security model. | **Stale** — write-only form, not plain text |
| CMP-003 | `db-backup.sh` plaintext SQL dumps | `scripts/db-backup.sh:5-7, 140-153, 192-199` — **AES-256-CBC + PBKDF2 encryption by default**, env-driven key, `--no-encrypt` requires explicit `--i-understand-the-pii-risk` flag. Encryption is the default, not absent. | **Stale** — encryption is the default |
| CMP-004 | Audit-log redaction missing for Aadhaar | The read path was fixed (PR-153, `web/src/app/api/admin/audit-logs/route.ts:50-68`). The write path (`web/src/lib/audit-log.ts`) was NOT — it persisted raw PII to `AuditLog.details` and `entityId`. Pre-existing test `tests/unit/audit-log-aadhaar-redaction.test.ts` was failing 3/3. | **Real** — fixed in `75a599ae` (wired `redactPii` into `createAuditLog` at write time + replaced the 5-key `safeParams` strip with the full `redactPii` pass on the failure-fallback path) |
| CMP-005 | PII retention undocumented for `device_data_service.dart` | The audit's pointer at the Flutter file was misdirected — it's a sync (upload) helper with no local cache. The real retention is server-side via the `telemetryCleanupJob` (PR-154, `web/src/server/workers/jobs/telemetry-cleanup.job.ts`) which sweeps `UserLocation` / `UserCallLog` / `UserContact` with a 30-day cutoff, atomically with an `AuditLog` row. The mechanism existed; the doc explaining it did not. | **Real (doc-only)** — fixed in `b497b05f` (`docs/PRIVACY_DATA_RETENTION.md`) |
| CMP-006 | Breach notification (72h SLA) not documented | No `*DPDP*` / `*PRIVACY*` / `*COMPLIANCE*` files; `RUNBOOK_INCIDENT_RESPONSE.md` had no breach / 72h / DPDP references. | **Real** — fixed in `d6dd58e8` (`docs/RUNBOOK_DPDP_BREACH.md` — the DPDP Act §8(7) 72h notification procedure with the 6-stage audit chain, per-Data-Principal notification rules, escalation matrix, post-mortem template) |
| CMP-007 | Data principal rights not implemented (no `/api/rider/data-export`) | Partial: erasure is implemented (`web/src/app/api/rider/account/delete-request/route.ts`, PR-3 — records `deletionRequestedAt` + audit log entry). Consent is implemented (`web/src/app/api/rider/consent/route.ts`). Access / export is NOT. | **Real (partial), deferred** — multi-day work, separate ticket |
| CMP-008 | Consent flow for call_log/contacts not implemented | `flutter/lib/features/onboarding/presentation/screens/permissions_screen.dart:7, 67-72, 113-134, 246-330` — call_log + contacts tiles map to `ConsentType.callLogs` / `ConsentType.contacts`, call `ConsentService().setConsent(...)`. Consent flow IS implemented (FLUTTER_CONSENT P1-1). | **Stale** — already implemented |
| CMP-009 | DPO not designated | No org-chart or DPO reference. Governance gap, not engineering. | **Real, deferred** — separate ticket; until filled, the breach runbook's "DPO designate" references resolve to CTO + CEO joint sign-off |

### Batch 16 (CMP-011..014 — Flutter telemetry / pubspec)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| CMP-011 | `flutter_contacts` access not gated by consent screen | `flutter_contacts` is only used in `flutter/lib/services/device_data_service.dart:128` (`FlutterContacts.getAll`). The call is gated by `ConsentService().hasConsent(ConsentType.contacts)` at line 122. The audit pointed at `features/device_compliance/` but that directory only contains the policy provider + emergency screens — no flutter_contacts usage. | **Stale** — consent-gated, wrong directory cited |
| CMP-012 | `flutter_background_service` version mismatch (5.x vs 6.x) | `flutter_background_service` is **not in `flutter/pubspec.yaml`** at all (full pubspec verified: 53 lines, no entry). Package is not a dependency. | **Stale** — package not used |
| CMP-013 | 4 overlapping telemetry systems (PostHog / OTel / Firebase / homegrown) | The 3 services (`analytics_service.dart`, `performance_service.dart`, `monitoring_service.dart`) are a **layered architecture around a single PostHog backend**, not 4 separate systems. The layering is documented in `monitoring_service.dart:2, 16, 26, 28` (PR-11, 2026-08-21): "Flutter code MUST NOT import `package:posthog_flutter/...`" — all PostHog access is wrapped in `PostHogService` and routed through `MonitoringService`. There is no OTel, no Firebase Analytics, no Sentry, no Crashlytics in the dependencies or services. | **Stale** — layered, not overlapping (3 layers, 1 backend) |
| CMP-014 | `opentelemetry_dart 0.0.2` pre-release pinned in production | `opentelemetry_dart` is **not in `flutter/pubspec.yaml`** at all (full pubspec verified: 53 lines, no entry). Package is not a dependency. | **Stale** — package not used |

### Batch 17 (CMP-015..018 — payment security + reconciliation SLA)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| CMP-015 | Payment gateway credentials plain text (PCI-DSS) | `web/src/lib/credentials.ts:5-26` — **PR-8 (2026-08-06 fix-plan, 7th audit P0) encrypted `keySecret` + `webhookSecret` at rest** using `encryptCredential()` (AES-256-GCM, key-versioned). The dialog form is also write-only (CMP-002 / batch 15). Audit missed BOTH layers. | **Stale** — encrypted at rest (PR-8) + write-only form (CMP-002) |
| CMP-016 | Webhook signature verification skipped in dev (fail-open) | The audit's cited file `routes/payment/webhooks.ts` **does not exist** in the current tree. A full enumeration of `web/src/app/api/**/*.ts` (135 route files) shows no `/api/payment/webhooks/*` route. Payment-gateway routes are admin-side only (POST/PUT/GET); no inbound webhook handler exists. | **Stale** — file does not exist |
| CMP-017 | Idempotency key not enforced on all payment webhooks | Same as CMP-016 — there is no webhook handler to add an idempotency key to. | **Stale** — file does not exist |
| CMP-018 | Payment reconciliation job has no SLA documentation | **Real (doc-only)** — `wallet-reconciliation.job.ts` has no SLA constant. The only mention in runbooks is the 15-minute runtime estimate at `RUNBOOK.md:163` (informational, not a SLO). Fixed in `09f1d786` — added §5 "Wallet Reconciliation SLA" to `RUNBOOK_INCIDENT_RESPONSE.md` with 5 SLO metrics (24h cadence, drift detection threshold, 4h resolution window, 15-min runtime, 0 false-negative rate), 4-step breach response, and "why these numbers" rationale. | **Real (doc-only)** — fixed |

### Batch 18 (CMP-019..025 — Flutter a11y + i18n + repo hygiene)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| CMP-019 | No visible focus indicators on text fields (WCAG 2.1 SC 1.4.13, 2.4.7) | `flutter/lib/theme/app_theme.dart:557-580` (PR-10, 2026-08-21) — 1px resting border + 2px primary focused border + error/focusedError states. The audit cited `theme/app_theme.dart:277-286` which is the `AppGradients` class (unrelated to focus). | **Stale** — wrong line range, focus indicators present |
| CMP-020 | Dark mode only overrides 5 of ~30 color tokens | The `darkTheme` (`app_theme.dart:628`) uses `darkColors.*` 23 times; the `colorScheme` at line 645-660 explicitly wires 9 surface tokens (PR-62 / AUDIT_DESIGN_SYSTEM N2). Audit miscounted. | **Stale** — miscount, 23 darkColors references + 9 surface tokens |
| CMP-021 | No screen reader labels on icon-only buttons | All 35 `IconButton` calls in `flutter/lib` now have `tooltip:` configured (giving screen reader labels and long-press tooltips). `LoadingIconButton` now accepts optional `tooltip`. Added automated regression audit in `test/utils/accessibility_test.dart`. | **Fixed / Complete** — 35/35 IconButtons labeled |
| CMP-022 | No dynamic type support (text sizes hardcoded) | Migrated `AppTheme.lightTheme` & `AppTheme.darkTheme` to wire Material 3 `TextTheme` via `AppTypography.material3TextTheme()`, mapping Plus Jakarta Sans across all 14 M3 slots. Added dynamic type scaler `AppTypography.scaled(context, ...)` with safety clamps (0.8x–2.0x) and `ScalableTextStyle` extension. Added tests in `test/theme/app_typography_dynamic_type_test.dart`. | **Fixed / Complete** — M3 TextTheme + Dynamic Type Scaler wired |
| CMP-023 | No colour-blindness testing | **Real** — no `protanopia` / `deuteranopia` / `colorBlind` matches anywhere in `flutter/test/` or `flutter/integration_test/`. | **Real, deferred** — multi-day; needs a test image set + render pipeline |
| CMP-024 | i18n: 320 untranslated Hindi messages | The audit author ran a raw key count difference (1,323 JSON keys in `app_en.arb` vs 848 in `app_hi.arb` = 475) and mistook the 475 `@` metadata developer descriptions in `app_en.arb` as missing messages. Both files contain exactly 847 translatable string keys (100% 1:1 match). All Hindi translations are present, non-empty, and verified by `flutter gen-l10n`. Added automated regression audit in `test/l10n/arb_completeness_test.dart`. | **Stale / Miscount** — 100% translated (847/847 string keys matched) |
| CMP-025 | `flutter/analyze_out.txt` + `flutter/analyze_waiver.txt` in repo root | **Real, ship-it-sized** — both files were git-tracked. `flutter/.gitignore:58-59` has a `*.txt` / `*.json` catch-all but it was added AFTER the analyzer output was committed (the file is from 2026-08-04; the catch-all is later). `git rm` doesn't untrack already-tracked files. Fixed in `ae84c734` — `git rm` both + strengthen the `.gitignore` comment. | **Real** — fixed |

### Batch 19 (ADR-V001..V004 — ADR compliance)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| ADR-V001-1 | Some routes use `pages/` instead of `app/` | A full enumeration of `web/src/**` shows **no `pages/` directory** anywhere. All Next.js routes live under `app/`. | **Stale** — `pages/` dir does not exist |
| ADR-V001-2 | `force-dynamic` not applied to all admin routes | 18 route files have `force-dynamic` (`grep` count); admin routes that read live data (auth, payments, audit logs, health, metrics) all have it. The audit didn't name which routes are "missing" — the claim is unverifiable as stated. | **Stale (vague)** — 18 already wired, no specifics given |
| ADR-V001-3 | Next.js version drift (14/15/16 across docs) | `web/package.json:121` pins `^15.5.19`. `docs/README.md:7` claimed "Next.js 16". `README.md` and `PROJECT_OVERVIEW_2026-07-30.md` don't cite a specific version. Fixed in `b1e37349`. | **Real** — fixed (Next 16 → Next 15 in `docs/README.md`) |
| ADR-V002-1 | Raw SQL queries in some use-cases | 5 `$queryRaw` calls in 3 files: `analytics/analytics.use-cases.ts:16, 134`, `data-management/backup.service.ts:104`, `data-management/data-management.use-cases.ts:280, 443`. Real surface, but not all raw is bad — these are aggregate queries that Prisma's query-builder doesn't express well. The "5 raw calls" presence doesn't violate the ADR (which mandates Prisma over Drizzle, not "no raw SQL ever"). | **Stale** — ADR doesn't forbid raw SQL; aggregate uses are reasonable |
| ADR-V002-2 | `$queryRaw` used without parameterisation in 2 places | All 5 `$queryRaw` calls use `${...}` template substitutions, which Prisma **does parameterize** (sends as SQL parameters, not string concat). No `Prisma.sql\`...\`` patterns either. | **Stale** — all 5 calls parameterized |
| ADR-V003-1 | Manual validation instead of Zod in 4 routes | Routes I spot-checked (`admin/announcements`, `admin/jobs`, `admin/rewards`) all use Zod via `validateBody(..., body)` from `@/lib/validators`. 66 `req.json()` references in 47 files (most do validate); 37 Zod import references in 19 files. The audit didn't name which 4 routes — unverifiable as stated. | **Stale (vague)** — routes verified use Zod; no specifics given |
| ADR-V003-2 | Zod schemas not exported from shared module | `web/src/lib/validators.ts` exports 50+ Zod schemas (`export const sendOtpSchema`, `verifyOtpSchema`, `updateProfileSchema`, `createAnnouncementSchema`, `awardRewardSchema`, etc.). Routes import via `import { validateBody, createAnnouncementSchema } from '@/lib/validators'`. | **Stale** — schemas are exported |
| ADR-V004-1 | Dual state management (Provider + Riverpod) | The audit claim was an inspection artifact: grepping for `Provider` matched Riverpod's own classes (`StateNotifierProvider`, `riverpod_providers.dart`). Complete codebase audit revealed **zero** imports of `package:provider/` in `lib/` or `test/`. All 73 state-driven files use `flutter_riverpod: ^3.3.2`. `provider: ^6.1.2` was an unused dormant dependency in `pubspec.yaml` (identical to `go_router` in ADR-V004-2). Removed `provider: ^6.1.2`, pruned lockfile via `flutter pub get`, verified with clean `flutter analyze`, 132/132 provider tests passing, and added architecture regression test `test/architecture/adr_v004_state_management_test.dart`. | **Fixed / Complete** — dormant provider pruned; 100% Riverpod |
| ADR-V004-2 | Dormant GoRouter coexists with state-machine router | **Real, ship-it-sized** — `flutter/pubspec.yaml` had `go_router: ^14.6.2` but the codebase has **zero** `package:go_router/...` imports (full grep). The app uses a custom `AppRouter` widget at `lib/app/router.dart` wired into `MaterialApp` at `main.dart:279`. Fixed in `b1e37349` — removed the dependency. The audit pointed at `router/app_router.dart` (wrong path — actual is `lib/app/router.dart`). | **Real** — fixed |

### Batch 20 (NET-001..009 — drift + state machine)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| NET-001 | Guarantor workflow deprecated vs `BACKEND_WORKFLOW_READY.md` lists it live | `BACKEND_WORKFLOW_READY.md` **does not exist** anywhere in the tree. Only `docs/WORKFLOWS.md` and `docs/WORKFLOWS_DEFERRED_PLAN_2026-08-28.md` exist. The audit cited a non-existent file. | **Stale** — file does not exist |
| NET-002 | Money Storage Drift at `AGENTS.md:205` | `AGENTS.md:205` is about Rental Plans `durationDays`, NOT money storage. The line is the user-memory note: "A plan's durationDays is strictly determined by its type". The Rupees-First Migration is a separate plan (`docs/plans/2026-08-08-rupees-first-completion.md`). There is no "Money Storage" rule in AGENTS.md. | **Stale** — wrong line cited |
| NET-003 | Sentry claim in CHANGELOG vs NO_CLOUD_DATA.md | **Real, ship-it-sized** — `CHANGELOG.md:18-19` said "Integrated Sentry into the Flutter application". `docs/NO_CLOUD_DATA.md:21` lists Sentry under **NOT Allowed** error-tracking vendors. Fixed in `2c63cc49` — replaced the Sentry claim with PostHog (the actual implementation, PR-11 / 2026-08-21, established in batch 16). | **Real** — fixed |
| NET-004 | Husky + Lefthook dual hook system | **Real, deferred** — `lefthook.yml` (2.5K, TEST-STRATEGY-AUDIT T-P2-3, 2026-08-08) and `.husky/pre-commit` (320 bytes, gitleaks + lint + typecheck + format) coexist. The inline comment at `lefthook.yml:1-15` documents the rationale (pre-commit cheap failures vs CI full suite). Both can coexist as long as the workflow is clear. | **Real, deferred** — per user choice |
| NET-005 | KYC APPROVED → EXPIRED has no trigger | **Real, ship-it-sized** — `web/src/server/modules/kyc/kyc-state-machine.ts:23` declared the transition but no worker performed it. Fixed in `2cf6ba6e` — added `expiresAt` column to KycProfile, the `kyc-expiry.job.ts` worker (IST-date idempotency, atomic audit log + status update, 365-day window matching the AuditLog retention for kyc.*), wired into `SCHEDULED_TASKS`, with 4 passing tests. | **Real** — fixed |
| NET-006 | Vehicle RETIRED state has no admin UI trigger | **Stale** — `BulkStatusModal.tsx:41` has `<SelectItem value="RETIRED">Retired</SelectItem>` in the admin vehicle-management flow. | **Stale** — UI present |
| NET-007 | Vehicle LOST state has no documented procedure | **Stale** — `BulkStatusModal.tsx:40` has `<SelectItem value="LOST">Lost</SelectItem>`. The state machine doc at `STATE_MACHINES.md:236` shows the transition. | **Stale** — UI present |
| NET-008 | Plan.durationDays derived from type, body input ignored | **Stale (by design)** — this is the user-memory design rule: "A plan's durationDays is strictly determined by its type (DAILY=1, WEEKLY=7, MONTHLY=30). The backend automatically calculates this on create/update, overriding any manual input." `plan.use-cases.ts:114-117, 191, 201` enforce it explicitly. | **Stale** — by design |
| NET-009 | RBAC Role Count Drift: 8 vs 5 | **Stale** — already fixed in batch 5 (commit `ff283110`). `STATE_MACHINES.md:291-302` and `PROJECT_OVERVIEW_2026-07-30.md:533` both now list 8 roles. The PROJECT_OVERVIEW even has the inline comment: "this section was last touched 2026-07-30 and was stale until reconciled 2026-09-02". | **Already fixed** — re-raised |

### Batch 21 (F-006..DB-002 — security re-validation)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| F-006 | OTP `isNewRider` defaults `false` (KYC bypass) | `web/src/server/modules/auth/auth.use-cases.ts:121, 139` — `isNewRider` defaults to `false` and is only set to `true` inside the `if (!rider)` block when a new rider row is actually created. The default is the safe state; the "bypass" claim is inverted. | **Stale** — safe default, only flipped on actual creation |
| F-019 | Token refresh race + unguarded jsonDecode | `web/src/app/api/auth/refresh/route.ts:25` uses `request.json().catch(() => ({}))` (tryParse pattern, not unguarded `JSON.parse`). `flutter/lib/core/network/api_client.dart:59-63, 166-176` implements single-flight refresh: while a refresh is in progress, concurrent 401-handlers `_await` the same `_refreshInFlight` Future. The server-side race is mitigated by the client-side coalescing. The audit's own pre-verification "FALSE — `_safeJsonDecode` + single-flight refresh in place" is correct. | **Stale** — single-flight in place |
| F-020 | `call_log` plugin (Play Store policy red flag) | Per user memory (2026-08-21): "`call_log` and `flutter_contacts` plugins are intentional and stay. Do not propose their removal in future audits." Per distribution decision (2026-08-27): "**No Play Store release.**" Both reasons make the Play Store policy claim inapplicable. | **Not a bug** — intentional, no Play Store |
| SEC-003 / REL-024 | KYC PII plain-text in admin | `web/src/components/admin/screens/kyc-management/KycDetailDialog.tsx:27, 31` — `showPii` reveal toggle + `maskString()` helper applied to aadhaar / pan / accountNumber / ifscCode. Already verified in batch 15 (CMP-001). | **Stale** — masked, with opt-in reveal |
| SEC-004 / CMP-002 / REL-025 / ADM-PAY-001 | Payment gateway creds plain text | `web/src/lib/credentials.ts:5-26` (PR-8, 2026-08-06 fix-plan) — AES-256-GCM at rest with key-versioned envelope. `PaymentGatewayEditDialog.tsx:43-45, 110-114` (write-only form). Already verified in batches 15 (CMP-002) and 17 (CMP-015). | **Stale** — encrypted at rest + write-only form |
| SEC-006 | Flutter CI keystore left on disk | `flutter/android/.gitignore:24-26` ignores `key.properties`, `*.keystore`, `*.jks`. `git ls-files` confirms `key.properties` and `debug.keystore` are NOT tracked. Both files exist on disk for local builds but are correctly excluded from the repo. | **Stale** — properly ignored |
| SEC-007 | Firebase config in plaintext | `flutter/android/app/google-services.json` has **dummy values** (`1234567890`, `dummy-project-id`, `dummy-api-key`) — clearly placeholder for CI. `flutter/lib/firebase_options.dart` is a thin shim that loads from `flutter/lib/core/firebase/firebase_config.dart` via `--dart-define` at build time. Real Firebase credentials are NOT in source. | **Stale** — placeholder, real keys via dart-define |
| SEC-008 | `ALLOW_DEV_PII_KEY` hardcoded dev key in source | It's an **env var flag**, not a hardcoded key. `web/src/lib/env.ts:96, 137-144` — production is explicitly forbidden (Zod schema throws on `ALLOW_DEV_PII_KEY=true` in prod). `web/src/lib/pii-crypto.ts:28-32` — the "dev key" is process-unique generated at startup from a random value, never a hardcoded secret. | **Stale** — env var, not hardcoded |
| SEC-009 / CMP-003 / INF-003 | `db-backup.sh` plaintext SQL dumps | `scripts/db-backup.sh:5-7, 140-153, 192-199` — AES-256-CBC + PBKDF2 default, env-driven `BACKUP_ENCRYPTION_KEY`, `--no-encrypt` requires explicit `--i-understand-the-pii-risk` flag. Already verified in batch 15 (CMP-003). | **Stale** — encrypted by default |
| DB-002 | No `SELECT FOR UPDATE` on wallet approve | Concurrency is enforced via **CAS (compare-and-swap) via `updateMany`** — the modern Prisma equivalent of `SELECT FOR UPDATE`. `web/src/server/modules/transactions/transaction.repository.ts` uses `updateMany({ where: { id, status: 'PENDING' } })` and treats `count === 0` as a `CONFLICT`. `web/tests/unit/wallet-approve-concurrency.test.ts` covers the concurrent-approval race explicitly (3 cases: atomic claim, second-approval CONFLICT, status-already-transitioned REJECT). | **Stale** — CAS is the Prisma equivalent |

### Batch 22 (DB-003..FLT-DECIMAL — data + worker + safety)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| DB-003 / NET-002 | Paise/rupee unit ambiguity systemic | `web/src/lib/money.ts:107` `formatRupeesFromPaise` + branded `Paise`/`Rupees` types (compiler-checked). `web/src/app/api/admin/riders/[id]/wallet-adjust/route.ts:25-27` `MAX_DEBIT_PAISE = env.MAX_ADMIN_DEBIT_INR * 100` (correct INR → paise at the API boundary). `web/src/components/admin/screens/transaction-management/TransactionDialogs.tsx:80-87` PR-6 (FINANCE P0-5) fixed the dialog paise/rupee conversion. | **Stale** — fix landed at 3 layers (helper, API boundary, dialog) |
| WK-001 / ADR-V005-1 | Outbox `emit()` outside transaction | `web/src/server/workers/outbox.ts:216` `emitWithCommit(eventType, writer, payloadBuilder, options)` wraps both the writer and the emit in a single `db.$transaction`. The inline comment at line 197-214 explicitly documents the anti-pattern ("LEAKS on crash") the new pattern replaces. | **Stale** — txn boundary in place via `emitWithCommit` |
| WK-002 | 10-20 orphan events per day | Unverifiable from code. The orphan-recovery sweep is at `web/src/server/workers/jobs/orphan-event-consumer.job.ts` (PR-151) and the outbox cleanup is at `OutboxService.cleanupCompleted()`. The "10-20 per day" number would need prod logs to verify. | **Unverified** — needs prod telemetry |
| WK-003 | rental-completed self-emitting loop | Unverifiable from code. The `rental-completed` outbox event is routed to `rental-completed-consumer.test.ts` (per `WORKERS` table); whether the consumer emits a new `rental-completed` is a behavior question that needs the consumer's source. | **Unverified** — needs source review of the consumer |
| WK-004 | telemetry-cleanup mis-tagged as notification | `web/tests/unit/workers/telemetry-cleanup.job.test.ts` last test asserts `OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP === 'admin.job.telemetry_cleanup'` is **distinct** from `SMS_SEND` and `NOTIFICATION_SEND`. The worker is registered to that exact event type in `WORKERS`. | **Stale** — distinct tag, test-asserted |
| WK-005 | engagement-daily-emitter 287 wasted runs/day | `web/src/server/workers/jobs/daily-engagement.job.ts:135` `msUntilNext0600IST` + `index.ts:463` `if (msUntil > 60_000) return;` + `lastEngagementFiredDate` fire-once-per-IST-day guard. Per-minute check is `O(1)` (compute msUntil, compare) and does NOT execute the actual emit. The "287" number is also wrong: 1440 ticks/day − 1 actual run = 1439 skipped, not 287. | **Stale** — gated + fire-once; the math is also wrong |
| WK-006 | Worker single-fork (no HA) | Unverifiable from code alone. The workers run via `npx tsx src/server/workers/index.ts` (per `index.ts:9`). Whether the deployment runs 1 fork or N is a deployment-context question (PM2 cluster mode, k8s replicas, etc.). | **Unverified** — needs deployment info |
| FLT-SOS-001 | SOS button no-op (safety risk) | `flutter/lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart:13, 30, 65, 156-159` — `launchDialer('112', ...)` is wired with safety fixes (lines 115-153 ensure the dialog's own context is used and the 112 dial is the primary path). Inline comment at line 30: "does NOT get their location sent, contacts alerted, or 112 dialed" describes what the screen DOES do. The audit's own pre-verification says **FALSE**. | **Stale (audit pre-verified)** |
| FLT-WALLET-001 | Top-up proof submission no-op | `flutter/lib/features/wallet/presentation/screens/top_up_proof_screen.dart:22, 30, 367` — `final Function(File, String?, String?)? onSubmit` parameter is declared and called via `await widget.onSubmit?.call(fileToSubmit, methodStr, refVal)`. The `onSubmit` IS wired; the audit's "no-op" claim is wrong. Pre-verified as "screen is dead code (no parent uses it)" — true that no parent imports it, but the screen's submission IS wired. | **Stale (partial)** — onSubmit wired; unused-by-parent is a different finding |
| FLT-LOGOUT-001 | Logout does not clear sibling provider state | `flutter/lib/core/state/rider_logout_orchestrator.dart` is a complete orchestration class that clears engagement (line 95), onboarding (125), support (126), tickets (127), guarantor (128), pickup draft (130-142), guarantor cache (150-152), document cache (161-163), refresh-in-flight (155), has-synced-device-data-once (157). The audit's claim of "does not clear sibling provider state" is the opposite of what the file does. | **Stale** — full orchestration in place |
| FLT-NOTIF-001 | FCM broken end-to-end (4 compounding bugs) | `web/src/lib/fcm.ts` (8K) is a complete FCM service with nonce dedup (`_sentNonces` map, `trackNonce()`, 5-min TTL, periodic cleanup) + `getMessaging` from firebase-admin. Pre-verified "fixed by PR-A through PR-H". | **Stale (audit pre-verified)** |
| FLT-DECIMAL-001 / ADM-FIN-001 / REL-023 | DeductWalletModal ₹5 not ₹500 | `TransactionDialogs.tsx:80-87` PR-6 (FINANCE P0-5) explicit fix: "tx.amount is in paise; walletCreditAmount is in rupees. The backend multiplies rupees by 100 when [saving]". `wallet-adjust/route.ts:25-27` confirms: `MAX_DEBIT_PAISE = env.MAX_ADMIN_DEBIT_INR * 100`. The paise/rupee conversion is correct at the API boundary AND the dialog surface. | **Stale** — fix landed at 2 layers |

#### Unverified items added to `docs/FOLLOWUP_TICKETS.md`

| ID | Why unverifiable | Suggested next step |
| -- | ----------------- | ------------------- |
| WK-002 | "10-20 orphan events per day" is a runtime metric. | Add a Grafana panel on `OutboxService.statusCounts()` over a 7-day window. |
| WK-003 | Self-emitting loop is a consumer-behavior question. | Read `rental-completed-consumer.test.ts` (or whatever file owns the consumer); trace whether it emits a new `rental-completed`. |
| WK-006 | Single-fork vs HA is a deployment-context question. | Read the `ecosystem.config.js` (or `pm2` config) for `instances` / `exec_mode`. |

If it returns a match within ±20 lines of the audit's cited line,
**read the comment** before flagging the item. It is almost
always the prior fix.

### Batch 23 (ADM-MNT..INF-005 — infra + safety re-validation)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| ADM-MNT-001 | Maintenance mode placebo (no middleware) | `web/src/middleware.ts:85-110` (PR-3, 2026-08-06 fix plan) — `getMaintenanceState()` is imported from `lib/maintenance-cache.ts`, the middleware checks `pathname !== '/api/rider/maintenance-status'` so the status endpoint stays open, and returns a `MAINTENANCE_MODE` error with the configured message when the toggle is on. | **Stale** — middleware in place |
| ADM-ANNOUNCE-001 | Admin announcement bypasses FCM | `web/src/server/workers/jobs/announcement-broadcast.job.ts:22, 89, 136, 145-148` — `fcmService.sendPushNotification(token, ...)` is called per recipient. AUDIT-RECON 2026-09-02 batch 4 P0-1 (commit `20a4c2ea`). FCM failure is logged but does not abort the batch. | **Stale** — FCM wired in worker |
| CMP-001 | KYC PII plain-text (DPDP) | `KycDetailDialog.tsx:27, 31` — `showPii` reveal toggle + `maskString()`. Same as SEC-003 (batch 21) and CMP-001 (batch 15). | **Stale (re-raised)** |
| CMP-010 | call_log plugin (Play Store red flag) | User memory (2026-08-21): `call_log` and `flutter_contacts` are intentional. Distribution decision (2026-08-27): no Play Store. Same as F-020 (batch 21). | **Not a bug (re-raised)** |
| CMP-015 | Payment credentials plain text (PCI-DSS) | `web/src/lib/credentials.ts:5-26` AES-256-GCM at rest (PR-8). `PaymentGatewayEditDialog.tsx:43-45, 110-114` write-only form. Same as SEC-004 (batch 21) and CMP-002 (batch 15) and CMP-015 (batch 17). | **Stale (re-raised)** |
| ADR-V005-2 | ADR-0005: 10-20 orphan events per day | Same as WK-002 (batch 22). Unverifiable from code. Tracked as **T-70** in `docs/FOLLOWUP_TICKETS.md`. | **Unverified (re-raised)** |
| ADR-V005-3 | ADR-0005: rental-completed self-emitting loop | Same as WK-003 (batch 22). Unverifiable from code. Tracked as **T-71** in `docs/FOLLOWUP_TICKETS.md`. | **Unverified (re-raised)** |
| INF-001 | check-migration-safety.sh is a no-op | `web/tests/unit/check-migration-safety.test.ts` (3 cases, all pass). Same as TEST-011 (batch 13). | **Stale (re-raised, already fixed)** |
| INF-002 | check-secret-rotation.sh is a fake check | `scripts/check-secret-rotation.ts` (PR-94a, INF-CI/CD-3) is a real TS implementation that calls `checkSecretRotation()` and exits 1 on any stale key. `scripts/check-secret-rotation.sh` (PR-139, INF-CI/CD-4) is a thin shell wrapper that exec's the TS file. The CI step `.github/workflows/ci-cd.yml:162` runs the .sh which runs the .ts — both real, both wired. | **Stale** — real implementation |
| INF-005 | CI coverage-gap job has `continue-on-error: true` | `.github/workflows/ci-cd.yml:307-308` "Check API coverage gap" step has **no** `continue-on-error: true`. It runs `npm run test:coverage-gap` and the workflow fails on non-zero exit. The 85% line gate is the separate `test:coverage:merge` step at lines 310-313 with `MIN_COVERAGE: '85.0'`. | **Stale** — gate is enforced |

### Batch 24 (INF-006..REL-025 — deploy + release re-validation)

| # | Claim | Reality | Stale because |
| - | ----- | ------- | -------------- |
| INF-006 | PM2 `kill_timeout` / `listen_timeout` too short | `ecosystem.config.js:92, 95, 127` — `kill_timeout: 30000` ("Bumped from 10s — graceful shutdown of in-flight requests"), `listen_timeout: 60000` ("Bumped from 30s — Next.js cold start"), `kill_signal: 'SIGINT'`, `kill_retry_time: 5000`. All 5 timeouts were bumped from the too-short defaults. Inline comments document the rationale at every line. | **Stale** — all 5 timeouts bumped |
| INF-007 | `deploy-prod.sh` rollback uses fragile `git revert HEAD` | `scripts/deploy-prod.sh:22-24, 85, 97` — rollback uses `git checkout "$PREVIOUS_TAG"` based on `git tag --sort=-creatordate \| grep -E "^deploy-${ENV_NAME}-" \| head -2 \| tail -1`. Tag-based rollback is the recommended pattern. | **Stale** — tag-based rollback |
| INF-008 | `deploy-staging` job runs on `ubuntu-latest` (no PM2 state) | `.github/workflows/ci-cd.yml:339-348` — the `deploy-staging` job is **commented out**. The block explicitly documents: "This job previously ran on ubuntu-latest (fresh VM each run) which meant PM2 had no persistent state and the deploy was a no-op. Staging deploys are run manually via `./scripts/deploy-staging.sh`". The job that runs on `ubuntu-latest` is `flutter-test` (line 352), not deploy. | **Stale** — job disabled, manual deploy via `scripts/deploy-staging.sh` |
| INF-009 | PM2 single-instance "zero downtime" is not zero-downtime | `ecosystem.config.js:75-76` — `instances: 'max'` (one per CPU core) + `exec_mode: 'cluster'`. Real zero-downtime via PM2's cluster reload. The `voltium-web` app runs in cluster mode with N=max instances; the `voltium-worker` is single-instance (intentional — outbox scheduler state). | **Stale** — cluster mode in place |
| REL-004 | Public beta entry gates not verified | Unverifiable from code. Needs the beta laptop + manual smoke-test pass. | **Unverified** — out of scope (per audit pre-verification) |
| REL-006 | Public beta exit criteria: 6 manual criteria | Unverifiable from code. Needs the beta laptop + ops + business sign-off. | **Unverified** — out of scope (per audit pre-verification) |
| REL-023 | DeductWalletModal decimal bug | `TransactionDialogs.tsx:80-87` PR-6 (FINANCE P0-5) explicit fix: "tx.amount is in paise; walletCreditAmount is in rupees. The backend multiplies rupees by 100 when [saving]". `wallet-adjust/route.ts:25-27` confirms: `MAX_DEBIT_PAISE = env.MAX_ADMIN_DEBIT_INR * 100`. Same as FLT-DECIMAL-001 (batch 22) and CMP-001 (batch 15). | **Stale (re-raised)** |
| REL-024 | KYC PII plain-text | `KycDetailDialog.tsx:27, 31` — `showPii` reveal toggle + `maskString()`. Same as SEC-003 (batch 21) and CMP-001 (batches 15, 23). | **Stale (re-raised)** |
| REL-025 | Payment gateway plain-text credentials | `web/src/lib/credentials.ts:5-26` AES-256-GCM at rest (PR-8). `PaymentGatewayEditDialog.tsx:43-45, 110-114` write-only form. Same as SEC-004 (batch 21) and CMP-002 (batch 15) and CMP-015 (batches 17, 23). | **Stale (re-raised)** |

If it returns a match within ±20 lines of the audit's cited line,
**read the comment** before flagging the item. It is almost
always the prior fix.

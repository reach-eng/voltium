# Audit Hygiene — How to Spot a Stale Claim Before You Open a PR

**Audience**: anyone (or any tool) generating audit reports that flag
issues in the Voltium repo. The lesson comes from 9 consecutive
audit batches (2026-09-02) where 24 of 45 items (53%) were stale,
already-fixed, or not-a-bug.

**The single rule**: **before flagging a "bug" item, prove the bug
is still present in the current code on the current branch.** A
code reading, not a re-statement of a prior finding.

This document is short on purpose. The checklists below are the
ones that would have caught every false positive in the last 9
batches. If you generate audits, run them before you file an item.

---

## 1. The 9-batch accuracy record (2026-09-02)

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
| | **Total** | **55** | **35 (64%)** | **4 (7%)** | **1 (2%)** | **14 (25%)** |

The dominant failure mode across all 9 batches: **the audit
re-states prior findings without reading the inline
PR-referencing comments that document the prior fix.** Items
1, 2, 3, 5, 6, 7, 9 all had the prior fix documented in a
comment within ~20 lines of the cited line number.

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
stale claim in batches 8-11. Future audit passes can use this
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

If it returns a match within ±20 lines of the audit's cited line,
**read the comment** before flagging the item. It is almost
always the prior fix.

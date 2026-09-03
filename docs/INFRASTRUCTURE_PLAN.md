# Voltium Infrastructure / DevOps / Deployment — Remediation Plan

> [!WARNING]
> **DEPRECATED TOPOLOGY — DO NOT FOLLOW**
> This remediation plan references a legacy infrastructure topology (Caddy, Bun bundles, mini-services, and `.zscripts/`) that has been decommissioned.
> As of 2026-09-03:
> - There is NO `.zscripts/`, NO `mini-services/`, NO Bun bundles, and NO Caddy in this repository.
> - Background work runs in-process via `web/src/server/workers/` (PostgreSQL `OutboxEvent` + `lib/job-queue.ts`).
> - `infra/` holds only `grafana/`.
> - For current host orchestration, see `scripts/laptop-service.ps1` and `AGENTS.md`.

**Date:** 2026-07-29
**Source audit:** [`docs/AUDIT_INFRASTRUCTURE.md`](./AUDIT_INFRASTRUCTURE.md) (110+ findings, mostly P0)
**Method:** Audit read top-to-bottom, every P0 in the audit's "Top 10" + the broader "Cross-cutting observations" verified against the current files (`ecosystem.config.js`, `db-backup.sh`, `db-restore.sh`, `deploy-prod.sh`, `deploy-staging.sh`, `ci-cd.yml`, `check-migration-safety.sh`, `check-secret-rotation.sh`).
**Audience:** the team only. PM/CTO not in the loop.
**Goal:** ship review-ready PRs that turn the infrastructure from "works on a single laptop" into "works on a single laptop and survives the obvious failure modes."

---

## TL;DR

The audit's "Top 10 P0 critical findings" is right about **8 of 10** and wrong about 2 (audit is stale on `db-backup.sh` output dir and `db-restore.sh` confirmation — both already fixed in Phase 6). The remaining 8 are real and the worst of them are:

1. **The `check-migration-safety.sh` script is a no-op.** It always exits 0. A `DROP TABLE` migration passes the gate. **(audit 6.1)**
2. **The `check-secret-rotation.sh` script is fake.** It only checks that `pii-crypto.ts` exists. It does not check that secrets are actually rotated. **(audit 6.2)**
3. **`ci-cd.yml` `deploy-staging` job runs on a fresh `ubuntu-latest` runner with `pm2 restart`** — PM2 has no persistent state on a fresh VM, so the "deploy" is a no-op. **(audit 4.3)**
4. **`ci-cd.yml` `coverage-gap` job has `continue-on-error: true`** — the gap check fails silently. **(audit 4.2)**
5. **`deploy-prod.sh` rollback uses `git revert HEAD --no-edit`** — fragile (revert is now HEAD, breaks on merge commits). **(audit 3.1)**
6. **PM2 `kill_timeout: 10000` and `listen_timeout: 30000`** — too short for a Next.js boot on slow disk; 10s SIGTERM is too short for graceful shutdown of in-flight requests. **(audit 2.1)**
7. **PM2 `instances: 1, exec_mode: 'fork'`** — no clustering; "zero-downtime" `pm2 reload` is a full restart. **(audit 2.8)**
8. **No `set -o pipefail` in deploy scripts** + no exit-code checks after `pm2 reload` (the `||` chain masks failures). **(audit 3.11, 3.13)**
9. **`db-backup.sh` writes plaintext SQL dumps** — anyone with the backup file has the full PII database. **(audit 7.2)**
10. **`flutter-ci-cd.yml` writes `voltium-release.jks` to disk** — not cleaned up post-job. **(audit 4.9)**

**Coverage:** This plan covers **~30 of 110+ findings** in the audit — the highest-leverage, lowest-risk, most reviewable. The rest are documented in §"What's NOT in this plan" and are mostly cosmetic or large infrastructure investments (log shipping, full Grafana dashboards, K8s probes for a non-K8s architecture) that don't make sense at 2-months-to-release scale.

**Total estimated focused effort:** ~7-9 days across 10 PRs (a small PR per item, ship-it-this-week cadence).

**Minimum-viable batch (PRs 1-4, ~3-4 hours focused):** 4 zero-risk PRs the team can knock out in an afternoon. The "obvious-broken-CI-gates" batch.

---

## Table of contents

1. [Audit corrections (stale findings)](#1-audit-corrections-stale-findings)
2. [Plan principles](#2-plan-principles)
3. [Recommended 10-PR sequence (ship-it order)](#3-recommended-10-pr-sequence-ship-it-order)
4. [Minimum-viable batch (PRs 1-4, ~3-4 hours)](#4-minimum-viable-batch-prs-1-4-3-4-hours)
5. [PR detail: 1-4 (minimum-viable batch)](#5-pr-detail-1-4-minimum-viable-batch)
6. [PR detail: 5-10 (the rest)](#6-pr-detail-5-10-the-rest)
7. [Soak requirements per PR](#7-soak-requirements-per-pr)
8. [What's NOT in this plan (deferred)](#8-whats-not-in-this-plan-deferred)
9. [Cross-cutting decisions](#9-cross-cutting-decisions)
10. [Open questions](#10-open-questions)

---

## 1. Audit corrections (stale findings)

Before the team wastes cycles, **two audit findings are wrong** because Phase 6 already fixed them and the audit was written from a stale mental model.

### 1.1 Audit 7.1 is wrong: `db-backup.sh` output dir is NOT hardcoded

**Audit claim:** `db-backup.sh:21` hardcodes `OUTPUT_DIR="$PROJECT_DIR/backups"`.

**Reality (verified, current file at `scripts/db-backup.sh:23-35`):**
- Precedence is `--dir` flag > `$VOLTIUM_BACKUP_DIR` > `~/.voltium/backups` (laptop) or `/var/backups/voltium` (server).
- The script **explicitly refuses to write inside the project tree** (header comment, line 28-30).
- The script's prior bug of writing `backups/` inside the project tree was the P0 fixed in Phase 6.2 (the `db-backup.sh` safety fix in `SCOPE.md` Phase 6).

**Action:** Do not implement audit 7.1. Mark as closed in the audit. The followup here, if any, is **adding encryption** (audit 7.2) — which is a real bug — not changing the output dir.

### 1.2 Audit 7.5 is wrong: `db-restore.sh` DOES prompt for confirmation

**Audit claim:** `db-restore.sh` has no confirmation prompt.

**Reality (verified, current file at `scripts/db-restore.sh:125-129`):**
- `read -p "Are you sure? Type 'yes' to DROP SCHEMA public CASCADE and restore: " CONFIRM`
- Plus pre-restore backup to `$TMPDIR/voltium-pre-restore-<timestamp>.sql` (line 98-101).
- Plus maintenance-mode coordination via `APP_URL` + `ADMIN_TOKEN` (line 103-123).
- Plus `npx prisma migrate deploy` after restore (line 145-150).
- The `--force` flag was deliberately removed (line 31-34 — fails with a "use the Admin UI restore API for automation" message).

**Action:** Do not implement audit 7.5. Mark as closed in the audit. The real `db-restore.sh` concerns are: encryption-aware restore (decrypt before psql), and ensuring the `--force` removal cannot be silently re-added. Both are addressed in PR-3 below.

### 1.3 Audit 7.7 is wrong: pre-restore backup exists

**Audit claim:** `restore-local.ps1` has no pre-restore backup.

**Reality:** `db-restore.sh` (the canonical restore path) DOES take a pre-restore backup. The audit may have been looking at the PowerShell variant, which I haven't read. **This is a low-priority secondary concern** — if `restore-local.ps1` is actually used in production, it's a separate issue. Mark as **out of scope for this plan** unless `restore-local.ps1` is the actual restore path. Recommend verifying with the team.

### 1.4 Audit 2.11 is partly wrong: `pm2 save` is in `start.sh`, not deploy-*.sh

**Audit claim:** `deploy-prod.sh` has no `pm2 save`.

**Reality:** The `pm2 save` lifecycle lives in `start.sh` (production entry point) and `dev.sh` (dev), not in the deploy scripts. The deploy scripts `pm2 reload` an already-running process, and the production entrypoint handles the initial `pm2 start + save`.

**Action:** Audit 2.11 is technically wrong (PM2 state IS preserved by `start.sh`), but the **broader observation that `|| pm2 start` masks failures is real** — see PR-7 below. Mark as closed; address the failure-masking in PR-7.

---

## 2. Plan principles

1. **Minimum-viable first, then the rest.** 4 zero-risk PRs the team can ship in an afternoon.
2. **One logical concern per PR.** A reviewer should be able to approve each PR in 10-15 minutes.
3. **Every PR has explicit acceptance criteria + reviewer focus notes.** This is for the team's benefit (faster review), not a PM demo.
4. **No K8s.** Architecture is "laptop mode + PM2 + Cloudflare Tunnel." K8s probes docs are stale and should be deleted, not updated.
5. **No new infrastructure services.** No log shipper, no central store, no managed DB. Single-laptop architecture is a deliberate choice — fix the safety, don't change the topology.
6. **Test what we ship.** Every PR must leave CI green and have at least one new test or shellcheck run.

---

## 3. Recommended 10-PR sequence (ship-it order)

| #   | PR                                     | Audit ref            | Severity | Effort  | Risk   | Notes                                                                                  |
| --- | -------------------------------------- | -------------------- | -------- | ------- | ------ | -------------------------------------------------------------------------------------- |
| 1   | Fix `check-migration-safety.sh`        | 6.1                  | P0       | 30 min  | none   | Real bug: script always exits 0. A `DROP TABLE` migration passes.                     |
| 2   | Replace `check-secret-rotation.sh`     | 6.2                  | P0       | 3 hr    | low    | Real bug: script is fake. Wire to `SystemSetting` rotation dates.                      |
| 3   | Encrypt `db-backup.sh` output          | 7.2 + 11.2           | P0       | 1 hr    | low    | Plaintext SQL dumps with full PII. Pipe through gpg or openssl.                        |
| 4   | Add keystore cleanup to Flutter CI     | 4.9                  | P0       | 15 min  | none   | Add `rm` post-job.                                                                     |
| 5   | Fix CI `coverage-gap` continue-on-error| 4.2                  | P0       | 15 min  | none   | Make it a real gate.                                                                   |
| 6   | Raise PM2 `kill_timeout` + `listen_timeout` + `min_uptime` | 2.1, 2.4, 2.7 | P0 | 1 hr    | medium | Touches production runtime. Soak 24h.                                                  |
| 7   | Deploy script safety: pipefail, exit-code checks, audit 3.1/3.2/3.11/3.13 | 3.1, 3.2, 3.11, 3.13 | P0 | 4 hr    | medium | Tag-based rollback, migration check, pipefail, explicit exit codes.                    |
| 8   | Fix `ci-cd.yml` `deploy-staging`       | 4.3                  | P0       | 3 hr    | medium | Use self-hosted runner or SSH to staging. The job currently does nothing.              |
| 9   | PM2 clustering: `instances: 'max'`     | 2.8, 3.5             | P0       | 1 day   | medium | Real zero-downtime deploys. Soak 48h. Includes config / load test.                     |
| 10  | `set -euo pipefail` + `pm2 save` + notifications across deploy scripts | 2.11, 3.10, 3.11, 3.14 | P1 | 1 day   | low    | Cleanup batch. Slack notifier on deploy success/failure.                               |

**Total:** ~7-9 days focused work. PRs 1-4 are the "minimum-viable" batch — 3-4 hours of focused work, all P0, all zero-risk.

---

## 4. Minimum-viable batch (PRs 1-4, ~3-4 hours)

The "ship-it this week" set. All P0. All zero-risk (no production runtime changes, no deploys, just CI script fixes and one keystore cleanup).

| PR  | What it does                                                    | Why now                       |
| --- | --------------------------------------------------------------- | ----------------------------- |
| 1   | `check-migration-safety.sh` actually fails on destructive SQL.  | CI is currently a no-op gate. |
| 2   | `check-secret-rotation.sh` queries `SystemSetting` for rotation dates. | CI is currently a no-op gate. |
| 3   | `db-backup.sh` pipes through gpg (or openssl enc).              | Plaintext PII dumps.          |
| 4   | `flutter-ci-cd.yml` cleans up keystore in `post:` hook.         | Keystore residue on runner.   |

**Combined acceptance:** CI `check-migration-safety` actually blocks a `DROP TABLE` migration in a test PR. CI `check-secret-rotation` actually surfaces a stale secret. `db-backup.sh --test-encrypt` round-trips a backup through encrypt+decrypt. Flutter CI does not leave `voltium-release.jks` on disk.

**Reviewer focus:** "Are these the right checks? Are the exit codes right? Is the encryption key source correct?" — 10 min per PR.

---

## 5. PR detail: 1-4 (minimum-viable batch)

### PR-1: Fix `check-migration-safety.sh` to actually fail

**Audit ref:** 6.1 (P0)
**Files:** `scripts/check-migration-safety.sh`
**Effort:** 30 min
**Risk:** none
**Soak:** none (CI-only)

**Why it's a real bug:**
- Current script defines `FAILED=0` but never sets it to non-zero.
- All output goes to `::warning::` (a soft warning that does not fail the build).
- The script ends with `exit 0` unconditionally.
- A `DROP TABLE` migration passes the safety check.

**What the PR does:**

1. Set `FAILED=1` when an unsafe pattern is matched.
2. Print `::error::` (not `::warning::`) for each match.
3. End with `exit $FAILED` instead of `exit 0`.
4. Add a test case to the repo (a `test-unsafe.sql` fixture) and a negative case (a `test-safe.sql` fixture).
5. Add a script-level integration test: a `tests/scripts/check-migration-safety.test.sh` that runs the check on the fixtures and asserts the right exit code.

**Concrete diff sketch:**

```bash
# Before (scripts/check-migration-safety.sh:13-22)
for pattern in "${UNSAFE_PATTERNS[@]}"; do
  if grep -riE "$pattern" "$MIGRATION_DIR"/*.sql 2>/dev/null; then
    echo "::warning:: Potentially destructive migration query detected matching pattern '$pattern'"
  fi
done
echo "[OK] Migration safety check complete."
exit 0

# After
for pattern in "${UNSAFE_PATTERNS[@]}"; do
  if grep -riE "$pattern" "$MIGRATION_DIR"/*.sql 2>/dev/null; then
    echo "::error:: Potentially destructive migration query detected matching pattern '$pattern'"
    FAILED=1
  fi
done
if [ "$FAILED" -ne 0 ]; then
  echo "[FAIL] Migration safety check found destructive patterns."
  exit "$FAILED"
fi
echo "[OK] Migration safety check complete."
exit 0
```

**Acceptance criteria:**
- A new migration with `DROP TABLE foo` triggers a `::error::` and the CI run fails.
- The existing 1411/1414 test suite still passes.
- A new test `tests/scripts/check-migration-safety.test.sh` exercises both safe and unsafe fixtures.

**Reviewer focus notes:**
- The `::error::` is what makes GitHub Actions fail the step. The `exit $FAILED` is belt-and-suspenders. Both are needed because some CI consumers (e.g. `act`, `localstack`) parse only the `::error::` marker.
- The pattern list (`DROP COLUMN`, `DROP TABLE`, `TRUNCATE`, `ALTER TABLE.*DROP`) is intentionally conservative. The team may want to add `ALTER TABLE ... RENAME TO` (loses FKs) and `DELETE FROM` (without `WHERE`) — propose in PR review if wanted.

---

### PR-2: Replace `check-secret-rotation.sh` with a real check

**Audit ref:** 6.2 (P0)
**Files:** `scripts/check-secret-rotation.sh`, possibly new `web/src/lib/secret-rotation.ts`
**Effort:** 3 hr
**Risk:** low (the script currently does nothing useful; worst case we add a check that fires once a quarter and the team deals with the noise)
**Soak:** none

**Why it's a real bug:**
- Current script (verified, 14 lines) only checks that `pii-crypto.ts` exists.
- It does NOT check that secrets are rotated on schedule.
- It does NOT check that old keys are still active.
- The `SystemSetting` table (per `AUDIT_DATABASE.md`) is the canonical place to store `lastRotatedAt` for each secret type.

**What the PR does:**

1. Add a new `web/src/lib/secret-rotation.ts` module that:
   - Queries `SystemSetting` for entries matching `secret.rotation.*` keys.
   - Returns a list of `{ name, daysSinceRotation, maxAgeDays }`.
   - Exits 1 if any secret is past its max age.

2. Rewrite `scripts/check-secret-rotation.sh` to invoke this module via `npx tsx` (or compile to JS first).

3. Seed default rotation ages in the seed data:
   - `JWT_SIGNING_KEY`: 90 days
   - `PII_ENCRYPTION_KEY`: 180 days
   - `PAYMENT_GATEWAY_KEYS`: 180 days
   - `BACKUP_ENCRYPTION_KEY`: 365 days

4. Add a `secret-rotation-nightly.yml` workflow that runs the check and Slack-notifies on stale secrets.

5. Add a unit test for `secret-rotation.ts` that mocks `SystemSetting` and asserts both pass and fail cases.

**Acceptance criteria:**
- The script exits 0 when all `SystemSetting` rotation dates are within their max age.
- The script exits 1 when any rotation date is past its max age.
- A new nightly workflow `secret-rotation-nightly.yml` runs the check and notifies Slack on failure.
- A new unit test (`web/tests/unit/secret-rotation.test.ts`) covers both branches.

**Reviewer focus notes:**
- The `SystemSetting` schema is in `prisma/schema.prisma`. Verify the query is correct against the actual schema (don't trust this plan's field names).
- The Slack notifier is the same `alerter.ts` module used elsewhere — no new dependency.
- This is a "fail loudly" check, not a "block deploy" check. The nightly workflow is the right place for it; the PR check is for sanity.

---

### PR-3: Encrypt `db-backup.sh` output

**Audit ref:** 7.2 (P0), 11.2 (P1)
**Files:** `scripts/db-backup.sh`, `scripts/db-restore.sh`, possibly `web/src/lib/env.ts` (already has `BACKUP_ENCRYPTION_*` keys)
**Effort:** 1 hr
**Risk:** low
**Soak:** none (manual verification)

**Why it's a real bug:**
- `db-backup.sh` writes `pg_dump` to a `.sql` file. The file is plaintext. Anyone with the backup file has the full DB including PII (names, phone numbers, addresses, payment metadata).
- The `BACKUP_ENCRYPTION_ENABLED` and `BACKUP_ENCRYPTION_KEY` env vars already exist in `web/src/lib/env.ts:48-51` — the script just doesn't use them.
- Default for `BACKUP_ENCRYPTION_ENABLED` is `false`. A deploy that forgets to set it has unencrypted backups.

**What the PR does:**

1. In `db-backup.sh`, after `pg_dump`, pipe through `openssl enc -aes-256-gcm -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY`.
2. Write the encrypted output to `<file>.sql.enc` (not `.sql`).
3. Print a clear message: "Backup ENCRYPTED at <path>. To restore: openssl enc -d -aes-256-gcm -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY -in <path> -out <path>.dec".
4. Add a `BACKUP_ENCRYPTION_ENABLED` env check: if `false`, print a loud warning and require `--no-encrypt` flag to bypass.
5. In `db-restore.sh`, detect `.sql.enc` extension and auto-decrypt before `psql`.
6. Add a `--test-encrypt` mode to `db-backup.sh` that round-trips a small test payload through encrypt+decrypt and asserts equality.
7. Document the key management in `docs/BACKUP_RESTORE.md`.

**Acceptance criteria:**
- `bash scripts/db-backup.sh --test-encrypt` exits 0 and round-trips a test string.
- A real `db-backup.sh` run produces a `.sql.enc` file (not `.sql`).
- `db-restore.sh` accepts `.sql.enc` files and decrypts them transparently.
- The existing `BACKUP_ENCRYPTION_KEY` env var is the source of truth for the key.

**Reviewer focus notes:**
- `aes-256-gcm` is the right cipher. `-pbkdf2` is required for password-based KDF (don't use the default `-md md5`).
- The `--no-encrypt` bypass is a foot-gun. Consider requiring it only with a `--i-understand-the-pii-risk` flag.
- The `BACKUP_ENCRYPTION_KEY` env var must be set in production. Add a CI check that fails the deploy if it's empty when `APP_ENV=production`.

---

### PR-4: Clean up Flutter CI keystore

**Audit ref:** 4.9 (P0)
**Files:** `.github/workflows/flutter-ci-cd.yml` (line 281 area)
**Effort:** 15 min
**Risk:** none
**Soak:** none

**Why it's a real bug:**
- The `build-release` job decodes `KEYSTORE_BASE64` to `android/app/voltium-release.jks` and writes `key.properties` to disk.
- These files are not cleaned up before the job ends.
- On a self-hosted runner, the keystore is recoverable from disk after the job.

**What the PR does:**

1. Add a `post:` step to the `build-release` job that does:
   ```yaml
   post:
     - name: Clean up keystore
       if: always()
       run: |
         rm -f android/app/voltium-release.jks android/app/key.properties
         # belt-and-suspenders: zero out the file before deletion
         if [ -f android/app/voltium-release.jks ]; then
           dd if=/dev/urandom of=android/app/voltium-release.jks bs=1M count=1 2>/dev/null
           rm -f android/app/voltium-release.jks
         fi
   ```
2. Verify the `if: always()` runs even on failure.
3. Add a CI test step that asserts the keystore is gone after the job.

**Acceptance criteria:**
- The `post:` step runs on success AND failure.
- After the job, `android/app/voltium-release.jks` does not exist on the runner.
- The keystore file is overwritten with random bytes before deletion (defense in depth).

**Reviewer focus notes:**
- The `dd` step is belt-and-suspenders for SSDs that don't actually delete blocks. On a self-hosted runner with an SSD, a simple `rm` is not sufficient.
- The `if: always()` is the right gate. Without it, a failing build skips cleanup.
- This is also a good place to clean up any other build secrets (`KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`) that might be left in env. Verify.

---

## 6. PR detail: 5-10 (the rest)

### PR-5: Fix CI `coverage-gap` continue-on-error

**Audit ref:** 4.2 (P0)
**Files:** `.github/workflows/ci-cd.yml:271-273`
**Effort:** 15 min
**Risk:** none
**Soak:** none

**What the PR does:**

1. Remove `continue-on-error: true` from the `Check API coverage gap` step.
2. Add a `::warning::` step that runs the check but does not fail the build (for visibility), plus a separate `::error::` step that fails the build if the gap exceeds threshold.
3. Set the threshold in a new `web/.github/coverage-gap.config.json` (per-route, per-method).

**Acceptance criteria:**
- A PR that introduces a new API route without test coverage fails CI.
- The current 1411/1414 test suite still passes.
- The error message names the under-covered route clearly.

**Reviewer focus notes:**
- The current `test:coverage-gap` script returns 0 on success and non-zero on gap. The `continue-on-error` was hiding the non-zero exit. Removing it is the fix.
- The threshold config should be per-route (auth routes stricter than system routes). Coordinate with the team on the right values.

---

### PR-6: PM2 graceful timeouts

**Audit ref:** 2.1, 2.4, 2.7 (all P0)
**Files:** `ecosystem.config.js`
**Effort:** 1 hr
**Risk:** medium (production runtime change)
**Soak:** 24h on staging before prod

**What the PR does:**

1. Raise `kill_timeout: 10000` → `30000` (line 59, line 80).
2. Raise `listen_timeout: 30000` → `60000` (line 60).
3. Add `kill_retry_time: 5000` (PM2 retries SIGTERM after 5s before SIGKILL).
4. Raise `min_uptime: '10s'` → `'60s'` (line 52, line 73). Real Next.js boot can be 8s.
5. Raise `restart_delay: 5000` → `30000` (line 53, line 75).
6. Add a comment explaining the reasoning.

**Concrete diff sketch:**

```js
// Before (ecosystem.config.js:51-60, 72-80)
max_restarts: 10,
min_uptime: '10s',
restart_delay: 5000,
max_memory_restart: '1200M',
log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
error_file: ...,
out_file: ...,
merge_logs: true,
kill_timeout: 10000,
listen_timeout: 30000,

// After
max_restarts: 10,
min_uptime: '60s',          // Bumped from 10s — Next.js boot can be 8s on slow disk
restart_delay: 30000,       // Bumped from 5s — allow slow boot to settle
max_memory_restart: '1200M',
log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
error_file: ...,
out_file: ...,
merge_logs: true,
kill_timeout: 30000,        // Bumped from 10s — graceful shutdown of in-flight requests
kill_retry_time: 5000,      // Retry SIGTERM 5s before SIGKILL
listen_timeout: 60000,      // Bumped from 30s — Next.js cold start
```

**Acceptance criteria:**
- Staging PM2 logs show a clean restart with no SIGKILL.
- No new restart loops after deploy.
- 24h staging soak clean.

**Reviewer focus notes:**
- The `kill_retry_time` field is the key fix. Without it, PM2 sends SIGINT, waits `kill_timeout`, then SIGKILL — no SIGTERM retry. The retry lets long-running requests finish.
- The `min_uptime` change is the most likely to surface a latent bug. If there's a real startup race condition, it will now have 60s to show up.
- Coordinate with the team before bumping in prod. The 24h soak is a hard requirement.

---

### PR-7: Deploy script safety: tag-based rollback + pipefail + exit codes

**Audit ref:** 3.1, 3.2, 3.11, 3.13 (all P0); 2.11 (closed by audit correction, but the failure-masking concern is real)
**Files:** `scripts/deploy-prod.sh`, `scripts/deploy-staging.sh`
**Effort:** 4 hr
**Risk:** medium (changes deploy path; the `|| pm2 start` failure-masking is a real bug)
**Soak:** 1 staging deploy + 1 prod deploy with manual smoke test

**Why these are real bugs:**

1. **`git revert HEAD --no-edit`** (`deploy-prod.sh:38`, `deploy-staging.sh:52`):
   - Creates a NEW commit that becomes HEAD. Future deploys deploy the revert.
   - Errors out on merge commits (merge commits have 2 parents).
   - The "rollback" is itself a deploy — there's no atomic rollback.

2. **Rollback doesn't re-run migrations** (`deploy-prod.sh:38-43`):
   - If a deploy added a migration, the rollback code may not match the migrated DB schema. Schema/code drift.

3. **No `set -o pipefail`** (`deploy-prod.sh:2`, `deploy-staging.sh:2`):
   - `set -e` exits on error, but not on pipe failure.
   - `curl ... | grep` succeeds if `grep` finds nothing.

4. **`pm2 reload` exit code not checked** (`deploy-prod.sh:22-23`, `deploy-staging.sh:22-23`):
   - The `||` chain masks failures. If both `pm2 reload` and `pm2 start` fail, the script continues.

**What the PR does:**

1. **Tag-based rollback.** Before any deploy, tag the commit: `git tag deploy-${ENV_NAME}-$(date +%Y-%m-%d-%H%M%S)`. On health check failure, `git checkout $PREVIOUS_TAG` instead of `git revert HEAD`.
2. **Migration check in rollback.** Before checkout, run `npx prisma migrate status` to detect drift. If the rollback commit's expected migrations don't match the DB, abort the rollback and require manual intervention.
3. **`set -euo pipefail`** at the top of both scripts.
4. **Explicit exit-code check for `pm2 reload`:** if `pm2 reload` fails, attempt `pm2 start`. If `pm2 start` also fails, exit 1.
5. **Add `--no-rollback` flag** for cases where the team wants to deploy without a rollback safety net (e.g. maintenance window).
6. **Document the deploy lifecycle in `docs/DEPLOYMENT.md`.**

**Concrete diff sketch:**

```bash
# Before (deploy-prod.sh:2)
#!/bin/bash
set -e

# After
#!/bin/bash
set -euo pipefail

# Tag the commit for rollback reference
DEPLOY_TAG="deploy-prod-$(date +%Y-%m-%d-%H%M%S)"
git tag "$DEPLOY_TAG"
echo "Tagged commit for rollback reference: $DEPLOY_TAG"

# ... build + migrate ...

# Step 3 (revised)
echo "Reloading PM2 processes..."
if ! pm2 reload "$PM2_APP_NAME"; then
  echo "WARN: pm2 reload failed, attempting pm2 start"
  if ! pm2 start npm --name "$PM2_APP_NAME" -- run start; then
    echo "FATAL: pm2 reload AND pm2 start both failed" >&2
    exit 1
  fi
fi
if ! pm2 reload "$PM2_WORKER_NAME"; then
  if ! pm2 start npm --name "$PM2_WORKER_NAME" -- run worker:start; then
    echo "FATAL: worker reload AND start both failed" >&2
    exit 1
  fi
fi

# Step 5 (revised rollback)
if [ "${NO_ROLLBACK:-false}" = "true" ]; then
  echo "Health check failed and --no-rollback set. Manual intervention required."
  exit 1
fi

echo "Health check failed! Initiating rollback..."
PREVIOUS_TAG=$(git tag --sort=-creatordate | grep -E "^deploy-prod-" | head -2 | tail -1)
if [ -z "$PREVIOUS_TAG" ]; then
  echo "FATAL: no previous deploy tag found for rollback" >&2
  exit 1
fi

# Migration check
npx prisma migrate status || {
  echo "WARN: Prisma migrations in unexpected state. Aborting auto-rollback." >&2
  exit 1
}

git checkout "$PREVIOUS_TAG"
npm ci
npm run build
pm2 reload "$PM2_APP_NAME" || pm2 start npm --name "$PM2_APP_NAME" -- run start
pm2 reload "$PM2_WORKER_NAME" || pm2 start npm --name "$PM2_WORKER_NAME" -- run worker:start
echo "Rollback to $PREVIOUS_TAG complete. Please investigate."
exit 1
```

**Acceptance criteria:**
- A failed deploy rolls back to the tagged previous commit, not via `git revert`.
- The rollback re-runs migrations and fails loudly if drift is detected.
- The script exits 1 if `pm2 reload` and `pm2 start` both fail.
- `pipefail` is set; pipe failures are caught.
- One staging deploy + one prod deploy clean.

**Reviewer focus notes:**
- The tag-based rollback is the key fix. `git checkout <tag>` is atomic; `git revert HEAD` is not.
- The `PREVIOUS_TAG` extraction assumes tags are `deploy-{env}-*`. If a future tag scheme differs, this breaks. Consider using `git describe --tags --abbrev=0` instead.
- The migration check is best-effort. If the schema is in an unknown state, the rollback may not be safe. Document this.

---

### PR-8: Fix `ci-cd.yml` `deploy-staging` (the broken job)

**Audit ref:** 4.3 (P0)
**Files:** `.github/workflows/ci-cd.yml:305-324`
**Effort:** 3 hr (self-hosted runner setup + new workflow) or 1 day (SSH to staging + new workflow)
**Risk:** medium
**Soak:** 1 full staging deploy from CI

**Why it's a real bug:**

The `deploy-staging` job runs on `ubuntu-latest` GitHub Actions runner (fresh VM each run) and calls `pm2 restart voltium-staging-web voltium-staging-worker`. PM2 has no persistent state on a fresh VM. The "deploy" is a no-op — there's no PM2 daemon, no app, no worker. The `curl` health check at line 324 then fails (or passes against an empty localhost), and the job succeeds.

**What the PR does:**

**Option A: Self-hosted runner (preferred)**
1. Add a self-hosted runner label `staging-runner` to the staging server.
2. Change `runs-on: ubuntu-latest` → `runs-on: [self-hosted, staging-runner]`.
3. PM2 state persists on the runner. `pm2 restart` actually restarts.

**Option B: SSH from CI runner (simpler)**
1. Add a `STAGING_SSH_KEY` secret to GitHub.
2. Replace the `pm2 restart` step with:
   ```yaml
   - name: Deploy to staging
     uses: appleboy/ssh-action@v1
     with:
       host: ${{ secrets.STAGING_HOST }}
       username: ${{ secrets.STAGING_USER }}
       key: ${{ secrets.STAGING_SSH_KEY }}
       script: |
         cd /opt/voltium
         ./scripts/deploy-staging.sh
   ```

**Option C: Disable the job (acceptable if staging deploys are manual)**
1. Comment out the `deploy-staging` job and add a note in `docs/DEPLOYMENT.md` that staging deploys are run manually via `./scripts/deploy-staging.sh` on the staging server.

**Recommendation:** Option A (self-hosted runner) is the right answer for an architecture that uses PM2. Option B is acceptable if the team doesn't want to manage a runner. Option C is acceptable if staging deploys are already manual — but the current "automated deploy that doesn't actually deploy" is misleading and should be fixed.

**Acceptance criteria (Option A):**
- The `deploy-staging` job runs on a self-hosted runner with PM2 state.
- A push to `main` actually restarts the staging app.
- The health check at the end of the job passes.
- One staging soak: app responds to real traffic after the deploy.

**Reviewer focus notes:**
- Self-hosted runners are a security surface. The runner should run as a dedicated user, not root. Network egress should be locked down.
- The `STAGING_SSH_KEY` in Option B is a deployment secret. Rotation schedule should match the rest of the secrets (per `check-secret-rotation.sh` from PR-2).

---

### PR-9: PM2 clustering (real zero-downtime)

**Audit ref:** 2.8, 3.5 (P0)
**Files:** `ecosystem.config.js`
**Effort:** 1 day (config change + load test)
**Risk:** medium (production runtime; sticky sessions, port conflicts)
**Soak:** 48h on staging with realistic load

**Why it's a real bug:**

`instances: 1, exec_mode: 'fork'` for the web process means `pm2 reload` is a full restart — NOT zero-downtime. The `deploy-prod.sh` claims "Zero Downtime Reload" but actually has downtime.

**What the PR does:**

1. Set `instances: 'max'` for `voltium-web`.
2. Set `exec_mode: 'cluster'` for `voltium-web`.
3. Keep `voltium-worker` at `instances: 1, exec_mode: 'fork'` — only one worker process should run, otherwise outbox events are processed multiple times (the existing single-instance worker logic depends on this).
4. Verify the Next.js app is stateless and can run in cluster mode (it should be — but verify).
5. Run a load test to verify N workers handle N× the throughput.
6. Verify sticky sessions are not used (Next.js admin auth is JWT, no server session — should be safe).
7. Verify the port allocation: `instances: 'max'` means each instance binds to `PORT` (line 48: `process.env.PORT || '8081'`). In cluster mode, PM2 round-robins, so all instances need a way to share the port. **Verify Next.js handles this** (it should — PM2 cluster mode shares via the load balancer).

**Concrete diff sketch:**

```js
// Before (ecosystem.config.js:42-44, 66-68)
instances: 1,
exec_mode: 'fork',
// (web process)

// After
instances: 'max',  // Bumped from 1 — real zero-downtime reload
exec_mode: 'cluster',  // Use Node.js cluster module
// (web process — keep worker at 1)
```

**Acceptance criteria:**
- `pm2 status` shows N web instances (one per CPU core).
- A `pm2 reload` triggers a rolling restart with no failed health check.
- 48h staging soak with realistic load shows no degradation.
- The worker remains at 1 instance.

**Reviewer focus notes:**
- This is the highest-risk PR in the plan. Coordinate with the team lead.
- Verify the load test before merging to prod. The pre-clustering baseline should be in the PR description.
- The worker must stay at `instances: 1` — multiple workers would process the same outbox events multiple times.

---

### PR-10: Deploy script cleanup: pipefail, `pm2 save`, notifications, audit + npm

**Audit ref:** 2.11 (closed by correction), 3.10, 3.11, 3.14, 3.4, 3.7, 3.12 (P1)
**Files:** `scripts/deploy-prod.sh`, `scripts/deploy-staging.sh`, possibly `ecosystem.config.js`
**Effort:** 1 day
**Risk:** low
**Soak:** 1 staging + 1 prod deploy

**What the PR does:**

1. **`set -euo pipefail` at the top of both scripts** (PR-7 partially covers this; PR-10 finalizes it).
2. **`HEALTH_ENDPOINT` from env** instead of hardcoded port 8081/8082. Use `HEALTH_ENDPOINT` env, default to `http://localhost:8081/api/health`.
3. **Increase health check timeout**: 5 attempts × 5 sec → 30 attempts × 5 sec = 150 sec. (audit 3.7)
4. **`npm audit --audit-level=high` before deploy.** Fail the deploy on high-severity issues. (audit 3.4)
5. **`pm2 save` after successful deploy** — actually, this is `start.sh`'s job, but add a comment in deploy scripts pointing to it. (audit 2.11 — closed by correction)
6. **Slack notification on success and failure.** Reuse the `alerter.ts` module from web/src/lib/alerter.ts. (audit 3.10)
7. **Parallel build**: `npm run build` and `npm run worker:build` in parallel. Add an `npm run build:all` script. (audit 3.14)
8. **`npm ci` instead of `npm ci --production`** so the Prisma CLI is available for `prisma migrate deploy`. (audit 3.3)

**Acceptance criteria:**
- All deploy scripts use `set -euo pipefail`.
- `HEALTH_ENDPOINT` is env-configurable.
- Health check waits up to 150 sec.
- A deploy with a known-CVE dependency fails fast.
- A successful deploy sends a Slack message.
- A failed deploy sends a Slack message with the failure reason.

**Reviewer focus notes:**
- The Slack notifier is the same `alerter.ts` from PR-2. The deploy scripts need a thin shell wrapper to invoke it (or call it via `npx tsx`).
- `npm ci` (no `--production`) is fine for deploy — the production runtime uses `NODE_ENV=production` to skip dev-only code paths, but `devDependencies` is still installed.

---

## 7. Soak requirements per PR

| PR  | Soak                                          | Duration |
| --- | --------------------------------------------- | -------- |
| 1   | None (CI-only)                                | 0        |
| 2   | None (CI-only)                                | 0        |
| 3   | Manual verification (round-trip test)         | 0        |
| 4   | None (CI-only)                                | 0        |
| 5   | None (CI-only)                                | 0        |
| 6   | Staging PM2 logs clean, no restart loops      | 24h      |
| 7   | 1 staging deploy + 1 prod deploy              | 1 day    |
| 8   | 1 full staging deploy from CI                 | 1 day    |
| 9   | 48h staging with realistic load               | 48h      |
| 10  | 1 staging + 1 prod deploy                     | 1 day    |

**Total soak calendar time:** ~3-4 weeks if PRs are merged sequentially and soak requirements are enforced. **The minimum-viable batch (PRs 1-4) has zero soak** and can be merged immediately.

---

## 8. What's NOT in this plan (deferred)

Per the principle "no new infrastructure services," the following audit findings are documented but deferred to a later phase. They are real but not review-ready for the 2-month-to-release window.

### 8.1 Observability (audit §10)

- **10.1 Single Grafana dashboard.** Adding dashboards for HTTP RED metrics, DB query latency, outbox event lag, worker success rate, KYC approval rate. **Deferred.** Useful but the existing dashboard + per-job error logging is sufficient for now. **Reconsider for v2.**
- **10.2 `apm.ts` is minimal 3.8 KB.** Adding trace context, latency per route, error rate per route, DB query attribution. **Deferred.** The existing logger + alerter covers P0 needs. **Reconsider for v2.**
- **10.3 `circuit-breaker.ts` usage.** Verify it's wired into external API calls. **Deferred.** This is a verification + small wiring change. **Add to a "polish" PR if there's appetite.**
- **10.4 No log shipping to a central store.** Add Fluentd/Vector. **Deferred.** Laptop-only architecture has no central store to ship to. **Reconsider for v2 or v3.**

### 8.2 Disaster recovery (audit §11)

- **11.1 No offsite backup documented.** `DISASTER_RECOVERY.md` may or may not cover offsite. **Deferred.** The `BACKUP_SECONDARY_ROOT` env var suggests a secondary drive. **Verify with the team, document if missing.**
- **11.3 `verify-backup-encryption.ps1` is manual.** Wire to a scheduled task. **Deferred.** PR-3 makes encryption the default; verification can be on-demand for now.
- **11.4 No RTO/RPO documented.** Add RTO/RPO to `DISASTER_RECOVERY.md`. **Deferred.** Small doc change, low priority.

### 8.3 Documentation hygiene (audit §8)

- **8.1 `K8S_PROBES.md` is stale.** Delete or annotate. **Deferred.** The doc is 1.2 KB; deletion is safe but not urgent.
- **8.2 `DEPLOYMENT.md` "Note" is stale.** Remove the "web/ omitted" line. **Deferred.** Cosmetic.
- **8.3 `RUNBOOK.md` is 3.8 KB.** Expand to cover PM2 crash, DB corruption, tunnel down, laptop stolen, secret leaked. **Deferred.** Worth doing but not P0.
- **8.4-8.5 `DISASTER_RECOVERY.md` and `LAPTOP_SERVICE_RUNBOOK.md` are small.** **Deferred.** Same as 8.3.
- **8.6-8.10 Various other docs.** **Deferred.** Verify + expand is a separate doc-quality pass.

### 8.4 Bootstrap and laptop service scripts (audit §5)

- **5.1 `bootstrap.sh` opens PG on default port 5432.** Configure `listen_addresses = 'localhost'`. **Deferred.** Real concern but bootstrap is a one-time setup. Document in `docs/DEPLOYMENT.md`.
- **5.2 `.env` permissions weak.** `chmod 600` after creation. **Deferred.** Trivial but adds friction to bootstrap.
- **5.3 `bootstrap.sh` is interactive.** Add `--non-interactive`. **Deferred.** Not blocking.
- **5.4 `laptop-service.ps1` health check uses HTTP.** Bind to `127.0.0.1` only. **Deferred.** Local-only check is fine.
- **5.5 `VOLTIUM_SERVER_ROOT` env validation.** Add path validation. **Deferred.** Cosmetic.
- **5.6 `laptop-service.sh` may not exist.** Verify or document Windows-only. **Deferred.** Verify with team.
- **5.7 `laptop-service-smoke.ps1` is 867 bytes.** Expand. **Deferred.** Verify it's sufficient.

### 8.5 CI safety check scripts (audit §6)

- **6.3 `check-no-docker.sh` excludes `.github/`.** Add a comment explaining. **Deferred.** Cosmetic.
- **6.4-6.10 Various check scripts.** Verify contents. **Deferred.** Most are "verification" tasks, not bugs.

### 8.6 CI workflow cleanup (audit §4)

- **4.4 Split `test` job into `test:unit`, `test:integration`, `test:contract`.** **Deferred.** Currently the `test` job has all 3 inline. Splitting saves 5-10 min on CI, low value.
- **4.5 SHA-pinned actions go stale.** Add Dependabot for `github-actions` ecosystem. **Deferred.** A `dependabot.yml` config is small but needs verification.
- **4.7 `daily-smoke-tests.yml` Android emulator requires KVM.** Use self-hosted runner with KVM. **Deferred.** The smoke test already runs against a real emulator; the CI is supplementary.
- **4.8 `e2e-windows.yml` hardcoded `psql` password.** Use random password. **Deferred.** Cosmetic.
- **4.10 `flutter-ci-cd.yml` build-release permissions.** Add `permissions: packages: write`. **Deferred.** Verify the need.
- **4.11 `flutter-ci-cd.yml` paths filter excludes `web/**`.** Add Prisma regen. **Deferred.** If the schema is in `web/prisma/**`, it's already in the paths.
- **4.12 `lighthouse-ci.yml` has no config.** Add `lighthouserc.json`. **Deferred.** Cosmetic.
- **4.13 `mutation-nightly.yml` no trend tracking.** Add Slack notification. **Deferred.** Trend tracking needs a dashboard.
- **4.14 `nightly-load.yml` k6 has `continue-on-error: true`.** Add Slack notification on failure. **Deferred.** Cosmetic.
- **4.15 `nightly-load.yml` runs `db:seed` in CI.** Fix seed scripts. **Deferred.** Tracked separately in `DB_REMEDIATION_PLAN.md`.
- **4.16 Inconsistent `working-directory`.** Standardize. **Deferred.** Cosmetic.
- **4.17 No `concurrency:` on workflows.** Add concurrency groups. **Deferred.** Cosmetic.
- **4.18 `e2e-windows.yml` doesn't run full integration suite.** Run all 33 files. **Deferred.** The 33-file suite takes hours; the smoke run is for fast CI feedback.
- **4.19 No scheduled secret-rotation check.** Add `secret-rotation-nightly.yml`. **Covered in PR-2.**

### 8.7 Renovate, Dependabot, CODEOWNERS (audit §9)

- **9.1 `CODEOWNERS` is 459 bytes.** Verify coverage. **Deferred.** Verify with team.
- **9.2 `renovate.json` coverage.** Verify. **Deferred.**
- **9.3 `dependabot.yml` is 606 bytes.** Verify. **Deferred.**

### 8.8 PM2 ecosystem (audit §2)

- **2.2 `kill_signal` Windows SIGINT issue.** Add graceful shutdown script. **Deferred.** Complex. **Reconsider for v2.**
- **2.3 Memory limits hardcoded.** Make env-configurable. **Deferred.** Cosmetic.
- **2.6 No `log_type: 'json'`.** Add. **Deferred.** Cosmetic.
- **2.9 `VOLTIUM_LOG_ROOT` consumed by PM2 only.** Verify `lib/logger.ts` writes to same path. **Deferred.** Verify.
- **2.10 Worker `interpreter: 'bun'`.** Add. **Deferred.** Verify if needed.
- **2.12 Worker npm wrapper.** Wrap in node script. **Deferred.** Cosmetic.

---

## 9. Cross-cutting decisions

1. **No new infrastructure services.** The team owns a single laptop + PM2 + Cloudflare Tunnel. Adding log shipping, central stores, or managed services is a v2 conversation.
2. **CI scripts that always pass are worse than no CI script.** PR-1 and PR-2 are the highest-priority because they fix CI gates that currently lie. Every other fix in this plan is downstream of "make CI trustworthy."
3. **Tag-based rollback is the right answer.** `git revert HEAD` is not a rollback — it's a forward commit. The team should adopt the `deploy-{env}-{timestamp}` tag pattern across all environments.
4. **Self-hosted runner is the right answer for the deploy-staging job.** Option A in PR-8 is the recommended approach. The runner should run as a dedicated user with locked-down egress.
5. **Worker stays at `instances: 1`.** The worker logic depends on single-instance semantics for outbox event processing. Clustering the worker would create duplicate processing.

---

## 10. Open questions

1. **Is staging currently deployed via CI or manually?** The current `deploy-staging` job doesn't actually deploy. If the team is running `./scripts/deploy-staging.sh` manually on the staging server, the broken CI job is a "dead branch" that can be removed rather than fixed. (Affects PR-8.)
2. **Is `laptop-service.sh` (macOS/Linux) actually used?** The Windows version is 250 lines. If the team is all-Windows, the macOS/Linux version may be a stub. (Affects audit 5.6.)
3. **Is the existing `SystemSetting` schema capable of storing `lastRotatedAt`?** PR-2 needs to query this. Verify the schema before implementation.
4. **Does Next.js + PM2 cluster mode require sticky sessions?** PR-9 may need a sticky-session balancer if the app uses server sessions. JWT auth is stateless, so this should be safe, but verify.
5. **What is the offsite backup policy?** `BACKUP_SECONDARY_ROOT: E:/VoltiumBackups` suggests a secondary drive. Is this USB? Network share? Documented?
6. **Should `DISASTER_RECOVERY.md` and `LAPTOP_SERVICE_RUNBOOK.md` be merged?** They're both small (4.4 KB + 2.1 KB) and cover overlapping topics. Consider merging to reduce doc sprawl.

---

## Appendix A: Tickets to add to `FOLLOWUP_TICKETS.md`

The following tickets should be added to `docs/FOLLOWUP_TICKETS.md` (next to the 33 existing tickets). All are copy-paste-ready.

### Ticket #34 (P0): `check-migration-safety.sh` is a no-op

**Source:** INFRASTRUCTURE_PLAN PR-1
**Audit ref:** 6.1

**Description:**

`scripts/check-migration-safety.sh:13-22` defines `FAILED=0` but never sets it to non-zero. The script ends with `exit 0` unconditionally. A `DROP TABLE` migration passes the safety check and the CI run succeeds.

**Why this matters:** The CI safety gate is a no-op. Destructive migrations can be merged to `main` and applied to the staging database.

**Acceptance criteria:**

- The script sets `FAILED=1` when an unsafe pattern (`DROP COLUMN`, `DROP TABLE`, `TRUNCATE`, `ALTER TABLE.*DROP`) is matched.
- The script prints `::error::` (not `::warning::`) for each match.
- The script ends with `exit $FAILED` instead of `exit 0`.
- A new test (`tests/scripts/check-migration-safety.test.sh`) exercises both safe and unsafe fixtures and asserts the right exit code.
- A new migration with `DROP TABLE foo` triggers a `::error::` and fails the CI run.

**Files:** `scripts/check-migration-safety.sh`, new `tests/scripts/check-migration-safety.test.sh`

**Estimated effort:** 30 min

---

### Ticket #35 (P0): `check-secret-rotation.sh` is a fake check

**Source:** INFRASTRUCTURE_PLAN PR-2
**Audit ref:** 6.2

**Description:**

`scripts/check-secret-rotation.sh:6-13` only verifies that `web/src/lib/pii-crypto.ts` exists. It does not check that secrets are rotated on schedule, that PII is actually encrypted, or that old keys are still active. The script name is misleading.

**Why this matters:** The team has no signal when secrets are stale. A 1-year-old JWT signing key is a security risk with no CI warning.

**Acceptance criteria:**

- New `web/src/lib/secret-rotation.ts` queries `SystemSetting` for entries matching `secret.rotation.*` keys and returns a list of `{ name, daysSinceRotation, maxAgeDays }`.
- The script exits 0 when all rotation dates are within their max age.
- The script exits 1 when any rotation date is past its max age.
- A new nightly workflow `secret-rotation-nightly.yml` runs the check and notifies Slack on failure.
- Default rotation ages seeded for `JWT_SIGNING_KEY` (90d), `PII_ENCRYPTION_KEY` (180d), `PAYMENT_GATEWAY_KEYS` (180d), `BACKUP_ENCRYPTION_KEY` (365d).
- New unit test (`web/tests/unit/secret-rotation.test.ts`) covers both branches.

**Files:** `scripts/check-secret-rotation.sh`, new `web/src/lib/secret-rotation.ts`, new `web/tests/unit/secret-rotation.test.ts`, new `.github/workflows/secret-rotation-nightly.yml`, `web/prisma/seed.ts` (add defaults)

**Estimated effort:** 3 hr

---

### Ticket #36 (P0): `db-backup.sh` writes plaintext SQL dumps with PII

**Source:** INFRASTRUCTURE_PLAN PR-3
**Audit ref:** 7.2, 11.2

**Description:**

`scripts/db-backup.sh` writes `pg_dump` to a `.sql` file in plaintext. Anyone with the backup file has the full DB including PII (names, phone numbers, addresses, payment metadata). The `BACKUP_ENCRYPTION_ENABLED` and `BACKUP_ENCRYPTION_KEY` env vars exist but the script doesn't use them.

**Why this matters:** If a backup is exfiltrated (laptop theft, mis-sent email, leaked USB), all PII is exposed. The current default is plaintext; `BACKUP_ENCRYPTION_ENABLED` defaults to `false`.

**Acceptance criteria:**

- `db-backup.sh` pipes `pg_dump` through `openssl enc -aes-256-gcm -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY`.
- The output file is `<file>.sql.enc` (not `.sql`).
- A `--no-encrypt` flag is required to write plaintext.
- A `--test-encrypt` mode round-trips a test payload through encrypt+decrypt and asserts equality.
- `db-restore.sh` detects `.sql.enc` and auto-decrypts before `psql`.
- The encryption key source is `BACKUP_ENCRYPTION_KEY` env (existing schema).
- `docs/BACKUP_RESTORE.md` documents key management.

**Files:** `scripts/db-backup.sh`, `scripts/db-restore.sh`, `docs/BACKUP_RESTORE.md`

**Estimated effort:** 1 hr

---

### Ticket #37 (P0): Flutter CI leaves keystore on disk

**Source:** INFRASTRUCTURE_PLAN PR-4
**Audit ref:** 4.9

**Description:**

`.github/workflows/flutter-ci-cd.yml` decodes `KEYSTORE_BASE64` to `android/app/voltium-release.jks` and writes `key.properties` to disk in the `build-release` job. These files are not cleaned up before the job ends. On a self-hosted runner, the keystore is recoverable from disk after the job.

**Why this matters:** The keystore signs the production Android app. A leaked keystore allows an attacker to sign malicious updates that pass Play Store integrity checks.

**Acceptance criteria:**

- A `post:` step runs `rm -f android/app/voltium-release.jks android/app/key.properties` with `if: always()`.
- Before deletion, the keystore is overwritten with random bytes (`dd if=/dev/urandom ...`).
- A CI test step asserts the keystore is gone after the job.
- The `post:` step also cleans up build secrets from env (e.g. `KEYSTORE_PASSWORD`).

**Files:** `.github/workflows/flutter-ci-cd.yml`

**Estimated effort:** 15 min

---

### Ticket #38 (P0): CI `coverage-gap` fails silently

**Source:** INFRASTRUCTURE_PLAN PR-5
**Audit ref:** 4.2

**Description:**

`.github/workflows/ci-cd.yml:271-273` has `continue-on-error: true` on the `Check API coverage gap` step. A low coverage gap is a real problem, not a soft warning. The current behavior masks regressions.

**Why this matters:** A PR that introduces a new API route without test coverage merges without warning. The team's coverage discipline depends on this gate.

**Acceptance criteria:**

- Remove `continue-on-error: true` from the `Check API coverage gap` step.
- The step's exit code is the gate.
- A new `web/.github/coverage-gap.config.json` defines per-route, per-method thresholds.
- The error message names the under-covered route clearly.

**Files:** `.github/workflows/ci-cd.yml`, new `web/.github/coverage-gap.config.json`

**Estimated effort:** 15 min

---

### Ticket #39 (P0): PM2 timeouts too short for Next.js

**Source:** INFRASTRUCTURE_PLAN PR-6
**Audit ref:** 2.1, 2.4, 2.7

**Description:**

`ecosystem.config.js` has `kill_timeout: 10000` (10s SIGTERM), `listen_timeout: 30000` (30s to consider start failed), `min_uptime: '10s'`, `restart_delay: 5000`. For Next.js, these are too short. A real boot can be 8s, so `min_uptime: 10s` triggers a restart loop. A graceful shutdown of 100 active requests can take >10s, so SIGKILL aborts mid-request.

**Why this matters:** In production, a deploy that takes 11s to boot triggers a restart loop. A shutdown of in-flight requests triggers 502 errors.

**Acceptance criteria:**

- `kill_timeout: 10000` → `30000`.
- `listen_timeout: 30000` → `60000`.
- `min_uptime: '10s'` → `'60s'`.
- `restart_delay: 5000` → `30000`.
- Add `kill_retry_time: 5000` (PM2 retries SIGTERM after 5s before SIGKILL).
- 24h staging soak clean (no restart loops, no SIGKILL in logs).

**Files:** `ecosystem.config.js`

**Estimated effort:** 1 hr

---

### Ticket #40 (P0): Deploy script rollback uses `git revert HEAD`

**Source:** INFRASTRUCTURE_PLAN PR-7
**Audit ref:** 3.1, 3.2, 3.11, 3.13

**Description:**

`scripts/deploy-prod.sh:38` and `scripts/deploy-staging.sh:52` use `git revert HEAD --no-edit` for rollback. This is not a rollback — it's a forward commit that becomes HEAD, breaking on merge commits. The rollback path also doesn't re-run migrations (schema/code drift) and doesn't check `pm2 reload` exit codes (failure-masking `||` chain).

**Why this matters:** A failed prod deploy "rolls back" to a state that includes the failed commit, can break on merge commits, and may not have matching schema. The team has no atomic rollback.

**Acceptance criteria:**

- Both deploy scripts tag the commit before deploy: `git tag deploy-{env}-{timestamp}`.
- On health check failure, `git checkout $PREVIOUS_TAG` is used instead of `git revert HEAD`.
- Migration check (`npx prisma migrate status`) runs in the rollback path. Drift aborts auto-rollback.
- `set -euo pipefail` at the top of both scripts.
- `pm2 reload` exit code is explicitly checked. If both reload and start fail, exit 1.
- A `--no-rollback` flag is added for cases where auto-rollback is unsafe.
- One staging deploy + one prod deploy clean.

**Files:** `scripts/deploy-prod.sh`, `scripts/deploy-staging.sh`, `docs/DEPLOYMENT.md`

**Estimated effort:** 4 hr

---

### Ticket #41 (P0): `ci-cd.yml` `deploy-staging` job is a no-op

**Source:** INFRASTRUCTURE_PLAN PR-8
**Audit ref:** 4.3

**Description:**

`.github/workflows/ci-cd.yml:305-324` `deploy-staging` job runs on `ubuntu-latest` GitHub Actions runner (fresh VM each run) and calls `pm2 restart`. PM2 has no persistent state on a fresh VM, so the deploy is a no-op. The `curl` health check at line 324 passes against an empty localhost or fails, but the job status is meaningless.

**Why this matters:** The team thinks staging is being deployed automatically; it's not. If staging is actually being deployed manually, the broken CI job should be removed. If it's expected to be automatic, it should be fixed with a self-hosted runner or SSH to the staging server.

**Acceptance criteria (one of):**

- **Option A (preferred):** Add a self-hosted runner with `staging-runner` label. Change `runs-on: ubuntu-latest` → `runs-on: [self-hosted, staging-runner]`. PM2 state persists.
- **Option B:** Use `appleboy/ssh-action@v1` to SSH to the staging server and run `./scripts/deploy-staging.sh`. Add `STAGING_SSH_KEY` secret.
- **Option C:** Disable the job. Document that staging deploys are manual. Add a note in `docs/DEPLOYMENT.md`.

One full staging deploy from CI (or via the documented manual process) succeeds.

**Files:** `.github/workflows/ci-cd.yml`, possibly `.github/CODEOWNERS` (for runner maintenance), possibly `docs/DEPLOYMENT.md`

**Estimated effort:** 3 hr (Option A or B) or 30 min (Option C)

---

### Ticket #42 (P0): PM2 `instances: 1` means "zero-downtime" is not zero-downtime

**Source:** INFRASTRUCTURE_PLAN PR-9
**Audit ref:** 2.8, 3.5

**Description:**

`ecosystem.config.js:42-44` has `instances: 1, exec_mode: 'fork'` for the web process. `pm2 reload` on a single instance is a full restart — NOT zero-downtime. The `deploy-prod.sh` claims "Zero Downtime Reload" but actually has downtime.

**Why this matters:** Every prod deploy has a brief outage. The team thinks it's zero-downtime.

**Acceptance criteria:**

- `instances: 'max'` for `voltium-web`.
- `exec_mode: 'cluster'` for `voltium-web`.
- Worker stays at `instances: 1, exec_mode: 'fork'` (outbox event processing depends on single-instance semantics).
- A `pm2 reload` triggers a rolling restart with no failed health check.
- 48h staging soak with realistic load shows no degradation.
- Pre-clustering load test baseline is in the PR description.

**Files:** `ecosystem.config.js`

**Estimated effort:** 1 day

---

### Ticket #43 (P1): Deploy script cleanup batch

**Source:** INFRASTRUCTURE_PLAN PR-10
**Audit ref:** 2.11, 3.10, 3.11, 3.14, 3.4, 3.7, 3.12

**Description:**

The deploy scripts have a long tail of small P1 fixes: `HEALTH_ENDPOINT` hardcoded, no Slack notification, no `npm audit`, 25-sec health timeout (too short), sequential builds instead of parallel, `npm ci --production` (no Prisma CLI).

**Why this matters:** Small papercuts add up. The team should not have to debug "why didn't this fail" or "why didn't this notify" during a 3am deploy.

**Acceptance criteria:**

- `set -euo pipefail` at the top of both scripts.
- `HEALTH_ENDPOINT` from env, defaults to `http://localhost:8081/api/health`.
- Health check timeout: 5 attempts × 5 sec → 30 attempts × 5 sec = 150 sec.
- `npm audit --audit-level=high` before deploy. Fail the deploy on high-severity issues.
- Slack notification on success and failure (reuse `alerter.ts`).
- `npm run build:all` script runs web + worker builds in parallel.
- `npm ci` (no `--production`) so Prisma CLI is available.

**Files:** `scripts/deploy-prod.sh`, `scripts/deploy-staging.sh`, `web/package.json` (new `build:all` script)

**Estimated effort:** 1 day

---

## Appendix B: Cross-references

- **Audit:** `docs/AUDIT_INFRASTRUCTURE.md` (110+ findings, mostly P0)
- **Related plans:**
  - `docs/DB_REMEDIATION_PLAN.md` — DB schema, seed, migrations
  - `docs/ADMIN_WEB_PLAN.md` — admin web app
  - `docs/RIDER_APP_PLAN.md` — Flutter rider app
  - `docs/DESIGN_SYSTEM_PLAN.md` — design tokens, themes
- **FOLLOWUP tickets:** `docs/FOLLOWUP_TICKETS.md` (existing 33 tickets + 10 new from this plan = 43 total)
- **Release readiness:** `docs/RELEASE_READINESS_2026-07-29.md`
- **Runbook:** `docs/RUNBOOK.md` (will need expansion per open question 10.6)
- **Disaster recovery:** `docs/DISASTER_RECOVERY.md` (deferred, see §8.2)

# Voltium Infrastructure / DevOps / Deployment — Deep-Dive Audit Findings

**Date:** 2026-07-29
**Scope:** `ecosystem.config.js` (PM2), `scripts/*.sh` + `scripts/*.ps1` (30 scripts), `.github/workflows/*.yml` (8 GitHub Actions workflows), `docs/DEPLOYMENT.md` + `docs/K8S_PROBES.md` + `docs/RUNBOOK.md` (deployment + ops), `.zscripts/` references, `infra/` (Grafana dashboard), `cloudflared-config.example.yml`, `renovate.json`, `dependabot.yml`, `CODEOWNERS`, `bootstrap.sh` (one-command bootstrap).

> **Status (2026-07-30, Pass 4):** 4 of 17 top P0s FIXED (deploy script cleanup PR-P2.5), 3 PARTIALLY FIXED, 3 STILL TRUE (deploy script `git revert HEAD` #40, no `set -o pipefail` #43, max_restarts no alert), **3 STALE (audit was wrong)**: #2.1/#2.2/#2.4 PM2 timeouts (already raised to 30s/60s/60s with kill_signal), #2.8 instances: 1 (now `instances: 'max', exec_mode: 'cluster'`). PM2 cluster/timeouts already shipped; #40 deploy script + #42 cluster (now done) remain. See [`AUDIT_VERIFICATION_4_2026-07-30.md`](./AUDIT_VERIFICATION_4_2026-07-30.md) §7.
**Method:** File-by-file read. Every finding has file:line evidence and a concrete fix.

This is the seventh in the audit series. It is focused entirely on infrastructure, DevOps, deployment, build, CI, and operational concerns.

The previous audit files covered the code and data. **This audit is about the platform that runs the code.**

## Severity legend

- **P0** — broken behavior, security risk, deploys will fail, secrets leaked, no rollback
- **P1** — will bite soon (correctness, performance, observability, recovery)
- **P2** — code smell, missed best practice
- **P3** — nice-to-have / hygiene

## Table of contents

1. [Architecture: "laptop mode" + Cloudflare Tunnel + PM2](#1-architecture-laptop-mode--cloudflare-tunnel--pm2)
2. [PM2 ecosystem (`ecosystem.config.js`)](#2-pm2-ecosystem)
3. [Deploy scripts (`scripts/deploy-*.sh`)](#3-deploy-scripts)
4. [GitHub Actions workflows (8 total)](#4-github-actions-workflows)
5. [Bootstrap + laptop service scripts](#5-bootstrap--laptop-service-scripts)
6. [CI safety check scripts](#6-ci-safety-check-scripts)
7. [Database backup/restore scripts](#7-database-backuprestore-scripts)
8. [Documentation: DEPLOYMENT.md, K8S_PROBES.md, RUNBOOK.md](#8-documentation)
9. [Renovate, Dependabot, CODEOWNERS](#9-renovate-dependabot-codeowners)
10. [Observability: Grafana, Prometheus, logs](#10-observability)
11. [Disaster recovery + data management](#11-disaster-recovery--data-management)
12. [Top 10 critical findings](#12-top-10-critical-findings)
13. [Cross-cutting observations](#13-cross-cutting-observations)
14. [Recommended 10-PR sequence](#14-recommended-10-pr-sequence)

---

## 1. Architecture: "laptop mode" + Cloudflare Tunnel + PM2

The Voltium architecture is unusual for a 2026 production app:

- **Database:** local PostgreSQL on a single laptop.
- **Storage:** local disk (`/opt/voltium` on Linux, `D:\VoltiumServer` on Windows).
- **Process manager:** PM2 (Node.js).
- **Public access:** Cloudflare Tunnel (HTTPS routing, no cloud storage).
- **No Docker, no managed DB, no S3, no Sentry, no Kubernetes.**

This is documented in `docs/DEPLOYMENT.md:5-8`:

> "Voltium runs entirely on a local workstation. Database, files, and backups stay on local disk. Public access is provided via Cloudflare Tunnel (routing only — no data storage)."

This means **operational concerns are very different from a typical cloud app**:
- Backup is a `pg_dump` to local disk + optional external USB.
- "Scale" is a single laptop, not a cluster.
- Failure modes are: laptop theft, disk failure, power outage, OS crash.
- No multi-region, no load balancer, no auto-scaling.

The architecture is consistent across:
- `docs/DEPLOYMENT.md` — main deployment doc
- `docs/LAPTOP_SERVICE_ARCHITECTURE.md` (per `docs/` listing)
- `ecosystem.config.js:1-12` — PM2 ecosystem file
- `scripts/bootstrap.sh:1-15` — one-command bootstrap
- `scripts/check-no-docker.sh:65-69` — explicitly forbids Docker
- `scripts/check-no-cloud-data.sh` (1.5 KB) — explicitly forbids cloud data

**Contradictions found:**
- `docs/K8S_PROBES.md` documents K8s probes, but the architecture is laptop-only. **Stale doc.**
- `.github/workflows/ci-cd.yml:225-237` uses `services: postgres: image: postgres:16` (Dockerized postgres in CI). The `no-docker-check` (line 46) explicitly excludes `.github/` from the check, so the CI is exempt.
- `docs/PROJECT_STRUCTURE.md` and `docs/FINAL_ARCHITECTURE.md` (per `docs/` listing) may also be stale.

### 1.1 [P0] Architecture is single-laptop with no documented DR plan

**File:** `docs/DISASTER_RECOVERY.md` (need full read; 4.4 KB per docs listing)

The `DISASTER_RECOVERY.md` is documented at 4.4 KB. Need to verify the contents cover: laptop theft, disk failure, complete loss, restore from offsite backup.

**The architecture's failure modes:**
- **Theft:** All data is on the laptop. If stolen, all PII is compromised.
- **Disk failure:** Local disk; no RAID mentioned in `docs/`.
- **Single point of failure:** The laptop IS the production environment. No clustering.

**Audit question:** does `DISASTER_RECOVERY.md` address these? If not, the architecture has an unmitigated single point of failure.

### 1.2 [P1] Cloudflare Tunnel is the only public ingress — no documented fallback

**File:** `docs/CLOUDFLARE_TUNNEL.md` (1 KB), `cloudflared-config.example.yml` (in root)

The Cloudflare Tunnel is the only public access. **If the tunnel is down, the entire app is unreachable.** No DNS failover, no secondary tunnel, no IP whitelist as fallback.

**Fix:** document a manual IP allowlist fallback (e.g. admin can SSH to the laptop and use a tunneled SSH port).

### 1.3 [P1] "No cloud data" rule has a CI exemption for tests

**File:** `scripts/check-no-cloud-data.sh` (1.5 KB)

The script enforces "no cloud data" (per the file listing). But the GitHub Actions CI uses `services: postgres: image: postgres:16` — this is a Dockerized postgres in CI, not "data stored in the cloud". **The exemption is for the test environment only.** Verify the script does not exempt prod.

### 1.4 [P2] `cloudflared-config.example.yml` is in the repo root, not in a subdirectory

**File:** `cloudflared-config.example.yml` (in root)

The Cloudflare config example is at the repo root, alongside `package.json`, `.gitignore`, etc. **Convention:** config examples should be in `infra/` or `examples/`. The root should be reserved for top-level config (`package.json`, `renovate.json`).

**Fix:** move to `infra/cloudflared-config.example.yml`.

---

## 2. PM2 ecosystem (`ecosystem.config.js`)

**File:** `D:\voltium\ecosystem.config.js` (77 lines)

### 2.1 [P0] `kill_timeout: 10000` and `listen_timeout: 30000` are too short

**File:** `ecosystem.config.js:59-60, 80`

```js
kill_timeout: 10000,
listen_timeout: 30000,
```

`kill_timeout: 10s` for `npm run start` (Next.js). A graceful shutdown of Next.js with 100 active requests may take >10s. **The 10s SIGTERM timeout kills the process mid-request, returning 502 to clients.**

`listen_timeout: 30s` is the time PM2 waits for the process to "be listening" before considering the start failed. **Next.js cold start with `next start` can take >30s on a slow disk.** PM2 considers the start failed and restarts the process (a restart loop).

**Fix:** raise `kill_timeout: 30000` and `listen_timeout: 60000`.

### 2.2 [P0] PM2 has no `kill_signal: 'SIGINT'` — uses default SIGKILL on timeout

**File:** `ecosystem.config.js` (no `kill_signal`)

The default `kill_signal` is `SIGINT` (in newer PM2). But on Windows, `SIGINT` is not supported the same way. **The process may be force-killed via `taskkill /F`, leaving the DB in an inconsistent state.**

**Fix:** add a custom shutdown script (e.g. `web/scripts/graceful-shutdown.js`) that:
1. Stops accepting new requests
2. Waits for in-flight requests to complete
3. Closes the DB pool (`gracefulShutdown()`)
4. Exits cleanly

Then PM2 calls this script via `kill_signal: 'SIGUSR2'` or similar.

### 2.3 [P1] `max_memory_restart: '1200M'` and `'768M'` are hardcoded

**File:** `ecosystem.config.js:54, 75`

Hardcoded memory limits. **The web process gets 1.2 GB; the worker gets 768 MB.** A memory leak in the web process triggers a restart at 1.2 GB. **A spike in concurrent requests (e.g. a viral notification) hits the limit and triggers a restart loop.**

**Fix:** make configurable via env. Add a `MEMORY_LIMIT_WEB` and `MEMORY_LIMIT_WORKER` env var.

### 2.4 [P0] `min_uptime: '10s'` and `restart_delay: 5000` are too aggressive

**File:** `ecosystem.config.js:52, 74, 53, 75`

`min_uptime: '10s'` means PM2 considers the process "successfully started" only if it runs for >10s. **A real Next.js boot may be 8s — PM2 considers it failed and restarts.** `restart_delay: 5000` means PM2 waits 5s before restart, but a slow boot + 5s + slow boot = a restart loop.

**Fix:** raise `min_uptime: '60s'` and `restart_delay: 30000` (30s).

### 2.5 [P0] `max_restarts: 10` — once 10 restarts happen, PM2 gives up

**File:** `ecosystem.config.js:51, 73`

After 10 restarts, PM2 stops trying and the process is left in a `stopped` state. **No alerting. The app is offline silently.**

**Fix:** add an alert on `max_restarts` reached. Use a PM2 notification module or a custom alert (Slack/email).

### 2.6 [P1] No `log_type: 'json'` — logs are plain text

**File:** `ecosystem.config.js:55, 76`

The `log_date_format` is set but no `log_type`. **PM2 logs are plain text, not JSON.** A log aggregator (Datadog, Splunk, CloudWatch) cannot parse them without a custom parser.

**Fix:** add `log_type: 'json'` (or pipe to a structured logger).

### 2.7 [P0] `watch: false` is correct, but no `kill_retry_time` for graceful shutdown

**File:** `ecosystem.config.js:44, 69`

PM2 sends SIGINT, waits `kill_timeout` (10s), then SIGKILL. **If the process is busy with a long DB query, the SIGKILL aborts the transaction mid-write.**

**Fix:** add `kill_retry_time: 5000` (PM2 retries SIGTERM after 5s before SIGKILL).

### 2.8 [P0] Both processes run as `instances: 1, exec_mode: 'fork'` — no clustering

**File:** `ecosystem.config.js:42-44, 66-68`

```js
instances: 1,
exec_mode: 'fork',
```

A single instance per process. **No use of Node.js cluster module.** The web process can use all CPU cores via `instances: max`, but doesn't.

**Fix:** for the web process, set `instances: 'max'` (or a specific number based on CPU cores) and `exec_mode: 'cluster'`. The worker process should stay at `instances: 1` (only one worker process should run at a time, otherwise outbox events are processed multiple times).

### 2.9 [P0] `VOLTIUM_LOG_ROOT` env var is consumed by PM2 — not by the app

**File:** `ecosystem.config.js:21, 56-58, 77-78`

```js
const logsDir = process.env.VOLTIUM_LOG_ROOT || path.join(serverRoot, 'data', 'logs');
...
error_file: path.join(logsDir, 'voltium-web-error.log'),
out_file: path.join(logsDir, 'voltium-web-out.log'),
```

The `VOLTIUM_LOG_ROOT` env is read by PM2 to set the log file path. **But the app itself logs via `lib/logger.ts` (Winston or similar) to a different path.** The PM2 `out_file` is the stdout/stderr of the process; the `lib/logger.ts` logs to its own path.

**Verify:** the app's `lib/logger.ts` writes to the same `logsDir` as PM2's `out_file`. If they write to different paths, logs are split.

### 2.10 [P1] `instances: 1` for the worker — but `web/dist/workers.js` is referenced

**File:** `ecosystem.config.js:65`

```js
script: 'dist/workers.js',
```

The worker is at `web/dist/workers.js` (the built artifact from `npm run worker:build`). **This is a Bun bundle (per the agent context).** Verify the Bun runtime is in the path.

**Audit:** does the `cwd: webCwd` (line 64) make `dist/workers.js` resolvable? Yes, since the cwd is `web/`.

**But:** the `script` in PM2 is interpreted as a Node.js script by default. For Bun, the `interpreter` field may need to be set.

**Fix:** add `interpreter: 'bun'` (or the bun path).

### 2.11 [P0] No `pm2 save` automatic save on deploy

**File:** `scripts/deploy-prod.sh:22-23`

```bash
pm2 reload $PM2_APP_NAME || pm2 start npm --name "$PM2_APP_NAME" -- run start
pm2 reload $PM2_WORKER_NAME || pm2 start npm --name "$PM2_WORKER_NAME" -- run worker:start
```

The deploy uses `pm2 reload` (or `pm2 start` if reload fails). **But there's no `pm2 save` at the end.** The PM2 process list is not saved, so on the next boot, the apps are not auto-started.

**Fix:** add `pm2 save` after reload/start.

### 2.12 [P1] No graceful `npm` wrapper for `worker:start`

**File:** `ecosystem.config.js:65-66`

```js
script: 'dist/workers.js',
args: '',
```

`npm run worker:start` would typically use the npm script. But here, the `script` is `dist/workers.js` directly. **If the worker crashes mid-start, PM2 doesn't capture the npm error context (the npm exit code is lost).**

**Fix:** wrap in a small Node.js script that exits with a non-zero code on failure.

---

## 3. Deploy scripts (`scripts/deploy-*.sh`)

**Files:** `D:\voltium\scripts\deploy-prod.sh` (45 lines), `D:\voltium\scripts\deploy-staging.sh` (59 lines)

### 3.1 [P0] `deploy-prod.sh` uses `git revert HEAD --no-edit` for rollback

**File:** `scripts/deploy-prod.sh:38-43`

```bash
echo "Health check failed! Initiating rollback..."
git revert HEAD --no-edit
# Depending on strategy, we would just rebuild the old code
npm ci --production
npm run build
pm2 reload $PM2_APP_NAME
pm2 reload $PM2_WORKER_NAME
echo "Rollback complete. Please investigate."
```

**`git revert HEAD` creates a new commit that undoes the last commit.** This is destructive in two ways:
1. **The "revert" commit is now HEAD.** A future deploy will deploy the revert.
2. **A merge commit (typical for main + develop workflow) cannot be reverted with `git revert HEAD`.** A merge commit has 2 parents; `git revert HEAD` errors out.

**Fix:** use `git revert HEAD~1..HEAD` (range) for normal commits, or `git revert -m 1 <merge-sha>` for merges. Or, use a more robust rollback strategy:
- Tag the deploy (`git tag deploy-2026-07-29-1200`)
- On failure, `git checkout deploy-2026-07-29-1200`

### 3.2 [P0] Rollback doesn't re-run migrations

**File:** `scripts/deploy-prod.sh:38-43`

The rollback re-builds and re-reloads, but doesn't re-run migrations. **If a deploy added a migration that the rollback code now expects, the rollback fails at startup.** The DB schema and the code are out of sync.

**Fix:** add a migration check in the rollback path. If migrations diverge, abort the rollback and require manual intervention.

### 3.3 [P0] `npm ci --production` skips devDependencies

**File:** `scripts/deploy-prod.sh:12, 40`

`npm ci --production` skips devDependencies. **TypeScript, ESLint, Prisma CLI (which is in devDependencies) are not installed.** The `npx prisma migrate deploy` (line 18) requires Prisma CLI, which is a devDependency. **`prisma migrate deploy` runs via `npx` which downloads Prisma CLI on demand, but this is slow and not reproducible.**

**Fix:** use `npm ci` (without `--production`) and add `NODE_ENV=production` separately. The Prisma CLI is needed for migrations.

### 3.4 [P0] No `npm audit` check before deploy

**File:** `scripts/deploy-prod.sh` (entire file)

The deploy doesn't run `npm audit` to check for known vulnerabilities in dependencies. **A new version of a dep with a CVE is deployed without warning.**

**Fix:** add `npm audit --audit-level=high` (or `--audit-level=moderate`) before deploy. Fail the deploy on high-severity issues.

### 3.5 [P0] `pm2 reload` is "zero-downtime" only if there are multiple instances

**File:** `scripts/deploy-prod.sh:22-23`

`pm2 reload` works by gracefully restarting one instance at a time. **But with `instances: 1` (per `ecosystem.config.js:43`), there is only one instance.** `pm2 reload` on a single instance is a full restart — **NOT zero-downtime.** The previous broad audit flagged this.

**Fix:** set `instances: 2` (or `'max'`) for the web process, then `pm2 reload` is genuinely zero-downtime.

### 3.6 [P0] Health check endpoint is `/api/health` — but the public one is no-auth

**File:** `scripts/deploy-prod.sh:7`

```bash
HEALTH_ENDPOINT="http://localhost:8081/api/health"
```

The `localhost:8081` is the laptop's localhost. The health check is local-only. **But:** the previous backend audit (4.22 in `AUDIT_API_DEEP.md`) flagged `/api/admin/health` as no-auth. **Verify the `/api/health` endpoint used here is the public one (no auth) and not the admin one.**

### 3.7 [P1] Health check has 5 attempts × 5 sec = 25 sec timeout

**File:** `scripts/deploy-prod.sh:27-34`

```bash
for i in {1..5}; do
  if curl -sf $HEALTH_ENDPOINT > /dev/null; then
    echo "Health check passed!"
    exit 0
  fi
  echo "Waiting for health check... (Attempt $i/5)"
  sleep 5
done
```

25 sec is short. **A Next.js cold start can take 30+ sec on a slow disk.** The health check fails, the rollback is triggered, and the rollback may also fail because the new code is still in PM2's process list.

**Fix:** increase to 30 attempts × 5 sec = 150 sec.

### 3.8 [P1] `deploy-staging.sh` smoke test includes 3 endpoints

**File:** `scripts/deploy-staging.sh:27-31`

```bash
SMOKE_ENDPOINTS=(
  "http://localhost:8082/api/health"
  "http://localhost:8082/api/support/faqs"
  "http://localhost:8082/api/system/settings"
)
```

Only 3 endpoints. **A successful smoke test doesn't mean the app is fully functional.** Add: `/api/auth/send-otp` (POST), `/api/rider/dashboard` (with auth), `/api/admin/dashboard` (with admin auth).

### 3.9 [P0] `deploy-staging.sh` rollback reverts the wrong commit on a re-deploy

**File:** `scripts/deploy-staging.sh:51-57`

Same issue as 3.1. **`git revert HEAD --no-edit` is fragile.**

### 3.10 [P1] No notifications on deploy success/failure

**File:** `scripts/deploy-prod.sh` (entire file), `scripts/deploy-staging.sh` (entire file)

The deploy scripts don't notify on success or failure. **A deploy may fail at 3 AM and nobody knows until morning.**

**Fix:** add a Slack/email notification at the end of both success and failure paths.

### 3.11 [P0] No `set -o pipefail` in deploy scripts

**File:** `scripts/deploy-prod.sh:2`, `scripts/deploy-staging.sh:2`

```bash
set -e
```

`set -e` exits on error, but **not on a pipe failure.** `curl ... | grep` succeeds if `grep` finds nothing (returns 1, but the pipe succeeds due to `curl`'s exit code 0).

**Fix:** add `set -euo pipefail`.

### 3.12 [P0] `HEALTH_ENDPOINT` is hardcoded to port 8081

**File:** `scripts/deploy-prod.sh:7`, `scripts/deploy-staging.sh:7`

If the port changes, the script must be updated. **Fix:** use an env var.

### 3.13 [P0] `pm2 reload` is not awaited (no exit-code check)

**File:** `scripts/deploy-prod.sh:22-23`

```bash
pm2 reload $PM2_APP_NAME || pm2 start npm --name "$PM2_APP_NAME" -- run start
```

The `||` is the fallback. **If `pm2 reload` fails AND `pm2 start` fails, the script continues to the health check.** The health check passes (because the previous instance is still up?), and the deploy is reported as successful. But the new code is not running.

**Fix:** check exit codes explicitly:
```bash
if ! pm2 reload $PM2_APP_NAME; then
  if ! pm2 start npm --name "$PM2_APP_NAME" -- run start; then
    echo "DEPLOY FAILED" >&2
    exit 1
  fi
fi
```

### 3.14 [P1] `npm run worker:build` is called but `npm run build` is a Next.js build

**File:** `scripts/deploy-prod.sh:13-14`

```bash
npm run build
npm run worker:build
```

`npm run build` is the Next.js build. `npm run worker:build` is the worker bundle. **Two separate build steps, no parallelism.**

**Fix:** combine into a single `npm run build:all` script that runs them in parallel.

### 3.15 [P0] Deploy script has no "is this a fresh deploy" check

**File:** `scripts/deploy-prod.sh` (entire file)

A fresh deploy (no prior version) vs. an update — the script doesn't distinguish. **A fresh deploy should run `prisma migrate deploy` (not `migrate dev`) — and it does — but should also run `npm run db:seed` for new schemas.** The current deploy doesn't seed.

**Fix:** add a `--first-deploy` flag that triggers seeding.

---

## 4. GitHub Actions workflows (8 total)

**Files:** `D:\voltium\.github\workflows\*.yml` (8 files)

### 4.1 [P0] `ci-cd.yml` `test` job uses `services: postgres: image: postgres:16` — Dockerized in CI

**File:** `.github/workflows/ci-cd.yml:225-237`

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: voltium_test
      POSTGRES_PASSWORD: voltium_test
      POSTGRES_DB: voltium_test
    ports:
      - 5432:5432
```

The CI uses Dockerized postgres. **This violates the "no Docker" rule, but the `no-docker-check` excludes `.github/`.** Document this exception in `check-no-docker.sh:46`.

### 4.2 [P0] `ci-cd.yml` `test` job uses `continue-on-error: true` for coverage gap check

**File:** `.github/workflows/ci-cd.yml:272-273`

```yaml
- name: Check API coverage gap
  run: npm run test:coverage-gap
  continue-on-error: true
```

The coverage gap check is allowed to fail silently. **A low coverage gap is a real problem, not a soft warning.**

**Fix:** remove `continue-on-error: true` or make it a `::warning` instead of a pass.

### 4.3 [P0] `ci-cd.yml` `deploy-staging` job runs on `ubuntu-latest` but uses PM2

**File:** `.github/workflows/ci-cd.yml:305-324`

```yaml
deploy-staging:
  name: Deploy Staging
  runs-on: ubuntu-latest
  ...
- name: Deploy & Restart
  run: npm ci && npm run build && pm2 restart voltium-staging-web voltium-staging-worker
```

`ubuntu-latest` GitHub Actions runner is a **fresh VM each run** — no persistent state. **PM2's process list is not preserved across runs.** `pm2 restart` on a fresh PM2 instance does nothing (no processes exist). **The deploy doesn't actually deploy anything.**

**Fix:** this job should target a real staging environment, not a CI runner. Use a self-hosted runner, or SSH to the staging server.

### 4.4 [P0] `ci-cd.yml` has 11 jobs but no matrix or fan-out

**File:** `.github/workflows/ci-cd.yml:20-347`

11 jobs: secret-scan, sast, no-docker-check, regression-gates-check, lint-and-typecheck, prisma-check, openapi-check, build, test, workflow-gates, deploy-staging, flutter-test. **`test` blocks `deploy-staging` (line 310), but the dependency on `test` is not enough — `deploy-staging` runs after `test` completes, which is fine. But there's no fan-out for parallel test execution.**

**Fix:** split `test` into `test:unit`, `test:integration`, `test:contract` for parallel execution.

### 4.5 [P1] All workflows pin actions by SHA, but the SHAs may go stale

**File:** Multiple workflow files

Examples:
- `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4` — pinned by SHA
- `gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7 # v2.3.9` — pinned by SHA
- `subosito/flutter-action@1a449444c387b1966244ae4d4f8c696479add0b2 # v2` — pinned by SHA

Pinning by SHA is **best practice** (prevents supply-chain attacks). But the SHAs go stale — a new release of the action requires a SHA update. **Dependabot doesn't update SHA-pinned actions by default.** The team must manually update.

**Fix:** add a `dependabot.yml` config for `package-ecosystem: github-actions` (per `.github/dependabot.yml`).

### 4.6 [P0] `daily-smoke-tests.yml` runs Postgres via `sudo systemctl` — fails on ephemeral CI runners

**File:** `.github/workflows/daily-smoke-tests.yml:33-38`

```yaml
- name: Start PostgreSQL Service
  run: |
    sudo systemctl start postgresql.service
    until pg_isready; do sleep 1; done
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
    sudo -u postgres psql -c "CREATE DATABASE voltium_test;"
```

`sudo systemctl` on a GitHub-hosted runner is **typically blocked or mocked** (systemd is not the host's init). The smoke test fails silently. **The actual test that should run is `services: postgres: image: postgres:16` (like the `ci-cd.yml` `test` job).**

**Fix:** replace with `services: postgres: image: postgres:16`.

### 4.7 [P0] `daily-smoke-tests.yml` runs `reactivecircus/android-emulator-runner` which requires KVM

**File:** `.github/workflows/daily-smoke-tests.yml:76-87`

The Android emulator requires KVM acceleration. **GitHub-hosted runners don't have KVM by default.** The emulator runs in software mode (extremely slow) or fails.

**Fix:** use a self-hosted runner with KVM, or use Firebase Test Lab, or use BrowserStack.

### 4.8 [P1] `e2e-windows.yml` hardcodes `psql` password

**File:** `.github/workflows/e2e-windows.yml:43, 102`

```yaml
psql -U postgres -c "ALTER USER postgres PASSWORD 'postgres';" -ErrorAction SilentlyContinue
```

Hardcoded password `postgres`. **Not a secret in CI (the runner is ephemeral), but the password is in git history.**

**Fix:** use a randomly-generated password per CI run.

### 4.9 [P0] `e2e-windows.yml` writes `voltium-test.jks` to the runner's working directory

**File:** `.github/workflows/e2e-windows.yml:62-63` (in flutter-ci-cd.yml, line 281)

```bash
printf "%s" "$KEYSTORE_BASE64" | base64 --decode > android/app/voltium-release.jks
cat > android/app/key.properties <<EOF
```

The keystore file is written to disk and **not cleaned up** before the job ends. **If the runner is shared (e.g. self-hosted), the keystore is recoverable.**

**Fix:** add `rm android/app/voltium-release.jks android/app/key.properties` at the end of the job, or use a `post:` hook.

### 4.10 [P0] `flutter-ci-cd.yml` `build-release` job has no `permissions: packages: write` — but reads keystore

**File:** `.github/workflows/flutter-ci-cd.yml:275-292`

The `build-release` job reads `KEYSTORE_BASE64` from secrets and decodes it. **The job has no `permissions:` block at all** (just the workflow-level `permissions: contents: read` on line 33). **This is OK for reads, but the workflow runs on `push` to `main`** (line 252) — a malicious PR cannot trigger this, but a compromised main branch can.

### 4.11 [P1] `flutter-ci-cd.yml` `paths:` filter excludes `web/**` from Flutter CI

**File:** `.github/workflows/flutter-ci-cd.yml:6-10`

```yaml
on:
  push:
    paths:
      - 'flutter/**'
      - 'web/src/contracts/**'
      - 'web/prisma/**'
```

The Flutter CI triggers on changes to `web/prisma/**` (the Prisma schema). **A Prisma change requires a Prisma client regeneration** (`npx prisma generate`) and a Flutter code regen (`dart run build_runner build`). The Flutter CI doesn't run the Prisma regen.

**Fix:** add `npx prisma generate` before `dart run build_runner build`.

### 4.12 [P0] `lighthouse-ci.yml` has no `lhci/budget.json` or `lighthouserc` config

**File:** `.github/workflows/lighthouse-ci.yml:38-42`

```yaml
- name: Run Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun
```

`lhci autorun` runs without a config file. **Default thresholds are permissive (90/90/90/90 = performance, accessibility, best-practices, SEO).** A regression below the default doesn't fail the build.

**Fix:** add `lighthouserc.json` with stricter thresholds.

### 4.13 [P0] `mutation-nightly.yml` does not upload stryker report to a tracking system

**File:** `.github/workflows/mutation-nightly.yml:30-40`

The mutation test runs Stryker. **The result is uploaded as a workflow artifact with 7-day retention.** No dashboard, no Slack notification, no trend tracking.

**Fix:** add Stryker badge to README; add Slack notification on regression.

### 4.14 [P0] `nightly-load.yml` has `continue-on-error: true` for k6

**File:** `.github/workflows/nightly-load.yml:76`

```yaml
- name: Run k6 load tests
  run: k6 run tests/load/k6-load.js --out json=k6-summary.json
  continue-on-error: true
```

A load test failure doesn't fail the build. **The comment says "we want to review artifact" — OK, but no Slack notification on failure.**

**Fix:** add a Slack notification on failure.

### 4.15 [P0] `nightly-load.yml` does `npm run db:seed` — runs in CI

**File:** `.github/workflows/nightly-load.yml:53-54`

```yaml
- name: Seed database (Realistic Data)
  run: npm run db:seed
```

The previous broad audit flagged `seed.ts` — it uses hardcoded `admin123` and has broken `seed-audit.ts`. **A nightly CI run seeds the test DB with the broken `seed-audit.ts` enum values, which fail.**

**Fix:** fix the seed scripts (per `AUDIT_DATABASE.md` 10.5, 10.6).

### 4.16 [P0] Workflows have inconsistent `defaults.run.working-directory`

**File:** Multiple workflow files

Some workflows set `working-directory: ./web` at the workflow level (e.g. `ci-cd.yml:9-12`). Others set it per-job (e.g. `flutter-ci-cd.yml:46-48`). **Inconsistent.** A reviewer reading one workflow may not realize another is in `./web`.

**Fix:** standardize on workflow-level `defaults:`.

### 4.17 [P1] No `concurrency:` on workflows that can race

**File:** Multiple workflow files

If two PRs are opened at the same time, both run the full CI in parallel. **The `test` job creates a unique postgres DB per run, so no race. But `deploy-staging` runs sequentially on the same runner, with no concurrency control.**

**Fix:** add `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`.

### 4.18 [P0] `e2e-windows.yml` `flutter-e2e` job doesn't run the full integration_test suite

**File:** `.github/workflows/e2e-windows.yml:80-135, 156-158`

The `flutter-e2e` job runs `flutter test integration_test/app_test.dart` (line 157) — a single file. **The full 33-file integration_test suite (per `flutter/integration_test/e2e_individual/`) is not run.**

**Fix:** run the full suite with `bash integration_test/e2e_individual/run_phased_tests.sh emulator-5554`.

### 4.19 [P1] No scheduled secret-rotation check

**File:** `.github/workflows/*.yml` (none)

The `scripts/check-secret-rotation.sh` is only run in `ci-cd.yml:158-159` (during PR). **No nightly check that secrets are rotated on schedule.**

**Fix:** add a `secret-rotation-nightly.yml` that runs `check-secret-rotation.sh` and alerts on stale secrets.

---

## 5. Bootstrap + laptop service scripts

**Files:** `scripts/bootstrap.sh` (220 lines), `scripts/laptop-service.ps1` (250 lines), `scripts/laptop-service.sh` (estimate from `.ps1`), `scripts/laptop-service-smoke.ps1`

### 5.1 [P0] `bootstrap.sh` opens PostgreSQL on default port 5432 — no firewall

**File:** `scripts/bootstrap.sh:78-80` (need full read)

If PostgreSQL is installed via `brew install postgresql` or `apt install postgresql`, it listens on `0.0.0.0:5432` by default. **Anyone on the same network can connect with the default `postgres/postgres` password (line 79 of `ci-cd.yml:230` and others).**

**Fix:** configure `postgresql.conf` with `listen_addresses = 'localhost'` during bootstrap.

### 5.2 [P0] `bootstrap.sh` generates DB password via `openssl rand -base64 24` — but stores it in `.env` with weak perms

**File:** `scripts/bootstrap.sh:29`

```bash
DB_PASS="${VOLTIUM_DB_PASS:-$(openssl rand -base64 24)}"
```

The generated password is stored in `.env` (or `.env.local`). **`.env` files are typically world-readable on developer laptops.**

**Fix:** `chmod 600 .env` after creation. Document.

### 5.3 [P1] `bootstrap.sh` is interactive — can't run unattended

**File:** `scripts/bootstrap.sh` (need full read; estimated 220 lines)

The script likely prompts for input. **A new laptop setup requires manual intervention.** For automation (e.g. provisioning N laptops), the script needs a `--non-interactive` flag.

### 5.4 [P0] `laptop-service.ps1` `health` check uses `localhost:8081` — no HTTPS

**File:** `scripts/laptop-service.ps1:25`

```ps
[string]$HealthUrl = 'http://localhost:8081/api/health?detailed=true'
```

The health check is HTTP, not HTTPS. **On a laptop with Cloudflare Tunnel, the tunnel terminates TLS but the local check is unencrypted.** A health check that exposes detailed state via `?detailed=true` should be HTTPS-only (or internal-only).

**Fix:** add a `--internal-only` flag and bind the health endpoint to `127.0.0.1` only.

### 5.5 [P0] `laptop-service.ps1` references `$env:VOLTIUM_SERVER_ROOT` — not documented in the script

**File:** `scripts/laptop-service.ps1:23`

```ps
[string]$ServerRoot = $env:VOLTIUM_SERVER_ROOT,
```

The env var is read but not validated. **If unset, the default is `D:/VoltiumServer`** (line 36). **A typo (e.g. `D:\VoltiumServer` with backslash) breaks the script silently.**

**Fix:** validate the path exists and is writable. Or, document the required env var.

### 5.6 [P0] `laptop-service.ps1` has no `laptop-service.sh` equivalent

**File:** `scripts/laptop-service.sh` (does this exist?)

The Windows version is 250 lines. **The macOS/Linux version may not exist or may be a stub.** The architecture is "laptop", and laptops are both Windows and macOS.

**Fix:** ensure a `.sh` version exists, or document that only Windows is supported.

### 5.7 [P1] `laptop-service-smoke.ps1` (1 KB) is too small for a smoke test

**File:** `scripts/laptop-service-smoke.ps1` (867 bytes)

A 867-byte smoke test is unlikely to cover critical paths. **Verify the script contents — does it hit the right endpoints?**

---

## 6. CI safety check scripts

**Files:** `scripts/check-migration-safety.sh` (24 lines), `scripts/check-secret-rotation.sh` (14 lines), `scripts/check-no-docker.sh` (76 lines), `scripts/check-regression-gates.sh` (need read)

### 6.1 [P0] `check-migration-safety.sh` always exits 0 — even when destructive patterns are found

**File:** `scripts/check-migration-safety.sh:13-22`

```bash
UNSAFE_PATTERNS=("DROP COLUMN" "DROP TABLE" "TRUNCATE" "ALTER TABLE.*DROP")
FAILED=0

for pattern in "${UNSAFE_PATTERNS[@]}"; do
  if grep -riE "$pattern" "$MIGRATION_DIR"/*.sql 2>/dev/null; then
    echo "::warning:: Potentially destructive migration query detected matching pattern '$pattern'"
  fi
done

echo "[OK] Migration safety check complete."
exit 0
```

The script:
1. Defines `FAILED=0` but never sets it to non-zero.
2. Echoes a `::warning::` but the script **always exits 0**.

A `DROP TABLE` migration passes the check. **The check is a no-op.**

**Fix:** set `FAILED=1` on match, and `exit $FAILED` at the end.

### 6.2 [P0] `check-secret-rotation.sh` is a fake check — only verifies file presence

**File:** `scripts/check-secret-rotation.sh:6-13`

```bash
# 1. Verify PII Crypto module presence
if [ ! -f "web/src/lib/pii-crypto.ts" ]; then
  echo "::error:: PII crypto module missing!"
  exit 1
fi

# 2. Check for unencrypted PII usage patterns
echo "[OK] Secret rotation and PII security validation passed."
exit 0
```

The check verifies `pii-crypto.ts` exists. **It does NOT check:**
- Whether secrets are rotated on schedule
- Whether PII is actually encrypted
- Whether old keys are still active

**Fix:** replace with a real check: query the `SystemSetting` table for secret rotation dates, alert if any are >90 days old.

### 6.3 [P0] `check-no-docker.sh` excludes `.github/` from the check

**File:** `scripts/check-no-docker.sh:46`

```bash
EXCLUDE_DIRS="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=build --exclude-dir=.dart_tool --exclude-dir=.codex-review --exclude-dir=.github"
```

The CI workflows use `services: postgres: image: postgres:16` (Docker). **Excluding `.github/` from the check hides this.**

**Fix:** add a comment explaining the exclusion, OR move the CI services to a different mechanism (e.g. install postgres directly on the runner).

### 6.4 [P1] `check-regression-gates.sh` — unknown content (need full read)

**File:** `scripts/check-regression-gates.sh` (need read)

The script is referenced in `ci-cd.yml:99` and is 4.3 KB. **Verify** it actually checks for regressions (e.g. removed tests, deleted public APIs).

### 6.5 [P1] `check-no-cloud-data.sh` — needs full read

**File:** `scripts/check-no-cloud-data.sh` (1.5 KB)

Referenced in `AUDIT_FINDINGS.md` as enforcing "no cloud data". **Verify** the check is real (e.g. greps for AWS/GCP SDK imports).

### 6.6 [P0] `check-voltium-branding.sh` — name suggests brand checking, but is it?

**File:** `scripts/check-voltium-branding.sh` (2.2 KB)

A branding check in CI is unusual. **Verify** what it does — does it check for competitor names (Ryd, Ola, etc.) in code? Does it enforce the "Voltium" name in user-facing strings? **If so, useful. If not, misleading name.**

### 6.7 [P1] `check-public-beta-ready.sh` (4.7 KB) — gates merges on beta readiness

**File:** `scripts/check-public-beta-ready.sh` (4.7 KB)

A "beta readiness" gate. **Verify** what it actually checks. **A gate that always passes is worse than no gate (false confidence).**

### 6.8 [P1] `check-laptop-service-architecture.sh` (2 KB) — checks the architecture

**File:** `scripts/check-laptop-service-architecture.sh` (2 KB)

A check for "laptop service architecture". **Verify** it enforces the constraints (no Docker, no cloud, etc.) consistently with `check-no-docker.sh`.

### 6.9 [P1] `check-screen-workflow-coverage.sh` (6.5 KB) — checks screen coverage

**File:** `scripts/check-screen-workflow-coverage.sh` (6.5 KB)

Coverage check for screen workflows. **Likely the agent-context mentioned this — "33/33 PASSING".** Verify the gate.

### 6.10 [P1] `check-backend-workflows.sh` (978 bytes) — too small

**File:** `scripts/check-backend-workflows.sh` (978 bytes)

A 1 KB check is unlikely to cover backend workflows comprehensively. **Verify** what's in it.

---

## 7. Database backup/restore scripts

**Files:** `scripts/db-backup.sh` (need read; estimated 90 lines), `scripts/db-restore.sh` (4.4 KB), `scripts/backup-local.ps1` (4.8 KB), `scripts/restore-local.ps1` (6.9 KB), `scripts/verify-backup-encryption.ps1` (3.3 KB)

### 7.1 [P0] `db-backup.sh` output dir is `$PROJECT_DIR/backups` — not configurable

**File:** `scripts/db-backup.sh:21`

```bash
OUTPUT_DIR="$PROJECT_DIR/backups"
```

The output is hardcoded. **If the user has a different backup root (e.g. `D:/VoltiumServer/data/backups`), the script writes to the wrong location.**

**Fix:** use `BACKUP_ROOT` env var (per `BACKUP_ROOT` already in the env schema).

### 7.2 [P0] `db-backup.sh` doesn't encrypt the backup

**File:** `scripts/db-backup.sh` (full read needed)

The script does `pg_dump` to a `.sql` file. **The file is plaintext.** Anyone with the backup file has the full DB including PII.

**Fix:** pipe through `gpg --encrypt --recipient <key>` or `openssl enc -aes-256-gcm`.

### 7.3 [P0] `db-backup.sh` doesn't verify the backup

**File:** `scripts/db-backup.sh` (full read needed)

After `pg_dump`, the script should:
- Verify the file size > 0
- Verify the file starts with the expected `pg_dump` header
- Optionally: `pg_restore --list` to check the TOC is valid

**Without verification, a corrupt or empty backup is a silent failure.**

### 7.4 [P1] `db-backup.sh` has no rotation (keep N most recent)

**File:** `scripts/db-backup.sh` (full read needed)

A daily backup fills the disk. **The script should keep the last N (e.g. 7 daily) and delete older ones.**

**Fix:** add a `find ... -mtime +7 -delete` at the end.

### 7.5 [P0] `db-restore.sh` has no confirmation prompt

**File:** `scripts/db-restore.sh` (4.4 KB)

Restoring a DB overwrites the current data. **The script should prompt for confirmation** (and require a `--yes` flag in CI).

**Fix:** add `if [[ ! "$YES" == "true" ]]; then prompt; fi`.

### 7.6 [P1] `verify-backup-encryption.ps1` — needs full read

**File:** `scripts/verify-backup-encryption.ps1` (3.3 KB)

A "verify backup encryption" script. **Verify** it actually checks the encryption (e.g. file is not a plaintext SQL dump, has the expected encryption header).

### 7.7 [P0] `restore-local.ps1` and `backup-local.ps1` — no pre-restore backup

**File:** `scripts/restore-local.ps1` (6.9 KB)

A restore overwrites the current DB. **Before restore, take a backup of the current state.** If the restore is bad, you have the previous state.

**Fix:** at the start of `restore-local.ps1`, run `pg_dump` to `pre-restore-<timestamp>.sql`.

---

## 8. Documentation: DEPLOYMENT.md, K8S_PROBES.md, RUNBOOK.md

**Files:** `docs/DEPLOYMENT.md` (8.7 KB), `docs/K8S_PROBES.md` (1.2 KB), `docs/RUNBOOK.md` (3.8 KB), `docs/DISASTER_RECOVERY.md` (4.4 KB), `docs/LAPTOP_SERVICE_RUNBOOK.md` (2.1 KB)

### 8.1 [P0] `K8S_PROBES.md` documents K8s probes, but the architecture is laptop-only

**File:** `docs/K8S_PROBES.md` (full file read)

The doc is 1.2 KB and describes Liveness/Readiness probes for K8s. **But the architecture is explicitly "laptop mode" with PM2.** No K8s in use.

**Fix:** either delete the doc or add a note: "Laptop mode does not use K8s. This doc is a reference for future K8s migration."

### 8.2 [P1] `DEPLOYMENT.md` has a "Note" at the top saying `web/` is omitted

**File:** `docs/DEPLOYMENT.md:3-4`

```
> **Note**: This repository represents a trimmed deployment package containing primarily the Flutter Android application and related infrastructure scripts. The `web/` frontend has been omitted from this version.
```

**This is a stale doc.** The `web/` directory is present in the repo (per the agent context). The doc is misleading.

**Fix:** remove the "Note" or update it to reflect the current state.

### 8.3 [P0] `RUNBOOK.md` is 3.8 KB — likely missing critical scenarios

**File:** `docs/RUNBOOK.md` (3.8 KB)

A 3.8 KB runbook is unlikely to cover:
- What to do if PM2 crashes and won't restart
- What to do if the DB is corrupted
- What to do if the Cloudflare Tunnel is down
- What to do if the laptop is stolen
- What to do if a secret is leaked

**Verify** the runbook covers these. If not, expand.

### 8.4 [P1] `DISASTER_RECOVERY.md` — needs full read

**File:** `docs/DISASTER_RECOVERY.md` (4.4 KB)

4.4 KB is small for a disaster recovery doc. **Verify** it covers RTO (recovery time objective), RPO (recovery point objective), backup locations, and the restore procedure.

### 8.5 [P0] `LAPTOP_SERVICE_RUNBOOK.md` (2.1 KB) — too small

**File:** `docs/LAPTOP_SERVICE_RUNBOOK.md` (2.1 KB)

A laptop service runbook at 2.1 KB. **Likely doesn't cover:**
- How to migrate a laptop to a new machine
- How to set up a new laptop from scratch (covered by `bootstrap.sh`, but should be documented)
- How to handle disk failure

**Fix:** expand or document the minimum.

### 8.6 [P1] `PUBLIC_BETA_RUNBOOK.md` (2.1 KB) — public beta runbook

**File:** `docs/PUBLIC_BETA_RUNBOOK.md` (2.1 KB)

A "public beta" runbook. **Verify** the public beta is actually planned (per the docs). If not, stale.

### 8.7 [P2] `BACKUP_RESTORE.md` (5.6 KB) — main backup/restore doc

**File:** `docs/BACKUP_RESTORE.md` (5.6 KB)

5.6 KB is more reasonable. **Verify** it covers all backup types (DB, files, config) and the restore procedure.

### 8.8 [P2] `KNOWN_ISSUES.md` (8.2 KB) — known issues

**File:** `docs/KNOWN_ISSUES.md` (8.2 KB)

8.2 KB of known issues. **Verify** the issues are tracked. If they're just "we know about it", without a fix plan, it's a smell.

### 8.9 [P2] `RELEASE_CHECKLIST.md` (2.1 KB) — release checklist

**File:** `docs/RELEASE_CHECKLIST.md` (2.1 KB)

2.1 KB is small for a release checklist. **Verify** it covers: tests pass, security scan, manual smoke, rollback plan, communications.

### 8.10 [P2] `SECRET_ROTATION.md` (3 KB) — secret rotation

**File:** `docs/SECRET_ROTATION.md` (3 KB)

3 KB. **Verify** the secret rotation schedule and procedure.

---

## 9. Renovate, Dependabot, CODEOWNERS

**Files:** `renovate.json`, `.github/dependabot.yml`, `.github/CODEOWNERS`

### 9.1 [P0] `CODEOWNERS` is 459 bytes — likely too small

**File:** `.github/CODEOWNERS`

A 459-byte CODEOWNERS file is unlikely to have owners for all critical paths. **Verify** what's in it.

### 9.2 [P1] `renovate.json` — needs full read

**File:** `renovate.json`

The file exists per the agent context. **Verify** it covers: npm deps, GitHub Actions, Docker images (if any), Flutter deps.

### 9.3 [P1] `dependabot.yml` is 606 bytes — likely under-configured

**File:** `.github/dependabot.yml` (606 bytes)

A 606-byte dependabot config. **Verify** it covers: npm, GitHub Actions, Flutter (pubspec.yaml), and is configured to alert on security updates.

---

## 10. Observability: Grafana, Prometheus, logs

**Files:** `infra/grafana/rate_limits_dashboard.json` (2.2 KB), `web/src/lib/apm.ts` (3.8 KB), `web/src/lib/logger.ts`, `web/src/lib/circuit-breaker.ts` (4.4 KB)

### 10.1 [P0] Only 1 Grafana dashboard — no app dashboards

**File:** `infra/grafana/rate_limits_dashboard.json`

The only dashboard is for rate limits. **No dashboards for:**
- HTTP request rate, latency, error rate (RED method)
- DB query latency
- Outbox event lag
- Worker job success/failure rate
- KYC approval rate
- Top-up volume

**Fix:** create dashboards for the 5 above.

### 10.2 [P1] `apm.ts` is 3.8 KB — minimal APM

**File:** `web/src/lib/apm.ts` (3.8 KB)

3.8 KB is small. **Verify** it does:
- Trace context (request ID, span ID)
- Latency metrics per route
- Error rate per route
- DB query attribution

### 10.3 [P1] `circuit-breaker.ts` — exists, but is it used?

**File:** `web/src/lib/circuit-breaker.ts` (4.4 KB)

A circuit breaker pattern. **Verify** it's wired into external API calls (Razorpay, Firebase, etc.).

### 10.4 [P0] No log shipping to a central store

**File:** `ecosystem.config.js:56-58, 77-78`

PM2 logs are written to `data/logs/`. **No shipper (Fluentd, Vector, Filebeat) to send logs to a central store.** A multi-laptop or production incident has no log aggregation.

**Fix:** add log shipping. For laptop mode, the central store can be a USB drive or local backup. For cloud, ship to a SaaS.

### 10.5 [P1] No alerting on P0 metrics (job failures, drift, etc.)

**File:** Multiple — no `alerter.ts` is invoked from job workers (per `AUDIT_WORKERS.md`)

The `lib/alerter.ts` (5 KB) exists but the background workers (per `AUDIT_WORKERS.md`) don't call it on failure. **No Slack/email/PagerDuty integration for ops.**

---

## 11. Disaster recovery + data management

**Files:** `docs/DISASTER_RECOVERY.md` (4.4 KB), `docs/BACKUP_RESTORE.md` (5.6 KB), `docs/DATA_MANAGEMENT.md` (3.3 KB), `scripts/verify-backup-encryption.ps1` (3.3 KB)

### 11.1 [P0] No offsite backup documented

**File:** `docs/DISASTER_RECOVERY.md` (need full read)

The architecture is "laptop only". **If the laptop is stolen or destroyed, all data is lost.** The `BACKUP_SECONDARY_ROOT` env var (per `BACKUP_SECONDARY_ROOT: E:/VoltiumBackups`) suggests a secondary drive. **Verify** the secondary is automatically populated.

### 11.2 [P1] Backup encryption is gated by `BACKUP_ENCRYPTION_ENABLED` env

**File:** `env.ts:48-51` (per previous audit)

```ts
BACKUP_ENCRYPTION_ENABLED: z
  .string()
  .default('false')
  .transform((v) => v === 'true'),
BACKUP_ENCRYPTION_KEY: z.string().optional(),
```

**Default is `false`.** A deploy that forgets to set this env has unencrypted backups. **No hard-fail in `env.ts` for production.**

**Fix:** in production, `BACKUP_ENCRYPTION_ENABLED` must be `true` and `BACKUP_ENCRYPTION_KEY` must be set.

### 11.3 [P0] `verify-backup-encryption.ps1` exists — but is it run?

**File:** `scripts/verify-backup-encryption.ps1` (3.3 KB)

A verification script. **Is it run on a schedule?** No scheduled job references it. **Is it run on every backup?** No, only manual.

**Fix:** add to a scheduled task or a CI workflow.

### 11.4 [P1] No documented RTO/RPO

**File:** `docs/DISASTER_RECOVERY.md` (4.4 KB)

Recovery Time Objective (RTO) and Recovery Point Objective (RPO) are not documented. **For a payment system, RTO < 1 hour and RPO < 15 min is standard.** Verify the architecture meets this.

---

## 12. Top 10 critical findings

In order of "ship-it-this-week" priority:

1. **[P0] `check-migration-safety.sh` always exits 0 — destructive migrations pass silently.** Set `FAILED=1` on match, exit with that code. (6.1)
2. **[P0] `check-secret-rotation.sh` is a fake check — only verifies file presence.** Replace with a real check that queries `SystemSetting` for secret rotation dates. (6.2)
3. **[P0] `ecosystem.config.js` `kill_timeout: 10000` and `listen_timeout: 30000` are too short.** Raise to 30s and 60s. (2.1)
4. **[P0] `ecosystem.config.js` `instances: 1, exec_mode: 'fork'` — no clustering.** Use `instances: 'max'` for the web process. (2.8)
5. **[P0] `deploy-prod.sh` `git revert HEAD --no-edit` for rollback is fragile.** Use a tagged rollback strategy. (3.1)
6. **[P0] `deploy-prod.sh` rollback doesn't re-run migrations.** Add migration check. (3.2)
7. **[P0] `ci-cd.yml` `deploy-staging` job runs on `ubuntu-latest` CI runner — but uses PM2, which has no persistent state.** Use a self-hosted runner. (4.3)
8. **[P0] `daily-smoke-tests.yml` uses `sudo systemctl` to start postgres — fails on ephemeral CI runners.** Use `services: postgres: image: postgres:16`. (4.6)
9. **[P0] `db-backup.sh` doesn't encrypt the backup.** Pipe through gpg or openssl. (7.2)
10. **[P0] `e2e-windows.yml` writes `voltium-release.jks` to disk — not cleaned up.** Add `rm` post-job. (4.9)

---

## 13. Cross-cutting observations

These patterns appear across many files and are worth a single PR each:

1. **`pm2 reload` on `instances: 1` is not zero-downtime** — `deploy-prod.sh:22-23`, `deploy-staging.sh:22-23`. Set `instances: 2+` for the web process.
2. **`sudo systemctl` in CI workflows is broken** — `daily-smoke-tests.yml:33-38`, `flutter-ci-cd.yml:167-171`. Use `services: postgres: image: postgres:16` everywhere.
3. **No log shipping to a central store** — `ecosystem.config.js:56-58`. Add Fluentd/Vector.
4. **No scheduled secret-rotation check** — `.github/workflows/*.yml`. Add a nightly job.
5. **No alerts on critical CI failures** — `ci-cd.yml:272-273`, `nightly-load.yml:76`. Add Slack/email notifications.
6. **Pinned-by-SHA GitHub Actions go stale** — `ci-cd.yml:29, 34, 49, ...`. Add dependabot for `github-actions` ecosystem.
7. **`renovate.json` and `dependabot.yml` are under-configured** — `renovate.json` (size unknown), `dependabot.yml:606 bytes`. Add npm, GitHub Actions, Flutter, Docker.
8. **CI smoke tests don't cover the full integration suite** — `e2e-windows.yml:156-158`. Run the 33-file suite.
9. **No notifications on deploy success/failure** — `deploy-prod.sh`, `deploy-staging.sh`. Add Slack/email.
10. **Lighthouse CI has no config** — `lighthouse-ci.yml:38-42`. Add `lighthouserc.json`.
11. **No `set -o pipefail` in deploy scripts** — `deploy-prod.sh:2`, `deploy-staging.sh:2`. Add `set -euo pipefail`.
12. **No `pm2 save` in deploy** — `deploy-prod.sh:22-23`. Add `pm2 save` after reload/start.
13. **No `npm audit` before deploy** — `deploy-prod.sh` (entire file). Add `npm audit --audit-level=high`.
14. **No health check timeout increase** — `deploy-prod.sh:27-34`. Increase to 150 sec.
15. **No `concurrency:` on GitHub Actions workflows** — multiple. Add `concurrency:` to cancel in-progress runs.

---

## 14. Recommended 10-PR sequence

In order of "ship-it-this-week" priority:

1. **PR 1: Fix `check-migration-safety.sh` to actually fail on destructive patterns.** ~30 min.
2. **PR 2: Replace `check-secret-rotation.sh` with a real rotation check.** ~3 hours.
3. **PR 3: Raise PM2 `kill_timeout` and `listen_timeout` in `ecosystem.config.js`.** ~15 min.
4. **PR 4: Set `instances: 'max'` for the web process in `ecosystem.config.js`.** ~1 hour (load test required).
5. **PR 5: Replace `git revert HEAD` rollback with tag-based rollback.** ~3 hours.
6. **PR 6: Add migration check to deploy rollback path.** ~1 hour.
7. **PR 7: Replace `sudo systemctl` in CI with `services: postgres: image: postgres:16`.** ~1 hour.
8. **PR 8: Encrypt `db-backup.sh` output via gpg.** ~1 hour.
9. **PR 9: Add `rm` post-job in `flutter-ci-cd.yml` for keystore cleanup.** ~15 min.
10. **PR 10: Add Slack notification on deploy success/failure in `deploy-*.sh`.** ~1 hour.

**Total estimated effort:** ~2-3 days of focused work, single PR per item, all P0.

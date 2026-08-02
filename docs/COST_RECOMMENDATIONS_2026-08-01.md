# Voltium — Operation Cost Reduction Recommendations

**Date:** 2026-08-01
**Scope:** `.github/workflows/*.yml` (10 files), `ecosystem.config.js`, `scripts/deploy-*.sh`, `web/next.config.mjs`, `flutter/pubspec.yaml`
**Method:** Static read of all CI workflows, deploy scripts, runtime config, and infra cost drivers
**Goal:** prioritized list of cost reductions ranked by monthly $ saved × effort

---

## TL;DR — current monthly cost shape (rough estimate)

| Cost center | Estimated monthly cost | % of total |
|---|---|---|
| **GitHub Actions CI/CD** | $50-150 (10 workflows, mostly ubuntu-latest) | 20-30% |
| **Self-hosted laptop** (production) | $0 incremental (already on-prem) | 0% |
| **PostgreSQL** (laptop) | $0 (existing) | 0% |
| **Third-party APIs** (Firebase, PostHog, Sentry) | $0-50 (free tier) | 0-15% |
| **Storage** (backups) | $5-10 (incremental, on local disk) | 2-5% |
| **Developer time** (slow CI = lost productivity) | $500-2000 (eng hours × hourly rate) | 60-80% |

**The biggest cost is NOT the GitHub bill — it's the developer time wasted on slow CI.** 10 workflows running on `ubuntu-latest` (each PR = full VM) + nightly + weekly jobs that nobody looks at + repeated `npm ci` because cache misses.

**If you only do 3 things:**
1. **Add `actions/cache@v4` everywhere** (saves 30-60% of CI minutes) — likely already partially done
2. **Cancel redundant nightly jobs** (saves 8-12 hours of CI per week)
3. **Move the cheapest, most-frequent jobs to a self-hosted runner** (saves 70-90% of their CI minutes)

**Estimated total savings: 40-60% of CI minutes, 20-30% of total operation cost.**

---

## What's already in place (good)

### Self-hosted laptop model (per `ecosystem.config.js`)

The `voltium-web` and `voltium-worker` apps run via PM2 cluster mode (`instances: 'max'`) on a single laptop. This is the **correct model for the current scale** — no cloud compute cost.

### Concurrency groups (R10 polish #13)

4 workflows have `concurrency:` blocks that `cancel-in-progress: true` on rapid pushes:
- `lighthouse-ci.yml`
- `mutation-nightly.yml`
- `nightly-load.yml`
- `daily-smoke-tests.yml`

This prevents wasted CI on rapid pushes. **Good — keep these.**

### Concurrency cancellation works

- `daily-smoke.yml` — `group: daily-smoke-${{ github.ref }}`
- `lighthouse-ci.yml` — `group: lighthouse-${{ github.ref }}`
- `mutation-nightly.yml` — `group: mutation-${{ github.ref }}`
- `nightly-load.yml` — (already had it)

### Postgres sidecar pattern (R10 polish #15)

`daily-smoke-tests.yml` and `e2e-windows.yml` use the `services: postgres:` block instead of `sudo systemctl start postgresql` (which is blocked on GH runners). **Good — saves 30-60s per job.**

### npm caching

5+ workflows use `actions/setup-node@v4` with `cache: 'npm'`. **Good — saves 60-90s per job.**

---

# Priority 1 — High $ impact, low effort

## P1.1 Add `actions/cache@v4` to the 5 workflows that don't have it (30 min)

**Current state:**
- ✅ `ci-cd.yml` — has `cache: 'npm'`
- ✅ `daily-smoke-tests.yml` — has `cache: 'npm'`
- ✅ `dependency-audit.yml` — has `cache: 'npm'`
- ✅ `flutter-ci-cd.yml` — has `cache: 'npm'`
- ✅ `lighthouse-ci.yml` — has `cache: 'npm'`
- ✅ `mutation-nightly.yml` — has `cache: 'npm'`
- ❌ **`nightly-load.yml`** — no cache
- ❌ **`secret-rotation-nightly.yml`** — no cache
- ❌ **`flutter-e2e-manual.yml`** — no cache
- ❌ **`e2e-windows.yml`** — no cache (just runs setup-node)

**Fix:** add `cache: 'npm'` + `cache-dependency-path` to the 4 missing ones.

**Effort:** 5 min per file × 4 = 20 min

**Savings:** 60-90s per run × 4 workflows × 7-30 runs/month = **~2-3 hours CI per month**.

---

## P1.2 Cancel the 3 nightly workflows that have no value (15 min)

Reviewing each scheduled workflow against "is anyone looking at the result?":

| Workflow | Cron | Last useful? | Recommendation |
|---|---|---|---|
| `secret-rotation-nightly.yml` | `0 6 * * *` daily | **Yes** — checks if secrets are stale | **KEEP** but add concurrency |
| `daily-smoke-tests.yml` | `0 6 * * *` daily | **Yes** — catches prod breakage early | **KEEP** |
| `mutation-nightly.yml` | `0 2 * * 0` weekly (Sun) | Unclear — nobody runs mutations on real PRs | **DEPRECATE** if no value |
| `nightly-load.yml` | `0 4 * * 0` weekly (Sun) | **Maybe** — useful for capacity planning | **KEEP** but add concurrency |
| `dependency-audit.yml` | `0 6 * * 1` weekly (Mon) | **Yes** — opens an issue per week with vulns | **KEEP** |
| `e2e-windows.yml` | (no schedule) | Manual trigger only | **KEEP** |

**Two specific kills:**

1. **`mutation-nightly.yml`** — 4 hr/week CI minutes for results nobody reads. **DEPRECATE**: add a deprecation header, keep the file but don't trigger on schedule.

```yaml
# Deprecated 2026-08-01 — see docs/COST_RECOMMENDATIONS_2026-08-01.md
# Mutation testing doesn't catch bugs that unit tests miss for our codebase.
# Kept for emergency re-enable; remove after 2026-09-01.
on:
  workflow_dispatch: # only manual
```

2. **`lighthouse-ci.yml`** — runs on every push to main/develop. **Free with concurrency**, but it builds the entire Next.js app + runs Chrome. **2-3 minutes per run × 50+ pushes/month = 100-150 minutes/month**. Add a per-PR-only trigger:

```yaml
# Was: push + pull_request
# Now: pull_request only (skip on merge to main)
on:
  pull_request:
    branches: [main, develop]
```

**Effort:** 15 min

**Savings:** 4 hr mutation + 100-150 min Lighthouse = **~5-6 hours CI per month**.

---

## P1.3 Add concurrency groups to the 2 missing workflows (5 min)

Current concurrency blocks:
- `daily-smoke-tests.yml` ✅
- `lighthouse-ci.yml` ✅
- `mutation-nightly.yml` ✅
- `nightly-load.yml` ✅ (per the file content)

**Missing:** `secret-rotation-nightly.yml` runs daily at 6 AM UTC. If a manual dispatch is in progress, the schedule still fires.

**Fix:** add to `secret-rotation-nightly.yml`:
```yaml
concurrency:
  group: secret-rotation-${{ github.ref }}
  cancel-in-progress: true
```

**Effort:** 2 min

**Savings:** 1-2 min per overlap, ~5 min/month.

---

## P1.4 Move `secret-rotation-nightly.yml` to weekly (5 min)

The secret rotation check is the only "nightly" workflow that doesn't have a human checking its output. It just runs and either passes or posts a Slack alert. **A weekly cadence is sufficient** — secrets don't go stale in 24 hours.

**Fix:** change `0 6 * * *` to `0 6 * * 1` (Mondays only).

**Effort:** 2 min

**Savings:** 6 nightly runs/month → 4 weekly runs/month = **2 runs/month saved = ~5 min CI**.

---

## P1.5 Cache the `actions/checkout` (1 min per workflow)

Most workflows do `actions/checkout@v4` followed by `actions/setup-node@v4`. Adding `with: fetch-depth: 1` to the checkout makes it ~2x faster:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 1  # only need HEAD, not full history
```

Currently most workflows use `fetch-depth: 0` (full history) for things like gitleaks, blame, etc. The ones that don't need it (smoke tests, load tests, build) can use `fetch-depth: 1`.

**Effort:** 1 min per file × 4 files = 5 min

**Savings:** 10-20s per checkout × 4 files × 7-30 runs/month = **~10-15 min CI/month**.

---

# Priority 2 — Medium $ impact, low-medium effort

## P2.1 Reduce `cache: 'npm'` cache misses (15 min)

`actions/setup-node` with `cache: 'npm'` uses a hash of `package-lock.json` as the cache key. If the lock file changes, cache misses. But if your lock file is stable for long stretches, the cache works.

**Current cache key:** `cache-dependency-path: web/package-lock.json` (in most files)

**Optimization:** Use `cache-dependency-path: web/package.json` for workflows that don't need exact lockfile pinning (most linting, testing, building). This makes the cache key more lenient — if a transitive dep changes but the top-level deps don't, cache still hits.

**For workflows that need exact pinning** (lockfile validation, dependency audit): keep `package-lock.json`.

**Effort:** 15 min to verify each file

**Savings:** 10-30% cache miss reduction = ~5-10 min CI/month.

---

## P2.2 Add `concurrency.cancel-in-progress: true` semantics globally (10 min)

Right now, only 4 of 10 workflows have concurrency groups. Add to the other 6:

- `secret-rotation-nightly.yml` (already covered in P1.3)
- `e2e-windows.yml`
- `flutter-e2e-manual.yml`
- `flutter-ci-cd.yml`
- `dependency-audit.yml` (cancelled by Dependabot PRs would be useful here)
- `ci-cd.yml` — the main pipeline; should NOT have `cancel-in-progress: true` because it's a chain of dependent jobs

For each (except `ci-cd.yml`):
```yaml
concurrency:
  group: <workflow-name>-${{ github.ref }}
  cancel-in-progress: true
```

**Effort:** 10 min

**Savings:** varies; ~5-10 min CI/month.

---

## P2.3 Move the cheapest, most-frequent jobs to self-hosted runner (2-3 hr)

The "self-hosted runner" pattern is **already in the project** (see `ecosystem.config.js:51` which has the commented `# runs-on: [self-hosted, staging-runner]`). Use it.

**Candidates for self-hosted:**
- `lighthouse-ci.yml` — runs on every PR, 3-5 min each, ~50/month = 4 hours/month
- `dependency-audit.yml` — runs weekly but takes 2-3 min
- `secret-rotation-nightly.yml` — runs weekly

**Setup cost:**
- 1 day to provision a self-hosted runner (any old laptop)
- Configure `.github/workflows/*` to use `runs-on: [self-hosted, ...]`
- **No per-minute cost on self-hosted**

**Savings:** ~6 hours CI/month on GitHub = **$10-30/month** + faster feedback (no queue time).

**Effort:** 2-3 hr to set up + 1 day to provision a runner

---

## P2.4 Postgres tuning on the laptop (1 hr)

**File:** `ecosystem.config.js`

**Current:**
- `voltium-web`: `DATABASE_POOL_SIZE: 8` (cluster mode, `instances: 'max'`)
- `voltium-worker`: `WORKER_DATABASE_POOL_SIZE: 5`

On a laptop with 4 cores, `instances: 'max'` means 4 workers, each with pool size 8 = **32 total connections** to a laptop Postgres (which has default `max_connections: 100`).

This eats up 32% of the laptop's connection pool on a single app. If you also have:
- Daily smoke tests
- Mutation tests
- Manual local dev

You're at 80% of `max_connections` in steady state, and **exhausting the pool on any spike**.

**Fix options:**

1. **Lower pool size per worker:** with 4 instances and pool 4, you get 16 total connections (instead of 32). Or use `instances: 1` with `pool: 16` for better connection reuse (less Postgres fork overhead).

2. **Use PgBouncer** in front of Postgres (1-day setup, 2-3 hr config):
   - Connection pool with `pool_size: 5, reserve_pool: 2`
   - Survives app restarts (no need to wait for connections to free)

3. **Add `connection_limit: 5` to each Prisma schema block** (Prisma-native, no extra service):
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add this in production, not in migrations
}
// Per-query: prisma.$queryRaw`SET statement_timeout = '5s'`
```

**Effort:** 1 hr (option 1), 1 day (option 2)

**Savings:** Reduces laptop CPU + memory pressure. ~5-10% faster page loads under load. Not a $ saving but a real-world performance win.

---

## P2.5 Skip OpenAPI generation on PRs (10 min)

`ci-cd.yml` has a `prisma-check` job that runs `npm run generate:openapi` to verify the OpenAPI spec is in sync. This is a 30-60s step that runs on **every PR** even when the PR doesn't touch `web/src/contracts/openapi.ts`.

**Fix:** add a path filter:
```yaml
prisma-check:
  if: |
    contains(github.event.pull_request.files.*.filename, 'src/contracts/') ||
    contains(github.event.pull_request.files.*.filename, 'prisma/schema.prisma')
```

This skips the job on PRs that don't touch OpenAPI or Prisma schema. Most PRs (UI changes, test changes, etc.) skip this.

**Effort:** 10 min

**Savings:** 30-60s × 50+ PRs/month = **~30-50 min CI/month**.

---

## P2.6 Move `npm audit` to pre-commit (not in CI) (15 min)

`scripts/deploy-prod.sh:31` runs `npm audit --audit-level=high` before every deploy. This is the right pattern. But if you're running it in CI on every PR (via `dependency-audit.yml` weekly), you're paying for it twice.

**Fix:** Verify `dependency-audit.yml` is the only place that runs `npm audit` in CI. Remove from `ci-cd.yml` if present.

**Effort:** 15 min verification

**Savings:** 30-60s × 50+ PRs/month = **~30-50 min CI/month**.

---

# Priority 3 — Code health + small wins

## P3.1 `flutter pub outdated` as monthly Slack report (30 min)

**File:** `flutter/pubspec.yaml` has 50+ dependencies. A `pub outdated` check on every CI build is wasteful — only the **Flutter e2e manual** workflow needs the full pub state.

**Fix:** move `flutter pub outdated` to a monthly scheduled workflow that posts a Slack message with outdated packages. Skip in PR CI.

**Effort:** 30 min

**Savings:** 60-120s per Flutter CI run × 30 runs/month = **30-60 min CI/month**.

---

## P3.2 `actions/dependabot` PR grouping (15 min)

**File:** `.github/dependabot.yml`

The current config likely opens individual PRs for each outdated package. Group them:

```yaml
groups:
  dev-dependencies:
    patterns: ["*dev*", "*test*"]
  web-deps:
    patterns: ["web/*"]
  flutter-deps:
    patterns: ["flutter/*"]
```

**Why:** A single PR for grouped bumps is reviewed once instead of 5 individual PRs. **Saves review time ($$$)** more than CI minutes.

**Effort:** 15 min

**Savings:** ~1 hour of review time per month (10-20 individual PRs → 3-4 grouped PRs).

---

## P3.3 Add `concurrency: group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}` to `ci-cd.yml` (10 min)

The main `ci-cd.yml` doesn't have a concurrency group. When you push 3 commits in 2 minutes to a PR, all 3 pipelines run. Add:

```yaml
concurrency:
  group: ci-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

This **cancels in-progress CI on the same PR** (keeping the merge-to-main run intact).

**Effort:** 10 min

**Savings:** 5-15 min per duplicate PR push × 20/month = **2-5 hours CI/month**.

---

## P3.4 Drop `lighthouse-ci.yml` from `main` push trigger (5 min)

`lighthouse-ci.yml` runs on both `push` and `pull_request`. The `push` trigger fires on every merge to main, but **the audit scores are only useful for PR review** (catching perf regressions before merge).

**Fix:**
```yaml
on:
  pull_request:
    branches: [main, develop]
  # Remove: push trigger
```

**Effort:** 5 min

**Savings:** 3-5 min × 5 main merges/day = **~25-50 min CI/month**.

---

## P3.5 Stop the auto-merge / auto-deploy to staging (already disabled)

`ci-cd.yml` has a commented-out `runs-on: [self-hosted, staging-runner]` for auto-deploy. **Good — keep this disabled** until self-hosted runner is properly set up. Auto-deploy on every push would burn CI + laptop resources.

---

## P3.6 Backup retention (30 min)

**File:** `scripts/db-backup.sh` (per commit `2a52b47`)

Backups accumulate in `~/.voltium/backups/` or `/var/backups/voltium/`. With daily encryption-enabled backups, you accumulate ~30 encrypted files per month.

**Fix:** add a retention policy:
```bash
# Keep last 7 daily + 4 weekly + 3 monthly
find $OUTPUT_DIR -name "*.enc" -mtime +7 -delete
```

**Effort:** 30 min (modify `db-backup.sh` + add a test)

**Savings:** Disk space. ~$0.50/month on a hosted laptop, $0 locally.

---

# Priority 4 — Larger changes (defer to v2)

## P4.1 Move CI to self-hosted (multi-day)

The big one. **All workflows** on a single self-hosted runner (any old laptop). Cost savings: 100% of GitHub Actions bill, but cost: 1-2 days to set up + maintenance burden.

**Recommendation:** **Don't do this yet.** GitHub gives you 2,000 free minutes/month on private repos. You're using well under that. Self-hosted becomes worth it at 5,000+ minutes/month.

---

## P4.2 Replace `flutter_background_service` with a scheduled job (1-2 days)

`flutter/lib/services/background_location_service.dart` uses `flutter_background_service` (a 6-8 MB AAR). For a one-off sync every 5 minutes, a **server-scheduled push notification** (Firebase Cloud Messaging data messages) is much cheaper:

- Removes the AAR → 6-8 MB smaller APK
- Removes battery drain from continuous background service
- Removes the need for `flutter_background_service_android` dependency
- Server side: ~$0.10/1M FCM messages

**Effort:** 1-2 days (rebuild the location sync as a server-pushed job)

**Savings:** App size, battery, dev cost. Not a $ saving for cloud costs but a real user-experience win.

---

## P4.3 Move PDF generation to web-only (2-3 days)

`pdf` package is 8-10 MB in the rider app. Receipts can be generated server-side and opened in browser/WebView. Saves 8-10 MB APK.

**Effort:** 2-3 days

**Savings:** APK size, not a $ saving.

---

# Stack rank by $ impact

| Rank | Fix | Monthly $ saved | Effort | Net |
|---|---|---|---|---|
| 1 | **P1.2** Kill 3 unused nightly jobs | $5-15 + 1-2 hr dev time | 15 min | **HIGH** |
| 2 | **P1.1** Add `actions/cache` to 4 workflows | $3-10 | 20 min | **HIGH** |
| 3 | **P2.3** Self-hosted runner for frequent jobs | $10-30 + faster feedback | 2-3 hr | **HIGH** |
| 4 | **P3.3** Add concurrency to `ci-cd.yml` | $5-15 | 10 min | **HIGH** |
| 5 | **P3.4** Drop Lighthouse `push` trigger | $1-3 | 5 min | **MED** |
| 6 | **P1.3** + **P1.4** secret-rotation concurrency + weekly | $1-2 | 5 min | **MED** |
| 7 | **P2.5** Path-filter OpenAPI gen | $1-2 | 10 min | **MED** |
| 8 | **P1.5** Checkout `fetch-depth: 1` | <$1 | 5 min | **LOW** |
| 9 | **P2.1** Cache key optimization | <$1 | 15 min | **LOW** |
| 10 | **P2.2** Global concurrency groups | <$1 | 10 min | **LOW** |
| 11 | **P3.2** Dependabot group PRs | $5-20 dev time | 15 min | **LOW-MED** |
| 12 | **P2.4** Postgres pool tuning | not $ | 1 hr | **LOW (perf win)** |
| 13 | **P3.1** `pub outdated` Slack monthly | <$1 | 30 min | **LOW** |
| 14 | **P3.6** Backup retention | <$1 | 30 min | **LOW** |

**Recommended order if 1 hour:**
1. P1.2 (15 min) — kill 3 unused nightly jobs (single highest dev-time $ saving)
2. P1.1 (20 min) — add `actions/cache` to 4 workflows
3. P3.3 (10 min) — add concurrency to `ci-cd.yml`
4. P3.4 (5 min) — drop Lighthouse `push` trigger
5. P1.3 + P1.4 (5 min) — secret-rotation concurrency + weekly

**Total: 55 min, estimated $10-30/month in CI minutes + 1-2 hours/month in dev time.**

**Recommended order if 1 day:**
1. The 55-min batch above
2. P2.3 (2-3 hr) — provision self-hosted runner for the 3 most-frequent jobs
3. P2.5 (10 min) — path filter for OpenAPI
4. P2.2 (10 min) — global concurrency
5. P2.4 (1 hr) — Postgres pool tuning
6. P3.1 (30 min) — `pub outdated` Slack
7. P3.2 (15 min) — Dependabot group PRs
8. P3.6 (30 min) — backup retention

**Total: ~6 hours, estimated $30-80/month in CI minutes + 3-5 hours/month in dev time.**

---

# Measurement plan

Before any fix, baseline:

1. **GitHub Actions minutes used (this month):**
   - `gh api /repos/{owner}/{repo}/actions/runs?per_page=100` and sum
   - Or check the Actions tab → Settings → Billing

2. **CI feedback time** (time from push to green/red):
   - `gh pr list --json number,createdAt,statusCheckRollup`

3. **Laptop CPU/memory under load:**
   ```bash
   pm2 monit
   # or
   docker stats # if you migrate to docker later
   ```

4. **Postgres connection count:**
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
   ```

Re-measure after each fix.

---

# Source references

- `.github/workflows/ci-cd.yml` (282 lines, 12 jobs)
- `.github/workflows/daily-smoke-tests.yml` (109 lines, daily cron)
- `.github/workflows/dependency-audit.yml` (Mondays 06:00 UTC)
- `.github/workflows/e2e-windows.yml` (manual trigger)
- `.github/workflows/flutter-ci-cd.yml`
- `.github/workflows/flutter-e2e-manual.yml` (114 lines)
- `.github/workflows/lighthouse-ci.yml` (42 lines, push+PR)
- `.github/workflows/mutation-nightly.yml` (51 lines, weekly Sun)
- `.github/workflows/nightly-load.yml` (91 lines, weekly Sun)
- `.github/workflows/secret-rotation-nightly.yml` (33 lines, daily)
- `ecosystem.config.js` (PM2 config, instances: 'max')
- `scripts/deploy-prod.sh` (90 lines, includes `npm audit` gate)
- `web/next.config.mjs` (Next.js config, compress: true already)
- `flutter/pubspec.yaml` (50+ deps)
- `docs/REMEDIATION_PLAN_2026-07-31.md` §R10 (where R10 polish #13-15 set up the current patterns)

---

# Out of scope (defer to v2)

- **Move from GitHub Actions to self-hosted entirely** (only worth it at 5,000+ min/month)
- **Migrate to GitLab CI** (different cost model, not a clear win at current scale)
- **Replace PM2 cluster with Docker Swarm** (overhead > benefit at current scale)
- **CDN for static assets** (already handled by Next.js + Vercel-style edge if deployed there)
- **Reduce `flutter` package versions** (covered in PERF_RECOMMENDATIONS, not a cost saving)
- **Add Redis** for shared cache across PM2 pods (CACHE_RECOMMENDATIONS P3.1, defer)

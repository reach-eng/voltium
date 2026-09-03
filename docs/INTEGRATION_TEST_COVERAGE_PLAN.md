# Voltium 100% Integration Test Coverage Plan

> **Created**: 2026-07-01
> **Status**: Approved Roadmap / Deferred (Tracked as TEST-019 in `AUDIT_HYGIENE.md §Batch 14`)
> **Goal**: Every OpenAPI operation (182 across 119 paths) has at least one integration test covering the happy path. Every operation also has a 4xx-error test (auth, validation, not-found).
> **Note**: This is a multi-sprint strategic roadmap (10 work days, ~15,000+ lines of test code across 40-60 new files) staged for post-launch execution beyond the existing baseline of 76 integration test files (451 tests) and 3,000+ unit/integration tests.

---

## 1. Current State (2026-07-01 audit)

### 1.1 API surface
- **119 unique paths** in `src/app/api/**/route.ts`
- **182 HTTP operations** documented in `src/contracts/openapi.json`
- Breakdown by method: 83 GET, 63 POST, 25 PUT, 11 DELETE
- Breakdown by tag: 116 admin, 20 rider profile, 10 auth, 8 rentals, 7 files, 5 support, 4 wallet, 4 notifications, 2 KYC, 2 guarantor, 2 health, 1 vehicles, 1 hubs

### 1.2 Existing integration test infrastructure
- **50 non-unit test files** under `web/tests/{integration,api,security,e2e,smoke}`
- **727 integration/api/security tests** already exist
- **9 dedicated test directories**:
  - `web/tests/integration/` (24 files, ~200 tests) — workflow integration
  - `web/tests/api/` (5 files) — single-endpoint API tests
  - `web/tests/api-routes.test.ts` (1454 lines) — the main API coverage file
  - `web/tests/security/` (2 files) — pii_leak, privilege_escalation
  - `web/tests/smoke.test.ts` — quick smoke
  - `web/tests/offline-store.test.ts` — Flutter integration
  - `web/tests/dynamic-pricing.test.ts`, `image-compress.test.ts` — feature-specific

### 1.3 Path-level coverage of OpenAPI operations
- **45 of 182 operations** (25%) are NOT referenced in any test file
- The 45 uncovered operations are concentrated in:
  - Admin sub-resources: FAQs, feature-flags, legal, offers, rewards, scores, team-leaders
  - Admin bulk operations: hubs/bulk, tickets/bulk, transactions/bulk, vehicles/bulk, team-leaders/bulk
  - Admin data-management: backup detail (get/delete)
  - Admin jobs, workflow-coverage
  - Device permissions
  - Admin auth refresh
  - Several rider sub-resources

### 1.4 Limitations of path-level analysis
The "45 not covered" number is a **lower bound**. Path-level matching doesn't verify:
- Whether the test actually exercises the method (GET vs POST vs DELETE)
- Whether the test covers the request body schema
- Whether the test covers response status codes (200 vs 422 vs 500)
- Whether the test covers auth/RBAC scenarios
- Whether the test covers edge cases (empty body, invalid params)

The 100% target is: every operation × every method × at least 1 happy path test + at least 1 negative test (auth/validation/state).

---

## 2. Coverage Target Definition

### 2.1 What "100% integration test coverage" means
For every operation in the OpenAPI spec, the test suite must include:

1. **Happy path test**: valid request → 2xx response with expected shape
2. **Auth test**: missing/invalid token → 401 (or 403 for public routes)
3. **Validation test** (for POST/PUT/PATCH): missing required fields → 422
4. **Method match**: the test must use the correct HTTP method

### 2.2 Exclusions
The following are excluded from the 100% target:
- **Health endpoints** (`/api/health`, `/api/health/db`, etc.) — already covered by `integration/health/`
- **Internal/cron endpoints** (`/api/cron/*`, `/api/internal/*`) — covered by `integration/cron/`
- **Metrics** (`/api/metrics`, `/api/monitoring/metrics`) — covered by smoke tests
- **Device webhooks** (`/api/riders/register-token`) — covered by rider device tests
- **Webhooks without auth** — covered by `integration/backups/`
- **Files endpoints** (`/api/files/*`) — covered by `integration/files/`

After exclusions: ~155 operations need explicit coverage.

### 2.3 Required test counts
- **1,550+ new integration tests** (155 operations × 10 tests average: 2 happy, 2 auth, 2 validation, 2 RBAC, 2 state)
- Estimated **40-60 new test files** organized by feature area
- Estimated **15,000+ lines of new test code**

---

## 3. Test File Organization

New tests will be organized by feature area in `web/tests/integration/`:

```
web/tests/integration/
├── admin/                  (existing, expand)
│   ├── admin_auth.test.ts
│   ├── admin_users_roles.test.ts
│   ├── admins.test.ts                 (NEW: /api/admin/admins)
│   ├── coupons.test.ts                (NEW)
│   ├── feature_flags.test.ts          (NEW)
│   ├── hubs_bulk.test.ts              (NEW)
│   ├── jobs.test.ts                   (NEW)
│   ├── legal.test.ts                  (NEW)
│   ├── offers.test.ts                 (NEW)
│   ├── rewards.test.ts                (NEW)
│   ├── scores.test.ts                 (NEW)
│   ├── team_leaders_bulk.test.ts      (NEW)
│   ├── tickets_bulk.test.ts           (NEW)
│   ├── tickets_id_messages.test.ts    (NEW)
│   ├── tickets_id.test.ts             (NEW)
│   ├── transactions_bulk.test.ts      (NEW)
│   ├── vehicles_bulk.test.ts          (NEW)
│   ├── vehicles_id_history.test.ts    (NEW)
│   ├── workflow_coverage.test.ts      (NEW)
│   ├── data_management/               (NEW directory)
│   │   ├── backup_get.test.ts
│   │   ├── backup_delete.test.ts
│   │   ├── backup_download.test.ts
│   │   ├── backup_verify.test.ts
│   │   ├── restore_history.test.ts
│   │   └── restore_start.test.ts
│   ├── earnings.test.ts               (NEW)
│   ├── faqs.test.ts                   (NEW)
│   ├── incidents_id.test.ts           (NEW)
│   └── ... (expand existing)
├── rider/                  (existing, expand)
│   ├── device_permissions.test.ts     (NEW)
│   ├── verify_lock_password.test.ts   (NEW)
│   ├── riders_register_token.test.ts  (NEW)
│   └── ... (expand existing)
├── auth/                   (existing)
├── kyc/                    (existing)
├── wallet/                 (existing)
├── rentals/                (existing)
├── support/                (existing)
├── notifications/          (existing)
├── files/                  (existing)
├── backups/                (existing)
├── fleet/                  (existing)
├── guarantor/              (existing)
├── incidents/              (existing)
├── plans/                  (existing)
├── rewards/                (existing)
├── state/                  (existing)
├── system/                 (existing)
├── validation/             (existing)
├── audit/                  (existing)
├── cron/                   (existing)
├── conflicts/              (existing)
├── health/                 (existing)
├── laptop/                 (existing)
├── reports/                (existing)
├── rbac.test.ts            (existing)
├── api-integration.test.ts (existing)
├── chaos.test.ts           (existing)
├── worker-dispatcher.test.ts (existing)
└── helpers.ts              (existing)
```

---

## 4. Test Pattern (per operation)

Each new test file follows this pattern:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, adminLogin, riderLogin, generateRandomPhone } from '../helpers';

describe('GET /api/admin/faqs', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  // 1. Happy path
  it('1. returns 200 with list of FAQs', async () => {
    const { status, body } = await api('/api/admin/faqs', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // 2. Auth — missing cookie
  it('2. returns 401 when no auth cookie', async () => {
    const { status } = await api('/api/admin/faqs', { method: 'GET' });
    expect(status).toBe(401);
  });

  // 3. Pagination
  it('3. supports pagination', async () => {
    const { status, body } = await api('/api/admin/faqs?page=1&limit=10', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.pagination).toBeDefined();
  });

  // 4. Search
  it('4. supports search query', async () => {
    const { status, body } = await api('/api/admin/faqs?search=how', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.data).toBeDefined();
  });
});

describe('POST /api/admin/faqs', () => {
  let adminCookie: string;
  beforeAll(async () => { adminCookie = await adminLogin(); });

  // 1. Happy path
  it('1. creates a new FAQ', async () => {
    const { status, body } = await api('/api/admin/faqs', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        question: 'How do I book a vehicle?',
        answer: 'Use the app to find a vehicle and tap Book.',
        category: 'booking',
      },
    });
    expect(status).toBe(200);
    expect(body.data.id).toBeDefined();
  });

  // 2. Validation — missing required field
  it('2. returns 422 when question is missing', async () => {
    const { status } = await api('/api/admin/faqs', {
      method: 'POST',
      cookie: adminCookie,
      json: { answer: 'incomplete' },
    });
    expect(status).toBe(422);
  });

  // 3. Auth
  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/faqs', {
      method: 'POST',
      json: { question: 'x', answer: 'y' },
    });
    expect(status).toBe(401);
  });
});

describe('DELETE /api/admin/faqs/{id}', () => {
  // similar pattern
});
```

---

## 5. Phased Execution Plan (10 work days)

### Day 1: Admin sub-resources (small ones)
- `admins.test.ts` (CRUD on /api/admin/admins)
- `coupons.test.ts` (CRUD on /api/admin/coupons)
- `feature_flags.test.ts` (CRUD on /api/admin/feature-flags)
- `legal.test.ts` (CRUD on /api/admin/legal)
- `offers.test.ts` (CRUD on /api/admin/offers)
- `rewards.test.ts` (CRUD on /api/admin/rewards)
- `scores.test.ts` (CRUD on /api/admin/scores)
- **Total: ~28 operations × 6 tests = ~168 new tests**

### Day 2: Admin bulk operations
- `hubs_bulk.test.ts` (POST /api/admin/hubs/bulk)
- `team_leaders_bulk.test.ts` (POST /api/admin/team-leaders/bulk)
- `tickets_bulk.test.ts` (POST /api/admin/tickets/bulk)
- `tickets_id.test.ts` (GET /api/admin/tickets/{id})
- `tickets_id_messages.test.ts` (POST /api/admin/tickets/{id}/messages)
- `transactions_bulk.test.ts` (GET /api/admin/transactions/bulk)
- `vehicles_bulk.test.ts` (POST /api/admin/vehicles/bulk)
- `vehicles_id_history.test.ts` (GET /api/admin/vehicles/{id}/history)
- **Total: ~9 operations × 8 tests = ~72 new tests**

### Day 3: Admin data-management
- `backup_get.test.ts`, `backup_delete.test.ts`, `backup_download.test.ts`, `backup_verify.test.ts`
- `restore_history.test.ts`, `restore_start.test.ts`
- `workflow_coverage.test.ts`
- `earnings.test.ts`
- `faqs.test.ts`
- `incidents_id.test.ts`
- `jobs.test.ts`
- **Total: ~12 operations × 8 tests = ~96 new tests**

### Day 4: Rider sub-resources
- `device_permissions.test.ts` (POST /api/device/permissions, /api/rider/device/permissions)
- `verify_lock_password.test.ts` (POST /api/rider/verify-lock-password)
- `rider_register_token.test.ts` (POST /api/riders/register-token)
- `internal_debug.test.ts` (GET /api/internal/debug)
- **Total: ~5 operations × 8 tests = ~40 new tests**

### Day 5: Auth endpoints coverage
- `auth_refresh.test.ts` (POST /api/auth/refresh, /api/admin/auth/refresh)
- `ready.test.ts` (GET /api/ready)
- **Total: ~3 operations × 6 tests = ~18 new tests**

### Day 6: Error path coverage (all operations)
- Add a `rbac_negative.test.ts` that hits every admin endpoint without auth
- Add a `validation_negative.test.ts` that hits every POST/PUT/PATCH with empty body
- **Total: ~155 operations × 2 tests = ~310 new tests**

### Day 7: CI integration
- Add `test:integration:full` script
- Update `ci-cd.yml` to run the full integration suite
- Add a coverage report job
- Add a coverage gap detector script

### Day 8: Cross-cutting
- Add `metrics_test.ts` (GET /api/metrics, /api/monitoring/metrics)
- Add `webhook_cron.test.ts` extensions
- Add chaos scenarios for the new endpoints

### Day 9: Hardening
- Run full suite 3 times in a row, check for flakiness
- Fix any timing issues
- Update coverage thresholds

### Day 10: Documentation
- Update `docs/TESTING_STRATEGY.md`
- Add `docs/INTEGRATION_TESTING.md` (new file)
- Final coverage report

---

## 6. CI Integration

### 6.1 New npm scripts
```json
{
  "test:integration:full": "vitest --run tests/integration",
  "test:integration:api": "vitest --run tests/api",
  "test:integration:security": "vitest --run tests/security",
  "test:integration:coverage": "vitest --run tests/integration tests/api tests/security --coverage",
  "test:integration:all": "vitest --run tests/integration tests/api tests/security tests/api-routes.test.ts"
}
```

### 6.2 Updated `ci-cd.yml`
- Add `test:integration:full` after the existing `test:integration` step
- Add a coverage report artifact
- Add a coverage gap detection step that fails if any OpenAPI operation is not referenced in any test

### 6.3 New coverage gap detection script
`web/scripts/check-api-coverage.js`:
- Parses `src/contracts/openapi.json` to get all operations
- Scans `web/tests/integration/`, `web/tests/api/`, `web/tests/security/` for path references
- Fails the CI if any operation is not referenced

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tests depend on dev server running | Tests can be flaky in CI | Add `wait-on tcp:8081` with 120s timeout |
| Tests share global state (DB) | Test order matters | Each test creates unique riders with `generateRandomPhone()` |
| Some operations are admin-only | Need elevated auth | `adminLogin()` helper already exists |
| Slow tests | CI takes 30+ min | Parallelize by splitting into multiple CI jobs |
| Coverage gap detection false positives | Path matching too lenient | Use exact path + method matching |
| Some operations are intentionally internal | Wasted test effort | Document exclusions in `INTEGRATION_TESTING.md` |

---

## 8. Definition of Done

The 100% target is met when:
1. All 182 OpenAPI operations have at least 1 happy-path integration test
2. All 155 non-excluded operations have auth-failure tests
3. All 121 POST/PUT/PATCH operations have validation tests
4. The coverage gap detection script exits 0
5. CI runs the full suite in <15 min
6. All tests pass 3 times in a row without flakes

---

## 9. Open Questions

1. **Should I include admin sub-resources** (FAQs, legal, offers, etc.) **in the 100% target**? Some of these are rarely used and may not be worth the test maintenance cost. The plan includes them, but they could be moved to a "tier 2" target.

2. **Should the coverage gap detection be a hard CI failure or a soft warning**? A hard failure enforces discipline but can block deploys; a soft warning allows gradual improvement.

3. **How aggressive should the validation tests be**? Current `validation_negative.test.ts` checks empty body. The plan adds per-operation validation tests (missing required fields, invalid types). This is more thorough but adds 100+ tests.

4. **Should I parallelize the test suite** to keep CI under 15 min? Vitest supports file-level parallelism. Currently `fileParallelism: false` to avoid connection pool exhaustion. With the new global setup and 50-connection pool, we could enable parallelism.

---

## 10. Decision Points (need user input)

Before I start execution, I need confirmation on:

1. **Should I commit at the end of each day**, or one final commit at the end?
2. **Should the coverage gap detection be hard CI failure or soft warning**?
3. **Tier 1 (admin CRUD, auth, rider essentials) or all 155 operations**?
4. **Should I parallelize the integration suite** for faster CI?

Default plan: daily commits, soft warning, tier 1 only (skip the rare admin sub-resources), no parallelization.

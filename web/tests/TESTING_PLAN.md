# Voltium Testing Plan

## Context

| Aspect | Current State |
|---|---|
| Unit tests | 574 passing, 28 skipped, 33 files |
| Integration tests | 23 files covering health, auth, rentals, wallet, KYC, support, etc. |
| API routes | 84 Next.js route handlers, 14 backend modules |
| Architecture | Route handler → use-case → repository → Prisma/Postgres |
| CI | Ubuntu, Node 20, no Docker, Postgres 16 as service |
| Flutter E2E | 33 passing integration tests |

---

## Phase 1 — CI Integration Test Pipeline

**Goal**: All integration & API route tests run in CI against a live dev server.

### 1a. CI Postgres
Postgres 16 configured as CI service:
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

### 1b. CI Test Pipeline
In `test` job, after migration + contract tests:
1. Seed database — `npm run db:seed`
2. Start dev server — `npm run dev &`, PID captured
3. Wait — `npx wait-on tcp:8081` (60s timeout)
4. Integration tests — `npm run test:integration`
5. API route tests — `npm run test:api`
6. Stop dev server — `if: always()` kill

### 1c. Review Skipped Tests
- 28 skipped unit tests (likely env-gated)
- Inspect each for skip condition, re-enable where possible

---

## Phase 2 — Backend Negative & Edge-Case Tests

### 2a. Auth & RBAC Negative Tests

| Test | Assert |
|---|---|
| Expired JWT | `401` |
| Invalid JWT signature | `401` |
| Missing token | `401` |
| Cross-tenant access (Rider A → Rider B) | `403` |
| Rider calls admin route | `403` |
| Admin calls rider route | `200` |
| Rate-limited `send-otp` | `429` |
| OTP brute force | `429` |

### 2b. Input Validation

Per module (`rentals`, `wallet`, `kyc`, `support`, etc.):
- Missing required fields → `400`
- Invalid format (date, phone, email) → `400`
- Empty/null/undefined → `400`
- Extreme values (negative amounts, 100-year dates) → `400`

### 2c. State Machine Transitions

| Machine | Invalid Transition |
|---|---|
| `RiderLifecycleStatus` | `NEW` → `ACTIVE` (skip KYC) |
| `KycStatus` | `PENDING` → `APPROVED` (skip submit) |
| `DepositStatus` | `PENDING` → `REFUNDED` (skip approve) |
| `TransactionStatus` | `PENDING` → `REVERSED` (not supported) |

### 2d. Conflict & Race
- Double-book vehicle+shift → `409`
- KYC after approved → `409`
- Wallet withdraw with insufficient funds → `400`

---

## Phase 3 — Webhook & Cron Tests

### 3a. Stripe Webhook (`POST /api/internal/worker`)
- Valid signature + known event → `200`, ledger entry created
- Invalid signature → `401`
- Unknown event type → `400`
- Duplicate idempotency key → idempotent `200`

### 3b. Cron Jobs

| Route | Success | Edge Case |
|---|---|---|
| `POST /api/cron/notifications` | Sends pending, `{processed: N}` | Empty → `{processed: 0}` |
| `POST /api/cron/reconciliation` | Matches ledger→Stripe | Mismatch logged |
| `POST /api/cron/cleanup-telemetry` | Deletes expired | No-op |

---

## Phase 4 — Flutter Widget & Unit Tests

### 4a. Widget Tests

| Screen | Tests |
|---|---|
| Login | Renders phone input, button disabled when empty, enabled with 10 digits |
| Dashboard | Shows vehicle card, wallet balance, shift timer |
| Profile | Shows fields, edit button, KYC badge |
| Settings | Theme toggle, biometric toggle |
| Wallet | Balance display, topup button, filter chips |
| Support | FAQ list, chat input, ticket list |

### 4b. Offline & Error States
- No network → offline indicator visible
- API 500 → toast/retry shown
- Empty wallet → empty state illustration
- Expired session → redirect to login

---

## Phase 5 — Cross-Cutting

### 5a. Migration Tests
CI runs `prisma migrate deploy` on fresh Postgres → assert 0 errors.

### 5b. Secrets Validation
Smoke test checks `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `FCM_SERVER_KEY` are set in CI.

### 5c. Load Test (k6)
- 100 concurrent users hitting `GET /api/vehicles` → p95 < 500ms
- 50 concurrent users hitting `POST /api/rental/book` → p95 < 2s, 0 errors

### 5d. Contract Tests
Run in CI: `npm run test:contracts`

---

## Priority

```
Phase 1  ████████████████████████████████  (blocking — integration tests in CI)
Phase 2  ████████████████████████████      (security & edge cases)
Phase 3  ██████████████████                (payment/reliability)
Phase 4  ████████████████                  (Flutter gap)
Phase 5  █████████                         (hardening)
```

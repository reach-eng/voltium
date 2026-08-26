# Voltium Security Policy

## 1. Overview & Security Architecture
Voltium Electric Mobility enforces zero-trust security controls across all backend microservices, Next.js API routes, Flutter mobile applications, and administrative control panels.

---

## 2. Authentication & Session Management
- **JWT Authentication**: Authenticated sessions utilize HMAC SHA-256 signed JSON Web Tokens (JWT) with strict algorithm verification.
- **Short-Lived Cookies**: Session cookies (`voltium_session`) enforce `HttpOnly`, `Secure`, `SameSite=Strict`, and a **24-hour maximum TTL (`maxAge: 86400`)**.
- **Token Refresh**: Mobile clients refresh authentication credentials via `/api/auth/refresh` using high-entropy refresh tokens.
- **Dev Bypass Flags**: Flags such as `ENABLE_TEST_OTP` and `ENABLE_DEV_ADMIN_LOGIN` are environment-gated in `src/lib/env.ts` and strictly disabled when `APP_ENV !== 'development'`. CI regression Gate 6 enforces this check automatically.

---

## 3. Access Control & RBAC
- **Role-Based Access Control (RBAC)**: Enforced via `withRbac(requiredRole, handler)` across admin routes (`SUPER_ADMIN`, `OPS_MANAGER`, `TL_LEADER`).
- **Rider Lifecycle State Machine**: State transitions (e.g. `NEW` → `PHONE_VERIFIED` → `KYC_SUBMITTED` → `KYC_APPROVED` → `ACTIVE` → `SUSPENDED` → `CLOSED`) are validated strictly via `riderLifecycleService.validateTransition`. Unsanctioned lifecycle jumps are blocked with structured `RiderLifecycleError` exceptions.

---

## 4. Input Validation & Data Sanitization
- **Strict Schema Enforcement**: All incoming HTTP payloads are parsed and validated using Zod schemas (`src/lib/validators.ts`) via `validateBody(schema, handler)`.
- **E.164 Phone Normalization**: Phone numbers are normalized using `phoneSchema` to strip country code prefixes (`+91`) and format numbers into standardized 10-digit formats before validation.
- **XSS & Text Sanitization**: Text input is sanitized using `sanitizeText` to strip dangerous HTML tags and script injections.

---

## 5. Rate Limiting & Denial-of-Service Defense
- **Dual-Tier Rate Limiting**:
  - **In-Memory LRU Store**: Provides sub-millisecond local rate-limiting protection.
  - **PostgreSQL Bucket Persistence**: When `RATE_LIMIT_STORE_PROVIDER=postgres` or `db`, rate-limiting counters persist across serverless/container restarts in the `RateLimitBucket` database model.
- **Strict Endpoint Thresholds**:
  - `/api/auth/send-otp`: 3 attempts / 10 minutes per IP/phone.
  - `/api/auth/verify-otp`: 5 attempts / 10 minutes per IP/phone.
  - `/api/auth/verify-phone`: 10 attempts / 10 minutes per IP/phone.

---

## 6. Content Security Policy (CSP) & CORS Policy
- **Dynamic CSP Headers**: Applied via `middleware.ts` using crypto-random nonces per HTTP request (`script-src 'self' 'nonce-${nonce}'`).
- **Development vs Production Isolation**: Development CSP eliminates `'unsafe-eval'` while preserving HMR, while production CSP enforces nonced `script-src`, `base-uri 'self'`, `form-action 'self'`, and `frame-ancestors 'none'`.
- **CORS Policy & Origin Validation**: CORS preflight checks (`middleware.ts`) validate request origins against `ALLOWED_ORIGINS`. In development mode, localhost origins are strictly restricted to explicit allowed ports (`8081`, `3000`, `8080`, `5173`, `5554`). Arbitrary or unlisted local ports are blocked.

---

## 7. SQL Injection Prevention & ORM Security
- **Prisma Parameterized Queries**: All database access utilizes Prisma ORM, which automatically parameterizes all SQL queries to prevent SQL injection vulnerabilities.
- **Raw Query Security**: Raw SQL calls (such as rate-limiting bucket upserts or ledger aggregations) use parameterized binding placeholders (`$1`, `$2`, `$3`) with strict integer/UUID casting. Concatenation of raw user input strings in SQL queries is strictly prohibited.

---

## 8. Financial Immutability & Double-Entry Ledger Protection
- **Immutable Transaction Records**: Financial transaction records (`Transaction`) cannot be deleted (`DELETE /api/transaction/history` returns HTTP `403 Forbidden`).
- **Double-Entry Ledger Integrity**: Wallet mutations execute via `walletLedgerService`, maintaining an immutable audit log (`WalletLedger`) with atomic balance updates (`increment`/`decrement`) inside database transactions.
- **Dispute Refund Idempotency**: Support dispute refunds enforce idempotency guards to prevent double-refunding.

---

## 9. Dev Bypass Security Gates & Secret Validation
- **Environment-Gated Bypass Flags**: Dev flags `ENABLE_TEST_OTP` and `ENABLE_DEV_ADMIN_LOGIN` cause server startup failure via `src/lib/env.ts` `.refine()` if enabled when `NODE_ENV === 'production'` or `APP_ENV === 'production' || APP_ENV === 'staging'`.
- **Secret Placeholder Rejection**: Startup validation strictly rejects placeholder secret strings (e.g. `YOUR_SECURE_...`, `CHANGE_ME`) in non-development environments.

---

## 10. Data Encryption & PII Protection
- **Encryption at Rest**: Personally Identifiable Information (PII) such as Aadhaar, PAN numbers, and financial details are encrypted at rest using **AES-256-GCM**.
- **Key Versioning**: Enforces dual-key versioning (`PII_ENCRYPTION_KEY_V1`, `PII_ENCRYPTION_KEY_V2`) for zero-downtime key rotation.
- **Redaction in Observability**: PII is redacted from logs, traces, and PostHog analytics using `redactPii` and `MonitoringService._maskPII`.

---

## 11. Secret Scanning & Rotation Policy
- **Pre-Commit Secret Scanning**: `gitleaks` scans all commits locally via Husky hooks and in GitHub Actions CI pipelines.
- **Rotation SLA**: Secret rotation follows a 6-step zero-downtime procedure:
  1. Generate new secret in secure key management service.
  2. Deploy key as `_V2` environment variable.
  3. Verify staging decryption and issuance.
  4. Promote `_V2` to primary in production environment during low-traffic window.
  5. Decommission `_V1` key after grace period.
  6. Document rotation entry in audit log.

---

## 12. Dependency Security & Vulnerability Reporting
- **Automated Scanning**: Dependabot and `npm audit` monitor dependency vulnerabilities.
- **SLA**: Critical vulnerabilities are patched within **24 hours**; high-severity within **7 days**.
- **Reporting Vulnerabilities**: Report security issues to `security@voltium.app`.

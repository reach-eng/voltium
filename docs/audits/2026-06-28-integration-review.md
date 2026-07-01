# Integration Review — 2026-06-28

A comprehensive read-only audit of every integration surface in the
Voltium platform, run after Phase 0-3 completion on branch
`fix/phase1-critical-blockers`.

Five parallel exploration passes:
1. Worker registry & outbox job wiring
2. FCM end-to-end (server signing → device validation)
3. OpenAPI ↔ Flutter client contract
4. Prisma schema ↔ migrations ↔ lib usage
5. CI/CD, husky, lint-staged, ESLint, scripts

## Summary verdict

| Surface | Verdict | Critical findings |
|---|---|---|
| Worker registry | ✅ Clean | Phase 1.4 wiring correct; knowledge graph was stale |
| FCM command channel | ⚠️ 1 critical gap | 7 of 9 security actions silently dropped on device |
| OpenAPI/Flutter contract | ⚠️ 1 runtime 405 | `GET /api/support/chat` called by Flutter, no handler |
| Prisma/migrations | 🛑 1 blocker drift | `IdempotencyKey.response` NOT NULL in DB, nullable in schema — raw INSERT will fail |
| CI/CD tooling | ⚠️ 2 PR blockers | `lint-staged` missing, ESLint OOM risk in CI |

## Critical findings (must fix before merge)

### C1 — IdempotencyKey.response NOT NULL drift 🛑
- **Schema** (`web/prisma/schema.prisma:1464`): `response String?` (nullable)
- **Migration** (`20260620000000_add_idempotency_key/migration.sql:5`): `"response" TEXT NOT NULL`
- **Migration** (`20260626000001_idempotency_status/migration.sql:44-45`): only sets `DEFAULT ''`, does **NOT** drop NOT NULL
- **Lib** (`web/src/lib/idempotency.ts:59-65`): raw INSERT passes `NULL` for `response`
- **Impact**: `checkOrClaimIdempotency` fails on every first-time claim with `null value in column "response" violates not-null constraint`
- **Fix**: add `ALTER TABLE "IdempotencyKey" ALTER COLUMN response DROP NOT NULL;` to a new migration

### C2 — FCM security command allowlist mismatch ⚠️
- **Server** (`web/src/lib/fcm.ts:118-155`): dispatches 9 security actions (DISABLE_CAMERA, ENABLE_CAMERA, ENFORCE_PASSCODE, CHECK_LOCATION_INTEGRITY, ADMIN_LOCK, UNLOCK_DEVICE, PERSIST_APP, ENFORCE_LOCATION, RESTRICT_APPS_CONTROL)
- **Client** (`flutter/lib/services/fcm_service.dart:33-36`): `_allowedSecurityActions = {ADMIN_LOCK, UNLOCK_DEVICE}` only
- **Impact**: 7 of 9 admin security commands pass HMAC verification but are silently dropped by the device. Admin UI reports success (FCM send receipt) while the device never executes.
- **Fix**: expand the client allowlist to match the server's dispatch list, or document which actions are intentionally disabled for public beta

### C3 — `GET /api/support/chat` runtime 405 ⚠️
- **Flutter** (`flutter/lib/features/support/data/repository_impl.dart:35`): calls `_apiClient.getSupportChat()`
- **Generated client** (`flutter/lib/core/network/generated/api_client.dart:389`): `getSupportChat()` method exists
- **Backend** (`web/src/app/api/support/chat/route.ts`): exports only POST (line 56, via `withApiHandler`)
- **Impact**: Flutter support screen gets 405 Method Not Allowed when fetching chat history
- **Fix**: add a GET handler to `support/chat/route.ts` or remove the method from the generated client

## High-priority findings (should fix before merge)

### H1 — FCM HMAC secret has insecure default, no production guard
- `web/src/lib/env.ts:12-15`: `.default('fcm-command-hmac-secret-default-32-chars-long')`
- Unlike `JWT_SECRET` (which has a placeholder blocklist at `env.ts:170-185`), `FCM_COMMAND_HMAC_SECRET` has no production check
- If production boots without the env var, every security command is signed with a publicly-known secret
- **Fix**: add the default value to `insecurePlaceholders` blocklist in `env.ts`

### H2 — Replay window mismatch (server 10min, client 5min)
- Server nonce TTL: 10 minutes (`fcm.ts:12`)
- Client staleness window: 5 minutes (`fcm_service.dart:23`)
- Under >5min clock skew or slow delivery, validly-signed commands are rejected client-side while the server still has the nonce live
- **Fix**: align both to the same window (recommend 5min both sides)

### H3 — IdempotencyStatus enum type name drift
- Schema `@@map("idempotency_status")` expects lowercase `idempotency_status`
- Migration `20260626000001_idempotency_status/migration.sql:16` creates `CREATE TYPE "IdempotencyStatus" AS ENUM` (PascalCase)
- `prisma migrate diff` / `db pull` will flag this; future `migrate dev` may auto-generate a risky DROP+CREATE+ALTER migration
- **Fix**: rename the DB enum type to `idempotency_status` to match `@@map`

### H4 — Missing index for outbox reaper query
- Reaper filters on `status='PROCESSING' AND updatedAt < cutoff` (`job-queue.ts:164`)
- No `@@index([status, updatedAt])` exists on `OutboxEvent`
- Current `(status)` index is adequate for small PROCESSING counts but degrades if many rows get stuck
- **Fix**: add `@@index([status, updatedAt])` to `OutboxEvent` in schema.prisma

### H5 — lint-staged not installed, pre-commit hook broken
- `.husky/pre-commit` runs `cd web && npx lint-staged`
- `lint-staged` is NOT in `web/package.json` devDependencies
- No `lint-staged` config file exists anywhere
- Every `git commit` fails on a clean clone until developer uses `--no-verify` (FIXED: husky installed properly)
- **Fix**: either install `lint-staged` + add config, or remove the pre-commit hook

### H6 — ESLint OOM risk in CI
- `npm run lint` = `eslint . --max-warnings 800` over 677 source files
- No `--cache` flag, no `NODE_OPTIONS=--max-old-space-size=...` heap increase
- `eslint-config-next@^16` vs `next@^14` major version mismatch adds overhead
- Observed heap exhaustion locally; same command runs in `ci-cd.yml` `lint-and-typecheck` job
- **Fix**: add `NODE_OPTIONS=--max-old-space-size=4096` to the lint script, or cache, or align eslint-config-next version

## Medium-priority findings (track for follow-up)

### M1 — KNOWN_ISSUES.md phantom path list is stale
- Lists 5 phantom paths; 4 were never in the spec, 1 (`PUT /api/rider/profile`) is fully implemented
- Actual current phantoms: `POST /api/admin/deposits`, `POST /api/admin/transactions`, `GET /api/support/chat` (C3 above)
- **Fix**: update KNOWN_ISSUES.md to reflect the real phantom list

### M2 — Duplicate topup schemas (divergent, not just case collision)
- `topUpSchema` (`validators.ts:113-121`): max ₹50,000, enum purpose, used by transaction/topup route
- `walletTopupSchema` (`validators.ts:454-458`): max ₹10,000, int amount, free-text purpose, used by wallet route
- These are **divergent** schemas for the same conceptual operation, not a case collision
- OpenAPI injection emits empty `{}` stubs for both due to `zod-to-json-schema@3.25.2` + `zod@4.1.8` incompatibility
- **Fix**: deduplicate or rename to clarify they serve different flows

### M3 — OpenAPI audit regex blind to `withApiHandler` pattern
- `audit-openapi.ts:82` regex: `export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)`
- 9 of 123 route files use `export const POST = withApiHandler(...)` exclusively
- 2 of 5 reported "phantoms" are false positives (admin/kyc POST, support/chat POST)
- **Fix**: update the audit regex to also match `export const (GET|POST|PUT|DELETE|PATCH) = withApiHandler`

### M4 — Server nonce store is per-process in-memory
- `fcm.ts:11` `_sentNonces` is a module-level `Map` with a 10-min sweeper
- Not shared across Next.js serverless instances or horizontally-scaled replicas
- Replay protection only works within a single process
- **Fix**: back with Redis or Postgres (tracked in `docs/REMEDIATION_PLAN.md:22`)

### M5 — Client replay set has no TTL cleanup
- `fcm_service.dart:22` `_seenSecurityChallenges` is a `Set<String>` cleared only on `dispose()`
- Grows unbounded over a long-lived session (low severity — security commands are rare)
- **Fix**: add a periodic cleanup or use an LRU cap

### M6 — No FCM HMAC tests on either side
- Server: no tests for `fcm.ts` `sendSecurityCommand`, envelope construction, or nonce dedup
- Client: `secure_storage_service_test.dart` only asserts write/read don't throw (accepts `read == null`)
- `docs/phased-improvement-plan.md:100` lists a missing `test/services/fcm_service_test.dart` as security-critical
- The 5min-vs-10min window mismatch and the 7-action allowlist mismatch would likely have been caught by such tests
- **Fix**: add HMAC signing + replay detection + stale command + valid/invalid action tests

### M7 — CODEOWNERS `/prisma/` is a dead path
- `D:\voltium\prisma` does not exist at repo root; Prisma lives at `web/prisma/`
- `@voltium-db` team is never auto-requested on schema changes
- **Fix**: change `/prisma/` to `/web/prisma/` in `.github/CODEOWNERS`

### M8 — Stale script: `test:onboarding`
- `web/package.json` script references `web/e2e/onboarding-flow.spec.ts` which does not exist
- Not run in CI, but the script is stale
- **Fix**: remove the script or restore the missing spec file

### M9 — `wait-on` is an undeclared dependency
- Used in 4 workflows via `npx wait-on`
- Works only because npx downloads it on the fly
- **Fix**: add `wait-on` to `web/package.json` devDependencies for reproducibility

### M10 — Dual ESLint config
- `web/eslint.config.mjs` (flat config, ESLint 9, active)
- `web/.eslintrc.json` (legacy, references uninstalled `unused-imports` plugin, dead)
- **Fix**: remove `.eslintrc.json`

## Low-priority / cosmetic

- L1: `id` format inconsistency — raw INSERT uses `gen_random_uuid()::text`, schema declares `@default(cuid())`
- L2: Redundant dual `writeFcmCommandSecret` call sites (otp_verification_screen + repository_impl) — both write same value idempotently
- L3: Migration timestamp ordering inverted relative to commit chronology (3.4 migration `…000000` runs before 3.3 migration `…000001`) — harmless, independent tables
- L4: `openapi.json` (generated, 107.5 KB) not in ESLint `ignores` — harmless (ESLint skips `.json` by default)
- L5: Generated `api_client.dart` header references `generate-client.ts` but the shell script uses `openapi-generator-cli` — doc inconsistency

## Surfaces verified clean

- ✅ **Worker registry**: all 9 imported job modules exist and export expected symbols; Phase 1.4 split correct; old `notifications.job.ts` is an intentional documented tombstone
- ✅ **FCM token registration**: validator accepts `{fcmToken}` only; `riderId` derived from session; body `riderId` silently stripped by Zod
- ✅ **Firebase config**: all 9 keys via `--dart-define`, `MissingFirebaseConfigException` on missing key, no hardcoded dummies
- ✅ **Token refresh cookie**: `/api/auth/refresh` re-sets `voltium-session` cookie at line 89
- ✅ **Enum alignment**: TransactionStatus, AppNotificationType, TicketMessageSender all match between Prisma and Flutter (with safe legacy fallbacks)
- ✅ **HMAC algorithm match**: server and client use identical SHA-256 over `${action}.${ts}.${nonce}.${challenge}` with constant-time compare
- ✅ **Outbox readyAt/updatedAt**: claim query and reaper both use the new columns correctly
- ✅ **Idempotency lib usage**: uppercase enum values match the Prisma enum (PROCESSING/COMPLETED/FAILED)
- ✅ **Migration deploy safety**: `prisma migrate deploy` succeeds on populated DB for all 5 migrations (the C1 drift is runtime, not deploy-time)
- ✅ **CODEOWNERS/Dependabot**: all 3 ecosystems covered (npm, pub, github-actions), weekly cadence
- ✅ **Flutter analyzer**: Phase 3 files covered by `analysis_options.yaml`, no excludes match
- ✅ **Package.json scripts**: all script implementation files exist except `test:onboarding` (M8)

## Recommended fix order

1. **C1** (IdempotencyKey.response NOT NULL) — new migration, blocks all idempotent claims at runtime
2. **C2** (FCM action allowlist) — expand client allowlist or document intentional exclusions
3. **C3** (GET /api/support/chat) — add handler or remove generated method
4. **H1** (FCM secret production guard) — add default to blocklist
5. **H5** (lint-staged) — install or remove pre-commit hook
6. **H6** (ESLint OOM) — add NODE_OPTIONS to lint script
7. **H2, H3, H4** — align replay windows, fix enum name, add reaper index
8. **M1-M10** — track for follow-up PRs

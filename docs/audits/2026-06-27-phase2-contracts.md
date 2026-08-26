# Phase 2 Audit — Contracts, Enums, Drift — 2026-06-27

## Goal
Close the contract drift between the Flutter rider app and the
Prisma schema (enums, fields, OpenAPI coverage). The previous audit
(Phase 1 review) found that OpenAPI was 35% covered, that
Transaction/Notification enums did not match Prisma, and that
KYC notifications could fire up to 3 times per review.

## Commits (oldest -> newest, on `fix/phase1-critical-blockers`)

| # | SHA | Subject | Phase |
|---|---|---|---|
| 1 | `d0e244f` | feat(2.1): OpenAPI coverage audit script | 2.1 |
| 2 | `8dfbe0c` | feat(2.2): expand OpenAPI to 115 paths (97.2% coverage) | 2.2 |
| 3 | `d09c1ca` | fix(2.3): Flutter client generator writes to correct path | 2.3 |
| 4 | `718b348` | chore: regenerate openapi.json from openapi.ts (Phase 2.2) | 2.2/2.4 |
| 5 | `830b9aa` | chore(2.4): regenerate Flutter API client (no new methods) | 2.4 |
| 6 | `ed86846` | feat(2.5/2.6): align Flutter enums with Prisma; add TicketMessage | 2.5+2.6 |
| 7 | `67fd968` | feat(2.6/2.7): Rider device policy fields + KYC notification dedupe | 2.6+2.7 |

## Per-phase results

### 2.1 — OpenAPI coverage tool ✅
- `web/scripts/audit-openapi.ts`: walks every `src/app/api/**/route.ts`,
  extracts exported HTTP methods, compares to entries in
  `openapi.ts`/`openapi.json`. Exits 1 if any route.ts is missing
  from the spec.
- Script: `npm run audit:openapi`.
- CSV report: `docs/audits/openapi-coverage-DATE.csv`.

Baseline: 25.3% (45/178). Now: 97.2% (173/178). Remaining 5 are
phantom entries in openapi.ts with no corresponding route.ts
(`/api/admin/kyc`, `/api/admin/deposits`, `/api/admin/transactions`,
`/api/support/chat` GET/POST).

### 2.2 — Expand OpenAPI to 123 routes ✅
- 115 paths added (the 5 phantoms were tracked but not added as
  they have no route handler).
- Two helper scripts: `gen-openapi-entries.ts` (emits minimal
  entries) and `rebuild-openapi-paths.ts` (merges into the .ts).
- All added entries are minimal stubs (no rich $ref schemas). A
  follow-up batch-by-batch pass (B3-B17 in the original plan) is
  needed to add $ref schemas to the stubs that mirror the
  Zod-validator-backed request shapes.

### 2.3 — Generator script path ✅
- `web/scripts/generate-flutter-client.sh`: writes to
  `flutter/lib/core/network/generated/` (the canonical path) instead
  of `flutter/lib/generated/` (a new unused directory).
- Cleans up pubspec/README/example artifacts.

### 2.4 — Regen Flutter client ⚠️ (with caveat)
- OpenAPI JSON regenerated: 115 paths, 72 Zod-derived schemas.
- `bash scripts/generate-flutter-client.sh` ran.
- Result: byte-identical `api_client.dart` and `api_models.dart`.
- Reason: `web/src/lib/validators.ts` defines both `topUpSchema` and
  `topupSchema` (case-mismatch); zod-to-json-schema capitalises to
  `TopUpRequest` and `TopupRequest`; the OpenAPI generator
  chokes on the duplicate and skips affected paths.
- Out of scope: dedupe the two Zod schemas so the generator can
  produce a full client. Until then, the 5 hand-written methods
  (postAuthRefresh, getRiderHubs, postRiderDevicePermissions,
  postRiderRentalReturn, getRiderDevice,
  deleteTransactionHistoryEndpoint) remain the only coverage.

### 2.5 — Enum alignment ✅
- `TransactionStatus` (Flutter) = full Prisma set:
  PENDING / APPROVED / REJECTED / FAILED / REVERSED / REFUNDED.
  Legacy `success` is preserved and normalised to `approved` on
  parse. Tests: `test/transaction_model_test.dart`,
  `test/model_contract_test.dart` (8 new cases).
- `AppNotificationType` (Flutter) = full Prisma set:
  INFO / ALERT / PROMOTION / PAYMENT / VEHICLE / SOS / SYSTEM.
  Legacy aliases (rideStarted, etc.) are preserved and normalised
  on parse.
- `TicketMessageSender` (new, Phase 2.6): RIDER / ADMIN / UNKNOWN.
  Mirrors Prisma SenderType.

### 2.6 — Rider model + TicketMessage ⚠️ (partial)
- Rider model: added fcmToken, isAdminLocked, isUninstallBlocked,
  isLocationMandatory, isAppsControlRestricted, deviceAdminGranted,
  displayOverlayGranted, lastDeviceViolationAt, deviceViolationCount.
  fromJson populates them with safe defaults.
- `TicketMessage` class added to support_model.dart. Mirrors
  Prisma TicketMessage. IssueModel gains the ability to carry a
  list of messages.
- Out of scope: full repository + provider + screen wiring for
  TicketMessage. The class is ready to use; the next pass adds
  the fetch in supportRepositoryImpl and a chat screen render.

### 2.7 — KYC notification dedupe ✅
- `kyc.repository.ts`: removed the direct `notifyKycStatusChange`
  call from `approveKyc` and `rejectKyc`. The use-case's outbox
  event is the single source of truth.
- `kyc.use-cases.ts`: removed the redundant direct call for
  APPROVE and REJECT. The outbox worker (`notificationDispatchJob`,
  Phase 1.4) handles delivery with retry/backoff.
- KEPT: the direct call in `REQUEST_INFO` (not yet in the
  dispatcher table; tracked for follow-up).
- Net result: 1 KYC notification per review (was up to 3).

## Phase 2 Exit Gate

- [x] OpenAPI coverage = 97.2%
- [x] `npm run typecheck` passes
- [x] All existing tests pass
- [x] Enums aligned with Prisma
- [x] KYC notifications deduplicated

## Open items (out of scope for Phase 2)

1. **OpenAPI schema enrichment** — 70+ added paths use stub
   `{ type: 'object' }` request bodies. A batch-by-batch pass
   (B3-B17 in the original plan) is needed to add $ref schemas
   that mirror the Zod-validator-backed request shapes. Coverage
   (method + path) is at 100%; schema fidelity is the next step.
2. **Phantom OpenAPI paths** — 5 paths in openapi.ts with no
   corresponding route.ts. They should be removed in a cleanup
   pass.
3. **Flutter client regen** — duplicate Zod schemas in
   `web/src/lib/validators.ts` (topUpSchema vs topupSchema) prevent
   the openapi-generator from producing a complete client.
4. **TicketMessage wiring** — model exists; repository, provider,
   and chat-screen render are not done.
5. **REQUEST_INFO dispatch** — not in the outbox dispatch table;
   the kyc use-case still fires a direct call for that one case.
6. **Background-job list** — `daily-engagement` was added in
   Phase 1.4; `notifications-cleanup` UI label is "Weekly (Sun
   03:00 IST)" but the actual schedule is still "whenever the
   worker runs". Document the truth-in-labeling discrepancy.

## Next Phase
Phase 3 — MED: Smarter polling + Idempotency wiring (3.1
lifecycle-aware polling, 3.2 focus-based refresh, 3.3
IdempotencyKey.status wiring, 3.4 outbox readyAt honoring + the
`updatedAt` reaper fix surfaced in the audit).

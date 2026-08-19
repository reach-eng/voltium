# H6 DB Migration — Rupees, Two-Table Split

**Decision date**: 2026-08-13
**Decision**: Full split into `DepositTransaction` and `TopUpTransaction`
tables (user picked option 2 over minimum-viable rename).
**Effort**: ~2-3 days across 3 PRs.

## Why a two-table split

The `Transaction` table currently uses a `purpose` discriminator
(`TOP_UP`, `SECURITY_DEPOSIT`, `RENTAL_CHARGE`, `REFUND`). This is fine
for a small system, but the deposit and top-up flows have very different
lifecycle, validation, and audit requirements:

- **Deposit** is a refundable security hold. Its lifecycle is: PENDING →
  HELD → REFUNDED (or FORFEITED on damage). The amount is fixed by policy
  (e.g. ₹1,000). The "riders who have an outstanding deposit" query is
  hot — it's the gate for the active rental flow.
- **Top-up** is a wallet credit. Its lifecycle is: PENDING → APPROVED →
  CREDITED (or REJECTED). The amount is user-chosen. Reconciliation with
  UPI/bank is the hot query.

Splitting them:
- Makes the lifecycle invariants expressible as DB-level constraints
  (check constraints on status per table).
- Lets deposit and top-up scale independently (different index strategies,
  different retention, different PII fields).
- Simplifies admin queries (no `WHERE purpose = 'SECURITY_DEPOSIT'` everywhere).
- Adds a small cost: the shared `Transaction` model in the app code needs
  to become two narrow models. The repo layer abstracts this.

## Plan: 3 PRs

### PR 1 — Schema + dual-write (1 day)

**Branch**: `db/h6-deposit-topup-split-schema`

1. Add two new models to `prisma/schema.prisma`:
   ```prisma
   model DepositTransaction {
     id              String   @id @default(cuid())
     riderId         String
     amountInRupees  Decimal  @db.Decimal(10, 2)
     status          DepositStatus  // PENDING, HELD, REFUNDED, FORFEITED
     upiRef          String?
     proofUrl        String?
     approvedBy      String?
     approvedAt      DateTime?
     createdAt       DateTime @default(now())
     updatedAt       DateTime @updatedAt
     rider           Rider    @relation(fields: [riderId], references: [id], onDelete: Cascade)
     @@index([riderId, status])
     @@index([status, createdAt])
   }

   model TopUpTransaction {
     id              String   @id @default(cuid())
     riderId         String
     amountInRupees  Decimal  @db.Decimal(10, 2)
     status          TopUpStatus  // PENDING, APPROVED, REJECTED, CREDITED
     method          String   // UPI, BANK, etc.
     upiRef          String?
     proofUrl        String?
     approvedBy      String?
     approvedAt      DateTime?
     createdAt       DateTime @default(now())
     updatedAt       DateTime @updatedAt
     rider           Rider    @relation(fields: [riderId], references: [id], onDelete: Cascade)
     @@index([riderId, createdAt])
     @@index([status, createdAt])
   }
   ```
2. Create the `DepositStatus` and `TopUpStatus` enums.
3. Migration: create both tables; **do not** drop `Transaction` yet.
4. Server: keep writing to `Transaction` AND write to the new table on
   deposit/top-up creation. This is the dual-write window.
5. Add a `verifyDualWrite` test that asserts both tables have the new row
   after a deposit or top-up is created.

**Risk**: 2x write cost on the hot path. Mitigation: this is a temporary
state (PR 3 removes it). For the dev/staging traffic levels we have now,
the extra row is irrelevant.

### PR 2 — Migrate reads to new tables (1 day)

**Branch**: `db/h6-deposit-topup-split-reads`

1. Server: replace every read of `Transaction` (filtered by purpose) with
   a read of the appropriate new table. Specifically:
   - All `riderWallet` / deposit queries → `DepositTransaction`
   - All top-up / wallet-balance queries → `TopUpTransaction`
   - `getTransactionHistory` (Flutter) → UNION of both, with a
     `purpose` column for ordering
2. Keep writing to BOTH tables (so dev/staging tests still cover the old
   code path through the legacy routes).
3. Update API serializers:
   - `DepositTransactionResponse` — narrow DTO
   - `TopUpTransactionResponse` — narrow DTO
   - The legacy `TransactionResponse` is kept but only for admin tools
     that haven't migrated yet
4. Update server tests: every test that reads/writes `Transaction` with
   `purpose = SECURITY_DEPOSIT` or `TOP_UP` should now use the new tables.
5. Add a contract test that asserts the new tables' shape matches what
   Flutter expects (since this is the integration boundary).

**Risk**: API shape changes. Flutter's `TransactionEntity.fromJson` is
already defensive (it accepts `amountInRupees`, `amount`, or `amountInPaise / 100`),
so existing Flutter code should keep working. The shape of the JSON
itself doesn't change (still `{id, amountInRupees, purpose, status, createdAt}`).

### PR 3 — Cut over, drop legacy table (0.5 day)

**Branch**: `db/h6-deposit-topup-split-cutover`

1. Server: stop writing to the legacy `Transaction` table. Only write to
   the new tables.
2. Backfill: one final SQL to copy any rows from `Transaction` (with
   `purpose` in (SECURITY_DEPOSIT, TOP_UP)) into the new tables. This
   is the safety net for any rows missed by the dual-write window.
3. Drop the `Transaction` table (or rename to `_Transaction_deprecated`
   for one more week, then drop).
4. Drop the `purpose` enum values that are no longer used
   (`RENTAL_CHARGE`, `REFUND` — these move to a separate `LedgerEntry`
   model later, or stay in `Transaction` if used by other flows).
5. Update Prisma schema, regenerate client.
6. Update Flutter `getTransactionHistory` to handle the new server
   response shape (it should already, but verify with a device walk-through).

**Risk**: small if PRs 1 and 2 were solid. The backfill is a safety net.

## What I'm NOT doing in this plan

- **Not migrating to rupees column-wise yet.** PR-RUPEES-2026-08-08 already
  has the API in rupees, the app in rupees, and the DB in paise (via
  `amountInPaise` integer). The split is orthogonal to "use Decimal rupees
  in the DB" — that's a follow-up. Keeping them separate means smaller,
  easier-to-review PRs.
- **Not changing the Flutter `TransactionEntity` shape.** It stays
  `{id, amountInRupees, type, purpose, status, createdAt}`. The `purpose`
  field stays so the UI can still distinguish deposits from top-ups in
  history views.
- **Not splitting the `LedgerEntry` flows (RENTAL_CHARGE, REFUND).** Those
  are out of scope; they can be a follow-up ticket if deposit/top-up split
  proves the pattern.

## Acceptance criteria

- [ ] Both new tables exist, are indexed, and have check constraints
- [ ] Dual-write verified in dev and staging
- [ ] All reads migrated to new tables
- [ ] Legacy `Transaction` table dropped (or marked deprecated)
- [ ] Web test suite green (existing 2932 tests + new migration tests)
- [ ] Flutter test suite green (existing 1411 tests)
- [ ] `prisma migrate` runs cleanly on a fresh DB
- [ ] Admin can still see a unified transaction history (UNION query works)
- [ ] Device walk-through: rider can submit a deposit and see it in
      history with the correct status and amount

## Open questions for you

1. **Should the `purpose` field stay in the Flutter entity?** It is needed
   for the history view's icon/badge ("this is a deposit" vs "this is a
   top-up"). Recommend: yes, keep it. But confirm.
2. **Admin tools.** Are there any admin-side reports or admin tool screens
   that read the legacy `Transaction` table directly via SQL? If so, those
   need updating in this PR. Recommend: search for raw SQL hits in
   `web/src/app/api/admin/` and `web/src/server/modules/admin/` before
   starting PR 1.
3. **Retention.** Deposits stay forever (audit). Top-ups might be
   archived after 1 year. Want to do that in this plan, or punt to a
   follow-up? Recommend: punt (separate concern).

## Estimated timeline

- PR 1: 1 day (schema + dual-write + verify)
- PR 2: 1 day (read migration + Flutter contract test)
- PR 3: 0.5 day (cutover + backfill + drop legacy)
- **Total**: 2.5 working days, ~3 calendar days with review.

## What I need from you to start

- [ ] Confirm the open questions above
- [ ] Confirm you want to ship all 3 PRs in sequence (vs. a longer
      dual-write window, or a single big-bang PR)
- [ ] Confirm I should not touch `LedgerEntry`/`RENTAL_CHARGE`/`REFUND` in
      this plan
- [ ] Any admin-side SQL reports I might have missed

I'll then start PR 1 (`db/h6-deposit-topup-split-schema`) and report back
when the dual-write is verified.

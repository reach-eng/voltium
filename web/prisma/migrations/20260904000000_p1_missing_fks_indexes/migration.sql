-- P1 fix 2026-09-04: missing FKs + missing hot-path indexes.
--
-- FKs (each preceded by a data repair so dirty rows can't block deploy;
-- repairs NULL dangling links and NOTICE the counts for audit):
--   1. riders.referredBy → riders.referralCode (SetNull)
--   2. transactions.reversedTxnId → transactions.id, self (SetNull)
--   3. support_tickets.assignedToId → admins.id (SetNull; backfilled from
--      legacy assignedTo where it matches a live admin id)
--   4. sync_queues.riderId → riders.id (Cascade; orphans deleted — an
--      unsynced queue for a purged rider is meaningless)
-- Indexes (IF NOT EXISTS, transactional — no CONCURRENTLY inside migrate):
--   riders(lifecycleStatus), riders(deletedAt), riders(email),
--   vehicles(deletedAt), shifts(deletedAt), rental_plans(deletedAt),
--   guarantors(deletedAt), support_tickets(deletedAt),
--   transactions(reversedTxnId), transaction_breakdowns(transactionId),
--   support_tickets(assignedToId), rewards(riderId),
--   offers(isActive, validUntil), coupons(isActive, validUntil),
--   user_contacts(riderId, name)

-- ── 0. New nullable columns (FK holders + audit timestamps) ──────
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
-- P1 @updatedAt coverage (all nullable → no backfill needed; Prisma fills
-- them on the next row update).
ALTER TABLE "consents" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "rewards" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "sync_queues" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "transaction_breakdowns" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "notification_deliveries" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "user_contacts" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "user_call_logs" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "user_locations" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "announcement_deliveries" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;
ALTER TABLE "idempotency_keys" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;

-- ── 1. Repair: riders.referredBy must reference a live referralCode ──
DO $$ DECLARE _n INTEGER; BEGIN
  UPDATE "riders" SET "referredBy" = NULL
   WHERE "referredBy" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "riders" r2 WHERE r2."referralCode" = "riders"."referredBy");
  GET DIAGNOSTICS _n = ROW_COUNT;
  RAISE NOTICE 'P1 repair: nulled % dangling riders.referredBy', _n;
END $$;

-- ── 2. Repair: transactions.reversedTxnId must reference a live id ──
DO $$ DECLARE _n INTEGER; BEGIN
  UPDATE "transactions" SET "reversedTxnId" = NULL
   WHERE "reversedTxnId" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "transactions" t2 WHERE t2."id" = "transactions"."reversedTxnId");
  GET DIAGNOSTICS _n = ROW_COUNT;
  RAISE NOTICE 'P1 repair: nulled % dangling transactions.reversedTxnId', _n;
END $$;

-- ── 3a. Backfill assignedToId from legacy assignedTo (admin ids only) ──
UPDATE "support_tickets" st SET "assignedToId" = st."assignedTo"
 WHERE st."assignedTo" IS NOT NULL
   AND st."assignedToId" IS NULL
   AND EXISTS (SELECT 1 FROM "admins" a WHERE a."id" = st."assignedTo");

-- ── 3b. Repair: assignedToId must reference a live admin ──
DO $$ DECLARE _n INTEGER; BEGIN
  UPDATE "support_tickets" SET "assignedToId" = NULL
   WHERE "assignedToId" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "admins" a WHERE a."id" = "support_tickets"."assignedToId");
  GET DIAGNOSTICS _n = ROW_COUNT;
  RAISE NOTICE 'P1 repair: nulled % dangling support_tickets.assignedToId', _n;
END $$;

-- ── 4. Repair: drop orphan sync_queues rows ──
DO $$ DECLARE _n INTEGER; BEGIN
  DELETE FROM "sync_queues" sq
   WHERE NOT EXISTS (SELECT 1 FROM "riders" r WHERE r."id" = sq."riderId");
  GET DIAGNOSTICS _n = ROW_COUNT;
  RAISE NOTICE 'P1 repair: deleted % orphan sync_queues rows', _n;
END $$;

-- ── 5. FK constraints (guarded, idempotent) ────────────────────────
-- P1 vehicle-history protection: leases/tickets/returns referencing a
-- vehicle block raw-SQL hard deletes (Restrict). App code soft-deletes
-- vehicles (db.ts extension), which never fires FK actions — no behavior
-- change for the app, hard-stop for footguns. Any pre-existing FK on those
-- columns is dropped first REGARDLESS of its name ( Prisma / db-push naming
-- can differ), then the Restrict version is added.
DO $$ DECLARE _c TEXT; BEGIN
  FOR _c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'rental_leases'::regclass AND contype = 'f'
      AND conname LIKE '%vehicleId%fkey' LOOP
    EXECUTE format('ALTER TABLE "rental_leases" DROP CONSTRAINT %I', _c);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rental_leases_vehicleId_fkey') THEN
    ALTER TABLE "rental_leases" ADD CONSTRAINT "rental_leases_vehicleId_fkey"
      FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  FOR _c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'support_tickets'::regclass AND contype = 'f'
      AND conname LIKE '%vehicleId%fkey' AND conname <> 'support_tickets_vehicleId_fkey' LOOP
    EXECUTE format('ALTER TABLE "support_tickets" DROP CONSTRAINT %I', _c);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_vehicleId_fkey') THEN
    ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_vehicleId_fkey"
      FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  FOR _c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'vehicle_returns'::regclass AND contype = 'f'
      AND conname LIKE '%vehicleId%fkey' AND conname <> 'vehicle_returns_vehicleId_fkey' LOOP
    EXECUTE format('ALTER TABLE "vehicle_returns" DROP CONSTRAINT %I', _c);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_returns_vehicleId_fkey') THEN
    ALTER TABLE "vehicle_returns" ADD CONSTRAINT "vehicle_returns_vehicleId_fkey"
      FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'riders_referredBy_fkey') THEN
    ALTER TABLE "riders" ADD CONSTRAINT "riders_referredBy_fkey"
      FOREIGN KEY ("referredBy") REFERENCES "riders"("referralCode") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_reversedTxnId_fkey') THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reversedTxnId_fkey"
      FOREIGN KEY ("reversedTxnId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_assignedToId_fkey') THEN
    ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sync_queues_riderId_fkey') THEN
    ALTER TABLE "sync_queues" ADD CONSTRAINT "sync_queues_riderId_fkey"
      FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 6. Indexes (guarded, idempotent, transactional) ────────────────
CREATE INDEX IF NOT EXISTS "riders_lifecycleStatus_idx" ON "riders"("lifecycleStatus");
CREATE INDEX IF NOT EXISTS "riders_deletedAt_idx" ON "riders"("deletedAt");
CREATE INDEX IF NOT EXISTS "riders_email_idx" ON "riders"("email");
CREATE INDEX IF NOT EXISTS "vehicles_deletedAt_idx" ON "vehicles"("deletedAt");
CREATE INDEX IF NOT EXISTS "shifts_deletedAt_idx" ON "shifts"("deletedAt");
CREATE INDEX IF NOT EXISTS "rental_plans_deletedAt_idx" ON "rental_plans"("deletedAt");
CREATE INDEX IF NOT EXISTS "guarantors_deletedAt_idx" ON "guarantors"("deletedAt");
CREATE INDEX IF NOT EXISTS "support_tickets_deletedAt_idx" ON "support_tickets"("deletedAt");
CREATE INDEX IF NOT EXISTS "transactions_reversedTxnId_idx" ON "transactions"("reversedTxnId");
CREATE INDEX IF NOT EXISTS "transaction_breakdowns_transactionId_idx" ON "transaction_breakdowns"("transactionId");
CREATE INDEX IF NOT EXISTS "support_tickets_assignedToId_idx" ON "support_tickets"("assignedToId");
CREATE INDEX IF NOT EXISTS "rewards_riderId_idx" ON "rewards"("riderId");
CREATE INDEX IF NOT EXISTS "offers_isActive_validUntil_idx" ON "offers"("isActive", "validUntil");
CREATE INDEX IF NOT EXISTS "coupons_isActive_validUntil_idx" ON "coupons"("isActive", "validUntil");
CREATE INDEX IF NOT EXISTS "user_contacts_riderId_name_idx" ON "user_contacts"("riderId", "name");

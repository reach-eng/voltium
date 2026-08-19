-- =============================================================================
-- 2026-08-05 ops audit (discovery) — audit trail persistence fix
-- =============================================================================
-- Why this exists:
--   AuditLog.action was an `AuditActionType` enum column, but the code writes
--   90+ distinct dot-string actions (transaction.approve, wallet.approve_topup,
--   tl.create, notification.send_all, MAINTENANCE_ENABLED, ...) that were never
--   enum members. Every one of those writes failed Prisma validation at runtime
--   and was silently dropped (the `[AUDIT_FAILED]` lines in the test logs are
--   real evidence). Only ~8 of 17 enum members were ever written, so the audit
--   trail was almost entirely non-functional for SOC2.
--
--   The audit recommended either widening the enum (~15 domain actions) or
--   migrating the column to TEXT. TEXT is the robust choice: the action set is
--   unbounded (any module can introduce domain actions), and retention already
--   buckets by `action.split('.')[0]`, which works for both plain members and
--   dot-strings.
--
-- Steps:
--   1. Convert the column to TEXT (PG can cast enum -> text implicitly).
--   2. Drop the now-unused enum type.
-- =============================================================================

ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE TEXT;

DROP TYPE IF EXISTS "AuditActionType";

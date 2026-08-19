-- =============================================================================
-- P3-10 (2026-08-05 financial audit) — audit security-event persistence
-- =============================================================================
-- Why this exists:
--   logSecurityEvent() (src/lib/security-events.ts) wrote `action: "security.<type>"`
--   (e.g. "security.reconciliation.mismatch") into the AuditActionType enum
--   column. Those dot-strings are not members of the enum, so every Prisma
--   write failed validation at runtime and was dropped after a logger.error —
--   drift alerts, account suspensions, and balance-change events were never
--   persisted to the audit table (SOC2 gap). The action now uses the generic
--   SECURITY_EVENT member; the specific event kind is stored in
--   details.eventType.
--
-- ADD VALUE is safe: PG >= 12 allows adding enum values transactionally and
-- existing rows are unaffected.
-- =============================================================================

ALTER TYPE "AuditActionType" ADD VALUE 'SECURITY_EVENT';

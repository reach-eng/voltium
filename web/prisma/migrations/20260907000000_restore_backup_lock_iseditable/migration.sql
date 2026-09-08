-- P0-5 production repair (2026-09-07): restore isEditable = false on the
-- three BACKUP_LOCK_* rows.
--
-- Background: settingUseCases.update() (web/src/server/modules/settings/
-- setting.use-cases.ts) used to hardcode `isSecret: false, isEditable: true`
-- on every upsert. system_settings is a SHARED table — the admin
-- business-settings surface and the backup-lock service both write to it —
-- so if any pre-P0-5 write ever touched a BACKUP_LOCK_* row, that row was
-- permanently flipped to editable/non-secret. Consequence: PUT
-- /api/admin/system-settings (which refuses !isEditable rows) would have
-- accepted writes to the backup lock — the very rows the seed marks
-- read-only (prisma/seed.ts:1093-1095) and that backup-lock.service.ts
-- owns exclusively.
--
-- This migration is idempotent: it only re-freezes rows that exist. If
-- production never hit the bug, it is a no-op (0 rows updated). Values are
-- deliberately NOT touched — the repair is metadata-only, so a lock state
-- mid-operation (e.g. RUNNING) is preserved exactly.
--
-- The P0-5 code fix (update no longer writes isSecret/isEditable; create
-- takes them from registry meta) prevents a recurrence.

UPDATE "system_settings"
SET "isEditable" = false
WHERE "key" IN ('BACKUP_LOCK_STATUS', 'BACKUP_LOCK_STARTED_AT', 'BACKUP_LOCK_OWNER')
  AND "isEditable" <> false;

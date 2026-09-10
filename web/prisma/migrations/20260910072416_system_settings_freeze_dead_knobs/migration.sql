-- 2026-09-08 system-settings section audit — P0-1: freeze the 10 dead
-- editable knobs. Operators were making retention / URL decisions against
-- rows that have **zero runtime readers** in `src/` (verified by search;
-- the only mention is the route file's own doc comment). Scheduling,
-- retention, the low-disk guard, and the public/API URLs all resolve
-- elsewhere (`BackupSchedule` table, `NEXT_PUBLIC_API_BASE_URL` env, etc.),
-- so editing these rows here changes nothing while convincing the operator
-- it did. Freezing them is a no-op behavior change with a meaningful trust
-- fix: the row's value is preserved (operators may have set intent here
-- even though the runtime ignores it), but the Save button is gone and the
-- description now says where the knob actually lives.

UPDATE "system_settings"
SET    "isEditable" = false,
       "description" =
         'Superseded by Data Management → Schedule tab (BackupSchedule table). ' ||
         'This row is preserved for reference only; runtime does not read it.'
WHERE  "key" IN (
         'BACKUP_FREQUENCY',
         'BACKUP_TIME_OF_DAY',
         'BACKUP_TIMEZONE',
         'BACKUP_KEEP_DAILY',
         'BACKUP_KEEP_WEEKLY',
         'BACKUP_KEEP_MONTHLY',
         'BACKUP_KEEP_MANUAL',
         'BACKUP_MINIMUM_FREE_DISK_GB'
       );

UPDATE "system_settings"
SET    "isEditable" = false,
       "description" =
         'Set via NEXT_PUBLIC_API_BASE_URL environment variable. This row is ' ||
         'preserved for reference only; runtime does not read it.'
WHERE  "key" = 'API_BASE_URL';

UPDATE "system_settings"
SET    "isEditable" = false,
       "description" =
         'Informational only — runtime uses the same base as NEXT_PUBLIC_API_BASE_URL. ' ||
         'This row is preserved for reference.'
WHERE  "key" = 'APP_PUBLIC_URL';

-- Consolidate Setting model into SystemSetting model
-- Migrate all data from `settings` table to `system_settings` table,
-- then drop the `settings` table.

-- Step 1: Copy settings data to system_settings with sensible defaults
INSERT INTO system_settings (id, key, value, "valueType", category, "isSecret", "isEditable", "description", "updatedByAdminId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  s.key,
  s.value,
  CASE
    WHEN s.key IN ('walletMinTopup', 'lateFee', 'referralBonus', 'dailyRent', 'weeklyRent', 'monthlyRent', 'securityDeposit', 'gracePeriodHours', 'gpsFetchIntervalMins', 'maxRentalDays', 'penaltyCapDays', 'maxWalletBalance', 'loyaltyPointsPerRupee', 'BACKUP_KEEP_DAILY', 'BACKUP_KEEP_WEEKLY', 'BACKUP_KEEP_MONTHLY', 'BACKUP_KEEP_MANUAL', 'BACKUP_MINIMUM_FREE_DISK_GB') THEN 'NUMBER'
    WHEN s.key IN ('autoApproveKYC', 'emailNotifications', 'smsNotifications', 'maintenanceMode', 'backupLock') OR s.key LIKE 'flag.%' THEN 'BOOLEAN'
    ELSE 'STRING'
  END,
  CASE
    WHEN s.key IN ('walletMinTopup', 'lateFee', 'referralBonus', 'dailyRent', 'weeklyRent', 'monthlyRent', 'securityDeposit', 'autoApproveKYC', 'gracePeriodHours', 'gpsFetchIntervalMins', 'maxRentalDays', 'penaltyCapDays', 'maxWalletBalance', 'loyaltyPointsPerRupee', 'emailNotifications', 'smsNotifications', 'supportEmail', 'supportPhone') THEN 'BUSINESS'
    WHEN s.key = 'maintenanceMode' THEN 'SERVER'
    WHEN s.key LIKE 'flag.%' THEN 'FEATURE'
    WHEN s.key LIKE 'BACKUP_%' OR s.key LIKE 'job:%' OR s.key = 'backupLock' OR s.key = 'LAST_BACKUP_FAILURE' THEN 'INTERNAL'
    ELSE 'GENERAL'
  END,
  false,
  CASE
    WHEN s.key LIKE 'BACKUP_%' OR s.key LIKE 'job:%' OR s.key = 'backupLock' OR s.key = 'LAST_BACKUP_FAILURE' THEN false
    ELSE true
  END,
  NULL,
  s."updatedAt",
  s."updatedAt"
FROM settings s
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings ss WHERE ss.key = s.key
);

-- Step 2: Drop the old settings table
DROP TABLE IF EXISTS settings;

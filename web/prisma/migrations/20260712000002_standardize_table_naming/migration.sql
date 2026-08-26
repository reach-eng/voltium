-- Standardize Prisma table naming: add @@map to all models
-- Renames tables from Prisma-default (model name) to explicit snake_case.

-- Models that ALREADY had @@map (table already snake_case, no rename needed):
--   rental_plans, offers, coupons, rewards, system_settings,
--   legal_documents, faqs, team_leaders
-- Models that DID NOT have @@map before and need renaming:

ALTER TABLE IF EXISTS "Admin"               RENAME TO "admins";
ALTER TABLE IF EXISTS "AdminSession"        RENAME TO "admin_sessions";
ALTER TABLE IF EXISTS "RolePermission"      RENAME TO "role_permissions";
ALTER TABLE IF EXISTS "Hub"                 RENAME TO "hubs";
ALTER TABLE IF EXISTS "Vehicle"             RENAME TO "vehicles";
ALTER TABLE IF EXISTS "Shift"               RENAME TO "shifts";
ALTER TABLE IF EXISTS "Rider"               RENAME TO "riders";
ALTER TABLE IF EXISTS "VehicleReturn"       RENAME TO "vehicle_returns";
ALTER TABLE IF EXISTS "KycProfile"          RENAME TO "kyc_profiles";
ALTER TABLE IF EXISTS "Guarantor"           RENAME TO "guarantors";
ALTER TABLE IF EXISTS "Wallet"              RENAME TO "wallets";
ALTER TABLE IF EXISTS "WalletLedger"        RENAME TO "wallet_ledgers";
ALTER TABLE IF EXISTS "DepositRecord"       RENAME TO "deposit_records";
ALTER TABLE IF EXISTS "RentalLease"         RENAME TO "rental_leases";
ALTER TABLE IF EXISTS "Transaction"         RENAME TO "transactions";
ALTER TABLE IF EXISTS "TransactionBreakdown" RENAME TO "transaction_breakdowns";
ALTER TABLE IF EXISTS "SupportTicket"       RENAME TO "support_tickets";
ALTER TABLE IF EXISTS "TicketMessage"       RENAME TO "ticket_messages";
ALTER TABLE IF EXISTS "Notification"        RENAME TO "notifications";
ALTER TABLE IF EXISTS "NotificationDelivery" RENAME TO "notification_deliveries";
ALTER TABLE IF EXISTS "AuditLog"            RENAME TO "audit_logs";
ALTER TABLE IF EXISTS "SyncQueue"           RENAME TO "sync_queues";
ALTER TABLE IF EXISTS "FileRecord"          RENAME TO "file_records";
ALTER TABLE IF EXISTS "BackupSchedule"      RENAME TO "backup_schedules";
ALTER TABLE IF EXISTS "BackupJob"           RENAME TO "backup_jobs";
ALTER TABLE IF EXISTS "RestoreJob"          RENAME TO "restore_jobs";
ALTER TABLE IF EXISTS "Announcement"        RENAME TO "announcements";
ALTER TABLE IF EXISTS "AnnouncementDelivery" RENAME TO "announcement_deliveries";
ALTER TABLE IF EXISTS "Incident"            RENAME TO "incidents";
ALTER TABLE IF EXISTS "RiderEarning"        RENAME TO "rider_earnings";
ALTER TABLE IF EXISTS "RiderScore"          RENAME TO "rider_scores";
ALTER TABLE IF EXISTS "TrafficFine"         RENAME TO "traffic_fines";
ALTER TABLE IF EXISTS "DeviceViolation"     RENAME TO "device_violations";
ALTER TABLE IF EXISTS "UserContact"         RENAME TO "user_contacts";
ALTER TABLE IF EXISTS "UserCallLog"         RENAME TO "user_call_logs";
ALTER TABLE IF EXISTS "UserLocation"        RENAME TO "user_locations";
ALTER TABLE IF EXISTS "OtpCode"             RENAME TO "otp_codes";
ALTER TABLE IF EXISTS "RateLimitBucket"     RENAME TO "rate_limit_buckets";
ALTER TABLE IF EXISTS "OutboxEvent"         RENAME TO "outbox_events";
ALTER TABLE IF EXISTS "ReconciliationReport" RENAME TO "reconciliation_reports";
ALTER TABLE IF EXISTS "IdempotencyKey"      RENAME TO "idempotency_keys";

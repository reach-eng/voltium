/**
 * Job type definitions for Voltium background workers.
 *
 * Jobs are stored in the OutboxEvent table (PostgreSQL) — no Redis dependency.
 * Workers poll the database directly.
 */

export const JOB_TYPES = {
  // Reconciliation
  WALLET_RECONCILIATION: 'wallet_reconciliation',
  BACKFILL_OPENING_BALANCES: 'backfill_opening_balances',

  // Notifications
  BIRTHDAY_WISHES: 'birthday_wishes',
  PAYMENT_REMINDERS: 'payment_reminders',
  REFERRAL_LEADERBOARD: 'referral_leaderboard',
  ANNOUNCEMENT_DISPATCH: 'announcement_dispatch',

  // Rent
  RENT_DUE_CHECK: 'rent_due_check',
  RENT_AUTO_DEBIT: 'rent_auto_debit',
  OVERDUE_ESCALATION: 'overdue_escalation',

  // Compliance
  DEVICE_VIOLATION_SCAN: 'device_violation_scan',
  DEVICE_COMPLIANCE_REPORT: 'device_compliance_report',

  // Referrals
  REFERRAL_REWARD_PROCESS: 'referral_reward_process',

  // SMS
  SEND_SMS: 'send_sms',
  SEND_OTP: 'send_otp',

  // Cleanup
  AUDIT_LOG_CLEANUP: 'audit_log_cleanup',
  TELEMETRY_DATA_CLEANUP: 'telemetry_data_cleanup',
  EXPIRED_SESSION_CLEANUP: 'expired_session_cleanup',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

// Note: Queue-level configs and routing functions have been removed.
// Workers now read directly from the OutboxEvent table via JobQueue.processJobs().
// Each worker defines its polling concurrency inline in workers/index.ts.

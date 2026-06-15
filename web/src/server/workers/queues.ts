/**
 * Queue definitions for Voltium background workers.
 *
 * Defines job types, queue names, retry policies, and schedule intervals
 * for every background job in the system.
 */

export const QUEUE_NAMES = {
  RECONCILIATION: 'voltium:reconciliation',
  NOTIFICATIONS: 'voltium:notifications',
  RENT_REMINDERS: 'voltium:rent-reminders',
  DEVICE_COMPLIANCE: 'voltium:device-compliance',
  REFERRAL_REWARDS: 'voltium:referral-rewards',
  SMS_DISPATCH: 'voltium:sms-dispatch',
  AUDIT_CLEANUP: 'voltium:audit-cleanup',
  TELEMETRY_CLEANUP: 'voltium:telemetry-cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

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

export interface QueueConfig {
  queueName: QueueName;
  description: string;
  concurrency: number;
  maxRetries: number;
  retryDelayMs: number; // base delay, multiplied by attempt number
  schedule?: string; // cron expression
  ttlSeconds: number;
}

export const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  reconciliation: {
    queueName: QUEUE_NAMES.RECONCILIATION,
    description: 'Daily wallet reconciliation — compares ledger sums to wallet balances',
    concurrency: 1,
    maxRetries: 2,
    retryDelayMs: 60_000,
    schedule: '0 2 * * *', // daily at 2 AM
    ttlSeconds: 86_400,
  },
  notifications: {
    queueName: QUEUE_NAMES.NOTIFICATIONS,
    description: 'Daily notification tasks — birthday wishes, payment reminders, leaderboard',
    concurrency: 3,
    maxRetries: 3,
    retryDelayMs: 30_000,
    schedule: '0 8 * * *', // daily at 8 AM
    ttlSeconds: 43_200,
  },
  rentReminders: {
    queueName: QUEUE_NAMES.RENT_REMINDERS,
    description: 'Rent due/overdue detection and auto-debit attempts',
    concurrency: 2,
    maxRetries: 3,
    retryDelayMs: 60_000,
    schedule: '0 6 * * *', // daily at 6 AM
    ttlSeconds: 86_400,
  },
  deviceCompliance: {
    queueName: QUEUE_NAMES.DEVICE_COMPLIANCE,
    description: 'Hourly device compliance scan — checks permission violations',
    concurrency: 2,
    maxRetries: 2,
    retryDelayMs: 30_000,
    schedule: '0 * * * *', // every hour
    ttlSeconds: 3_600,
  },
  referralRewards: {
    queueName: QUEUE_NAMES.REFERRAL_REWARDS,
    description: 'Process referral rewards when new rider signs up with a code',
    concurrency: 3,
    maxRetries: 3,
    retryDelayMs: 10_000,
    schedule: undefined, // on-demand, triggered by event
    ttlSeconds: 86_400,
  },
  smsDispatch: {
    queueName: QUEUE_NAMES.SMS_DISPATCH,
    description: 'SMS dispatch — send OTPs and notifications via provider',
    concurrency: 5,
    maxRetries: 3,
    retryDelayMs: 5_000,
    schedule: undefined, // on-demand
    ttlSeconds: 3_600,
  },
  auditCleanup: {
    queueName: QUEUE_NAMES.AUDIT_CLEANUP,
    description: 'Weekly cleanup of expired audit log entries',
    concurrency: 1,
    maxRetries: 1,
    retryDelayMs: 60_000,
    schedule: '0 3 * * 0', // weekly on Sunday at 3 AM
    ttlSeconds: 86_400,
  },
  telemetryCleanup: {
    queueName: QUEUE_NAMES.TELEMETRY_CLEANUP,
    description: 'Monthly cleanup of old telemetry data (locations, call logs, contacts)',
    concurrency: 1,
    maxRetries: 1,
    retryDelayMs: 60_000,
    schedule: '0 4 1 * *', // monthly on the 1st at 4 AM
    ttlSeconds: 86_400,
  },
} as const;

/**
 * Returns what queue should handle a given JobType
 */
export function getQueueForJob(jobType: JobType): QueueName {
  const mapping: Record<string, QueueName> = {
    [JOB_TYPES.WALLET_RECONCILIATION]: QUEUE_NAMES.RECONCILIATION,
    [JOB_TYPES.BACKFILL_OPENING_BALANCES]: QUEUE_NAMES.RECONCILIATION,
    [JOB_TYPES.BIRTHDAY_WISHES]: QUEUE_NAMES.NOTIFICATIONS,
    [JOB_TYPES.PAYMENT_REMINDERS]: QUEUE_NAMES.NOTIFICATIONS,
    [JOB_TYPES.REFERRAL_LEADERBOARD]: QUEUE_NAMES.NOTIFICATIONS,
    [JOB_TYPES.ANNOUNCEMENT_DISPATCH]: QUEUE_NAMES.NOTIFICATIONS,
    [JOB_TYPES.RENT_DUE_CHECK]: QUEUE_NAMES.RENT_REMINDERS,
    [JOB_TYPES.RENT_AUTO_DEBIT]: QUEUE_NAMES.RENT_REMINDERS,
    [JOB_TYPES.OVERDUE_ESCALATION]: QUEUE_NAMES.RENT_REMINDERS,
    [JOB_TYPES.DEVICE_VIOLATION_SCAN]: QUEUE_NAMES.DEVICE_COMPLIANCE,
    [JOB_TYPES.DEVICE_COMPLIANCE_REPORT]: QUEUE_NAMES.DEVICE_COMPLIANCE,
    [JOB_TYPES.REFERRAL_REWARD_PROCESS]: QUEUE_NAMES.REFERRAL_REWARDS,
    [JOB_TYPES.SEND_SMS]: QUEUE_NAMES.SMS_DISPATCH,
    [JOB_TYPES.SEND_OTP]: QUEUE_NAMES.SMS_DISPATCH,
    [JOB_TYPES.AUDIT_LOG_CLEANUP]: QUEUE_NAMES.AUDIT_CLEANUP,
    [JOB_TYPES.TELEMETRY_DATA_CLEANUP]: QUEUE_NAMES.TELEMETRY_CLEANUP,
    [JOB_TYPES.EXPIRED_SESSION_CLEANUP]: QUEUE_NAMES.AUDIT_CLEANUP,
  };
  return mapping[jobType] || QUEUE_NAMES.NOTIFICATIONS;
}

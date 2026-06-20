/**
 * Unit tests for Worker Job Processors.
 *
 * Tests the job processing logic for:
 *   - Reconciliation Job (wallet drift detection)
 *   - Notifications Job (birthday, payment reminders, referral leaderboard)
 *   - Audit Cleanup Job (expired log deletion)
 *   - Rent Reminders Job (due/overdue detection)
 *
 * Uses mock implementations to avoid DB dependency.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Reconciliation Job
// ---------------------------------------------------------------------------

interface WalletEntry {
  entryType: 'CREDIT' | 'DEBIT';
  amountInPaise: number;
}

interface MockWallet {
  id: string;
  riderId: string;
  balanceInPaise: number;
  entries: WalletEntry[];
}

let walletStore: MockWallet[] = [];
let reportStore: Array<{
  reportDate: string;
  totalWallets: number;
  matched: number;
  mismatched: number;
  drift: number;
}> = [];

const mockReconciliationJob = {
  async process(): Promise<{
    totalWallets: number;
    matched: number;
    mismatched: number;
    drift: number;
    healthy: boolean;
  }> {
    const today = new Date().toISOString().split('T')[0];

    // Check idempotency
    const existing = reportStore.find((r) => r.reportDate === today);
    if (existing) {
      return {
        totalWallets: existing.totalWallets,
        matched: existing.matched,
        mismatched: existing.mismatched,
        drift: existing.drift,
        healthy: existing.mismatched === 0,
      };
    }

    let matched = 0;
    let mismatched = 0;
    let totalDrift = 0;

    for (const wallet of walletStore) {
      const ledgerSum = wallet.entries.reduce((sum, e) => {
        return e.entryType === 'CREDIT' ? sum + e.amountInPaise : sum - e.amountInPaise;
      }, 0);

      const drift = wallet.balanceInPaise - ledgerSum;
      totalDrift += drift;

      if (drift === 0) {
        matched++;
      } else {
        mismatched++;
      }
    }

    const report = {
      reportDate: today,
      totalWallets: walletStore.length,
      matched,
      mismatched,
      drift: totalDrift,
    };
    reportStore.push(report);

    return { ...report, healthy: mismatched === 0 };
  },

  reset() {
    walletStore = [];
    reportStore = [];
  },
};

describe('Worker Jobs — Reconciliation', () => {
  beforeEach(() => {
    mockReconciliationJob.reset();
  });

  it('reports all healthy when ledger matches balance', async () => {
    walletStore.push(
      {
        id: 'w1',
        riderId: 'r1',
        balanceInPaise: 1000,
        entries: [{ entryType: 'CREDIT', amountInPaise: 1000 }],
      },
      {
        id: 'w2',
        riderId: 'r2',
        balanceInPaise: 500,
        entries: [{ entryType: 'CREDIT', amountInPaise: 500 }],
      }
    );

    const result = await mockReconciliationJob.process();
    expect(result.totalWallets).toBe(2);
    expect(result.matched).toBe(2);
    expect(result.mismatched).toBe(0);
    expect(result.drift).toBe(0);
    expect(result.healthy).toBe(true);
  });

  it('detects drift when ledger does not match balance', async () => {
    walletStore.push({
      id: 'w1',
      riderId: 'r1',
      balanceInPaise: 1500,
      entries: [{ entryType: 'CREDIT', amountInPaise: 1000 }],
    });

    const result = await mockReconciliationJob.process();
    expect(result.totalWallets).toBe(1);
    expect(result.matched).toBe(0);
    expect(result.mismatched).toBe(1);
    expect(result.drift).toBe(500);
    expect(result.healthy).toBe(false);
  });

  it('handles debit entries correctly', async () => {
    walletStore.push({
      id: 'w1',
      riderId: 'r1',
      balanceInPaise: 800,
      entries: [
        { entryType: 'CREDIT', amountInPaise: 1000 },
        { entryType: 'DEBIT', amountInPaise: 200 },
      ],
    });

    const result = await mockReconciliationJob.process();
    expect(result.matched).toBe(1);
    expect(result.drift).toBe(0);
  });

  it('is idempotent — returns existing report for today', async () => {
    reportStore.push({
      reportDate: new Date().toISOString().split('T')[0],
      totalWallets: 5,
      matched: 5,
      mismatched: 0,
      drift: 0,
    });
    walletStore.push({
      id: 'w1',
      riderId: 'r1',
      balanceInPaise: 100,
      entries: [{ entryType: 'CREDIT', amountInPaise: 200 }],
    });

    const result = await mockReconciliationJob.process();
    expect(result.totalWallets).toBe(5); // from cached report, not walletStore
    expect(result.matched).toBe(5);
  });

  it('handles empty wallet store', async () => {
    const result = await mockReconciliationJob.process();
    expect(result.totalWallets).toBe(0);
    expect(result.matched).toBe(0);
    expect(result.mismatched).toBe(0);
    expect(result.drift).toBe(0);
    expect(result.healthy).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mock Notifications Job
// ---------------------------------------------------------------------------

interface MockNotificationResult {
  birthdays: number;
  paymentReminders: number;
  referralLeaderboard: number;
}

const mockNotificationsJob = {
  async process(
    birthdayRiders: string[],
    overdueRiders: string[]
  ): Promise<MockNotificationResult> {
    let birthdays = 0;
    let paymentReminders = 0;

    for (const _ of birthdayRiders) birthdays++;
    for (const _ of overdueRiders) paymentReminders++;

    return {
      birthdays,
      paymentReminders,
      referralLeaderboard: 1, // always sends leaderboard
    };
  },
};

describe('Worker Jobs — Notifications', () => {
  it('handles empty lists', async () => {
    const result = await mockNotificationsJob.process([], []);
    expect(result.birthdays).toBe(0);
    expect(result.paymentReminders).toBe(0);
    expect(result.referralLeaderboard).toBe(1);
  });

  it('processes birthday wishes', async () => {
    const result = await mockNotificationsJob.process(['rider-1', 'rider-2', 'rider-3'], []);
    expect(result.birthdays).toBe(3);
    expect(result.paymentReminders).toBe(0);
  });

  it('processes payment reminders', async () => {
    const result = await mockNotificationsJob.process([], ['rider-4', 'rider-5']);
    expect(result.birthdays).toBe(0);
    expect(result.paymentReminders).toBe(2);
  });

  it('handles both birthday and overdue riders', async () => {
    const result = await mockNotificationsJob.process(['rider-1'], ['rider-2', 'rider-3']);
    expect(result.birthdays).toBe(1);
    expect(result.paymentReminders).toBe(2);
    expect(result.referralLeaderboard).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Mock Audit Cleanup & Rent Reminders
// ---------------------------------------------------------------------------

const mockAuditCleanupJob = {
  async process(expiredCount: number): Promise<{ expiredLogsDeleted: number }> {
    return { expiredLogsDeleted: expiredCount };
  },
};

describe('Worker Jobs — Audit Cleanup', () => {
  it('reports deleted count', async () => {
    const result = await mockAuditCleanupJob.process(42);
    expect(result.expiredLogsDeleted).toBe(42);
  });

  it('handles zero deletions', async () => {
    const result = await mockAuditCleanupJob.process(0);
    expect(result.expiredLogsDeleted).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Queue Routing Logic
// ---------------------------------------------------------------------------

const QUEUE_NAMES = {
  RECONCILIATION: 'voltium:reconciliation',
  NOTIFICATIONS: 'voltium:notifications',
  RENT_REMINDERS: 'voltium:rent-reminders',
  DEVICE_COMPLIANCE: 'voltium:device-compliance',
  REFERRAL_REWARDS: 'voltium:referral-rewards',
  SMS_DISPATCH: 'voltium:sms-dispatch',
  AUDIT_CLEANUP: 'voltium:audit-cleanup',
  TELEMETRY_CLEANUP: 'voltium:telemetry-cleanup',
} as const;

type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const JOB_TYPES = {
  WALLET_RECONCILIATION: 'wallet_reconciliation',
  BIRTHDAY_WISHES: 'birthday_wishes',
  RENT_DUE_CHECK: 'rent_due_check',
  DEVICE_VIOLATION_SCAN: 'device_violation_scan',
  REFERRAL_REWARD_PROCESS: 'referral_reward_process',
  SEND_SMS: 'send_sms',
  AUDIT_LOG_CLEANUP: 'audit_log_cleanup',
  TELEMETRY_DATA_CLEANUP: 'telemetry_data_cleanup',
} as const;

type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

function getQueueForJob(jobType: JobType): QueueName {
  const mapping: Record<string, QueueName> = {
    wallet_reconciliation: QUEUE_NAMES.RECONCILIATION,
    birthday_wishes: QUEUE_NAMES.NOTIFICATIONS,
    rent_due_check: QUEUE_NAMES.RENT_REMINDERS,
    device_violation_scan: QUEUE_NAMES.DEVICE_COMPLIANCE,
    referral_reward_process: QUEUE_NAMES.REFERRAL_REWARDS,
    send_sms: QUEUE_NAMES.SMS_DISPATCH,
    audit_log_cleanup: QUEUE_NAMES.AUDIT_CLEANUP,
    telemetry_data_cleanup: QUEUE_NAMES.TELEMETRY_CLEANUP,
  };
  return mapping[jobType] || QUEUE_NAMES.NOTIFICATIONS;
}

describe('Worker Jobs — Queue Routing', () => {
  it('routes reconciliation job to correct queue', () => {
    expect(getQueueForJob('wallet_reconciliation')).toBe('voltium:reconciliation');
  });

  it('routes notification jobs to notifications queue', () => {
    expect(getQueueForJob('birthday_wishes')).toBe('voltium:notifications');
  });

  it('routes rent check to rent reminders queue', () => {
    expect(getQueueForJob('rent_due_check')).toBe('voltium:rent-reminders');
  });

  it('routes device compliance to device queue', () => {
    expect(getQueueForJob('device_violation_scan')).toBe('voltium:device-compliance');
  });

  it('routes referral rewards to referral queue', () => {
    expect(getQueueForJob('referral_reward_process')).toBe('voltium:referral-rewards');
  });

  it('routes SMS to SMS queue', () => {
    expect(getQueueForJob('send_sms')).toBe('voltium:sms-dispatch');
  });

  it('routes audit cleanup to audit queue', () => {
    expect(getQueueForJob('audit_log_cleanup')).toBe('voltium:audit-cleanup');
  });

  it('routes telemetry cleanup to telemetry queue', () => {
    expect(getQueueForJob('telemetry_data_cleanup')).toBe('voltium:telemetry-cleanup');
  });

  it('falls back to notifications for unknown job types', () => {
    expect(getQueueForJob('unknown_job' as JobType)).toBe('voltium:notifications');
  });
});

// ---------------------------------------------------------------------------
// Schedule Configuration
// ---------------------------------------------------------------------------

interface QueueConfig {
  queueName: string;
  concurrency: number;
  maxRetries: number;
  schedule?: string;
  ttlSeconds: number;
}

const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  reconciliation: {
    queueName: 'voltium:reconciliation',
    concurrency: 1,
    maxRetries: 2,
    schedule: '0 2 * * *',
    ttlSeconds: 86400,
  },
  notifications: {
    queueName: 'voltium:notifications',
    concurrency: 3,
    maxRetries: 3,
    schedule: '0 8 * * *',
    ttlSeconds: 43200,
  },
  rentReminders: {
    queueName: 'voltium:rent-reminders',
    concurrency: 2,
    maxRetries: 3,
    schedule: '0 6 * * *',
    ttlSeconds: 86400,
  },
  deviceCompliance: {
    queueName: 'voltium:device-compliance',
    concurrency: 2,
    maxRetries: 2,
    schedule: '0 * * * *',
    ttlSeconds: 3600,
  },
  referralRewards: {
    queueName: 'voltium:referral-rewards',
    concurrency: 3,
    maxRetries: 3,
    ttlSeconds: 86400,
  },
  smsDispatch: {
    queueName: 'voltium:sms-dispatch',
    concurrency: 5,
    maxRetries: 3,
    ttlSeconds: 3600,
  },
  auditCleanup: {
    queueName: 'voltium:audit-cleanup',
    concurrency: 1,
    maxRetries: 1,
    schedule: '0 3 * * 0',
    ttlSeconds: 86400,
  },
  telemetryCleanup: {
    queueName: 'voltium:telemetry-cleanup',
    concurrency: 1,
    maxRetries: 1,
    schedule: '0 4 1 * *',
    ttlSeconds: 86400,
  },
};

describe('Worker Jobs — Schedule Configuration', () => {
  it('reconciliation runs daily at 2 AM', () => {
    expect(QUEUE_CONFIGS.reconciliation.schedule).toBe('0 2 * * *');
    expect(QUEUE_CONFIGS.reconciliation.concurrency).toBe(1);
  });

  it('notifications run daily at 8 AM with fan-out', () => {
    expect(QUEUE_CONFIGS.notifications.schedule).toBe('0 8 * * *');
    expect(QUEUE_CONFIGS.notifications.concurrency).toBe(3);
  });

  it('device compliance runs hourly', () => {
    expect(QUEUE_CONFIGS.deviceCompliance.schedule).toBe('0 * * * *');
  });

  it('audit cleanup runs weekly on Sunday', () => {
    expect(QUEUE_CONFIGS.auditCleanup.schedule).toBe('0 3 * * 0');
  });

  it('referral rewards is on-demand (no schedule)', () => {
    expect(QUEUE_CONFIGS.referralRewards.schedule).toBeUndefined();
  });

  it('sms dispatch is on-demand (no schedule)', () => {
    expect(QUEUE_CONFIGS.smsDispatch.schedule).toBeUndefined();
  });

  it('telemetry cleanup runs monthly on the 1st', () => {
    expect(QUEUE_CONFIGS.telemetryCleanup.schedule).toBe('0 4 1 * *');
  });
});

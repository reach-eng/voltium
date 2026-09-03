import { OutboxEventTypes, type OutboxEventType } from '@/server/workers/outbox';

export interface JobOutboxConfig {
  eventType: OutboxEventType;
  priority: 'interactive' | 'background';
}

export const JOB_TO_OUTBOX_CONFIG: Record<string, JobOutboxConfig> = {
  'wallet-reconciliation': {
    eventType: OutboxEventTypes.ADMIN_JOB_WALLET_RECONCILIATION,
    priority: 'interactive',
  },
  'rent-due-checker': {
    eventType: OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
    priority: 'interactive',
  },
  'auto-debit': {
    eventType: OutboxEventTypes.ADMIN_JOB_AUTO_DEBIT,
    priority: 'interactive',
  },
  'device-compliance': {
    eventType: OutboxEventTypes.ADMIN_JOB_DEVICE_COMPLIANCE,
    priority: 'background',
  },
  'referral-reward': {
    eventType: OutboxEventTypes.ADMIN_JOB_REFERRAL_REWARD,
    priority: 'interactive',
  },
  'notifications-cleanup': {
    eventType: OutboxEventTypes.ADMIN_JOB_NOTIFICATIONS_CLEANUP,
    priority: 'background',
  },
  'telemetry-cleanup': {
    eventType: OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP,
    priority: 'background',
  },
  'daily-engagement': {
    eventType: OutboxEventTypes.ADMIN_JOB_DAILY_ENGAGEMENT,
    priority: 'background',
  },
};

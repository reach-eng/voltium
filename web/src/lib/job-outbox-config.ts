// AUDIT FIX: extracted JOB_TO_OUTBOX_CONFIG out of app/api/admin/jobs/route.ts.
// Next.js route modules may only export handlers/config — non-handler exports
// fail the generated type check — but the master-contract test needs to import
// this mapping. Shared module satisfies both.
import { OutboxEventType, OutboxEventTypes } from '@/server/workers/outbox';

export interface JobOutboxConfig {
  eventType: OutboxEventType;
  priority: 'interactive' | 'background';
}

export const JOB_TO_OUTBOX_CONFIG: Record<string, JobOutboxConfig> = {
  'wallet-reconciliation': {
    eventType: OutboxEventTypes.ADMIN_JOB_WALLET_RECONCILIATION,
    // Admin-triggered reconciliation is a fast single-SQL run (post-unify) —
    // interactive priority so it isn't starved behind long background jobs.
    priority: 'interactive',
  },
  'rent-due-checker': {
    eventType: OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
    priority: 'interactive',
  },
  // PR-VER-2026-08-06 (EVENT_BUS P0-6): auto-debit is now its own event
  // (debit-only mode) instead of silently sharing rent-due-checker's.
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


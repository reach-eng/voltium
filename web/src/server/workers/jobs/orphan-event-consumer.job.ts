/**
 * Orphan-Event Consumer — handles outbox event types that have no
 * other consumer.
 *
 * PR-151 (AUDIT_WORKERS §6.1-6.8) — wires up 4 OutboxEvent types that
 * were previously emitted but had no consumer (events piled up
 * forever in the outbox table):
 *
 *   - `RENT_PAID`        → rider gets a "rent paid" receipt push
 *   - `RENT_OVERDUE`     → rider gets an overdue escalation push
 *   - `DEVICE_VIOLATION` → admin gets a Slack alert + AuditLog
 *   - `ADMIN_ACTION`     → admin gets a Slack alert (e.g.
 *                          reconciliation.mismatch_alert from
 *                          reconciliation.job.ts)
 *
 * Each handler is best-effort: failures are logged and the event is
 * marked COMPLETED so it doesn't get stuck retrying. If the action
 * is critical (admin alert), the handler also calls `createAuditLog`
 * for the SOC2 trail.
 *
 * Tradeoff: this job is a "fan-in" — it handles 4 unrelated event
 * types in one file. The alternative is 4 separate jobs, but each
 * has 1-2 lines of work; the fan-in is more readable and the
 * routing logic is centralised in the `route()` switch.
 */

import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { alerter } from '@/lib/alerter';
import { notificationService } from '@/lib/notification-service';
import { createAuditLog } from '@/lib/audit-log';
import { OutboxEventTypes } from '../outbox';

interface OrphanEventResult {
  handled: number;
  failed: number;
  byType: Record<string, number>;
}

interface RentPaidPayload {
  riderId: string;
  leaseId?: string;
  amountInPaise?: number;
  periodNo?: number;
}

interface RentOverduePayload {
  riderId: string;
  leaseId?: string;
  amountDue?: number;
  balance?: number;
  hoursUntilDebit?: number;
  periodNo?: number;
}

interface DeviceViolationPayload {
  riderId: string;
  violations?: unknown[];
}

interface AdminActionPayload {
  action?: string;
  reportDate?: string;
  driftedRiders?: unknown[];
  totalDrift?: number;
}

async function handleRentPaid(payload: Record<string, unknown>): Promise<void> {
  const { riderId, leaseId, amountInPaise, periodNo } = payload as unknown as RentPaidPayload;
  logger.info('[OrphanConsumer] RENT_PAID', { riderId, leaseId, amountInPaise, periodNo });
  await notificationService.notifyPaymentReminder(
    riderId,
    amountInPaise ?? 0,
    'payment_receipt'
  );
  await createAuditLog({
    actorId: 'system',
    actorType: 'SYSTEM',
    action: 'rent.paid',
    entity: 'rentalLease',
    entityId: leaseId,
    details: { riderId, amountInPaise, periodNo },
  });
}

async function handleRentOverdue(payload: Record<string, unknown>): Promise<void> {
  const { riderId, leaseId, amountDue, balance, hoursUntilDebit, periodNo } =
    payload as unknown as RentOverduePayload;
  logger.warn('[OrphanConsumer] RENT_OVERDUE', { riderId, leaseId, amountDue, balance, hoursUntilDebit });

  const isProactive24h = typeof hoursUntilDebit === 'number' && hoursUntilDebit <= 24 && hoursUntilDebit > 0;
  const reminderType = isProactive24h ? 'proactive_24h' : 'overdue';

  // Notify the rider with 24h urgency context
  await notificationService.notifyPaymentReminder(riderId, amountDue ?? 0, reminderType);

  // If balance is critical (< 100 INR = 10000 paise), also page ops.
  if ((balance ?? 0) < 10000) {
    alerter.send({
      level: 'warn',
      title: isProactive24h ? 'Proactive 24h rent top-up prompt' : 'Rent overdue with low wallet balance',
      message: `Rider ${riderId} has debit of ${amountDue ?? 0} paise due in ${hoursUntilDebit ?? 0}h with balance ${balance ?? 0}`,
      details: { riderId, leaseId, amountDue, balance, hoursUntilDebit, periodNo },
    });
  }
  await createAuditLog({
    actorId: 'system',
    actorType: 'SYSTEM',
    action: isProactive24h ? 'rent.prompt_24h' : 'rent.overdue',
    entity: 'rentalLease',
    entityId: leaseId,
    details: { riderId, amountDue, balance, hoursUntilDebit, periodNo },
  });
}

async function handleDeviceViolation(payload: Record<string, unknown>): Promise<void> {
  const { riderId, violations } = payload as unknown as DeviceViolationPayload;
  logger.warn('[OrphanConsumer] DEVICE_VIOLATION', { riderId, violations });
  alerter.send({
    level: 'warn',
    title: 'Device compliance violation',
    message: `Rider ${riderId} has ${Array.isArray(violations) ? violations.length : '?'} violation(s)`,
    details: { riderId, violations },
  });
  await createAuditLog({
    actorId: 'system',
    actorType: 'SYSTEM',
    action: 'device.violation',
    entity: 'rider',
    entityId: riderId,
    details: { violations },
  });
}

async function handleAdminAction(payload: Record<string, unknown>): Promise<void> {
  // Most admin-action events come from reconciliation.mismatch_alert
  // and similar. They carry a free-form `action` field.
  const { action, reportDate, driftedRiders, totalDrift } = payload as AdminActionPayload;
  logger.warn('[OrphanConsumer] ADMIN_ACTION', { action, reportDate, driftedRiders, totalDrift });
  alerter.send({
    level: 'error',
    title: `Admin action: ${action}`,
    message: `Report date: ${reportDate ?? 'unknown'}. ${driftedRiders ?? 0} riders, total drift ${totalDrift ?? 0} paise.`,
    details: payload,
  });
  await createAuditLog({
    actorId: 'system',
    actorType: 'SYSTEM',
    action: action ?? 'admin.action',
    entity: 'system',
    entityId: reportDate ?? '',
    details: payload,
  });
}

export const orphanEventConsumerJob = {
  async process(job: QueueJob): Promise<OrphanEventResult> {
    const result: OrphanEventResult = { handled: 0, failed: 0, byType: {} };

    // The outbox poller (lib/job-queue.ts processJobs) sets `job.type`
    // to the event's `eventType`. We pull it from there, falling back
    // to a payload field.
    const eventType: string = job.type ?? job.payload?.eventType ?? '';

    const handlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
      [OutboxEventTypes.RENT_PAID]: handleRentPaid,
      [OutboxEventTypes.RENT_OVERDUE]: handleRentOverdue,
      [OutboxEventTypes.DEVICE_VIOLATION]: handleDeviceViolation,
      [OutboxEventTypes.ADMIN_ACTION]: handleAdminAction,
    };

    const handler = handlers[eventType];
    if (!handler) {
      // Not one of ours. The dispatcher should not have routed here;
      // we log and return zero-handled so the caller doesn't mark
      // the event COMPLETED prematurely.
      logger.warn('[OrphanConsumer] No handler for eventType', { eventType });
      return result;
    }

    try {
      await handler(job.payload ?? {});
      result.handled++;
      result.byType[eventType] = (result.byType[eventType] ?? 0) + 1;
    } catch (err) {
      result.failed++;
      logger.error('[OrphanConsumer] Handler failed', { eventType, err });
      throw err;
    }

    return result;
  },
};

// Re-export the event types this job consumes so the worker
// registration can import a single canonical list.
export const ORPHAN_EVENT_TYPES = [
  OutboxEventTypes.RENT_PAID,
  OutboxEventTypes.RENT_OVERDUE,
  OutboxEventTypes.DEVICE_VIOLATION,
  OutboxEventTypes.ADMIN_ACTION,
] as const;

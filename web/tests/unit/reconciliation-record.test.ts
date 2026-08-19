/**
 * Financial audit P0-8 / P0-4 — recordReconciliation audit payload.
 *
 * P0-8: the old `details: result as any` serialized EVERY drifted rider.
 * A 10k-wallet drift exceeded the outbox 64KB payload cap, the audit write
 * was swallowed, and the only record of the drift was lost. The record now
 * persists a capped sample (DRIFT_RIDER_SAMPLE_CAP) plus a `truncated`
 * flag and the real count.
 *
 * P0-4: the acting admin's id is passed through to the audit entry so the
 * run is attributable (SOC2); cron/system runs default to 'system'.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordReconciliation,
  DRIFT_RIDER_SAMPLE_CAP,
  type ReconciliationResult,
} from '../../src/server/workers/jobs/wallet-reconciliation.job';

const mocks = vi.hoisted(() => ({
  createAuditLog: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));
vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/alerter', () => ({ alerter: { send: vi.fn() } }));
vi.mock('@/lib/security-events', () => ({ logReconciliationMismatch: vi.fn() }));

function makeResult(driftedCount: number): ReconciliationResult {
  const driftedRiders = Array.from({ length: driftedCount }, (_, i) => ({
    riderId: `rider-${i}`,
    drift: 10,
    walletBalance: 110,
    ledgerSum: 100,
  }));
  return {
    totalWallets: driftedCount + 10,
    healthy: 10,
    drifted: driftedCount,
    totalDrift: driftedCount * 10,
    totalWalletSum: 0,
    totalLedgerSum: 0,
    driftedRiders,
  };
}

describe('recordReconciliation (P0-8 / P0-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuditLog.mockResolvedValue(undefined);
  });

  it('attributes the run to the acting admin (P0-4 / TG-9)', async () => {
    await recordReconciliation(makeResult(0), { actorId: 'admin-42', actorType: 'ADMIN' });

    expect(mocks.createAuditLog).toHaveBeenCalledTimes(1);
    const call = mocks.createAuditLog.mock.calls[0][0];
    expect(call.actorId).toBe('admin-42');
    expect(call.actorType).toBe('ADMIN');
    expect(call.action).toBe('reconciliation.run');
  });

  it('defaults to system attribution for cron runs', async () => {
    await recordReconciliation(makeResult(0));

    const call = mocks.createAuditLog.mock.calls[0][0];
    expect(call.actorId).toBe('system');
    expect(call.actorType).toBe('SYSTEM');
  });

  it('persists a small drift sample untruncated (TG-10)', async () => {
    await recordReconciliation(makeResult(3));

    const call = mocks.createAuditLog.mock.calls[0][0];
    expect(call.details.driftedRiders).toHaveLength(3);
    expect(call.details.truncated).toBe(false);
    expect(call.details.driftedRiderCount).toBe(3);
  });

  it('caps the drifted-rider sample at DRIFT_RIDER_SAMPLE_CAP and flags truncation', async () => {
    const big = DRIFT_RIDER_SAMPLE_CAP + 150; // 250 riders → over the 64KB payload cap
    await recordReconciliation(makeResult(big));

    const call = mocks.createAuditLog.mock.calls[0][0];
    expect(call.details.driftedRiders).toHaveLength(DRIFT_RIDER_SAMPLE_CAP);
    expect(call.details.truncated).toBe(true);
    expect(call.details.driftedRiderCount).toBe(big);
    expect(call.details.totalDrift).toBe(big * 10);
  });

  it('never swallows the write silently — logs on failure', async () => {
    mocks.createAuditLog.mockRejectedValue(new Error('OutboxPayloadTooLargeError'));
    await recordReconciliation(makeResult(5));

    expect(mocks.logger.error).toHaveBeenCalled();
  });
});

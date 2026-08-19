/**
 * TG (2026-08-05 legal/device audit) — P0-4 + P0-5:
 *
 * P0-4: assignPlan no longer takes a caller-supplied planName (the route was
 * passing planId as planName, corrupting the audit trail). The audit detail
 * now uses the plan name from the DB row.
 *
 * P0-5: getDeviceData no longer selects `lockPassword` (a field that does not
 * exist on the Rider model — the column is `lockPasswordHash`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  riderUpdate: vi.fn(),
  createAuditLog: vi.fn(),
  transitionRiderStatus: vi.fn(),
  invalidateRiderCache: vi.fn(),
  invalidateRiderPhoneCache: vi.fn(),
  getCachedRider: vi.fn(),
  getCachedRiderByPhone: vi.fn(),
  userContactFindMany: vi.fn(),
  userCallLogFindMany: vi.fn(),
  userLocationFindMany: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
      update: mocks.riderUpdate,
    },
    rentalPlan: { findUnique: mocks.findUnique },
    userContact: { findMany: mocks.userContactFindMany },
    userCallLog: { findMany: mocks.userCallLogFindMany },
    userLocation: { findMany: mocks.userLocationFindMany },
  },
}));

vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));

vi.mock('@/server/modules/riders/rider-lifecycle.service', () => ({
  transitionRiderStatus: mocks.transitionRiderStatus,
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: mocks.getCachedRider,
  getCachedRiderByPhone: mocks.getCachedRiderByPhone,
  invalidateRiderCache: mocks.invalidateRiderCache,
  invalidateRiderPhoneCache: mocks.invalidateRiderPhoneCache,
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

describe('P0-4: assignPlan uses the DB plan name in the audit log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: 'plan_1',
      name: 'Weekly Plan',
      durationDays: 7,
      priceInPaise: 49900,
    });
    mocks.riderUpdate.mockResolvedValue({ id: 'rider_1' });
    mocks.transitionRiderStatus.mockResolvedValue({});
    mocks.createAuditLog.mockResolvedValue({});
  });

  it('accepts the new 4-arg signature (riderId, planId, actorId, actorRole)', async () => {
    await adminRiderUseCases.assignPlan('rider_1', 'plan_1', 'admin_1', 'SUPER_ADMIN');

    // The audit detail must carry the real plan name from the DB row
    const auditCall = mocks.createAuditLog.mock.calls[0][0];
    expect(auditCall.details).toEqual({
      planId: 'plan_1',
      planName: 'Weekly Plan',
      override: true,
    });
  });

  it('throws Plan not found for an unknown plan', async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(
      adminRiderUseCases.assignPlan('rider_1', 'nope', 'admin_1', 'SUPER_ADMIN')
    ).rejects.toThrow('Plan not found');
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });
});

describe('P0-5: getDeviceData does not select lockPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: 'rider_1',
      isAdminLocked: false,
      isUninstallBlocked: true,
      isLocationMandatory: false,
      isAppsControlRestricted: false,
    });
    mocks.userContactFindMany.mockResolvedValue([]);
    mocks.userCallLogFindMany.mockResolvedValue([]);
    mocks.userLocationFindMany.mockResolvedValue([]);
  });

  it('selects only real Rider fields — no lockPassword, no lockPasswordHash leak', async () => {
    await adminRiderUseCases.getDeviceData('rider_1', 'all');

    const selectArg = mocks.findUnique.mock.calls[0][0].select;
    expect(selectArg).not.toHaveProperty('lockPassword');
    expect(selectArg).not.toHaveProperty('lockPasswordHash');
    expect(selectArg).toHaveProperty('isAdminLocked');
  });

  it('returns the rider settings without any lock-password field', async () => {
    const result = await adminRiderUseCases.getDeviceData('rider_1', 'all');
    expect(result.rider).not.toHaveProperty('lockPassword');
    expect(result.rider).not.toHaveProperty('lockPasswordHash');
    expect(result.rider.isAdminLocked).toBe(false);
  });
});

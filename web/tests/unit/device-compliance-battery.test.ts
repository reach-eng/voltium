import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  userLocationCreate: vi.fn(),
  userLocationCount: vi.fn(),
  riderUpdate: vi.fn(),
  transaction: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/db', () => ({
  db: {
    userLocation: {
      create: mocks.userLocationCreate,
      // W10 / I-6: quota check counts trailing-hour rows per rider.
      count: mocks.userLocationCount,
    },
    rider: { update: mocks.riderUpdate },
    $transaction: mocks.transaction,
  },
}));

import { deviceComplianceUseCases } from '@/server/modules/device-compliance/device-compliance.use-cases';

describe('DeviceCompliance — syncLocation atomicity & battery level (P1-4, P0-8 backend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((promises) => Promise.all(promises));
    mocks.userLocationCreate.mockResolvedValue({ id: 'loc_1' });
    mocks.riderUpdate.mockResolvedValue({ id: 'rider_1' });
    // W10 / I-6: below quota by default.
    mocks.userLocationCount.mockResolvedValue(0);
  });

  it('uses db.$transaction for atomic location create & rider update', async () => {
    await deviceComplianceUseCases.syncLocation('rider_1', {
      lat: 12.9716,
      lng: 77.5946,
      batteryLevel: 85,
    });

    expect(mocks.transaction).toHaveBeenCalled();
  });
});

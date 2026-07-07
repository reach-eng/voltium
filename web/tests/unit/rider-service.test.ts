import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateTransition, RiderLifecycleError } from '@/server/modules/riders/rider-lifecycle.service';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findUnique: vi.fn(), update: vi.fn() },
    notification: { count: vi.fn() },
    reward: { aggregate: vi.fn(), findMany: vi.fn() }
  }
}));

describe('Rider Lifecycle Service - validateTransition', () => {
  it('allows valid transitions', () => {
    expect(() => validateTransition('NEW', 'PHONE_VERIFIED')).not.toThrow();
    expect(() => validateTransition('ACTIVE', 'SUSPENDED')).not.toThrow();
  });

  it('allows no-op transitions', () => {
    expect(() => validateTransition('ACTIVE', 'ACTIVE')).not.toThrow();
  });

  it('throws RiderLifecycleError for invalid transitions', () => {
    expect(() => validateTransition('NEW', 'ACTIVE')).toThrow(RiderLifecycleError);
    expect(() => validateTransition('CLOSED', 'ACTIVE')).toThrow(RiderLifecycleError);
  });
});

describe('Rider Use Cases - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getProfile returns null if rider not found', async () => {
    (db.rider.findUnique as any).mockResolvedValue(null);
    const result = await riderUseCases.getProfile('invalid-id');
    expect(result).toBeNull();
  });

  it('getDashboard returns null if rider not found', async () => {
    (db.rider.findUnique as any).mockResolvedValue(null);
    const result = await riderUseCases.getDashboard('invalid-id');
    expect(result).toBeNull();
  });

  it('getRewards returns null if rider not found', async () => {
    (db.rider.findUnique as any).mockResolvedValue(null);
    const result = await riderUseCases.getRewards('invalid-id');
    expect(result).toBeNull();
  });

  it('registerFcmToken throws if rider not found', async () => {
    (db.rider.findUnique as any).mockResolvedValue(null);
    await expect(riderUseCases.registerFcmToken('invalid-id', 'token')).rejects.toThrow('Rider not found');
  });
});

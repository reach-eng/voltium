/**
 * completePickupVerification use-case unit tests (PR-26b, API N3)
 *
 * Verifies the use case:
 *   - rejects fewer than 2 photos
 *   - rejects a rider not in `lifecycleStatus === 'PICKUP_SCHEDULED'`
 *   - delegates to rentalUseCases.syncPickup for the actual DB work
 *   - writes a non-blocking audit log
 *
 * The underlying syncPickup is mocked so the unit test only exercises
 * the new boundary (preconditions + audit log).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRiderFindUnique = vi.fn();
const mockSyncPickup = vi.fn();
const mockAuditLog = vi.fn().mockResolvedValue(undefined);
const mockInvalidate = vi.fn();
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findUnique: mockRiderFindUnique },
  },
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mockAuditLog }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/server-cache', () => ({ invalidateRiderCache: mockInvalidate }));
vi.mock('@/server/modules/rentals/rental.use-cases', () => ({
  rentalUseCases: { syncPickup: mockSyncPickup },
}));

const { completePickupVerification } = await import(
  '@/server/modules/pickup/use-cases/completeVerification'
);
const { PickupVerificationError } = await import('@/server/modules/pickup/use-cases/errors');

const PICKUP_RIDER = {
  id: 'rider-1',
  riderId: 'VF-RD-001',
  lifecycleStatus: 'PICKUP_SCHEDULED',
};

const TWO_PHOTOS = {
  vehicleId: 'V001',
  pickupPhotoFront: 'https://cdn.example.com/front.jpg',
  pickupPhotoBack: 'https://cdn.example.com/back.jpg',
  hubId: 'hub-1',
  teamLeader: 'TL-Alice',
};

describe('completePickupVerification use case — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRiderFindUnique.mockResolvedValue(PICKUP_RIDER);
    mockSyncPickup.mockResolvedValue({ id: 'rider-1', rentalStatus: 'ACTIVE' });
  });

  it('delegates to rentalUseCases.syncPickup with mapped fields', async () => {
    const result = await completePickupVerification('rider-1', TWO_PHOTOS);

    expect(mockSyncPickup).toHaveBeenCalledWith('rider-1', {
      vehicleId: 'V001',
      hubId: 'hub-1',
      teamLeader: 'TL-Alice',
      emergencyContact: undefined,
      pickupPhotoFront: 'https://cdn.example.com/front.jpg',
      pickupPhotoBack: 'https://cdn.example.com/back.jpg',
      pickupPhotoLeft: undefined,
      pickupPhotoRight: undefined,
      pickupPhotoWithVehicle: undefined,
    });
    expect(result).toEqual({ id: 'rider-1', rentalStatus: 'ACTIVE' });
  });

  it('writes an audit log entry (pickup.verification_completed)', async () => {
    await completePickupVerification('rider-1', { ...TWO_PHOTOS, verifiedBy: 'admin-1' });

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        actorType: 'ADMIN',
        action: 'pickup.verification_completed',
        entity: 'Rider',
        entityId: 'rider-1',
        details: expect.objectContaining({
          vehicleId: 'V001',
          hubId: 'hub-1',
          teamLeader: 'TL-Alice',
          photoCount: 2,
        }),
      })
    );
  });

  it('uses rider as actor when no verifiedBy is provided', async () => {
    await completePickupVerification('rider-1', TWO_PHOTOS);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'rider-1',
        actorType: 'RIDER',
        action: 'pickup.verification_completed',
      })
    );
  });

  it('invalidates the rider cache after success', async () => {
    await completePickupVerification('rider-1', TWO_PHOTOS);

    expect(mockInvalidate).toHaveBeenCalledWith('rider-1');
  });
});

describe('completePickupVerification use case — precondition failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws PickupVerificationError(PHOTOS_REQUIRED) when no photos provided', async () => {
    await expect(
      completePickupVerification('rider-1', { vehicleId: 'V001' })
    ).rejects.toMatchObject({
      name: 'PickupVerificationError',
      code: 'PHOTOS_REQUIRED',
    });

    expect(mockSyncPickup).not.toHaveBeenCalled();
  });

  it('throws PickupVerificationError(PHOTOS_REQUIRED) when only one photo is provided', async () => {
    await expect(
      completePickupVerification('rider-1', {
        vehicleId: 'V001',
        pickupPhotoFront: 'https://cdn.example.com/front.jpg',
      })
    ).rejects.toMatchObject({
      name: 'PickupVerificationError',
      code: 'PHOTOS_REQUIRED',
    });
  });

  it('throws PickupVerificationError(RIDER_NOT_FOUND) when rider does not exist', async () => {
    mockRiderFindUnique.mockResolvedValue(null);

    await expect(completePickupVerification('ghost', TWO_PHOTOS)).rejects.toMatchObject({
      name: 'PickupVerificationError',
      code: 'RIDER_NOT_FOUND',
    });
  });

  it('throws PickupVerificationError(INVALID_STATE) when rider is not in PICKUP_SCHEDULED', async () => {
    mockRiderFindUnique.mockResolvedValue({ ...PICKUP_RIDER, lifecycleStatus: 'ACTIVE' });

    await expect(completePickupVerification('rider-1', TWO_PHOTOS)).rejects.toMatchObject({
      name: 'PickupVerificationError',
      code: 'INVALID_STATE',
    });

    expect(mockSyncPickup).not.toHaveBeenCalled();
  });
});

describe('completePickupVerification use case — audit log is non-blocking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRiderFindUnique.mockResolvedValue(PICKUP_RIDER);
    mockSyncPickup.mockResolvedValue({ id: 'rider-1', rentalStatus: 'ACTIVE' });
  });

  it('does not fail the use case if the audit log write throws', async () => {
    mockAuditLog.mockRejectedValueOnce(new Error('audit db down'));

    const result = await completePickupVerification('rider-1', TWO_PHOTOS);

    expect(result).toEqual({ id: 'rider-1', rentalStatus: 'ACTIVE' });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('audit log write failed'),
      expect.any(Object)
    );
  });
});

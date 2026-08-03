/**
 * submitReturn use-case unit tests (PR-26b, API N3)
 *
 * Verifies the use case:
 *   - rejects fewer than 4 photos
 *   - rejects a rider not in `lifecycleStatus === 'ACTIVE'`
 *   - creates a VehicleReturn row and transitions the rider to
 *     `RETURN_PENDING` atomically
 *   - writes a non-blocking audit log
 *   - rejects when the rider has no assigned vehicle
 *
 * The audit log call is mocked; the database is mocked via the
 * `db` shared mock. This mirrors the `use-cases.test.ts` pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();
const mockUpdateMany = vi.fn();

const mockTx = {
  vehicleReturn: { create: mockCreate },
  rider: { updateMany: mockUpdateMany },
};

const mockDb = {
  rider: {
    findUnique: vi.fn(),
  },
  vehicle: {
    findFirst: vi.fn(),
  },
  vehicleReturn: { create: mockCreate },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockTx)),
};

const mockAuditLog = vi.fn().mockResolvedValue(undefined);
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const mockInvalidate = vi.fn();

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mockAuditLog }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/server-cache', () => ({ invalidateRiderCache: mockInvalidate }));

// Import after mocks
const { submitReturn } = await import('@/server/modules/rentals/use-cases/submitReturn');
const { RentalReturnError } = await import('@/server/modules/rentals/use-cases/errors');

const ACTIVE_RIDER = {
  id: 'rider-1',
  riderId: 'VF-RD-001',
  lifecycleStatus: 'ACTIVE',
  vehicleId: 'vehicle-1',
  assignedVehicle: 'V001',
};

const FOUR_PHOTOS = [
  'https://cdn.example.com/left.jpg',
  'https://cdn.example.com/right.jpg',
  'https://cdn.example.com/front.jpg',
  'https://cdn.example.com/speedometer.jpg',
];

describe('submitReturn use case — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
    mockCreate.mockResolvedValue({ id: 'return-1' });
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('creates a VehicleReturn row and transitions to RETURN_PENDING', async () => {
    mockDb.rider.findUnique.mockResolvedValue(ACTIVE_RIDER);

    const result = await submitReturn('rider-1', {
      photoUrls: FOUR_PHOTOS,
      reason: 'End of trip',
    });

    expect(result.returnId).toBe('return-1');
    expect(result.vehicleId).toBe('vehicle-1');
    expect(result.rentalStatus).toBe('RETURN_PENDING');

    // VehicleReturn row is created with the 4 photos mapped to
    // photoLeft/photoRight/photoFront/photoSpeedometer.
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        vehicleId: 'vehicle-1',
        status: 'SUBMITTED',
        photoLeft: FOUR_PHOTOS[0],
        photoRight: FOUR_PHOTOS[1],
        photoFront: FOUR_PHOTOS[2],
        photoSpeedometer: FOUR_PHOTOS[3],
        reason: 'End of trip',
      }),
      select: { id: true },
    });

    // The rider is transitioned to RETURN_PENDING only if currently ACTIVE
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'rider-1', lifecycleStatus: 'ACTIVE' },
      data: { lifecycleStatus: 'RETURN_PENDING' },
    });
  });

  it('writes an audit log entry (rental.return_submitted)', async () => {
    mockDb.rider.findUnique.mockResolvedValue(ACTIVE_RIDER);

    await submitReturn('rider-1', { photoUrls: FOUR_PHOTOS });

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'rider-1',
        actorType: 'RIDER',
        action: 'rental.return_submitted',
        entity: 'VehicleReturn',
        entityId: 'return-1',
        details: expect.objectContaining({
          vehicleId: 'vehicle-1',
          photoCount: 4,
        }),
      })
    );
  });

  it('invalidates the rider cache after success', async () => {
    mockDb.rider.findUnique.mockResolvedValue(ACTIVE_RIDER);

    await submitReturn('rider-1', { photoUrls: FOUR_PHOTOS });

    expect(mockInvalidate).toHaveBeenCalledWith('rider-1');
  });
});

describe('submitReturn use case — precondition failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws RentalReturnError(PHOTOS_REQUIRED) when fewer than 4 photos are provided', async () => {
    await expect(
      submitReturn('rider-1', { photoUrls: ['only-one.jpg'] })
    ).rejects.toMatchObject({
      name: 'RentalReturnError',
      code: 'PHOTOS_REQUIRED',
    });

    // No DB writes attempted
    expect(mockDb.rider.findUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('throws RentalReturnError(PHOTOS_REQUIRED) on empty photo array', async () => {
    await expect(submitReturn('rider-1', { photoUrls: [] })).rejects.toMatchObject({
      name: 'RentalReturnError',
      code: 'PHOTOS_REQUIRED',
    });
  });

  it('throws RentalReturnError(RIDER_NOT_FOUND) when rider does not exist', async () => {
    mockDb.rider.findUnique.mockResolvedValue(null);

    await expect(
      submitReturn('ghost-rider', { photoUrls: FOUR_PHOTOS })
    ).rejects.toMatchObject({
      name: 'RentalReturnError',
      code: 'RIDER_NOT_FOUND',
    });
  });

  it('throws RentalReturnError(INVALID_STATE) when rider is not ACTIVE', async () => {
    mockDb.rider.findUnique.mockResolvedValue({
      ...ACTIVE_RIDER,
      lifecycleStatus: 'PICKUP_SCHEDULED',
    });

    await expect(
      submitReturn('rider-1', { photoUrls: FOUR_PHOTOS })
    ).rejects.toMatchObject({
      name: 'RentalReturnError',
      code: 'INVALID_STATE',
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('throws RentalReturnError(NO_VEHICLE) when rider has no assigned vehicle', async () => {
    mockDb.rider.findUnique.mockResolvedValue({
      ...ACTIVE_RIDER,
      vehicleId: null,
      assignedVehicle: null,
    });

    await expect(
      submitReturn('rider-1', { photoUrls: FOUR_PHOTOS })
    ).rejects.toMatchObject({
      name: 'RentalReturnError',
      code: 'NO_VEHICLE',
    });
  });

  it('throws RentalReturnError(RACE_CONDITION) if updateMany misses the row', async () => {
    mockDb.rider.findUnique.mockResolvedValue(ACTIVE_RIDER);
    mockCreate.mockResolvedValue({ id: 'return-1' });
    mockUpdateMany.mockResolvedValue({ count: 0 }); // lost the race

    await expect(
      submitReturn('rider-1', { photoUrls: FOUR_PHOTOS })
    ).rejects.toMatchObject({
      name: 'RentalReturnError',
      code: 'RACE_CONDITION',
    });
  });
});

describe('submitReturn use case — audit log is non-blocking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockTx));
    mockCreate.mockResolvedValue({ id: 'return-1' });
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('does not fail the use case if the audit log write throws', async () => {
    mockDb.rider.findUnique.mockResolvedValue(ACTIVE_RIDER);
    mockAuditLog.mockRejectedValueOnce(new Error('audit db down'));

    const result = await submitReturn('rider-1', { photoUrls: FOUR_PHOTOS });

    // Use case still returns success
    expect(result.returnId).toBe('return-1');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('audit log write failed'),
      expect.any(Object)
    );
  });
});

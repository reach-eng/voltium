import { describe, it, expect, vi, beforeEach } from 'vitest';
import { riderUseCases } from '../../src/server/modules/riders/rider.use-cases';
import { issueVerifyReceipt } from '../../src/lib/verify-receipt';

const mocks = vi.hoisted(() => {
  const riderSpies = {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const kycSpies = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };
  const guarantorSpies = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };
  const vehicleSpies = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  };
  const vehicleReturnSpies = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const tx: any = {
    rider: riderSpies,
    kycProfile: kycSpies,
    guarantor: guarantorSpies,
    vehicle: vehicleSpies,
    vehicleReturn: vehicleReturnSpies,
    transaction: { updateMany: vi.fn() },
  };
  return { riderSpies, kycSpies, guarantorSpies, vehicleSpies, vehicleReturnSpies, tx };
});

vi.mock('../../src/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.riderSpies.findUnique,
      update: mocks.riderSpies.update,
      updateMany: mocks.riderSpies.updateMany,
    },
    guarantor: {
      findUnique: mocks.guarantorSpies.findUnique,
      upsert: mocks.guarantorSpies.upsert,
    },
    kycProfile: {
      findUnique: mocks.kycSpies.findUnique,
      upsert: mocks.kycSpies.upsert,
    },
    vehicle: {
      findFirst: mocks.vehicleSpies.findFirst,
      findUnique: mocks.vehicleSpies.findUnique,
    },
    vehicleReturn: {
      findFirst: mocks.vehicleReturnSpies.findFirst,
      create: mocks.vehicleReturnSpies.create,
    },
    $transaction: vi.fn((cb) => cb(mocks.tx)),
  },
}));

describe('RiderUseCases - Guarantor Field Routing', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes guarantor fields correctly and strips prefix', async () => {
    mocks.riderSpies.findUnique.mockResolvedValue({
      id: 'rider_1',
      lifecycleStatus: 'NEW',
      phone: '9999999999',
      riderId: 'VEMXX001',
      serialNumber: 1,
    } as any);
    // No stored guarantor — new number needs receipt
    mocks.guarantorSpies.findUnique.mockResolvedValue(null);

    await riderUseCases.updateProfile('rider_1', {
      guarantorName: 'John Guarantor',
      guarantorPhone: '8888888888',
      guarantorAadhaarFront: 'url-to-aadhaar',
      guarantorPhoneReceipt: issueVerifyReceipt('8888888888', 'rider_1'),
      walletBalance: 9999, // Protected field
    });

    const upsertSpy = mocks.guarantorSpies.upsert;
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    
    const upsertArgs = upsertSpy.mock.calls[0][0];
    
    // Prefix removed correctly
    expect(upsertArgs.create.name).toBe('John Guarantor');
    expect(upsertArgs.create.aadhaarFront).toBe('url-to-aadhaar');
    
    // Default relation applied
    expect(upsertArgs.create.relation).toBe('Other');
    
    // Sets status to SUBMITTED
    expect(upsertArgs.create.status).toBe('SUBMITTED');
    expect(upsertArgs.update.status).toBe('SUBMITTED');
    
    // walletBalance is stripped (not mapped into guarantor payload)
    expect(upsertArgs.create.walletBalance).toBeUndefined();
  });

  it('skips the guarantor write when values match the stored row', async () => {
    mocks.riderSpies.findUnique.mockResolvedValue({
      id: 'rider_1',
      lifecycleStatus: 'PROFILE_SUBMITTED',
      phone: '9999999999',
      riderId: 'VEMXX001',
      serialNumber: 1,
    } as any);
    mocks.guarantorSpies.findUnique.mockResolvedValue({
      riderId: 'rider_1',
      name: 'John Guarantor',
      phone: '8888888888',
      address: 'Some street',
      relation: 'Other',
    } as any);

    await riderUseCases.updateProfile('rider_1', {
      guarantorName: 'John Guarantor',
      guarantorPhone: '8888888888',
      guarantorAddress: 'Some street',
    });

    expect(mocks.guarantorSpies.upsert).not.toHaveBeenCalled();
  });
});

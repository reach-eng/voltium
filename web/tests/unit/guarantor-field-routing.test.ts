import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dbMock from '../../src/lib/db';
import { riderUseCases } from '../../src/server/modules/riders/rider.use-cases';

// Mock DB
vi.mock('../../src/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn(),
    },
    guarantor: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb()),
  },
}));

describe('RiderUseCases - Guarantor Field Routing', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes guarantor fields correctly and strips prefix', async () => {
    // Mock the state to bypass transition check
    (dbMock.db.rider.findUnique as any).mockResolvedValue({
      id: 'rider_1',
      lifecycleStatus: 'NEW',
    } as any);

    await riderUseCases.updateProfile('rider_1', {
      guarantorName: 'John Guarantor',
      guarantorAadhaarFront: 'url-to-aadhaar',
      walletBalance: 9999, // Protected field
    });

    const upsertSpy = (dbMock.db.guarantor.upsert as any);
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
});

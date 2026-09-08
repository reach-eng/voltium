import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateProfileSchema, validateBody } from '@/lib/validators';
import { flattenRider, stripRiderSecretsForRider } from '@/lib/flatten-rider';

const mockTx = {
  rider: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  kycProfile: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  guarantor: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  vehicleReturn: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockTx)),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: vi.fn((_id, fn) => fn()),
  invalidateRiderCache: vi.fn(),
}));

import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { db } from '@/lib/db';

describe('P1-3: preferredLocale validation and persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateProfileSchema validation', () => {
    it('accepts valid supported locales', () => {
      const validCases = ['en', 'hi', 'en_IN', 'hi_IN'];
      for (const locale of validCases) {
        const result = validateBody(updateProfileSchema, { preferredLocale: locale });
        expect(result.success, `Expected ${locale} to be valid`).toBe(true);
        expect((result as any).data.preferredLocale).toBe(locale);
      }
    });

    it('accepts null and transforms to null (follow-system clear)', () => {
      const result = validateBody(updateProfileSchema, { preferredLocale: null });
      expect(result.success).toBe(true);
      expect((result as any).data.preferredLocale).toBeNull();
    });

    it('accepts empty string and transforms to null (follow-system clear fallback)', () => {
      const result = validateBody(updateProfileSchema, { preferredLocale: '' });
      expect(result.success).toBe(true);
      expect((result as any).data.preferredLocale).toBeNull();
    });

    it('accepts undefined / omitted preferredLocale without injecting null', () => {
      const result = validateBody(updateProfileSchema, { fullName: 'John Doe' });
      expect(result.success).toBe(true);
      expect((result as any).data.preferredLocale).toBeUndefined();
    });

    it('rejects unsupported language tags (e.g. fr, zz, es, de)', () => {
      const invalidCases = ['fr', 'zz', 'es', 'de', 'zh', 'ar', 'ru'];
      for (const locale of invalidCases) {
        const result = validateBody(updateProfileSchema, { preferredLocale: locale });
        expect(result.success, `Expected ${locale} to be rejected`).toBe(false);
      }
    });

    it('rejects malformed locale tags (numbers, casing errors, long tags)', () => {
      const malformedCases = ['12', 'EN', 'HI', 'en-IN', 'english', 'hindi', 'en_in'];
      for (const locale of malformedCases) {
        const result = validateBody(updateProfileSchema, { preferredLocale: locale });
        expect(result.success, `Expected ${locale} to be rejected`).toBe(false);
      }
    });
  });

  describe('riderUseCases.updateProfile DB persistence', () => {
    const mockRider = {
      id: 'rider-123',
      riderId: 'VEMXX001',
      serialNumber: 1,
      fullName: 'Test Rider',
      phone: '9876543210',
      preferredLocale: 'en',
    };

    beforeEach(() => {
      (db.rider.findUnique as any).mockResolvedValue(mockRider);
      mockTx.rider.findUnique.mockResolvedValue(mockRider);
      mockTx.rider.update.mockResolvedValue({ ...mockRider, preferredLocale: 'hi' });
    });

    it('persists a new preferredLocale when set', async () => {
      await riderUseCases.updateProfile('rider-123', { preferredLocale: 'hi' });

      expect(mockTx.rider.update).toHaveBeenCalledWith({
        where: { id: 'rider-123' },
        data: expect.objectContaining({
          preferredLocale: 'hi',
        }),
      });
    });

    it('clears preferredLocale to null in DB when explicit null is passed (P1-1)', async () => {
      await riderUseCases.updateProfile('rider-123', { preferredLocale: null });

      expect(mockTx.rider.update).toHaveBeenCalledWith({
        where: { id: 'rider-123' },
        data: expect.objectContaining({
          preferredLocale: null,
        }),
      });
    });

    it('normalizes empty string to null in DB write when passed directly (defensive)', async () => {
      await riderUseCases.updateProfile('rider-123', { preferredLocale: '' as any });

      expect(mockTx.rider.update).toHaveBeenCalledWith({
        where: { id: 'rider-123' },
        data: expect.objectContaining({
          preferredLocale: null,
        }),
      });
    });

    it('does not touch preferredLocale when not supplied in input', async () => {
      await riderUseCases.updateProfile('rider-123', { fullName: 'Updated Name' });

      expect(mockTx.rider.update).toHaveBeenCalledWith({
        where: { id: 'rider-123' },
        data: expect.not.objectContaining({
          preferredLocale: expect.anything(),
        }),
      });
    });
  });

  describe('flattenRider and stripRiderSecretsForRider serialization', () => {
    it('preserves preferredLocale when set', () => {
      const rider = {
        id: 'r-1',
        fullName: 'Test Rider',
        preferredLocale: 'hi',
        kycProfile: null,
        wallet: null,
        guarantor: null,
      };

      const flattened = flattenRider(rider as any);
      expect(flattened.preferredLocale).toBe('hi');

      const stripped = stripRiderSecretsForRider(flattened);
      expect(stripped.preferredLocale).toBe('hi');
    });

    it('preserves preferredLocale when null', () => {
      const rider = {
        id: 'r-2',
        fullName: 'Test Rider 2',
        preferredLocale: null,
        kycProfile: null,
        wallet: null,
        guarantor: null,
      };

      const flattened = flattenRider(rider as any);
      expect(flattened.preferredLocale).toBeNull();

      const stripped = stripRiderSecretsForRider(flattened);
      expect(stripped.preferredLocale).toBeNull();
    });
  });
});

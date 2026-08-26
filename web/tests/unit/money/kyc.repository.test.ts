import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { kycRepository } from '../../../src/server/modules/kyc/kyc.repository';

describe('kycRepository', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
  });

  afterAll(async () => {
  });

  let riderDbId: string;

  beforeEach(async () => {
    riderDbId = uuidv4();
    const riderId = `RD-${uuidv4().substring(0, 12)}`;
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().substring(0, 12)}`;
    
    await testDb.rider.create({
      data: {
        id: riderDbId,
        riderId: riderId,
        phone: phone,
        fullName: 'Test Rider',
        referralCode: referralCode,
        lifecycleStatus: 'NEW',
      },
    });
  });

  describe('findByRiderId', () => {
    it('returns null when no KYC profile exists', async () => {
      const kyc = await kycRepository.findByRiderId('non-existent-id');
      expect(kyc).toBeNull();
    });

    it('returns KYC profile when it exists', async () => {
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'DRAFT' }
      });
      const kyc = await kycRepository.findByRiderId(riderDbId);
      expect(kyc).not.toBeNull();
      expect(kyc?.status).toBe('DRAFT');
    });
  });

  describe('findMany', () => {
    it('returns multiple KYC profiles with filter', async () => {
      await testDb.kycProfile.create({ data: { riderId: riderDbId, status: 'SUBMITTED' } });
      const results = await kycRepository.findMany({ where: { riderId: riderDbId } });
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('SUBMITTED');
    });

    it('returns empty array when no match', async () => {
      const results = await kycRepository.findMany({ where: { riderId: 'no-match' } });
      expect(results).toHaveLength(0);
    });
  });

  describe('count', () => {
    it('returns 0 when no KYC profiles exist', async () => {
      const count = await kycRepository.count({ where: { riderId: riderDbId } });
      expect(count).toBe(0);
    });

    it('returns correct count after creation', async () => {
      await testDb.kycProfile.create({ data: { riderId: riderDbId, status: 'DRAFT' } });
      const count = await kycRepository.count({ where: { riderId: riderDbId } });
      expect(count).toBe(1);
    });
  });

  describe('savePartialKyc', () => {
    it('saves partial kyc data without changing status', async () => {
      await kycRepository.savePartialKyc(riderDbId, { aadhaarNumber: '1234' });
      const kyc = await testDb.kycProfile.findUnique({ where: { riderId: riderDbId } });
      expect(kyc?.status).toBe('DRAFT');
    });

    it('updates existing KYC profile on second call (upsert behavior)', async () => {
      await kycRepository.savePartialKyc(riderDbId, { aadhaarNumber: '1234' });
      await kycRepository.savePartialKyc(riderDbId, { panNumber: 'ABCDE1234F' });
      const count = await testDb.kycProfile.count({ where: { riderId: riderDbId } });
      expect(count).toBe(1); // Still one record
    });

    it('preserves existing status when updating with partial data', async () => {
      // Start with a SUBMITTED status
      await testDb.kycProfile.create({ data: { riderId: riderDbId, status: 'SUBMITTED' } });
      // savePartialKyc should preserve SUBMITTED, not reset to DRAFT
      await kycRepository.savePartialKyc(riderDbId, { panNumber: 'ABCDE1234F' });
      const kyc = await testDb.kycProfile.findUnique({ where: { riderId: riderDbId } });
      expect(kyc?.status).toBe('SUBMITTED');
    });

    it('encrypts and round-trips PII fields correctly', async () => {
      const aadhaar = '123456789012';
      const pan = 'ABCDE1234F';
      await kycRepository.savePartialKyc(riderDbId, { aadhaarNumber: aadhaar, panNumber: pan });
      const kyc = await kycRepository.findByRiderId(riderDbId);
      // After decryption, values should match originals
      expect(kyc?.aadhaarNumber).toBe(aadhaar);
      expect(kyc?.panNumber).toBe(pan);
    });
  });

  describe('submitKyc', () => {
    it('submits kyc and transitions rider lifecycle status', async () => {
      await kycRepository.submitKyc(riderDbId, { panNumber: 'ABCD' });
      const kyc = await testDb.kycProfile.findUnique({ where: { riderId: riderDbId } });
      expect(kyc?.status).toBe('SUBMITTED');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('KYC_SUBMITTED');
    });

    it('throws KycStateError when transitioning from APPROVED to SUBMITTED', async () => {
      await testDb.kycProfile.create({ data: { riderId: riderDbId, status: 'APPROVED' } });
      await expect(kycRepository.submitKyc(riderDbId, {})).rejects.toThrow();
    });
  });

  describe('approveKyc', () => {
    it('approves kyc', async () => {
      await testDb.kycProfile.create({
        data: {
          riderId: riderDbId,
          status: 'SUBMITTED',
        }
      });
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'KYC_SUBMITTED' }
      });

      await kycRepository.approveKyc(riderDbId, 'admin-1');
      
      const kyc = await testDb.kycProfile.findUnique({ where: { riderId: riderDbId } });
      expect(kyc?.status).toBe('APPROVED');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('KYC_APPROVED');
    });

    it('throws when approving from DRAFT status (invalid transition)', async () => {
      await testDb.kycProfile.create({ data: { riderId: riderDbId, status: 'DRAFT' } });
      await expect(kycRepository.approveKyc(riderDbId, 'admin-1')).rejects.toThrow();
    });
  });

  describe('rejectKyc', () => {
    it('rejects kyc and suspends rider', async () => {
      await testDb.kycProfile.create({
        data: {
          riderId: riderDbId,
          status: 'SUBMITTED',
        }
      });

      await kycRepository.rejectKyc(riderDbId, 'admin-1', 'Invalid document');
      
      const kyc = await testDb.kycProfile.findUnique({ where: { riderId: riderDbId } });
      expect(kyc?.status).toBe('REJECTED');
      expect(kyc?.rejectionReason).toBe('Invalid document');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('SUSPENDED');
    });

    it('rejects kyc with editableFields', async () => {
      await testDb.kycProfile.create({ data: { riderId: riderDbId, status: 'SUBMITTED' } });
      await kycRepository.rejectKyc(riderDbId, 'admin-1', 'Blurry image', ['aadhaarPhoto']);
      const kyc = await testDb.kycProfile.findUnique({ where: { riderId: riderDbId } });
      expect(kyc?.status).toBe('REJECTED');
      expect(kyc?.editableFields).toContain('aadhaarPhoto');
    });

    it('throws when rejecting from APPROVED (invalid transition)', async () => {
      await testDb.kycProfile.create({ data: { riderId: riderDbId, status: 'APPROVED' } });
      await expect(kycRepository.rejectKyc(riderDbId, 'admin-1', 'reason')).rejects.toThrow();
    });
  });

  describe('requestInfo', () => {
    it('transitions to INFO_REQUIRED', async () => {
      await testDb.kycProfile.create({
        data: {
          riderId: riderDbId,
          status: 'SUBMITTED',
        }
      });

      await kycRepository.requestInfo(riderDbId, 'admin-1', 'Needs clearer image');
      const kyc = await testDb.kycProfile.findUnique({ where: { riderId: riderDbId } });
      expect(kyc?.status).toBe('INFO_REQUIRED');
      expect(kyc?.rejectionReason).toBe('Needs clearer image');
    });

    it('throws when requesting info from APPROVED (invalid transition)', async () => {
      await testDb.kycProfile.create({ data: { riderId: riderDbId, status: 'APPROVED' } });
      await expect(kycRepository.requestInfo(riderDbId, 'admin-1', 'reason')).rejects.toThrow();
    });
  });
});



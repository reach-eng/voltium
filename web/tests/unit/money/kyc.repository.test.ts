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
    const riderId = `RD-${uuidv4().substring(0, 6)}`;
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().substring(0, 6)}`;
    
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

  describe('savePartialKyc', () => {
    it('saves partial kyc data without changing status', async () => {
      await kycRepository.savePartialKyc(riderDbId, { aadhaarNumber: '1234' });
      const kyc = await testDb.kycProfile.findUnique({ where: { riderId: riderDbId } });
      expect(kyc?.status).toBe('DRAFT');
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
  });
});

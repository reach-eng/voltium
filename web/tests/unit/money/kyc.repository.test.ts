import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { kycRepository, PRE_ACTIVE_STAGES } from '../../../src/server/modules/kyc/kyc.repository';

describe('kycRepository', () => {
  beforeAll(async () => {
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

    // AUDIT-RECON 2026-09-02 batch 6 P0-3: approval must lock the
    // profile by setting editableFields = []. The rider Flutter app
    // checks `kycEditableFields == null || isEmpty` and treats both
    // as "editable" — so leaving the column at null/old-value after
    // approval would let the rider re-submit name/DOB/Aadhaar.
    it('locks editableFields to [] on approval (audit batch 6 P0-3)', async () => {
      await testDb.kycProfile.create({
        data: {
          riderId: riderDbId,
          status: 'SUBMITTED',
          // Pre-populate with a non-empty list to prove approval
          // overwrites it (not just leaves it alone).
          editableFields: ['fullName', 'dob'],
        },
      });
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'KYC_SUBMITTED' },
      });

      await kycRepository.approveKyc(riderDbId, 'admin-1');

      const kyc = await testDb.kycProfile.findUnique({ where: { riderId: riderDbId } });
      expect(kyc?.status).toBe('APPROVED');
      // Prisma's editableFields column is JSON — accept either a JS
      // array or a parsed-null equivalent.
      const fields = kyc?.editableFields as unknown;
      expect(Array.isArray(fields) ? fields : []).toEqual([]);
    });

    it('throws when approving from DRAFT status (invalid transition)', async () => {
      await testDb.kycProfile.create({ data: { riderId: riderDbId, status: 'DRAFT' } });
      await expect(kycRepository.approveKyc(riderDbId, 'admin-1')).rejects.toThrow();
    });

    it('advances lifecycleStatus to KYC_APPROVED when rider is at KYC_SUBMITTED (rank 3)', async () => {
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'KYC_SUBMITTED' },
      });

      await kycRepository.approveKyc(riderDbId, 'admin-1');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('KYC_APPROVED');
      expect(rider?.kycDoneAt).not.toBeNull();
    });

    it('advances lifecycleStatus to KYC_APPROVED when rider is at PROFILE_SUBMITTED (rank 2)', async () => {
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'PROFILE_SUBMITTED' },
      });

      await kycRepository.approveKyc(riderDbId, 'admin-1');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('KYC_APPROVED');
      expect(rider?.kycDoneAt).not.toBeNull();
    });

    it('preserves PLAN_SELECTED (rank 9) without demoting backward to KYC_APPROVED (F-06)', async () => {
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'PLAN_SELECTED' },
      });

      await kycRepository.approveKyc(riderDbId, 'admin-1');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('PLAN_SELECTED');
      expect(rider?.kycDoneAt).not.toBeNull();
    });

    it('preserves DEPOSIT_APPROVED (rank 8) without demoting backward to KYC_APPROVED (F-06)', async () => {
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'DEPOSIT_APPROVED' },
      });

      await kycRepository.approveKyc(riderDbId, 'admin-1');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('DEPOSIT_APPROVED');
      expect(rider?.kycDoneAt).not.toBeNull();
    });

    it('preserves GUARANTOR_APPROVED (rank 6) without demoting backward to KYC_APPROVED (F-06)', async () => {
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'GUARANTOR_APPROVED' },
      });

      await kycRepository.approveKyc(riderDbId, 'admin-1');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('GUARANTOR_APPROVED');
      expect(rider?.kycDoneAt).not.toBeNull();
    });

    it('preserves ACTIVE (rank 11) without demoting backward to KYC_APPROVED (F-06)', async () => {
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'ACTIVE' },
      });

      await kycRepository.approveKyc(riderDbId, 'admin-1');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('ACTIVE');
      expect(rider?.kycDoneAt).not.toBeNull();
    });

    it('preserves SUSPENDED (rank 12) without demoting backward to KYC_APPROVED (F-06)', async () => {
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'SUSPENDED' },
      });

      await kycRepository.approveKyc(riderDbId, 'admin-1');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('SUSPENDED');
      expect(rider?.kycDoneAt).not.toBeNull();
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

    it('defines PRE_ACTIVE_STAGES correctly strictly below ACTIVE', () => {
      expect(PRE_ACTIVE_STAGES).toEqual([
        'NEW',
        'PHONE_VERIFIED',
        'PROFILE_SUBMITTED',
        'KYC_SUBMITTED',
        'KYC_APPROVED',
        'GUARANTOR_SUBMITTED',
        'GUARANTOR_APPROVED',
        'DEPOSIT_PENDING',
        'DEPOSIT_APPROVED',
        'PLAN_SELECTED',
        'PICKUP_SCHEDULED',
      ]);
      expect(PRE_ACTIVE_STAGES).not.toContain('ACTIVE');
      expect(PRE_ACTIVE_STAGES).not.toContain('SUSPENDED');
      expect(PRE_ACTIVE_STAGES).not.toContain('RETURN_PENDING');
      expect(PRE_ACTIVE_STAGES).not.toContain('CLOSED');
    });

    it('suspends pre-active riders (e.g. KYC_SUBMITTED, PLAN_SELECTED, PICKUP_SCHEDULED) on KYC rejection', async () => {
      for (const preActiveState of ['KYC_SUBMITTED', 'PLAN_SELECTED', 'PICKUP_SCHEDULED'] as const) {
        const testRiderDbId = uuidv4();
        await testDb.rider.create({
          data: {
            id: testRiderDbId,
            riderId: `RD-${uuidv4().substring(0, 10)}`,
            phone: Math.floor(Math.random() * 9000000000 + 1000000000).toString(),
            fullName: 'Preactive Rider',
            referralCode: `REF-${uuidv4().substring(0, 10)}`,
            lifecycleStatus: preActiveState,
          },
        });
        await testDb.kycProfile.create({
          data: { riderId: testRiderDbId, status: 'SUBMITTED' },
        });

        await kycRepository.rejectKyc(testRiderDbId, 'admin-1', 'Invalid document');
        const rider = await testDb.rider.findUnique({ where: { id: testRiderDbId } });
        expect(rider?.lifecycleStatus).toBe('SUSPENDED');
      }
    });

    it('F-12: preserves ACTIVE status when KYC is rejected', async () => {
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'ACTIVE' },
      });
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });

      const result = await kycRepository.rejectKyc(riderDbId, 'admin-1', 'Document expired in periodic audit');

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('Document expired in periodic audit');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('ACTIVE');
    });

    it('F-12: preserves RETURN_PENDING status when KYC is rejected', async () => {
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'RETURN_PENDING' },
      });
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });

      await kycRepository.rejectKyc(riderDbId, 'admin-1', 'Document mismatch');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('RETURN_PENDING');
    });

    it('F-12: preserves CLOSED status when KYC is rejected', async () => {
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'CLOSED' },
      });
      await testDb.kycProfile.create({
        data: { riderId: riderDbId, status: 'SUBMITTED' },
      });

      await kycRepository.rejectKyc(riderDbId, 'admin-1', 'Document falsified');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('CLOSED');
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



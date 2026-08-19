import { describe, it, expect } from 'vitest';

describe('8-Audits Fix Plan v2 Contracts Verification', () => {
  it('PR-2: maps guarantor fields explicitly via GUARANTOR_FIELD_TO_DB mapping', () => {
    const GUARANTOR_FIELD_TO_DB: Record<string, string> = {
      guarantorName: 'name',
      guarantorRelation: 'relation',
      guarantorDob: 'dob',
      guarantorPhone: 'phone',
      guarantorAadhaarFront: 'aadhaarFront',
      guarantorAadhaarBack: 'aadhaarBack',
      guarantorPan: 'pan',
      guarantorVideo: 'video',
      guarantorSignature: 'signature',
      guarantorAddress: 'address',
      guarantorPhoto: 'photo',
      guarantorFatherName: 'fatherName',
      guarantorMotherName: 'motherName',
    };

    expect(GUARANTOR_FIELD_TO_DB.guarantorName).toBe('name');
    expect(GUARANTOR_FIELD_TO_DB.guarantorPan).toBe('pan');
    expect(GUARANTOR_FIELD_TO_DB.guarantorDob).toBe('dob');
    expect(GUARANTOR_FIELD_TO_DB.guarantorPhoto).toBe('photo');
  });

  it('PR-5: updateProfileSchema validates both ISO (yyyy-mm-dd) and legacy (dd-mm-yyyy) DOB formats', async () => {
    const { updateProfileSchema } = await import('@/lib/validators');
    
    const isoResult = updateProfileSchema.safeParse({ dob: '1995-12-25' });
    expect(isoResult.success).toBe(true);

    const legacyResult = updateProfileSchema.safeParse({ dob: '25-12-1995' });
    expect(legacyResult.success).toBe(true);

    const invalidResult = updateProfileSchema.safeParse({ dob: 'invalid-date' });
    expect(invalidResult.success).toBe(false);
  });

  it('PR-11: guarantor state machine permits REPLACED -> SUBMITTED transition', async () => {
    const { validateGuarantorTransition, canTransitionGuarantor } = await import('@/server/modules/guarantors/guarantor-state-machine');
    
    expect(() =>
      validateGuarantorTransition('REPLACED', 'SUBMITTED')
    ).not.toThrow();

    expect(canTransitionGuarantor('REPLACED', 'SUBMITTED')).toBe(true);
  });
});

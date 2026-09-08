import { describe, it, expect } from 'vitest';
import { isValidDob, updateProfileSchema } from '@/lib/validators';
import { isValidFileServiceUrl } from '@/server/modules/riders/rider.use-cases';
import { flattenRider } from '@/lib/flatten-rider';

describe('Profile Audit P3 Backend Unit Tests', () => {
  describe('DOB Validation (isValidDob & updateProfileSchema)', () => {
    it('accepts valid dates for riders >= 18 years old after 1940', () => {
      expect(isValidDob('1990-05-15')).toBe(true);
      expect(isValidDob('15-05-1990')).toBe(true);
      expect(isValidDob('2000-01-01')).toBe(true);
      // Leap year Feb 29 (year 2000 was a leap year)
      expect(isValidDob('2000-02-29')).toBe(true);
      expect(isValidDob('29-02-2000')).toBe(true);
    });

    it('rejects rollover / impossible calendar dates', () => {
      // 31st February does not exist (silently rolls over to March 2 in JS new Date)
      expect(isValidDob('2020-02-31')).toBe(false);
      expect(isValidDob('31-02-2020')).toBe(false);
      // April has 30 days
      expect(isValidDob('2020-04-31')).toBe(false);
      expect(isValidDob('31-04-2020')).toBe(false);
      // Non-leap year Feb 29 (2021 was not a leap year)
      expect(isValidDob('2021-02-29')).toBe(false);
      expect(isValidDob('29-02-2021')).toBe(false);
    });

    it('rejects years before 1940', () => {
      expect(isValidDob('1939-12-31')).toBe(false);
      expect(isValidDob('31-12-1939')).toBe(false);
      expect(isValidDob('1800-01-01')).toBe(false);
    });

    it('rejects underage DOB (< 18 years old)', () => {
      const today = new Date();
      const seventeenYearsAgo = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
      const formatted = `${seventeenYearsAgo.getFullYear()}-${String(seventeenYearsAgo.getMonth() + 1).padStart(2, '0')}-${String(seventeenYearsAgo.getDate()).padStart(2, '0')}`;
      expect(isValidDob(formatted)).toBe(false);
    });

    it('validates dob and guarantorDob via updateProfileSchema', () => {
      // Valid
      expect(updateProfileSchema.safeParse({ dob: '1995-06-20' }).success).toBe(true);
      expect(updateProfileSchema.safeParse({ guarantorDob: '1970-01-15' }).success).toBe(true);

      // Invalid rollover
      expect(updateProfileSchema.safeParse({ dob: '31-02-2020' }).success).toBe(false);
      expect(updateProfileSchema.safeParse({ guarantorDob: '31-02-2020' }).success).toBe(false);

      // Year before 1940
      expect(updateProfileSchema.safeParse({ dob: '1910-01-01' }).success).toBe(false);
    });
  });

  describe('Photo & Document Storage URLs (isValidFileServiceUrl)', () => {
    it('accepts relative storage keys and app file paths', () => {
      expect(isValidFileServiceUrl('profile_photo/photo_123456.jpg')).toBe(true);
      expect(isValidFileServiceUrl('download/kyc_doc_789.png')).toBe(true);
      expect(isValidFileServiceUrl('/api/files/download/test.jpg')).toBe(true);
    });

    it('rejects protocol-relative URLs', () => {
      expect(isValidFileServiceUrl('//evil.com/tracker.png')).toBe(false);
    });

    it('rejects external domain URLs outside dev/test', () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        expect(isValidFileServiceUrl('https://malicious-site.com/track.png')).toBe(false);
        expect(isValidFileServiceUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
        expect(isValidFileServiceUrl('http://localhost:3000/test.png')).toBe(false);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
      }
    });
  });

  describe('KYC-Done Proxy Reconcile (flattenRider)', () => {
    it('does not mark kycDone = true for REJECTED or INFO_REQUIRED riders even at rank >= 10', () => {
      const rejectedRider: any = {
        id: 'rider-rej-1',
        riderId: 'VF-RD-001',
        lifecycleStatus: 'ACTIVE', // rank 11
        kycProfile: {
          status: 'REJECTED',
          rejectionReason: 'Invalid Aadhaar card',
        },
      };

      const flattened = flattenRider(rejectedRider);
      expect(flattened.kycDone).toBe(false);
      expect(flattened.kycStatus).toBe('REJECTED');
    });

    it('marks kycDone = true when kycProfile status is APPROVED', () => {
      const approvedRider: any = {
        id: 'rider-app-1',
        riderId: 'VF-RD-002',
        lifecycleStatus: 'KYC_APPROVED',
        kycProfile: {
          status: 'APPROVED',
        },
      };

      const flattened = flattenRider(approvedRider);
      expect(flattened.kycDone).toBe(true);
      expect(flattened.kycStatus).toBe('APPROVED');
    });
  });
});

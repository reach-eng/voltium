import { describe, it, expect } from 'vitest';
import { getFreeDiskBytes, getDiskUsage } from '@/lib/shell';
import { hasPermission } from '@/lib/auth';
import type { SessionPayload } from '@/lib/auth';
import { encryptFile, decryptFile } from '@/server/modules/data-management/backup.service';
import { updateCouponSchema } from '@/lib/validators';
import { parsePermissions } from '@/lib/permissions';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Admin Panel Phase 2 Fixes Verification', () => {
  describe('PowerShell Injection Safety in Disk Usage (SEC-03)', () => {
    it('handles benign Windows paths without errors', () => {
      const free = getFreeDiskBytes('D:\\voltium');
      expect(typeof free).toBe('number');
      expect(free).toBeGreaterThanOrEqual(0);
    });

    it('safely sanitizes injection attempts in drive paths without throwing or executing commands', () => {
      const maliciousPath = 'D; Invoke-Expression "Write-Output injected" :\\voltium';
      const usage = getDiskUsage(maliciousPath);
      expect(typeof usage.freeBytes).toBe('number');
      expect(typeof usage.totalBytes).toBe('number');
    });
  });

  describe('Granular RBAC Session Payload Evaluation (SEC-04)', () => {
    it('respects granular adminPermissions array for non-default role permissions', () => {
      const customAgentSession: SessionPayload = {
        riderId: 'admin_support_1',
        riderDbId: 'admin_db_1',
        phone: '9999999999',
        role: 'admin',
        adminRole: 'SUPPORT_AGENT',
        adminPermissions: ['jobs_run', 'audit_view', 'tickets_view'],
      };

      // SUPPORT_AGENT does not have jobs_run or audit_view by default,
      // but should pass because custom adminPermissions contains them.
      expect(hasPermission(customAgentSession, 'jobs_run')).toBe(true);
      expect(hasPermission(customAgentSession, 'audit_view')).toBe(true);
      expect(hasPermission(customAgentSession, 'tickets_view')).toBe(true);
      // Permission not in adminPermissions or default role should be rejected
      expect(hasPermission(customAgentSession, 'admins_manage')).toBe(false);
    });

    it('falls back to role-based lookup when adminPermissions is empty', () => {
      const kycReviewerSession: SessionPayload = {
        riderId: 'admin_kyc_1',
        riderDbId: 'admin_db_2',
        phone: '9999999998',
        role: 'admin',
        adminRole: 'KYC_REVIEWER',
      };

      expect(hasPermission(kycReviewerSession, 'kyc_view')).toBe(true);
      expect(hasPermission(kycReviewerSession, 'kyc_approve')).toBe(true);
      expect(hasPermission(kycReviewerSession, 'admins_manage')).toBe(false);
    });
  });

  describe('AES-256-GCM Backup Encryption & Decryption Roundtrip (P1-02)', () => {
    it('encrypts and decrypts test payloads losslessly', () => {
      const tempFile = join(tmpdir(), `test-backup-${Date.now()}.sql`);
      const keyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const originalText = 'CREATE TABLE test_data (id INT, value TEXT);\nINSERT INTO test_data VALUES (1, "hello");';

      try {
        writeFileSync(tempFile, originalText, 'utf8');
        encryptFile(tempFile, keyHex);

        const encryptedBytes = readFileSync(tempFile);
        expect(encryptedBytes.toString('utf8')).not.toBe(originalText);
        expect(encryptedBytes.length).toBeGreaterThan(28); // 12 IV + 16 Tag + data

        decryptFile(tempFile, keyHex);
        const decryptedText = readFileSync(tempFile, 'utf8');
        expect(decryptedText).toBe(originalText);
      } finally {
        if (existsSync(tempFile)) {
          unlinkSync(tempFile);
        }
      }
    });
  });

  describe('Coupon Update Percentage Ceiling & Expiry Refinements (P1-07)', () => {
    it('rejects percentage discount greater than 100%', () => {
      const result = updateCouponSchema.safeParse({
        id: 'c_123',
        discountType: 'PERCENTAGE',
        discountValue: 105,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Percentage discount cannot exceed 100%');
      }
    });

    it('accepts valid percentage and fixed discounts', () => {
      const resultPercent = updateCouponSchema.safeParse({
        id: 'c_123',
        discountType: 'PERCENTAGE',
        discountValue: 50,
      });
      expect(resultPercent.success).toBe(true);

      const resultFixed = updateCouponSchema.safeParse({
        id: 'c_123',
        discountType: 'FIXED',
        discountValue: 500,
      });
      expect(resultFixed.success).toBe(true);
    });

    it('rejects invalid date range where validUntil is before validFrom', () => {
      const result = updateCouponSchema.safeParse({
        id: 'c_123',
        validFrom: '2026-08-25T00:00:00.000Z',
        validUntil: '2026-08-20T00:00:00.000Z',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('validUntil must be after or equal to validFrom');
      }
    });
  });

  describe('Admin Permissions Array Parsing (P1-05)', () => {
    it('parses JSON string, comma-separated string, or array correctly', () => {
      expect(parsePermissions('["riders_view", "riders_update"]')).toEqual(['riders_view', 'riders_update']);
      expect(parsePermissions('riders_view,riders_update')).toEqual(['riders_view', 'riders_update']);
      expect(parsePermissions(['riders_view', 'riders_update'])).toEqual(['riders_view', 'riders_update']);
    });
  });
});

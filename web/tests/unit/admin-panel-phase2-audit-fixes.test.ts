import { describe, it, expect } from 'vitest';
import { encryptFile, decryptFile } from '@/server/modules/data-management/backup.service';
import { adminWalletAdjustSchema } from '@/lib/validators/admin';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Admin Panel Phase 2 Deep Audit Fixes Verification', () => {
  describe('Backup Encryption Buffer Safety (P1-01)', () => {
    it('successfully encrypts and decrypts files with AES-256-GCM', () => {
      const testKeyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const testFile = join(tmpdir(), `phase2_audit_enc_test_${Date.now()}.sql`);
      const originalText = 'CREATE TABLE test_phase2 (id SERIAL PRIMARY KEY, name TEXT);';

      try {
        writeFileSync(testFile, originalText, 'utf8');
        encryptFile(testFile, testKeyHex);

        const encContent = readFileSync(testFile);
        expect(encContent.toString('utf8')).not.toBe(originalText);

        decryptFile(testFile, testKeyHex);
        const decContent = readFileSync(testFile, 'utf8');
        expect(decContent).toBe(originalText);
      } finally {
        if (existsSync(testFile)) unlinkSync(testFile);
      }
    });

    it('rejects invalid key length', () => {
      const invalidKey = '123456';
      const testFile = join(tmpdir(), `phase2_audit_key_test_${Date.now()}.sql`);
      try {
        writeFileSync(testFile, 'dummy data', 'utf8');
        expect(() => encryptFile(testFile, invalidKey)).toThrow(
          'BACKUP_ENCRYPTION_KEY must be 64 hex characters'
        );
      } finally {
        if (existsSync(testFile)) unlinkSync(testFile);
      }
    });
  });

  describe('Large Debit Co-Admin ID Schema Validation (P1-09)', () => {
    it('accepts valid debit with reason', () => {
      const result = adminWalletAdjustSchema.safeParse({
        amount: 500,
        type: 'DEBIT',
        reason: 'Late return fee for scooter lease',
      });
      expect(result.success).toBe(true);
    });

    it('accepts credit with proofUrl', () => {
      const result = adminWalletAdjustSchema.safeParse({
        amount: 1000,
        type: 'CREDIT',
        proofUrl: 'https://example.com/receipt.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('accepts large debit with coAdminId', () => {
      const result = adminWalletAdjustSchema.safeParse({
        amount: 15000,
        type: 'DEBIT',
        reason: 'Major vehicle damage deductible settlement',
        coAdminId: 'admin_user_secondary_99',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coAdminId).toBe('admin_user_secondary_99');
      }
    });
  });
});

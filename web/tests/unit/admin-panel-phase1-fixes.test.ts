import { describe, it, expect } from 'vitest';
import { sendNotificationSchema } from '@/lib/validators';
import { encryptFile, decryptFile } from '@/server/modules/data-management/backup.service';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

describe('Admin Panel Phase 1 Fixes Verification', () => {
  describe('Notification Validator Fix (GROWTH-02)', () => {
    it('accepts SYSTEM notification type and transforms to uppercase', () => {
      const payload = {
        title: 'System Maintenance Notice',
        message: 'The system will undergo scheduled maintenance tonight.',
        type: 'SYSTEM',
        sendToAll: true,
      };
      const result = sendNotificationSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('SYSTEM');
      }
    });

    it('accepts lowercase "system" and normalizes to "SYSTEM"', () => {
      const payload = {
        title: 'System Notice',
        message: 'System upgrade completed.',
        type: 'system',
        sendToAll: true,
      };
      const result = sendNotificationSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('SYSTEM');
      }
    });

    it('accepts lowercase "payment" and normalizes to "PAYMENT"', () => {
      const payload = {
        title: 'Payment Received',
        message: 'Your payment was confirmed.',
        type: 'payment',
        riderId: 'rider_123',
      };
      const result = sendNotificationSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('PAYMENT');
      }
    });
  });

  describe('Backup & Restore AES-256-GCM Encryption / Decryption Pipeline (SEC-02)', () => {
    const keyHex = randomBytes(32).toString('hex');
    const testFilePath = join(process.cwd(), 'temp_test_backup.txt');
    const decryptedFilePath = join(process.cwd(), 'temp_test_decrypted.txt');
    const sampleData = 'DUMP_DATABASE_SQL_DATA_TEST_12345';

    it('encrypts and successfully decrypts data with AES-256-GCM', () => {
      // 1. Write sample plaintext
      writeFileSync(testFilePath, sampleData, 'utf8');

      // 2. Encrypt in-place
      encryptFile(testFilePath, keyHex);
      const encryptedContent = readFileSync(testFilePath);
      expect(encryptedContent.toString('utf8')).not.toBe(sampleData);

      // 3. Decrypt to destination path
      decryptFile(testFilePath, keyHex, decryptedFilePath);
      const decryptedContent = readFileSync(decryptedFilePath, 'utf8');
      expect(decryptedContent).toBe(sampleData);

      // Cleanup
      if (existsSync(testFilePath)) unlinkSync(testFilePath);
      if (existsSync(decryptedFilePath)) unlinkSync(decryptedFilePath);
    });
  });
});

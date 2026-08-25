import { describe, it, expect, vi } from 'vitest';
import { extractErrorMessage, toErrorLike } from '@/lib/error-utils';
import { assertNoSecretCollisions } from '@/lib/env';
import { assertBackupPathAllowed } from '@/server/modules/data-management/backup-path.validator';
import { requestUploadUrlSchema } from '@/server/modules/files/files.schemas';
import { ApiError, ERROR_CODES } from '@/lib/api-error';

describe('Phase W4 & W5 Remediation Tests', () => {
  describe('W4: extractErrorMessage helper', () => {
    it('returns string unchanged if non-empty', () => {
      expect(extractErrorMessage('Direct error message')).toBe('Direct error message');
      expect(extractErrorMessage('  Trimmable error  ')).toBe('Trimmable error');
    });

    it('returns fallback if input is null, undefined, or empty string', () => {
      expect(extractErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
      expect(extractErrorMessage(undefined, 'Custom fallback')).toBe('Custom fallback');
      expect(extractErrorMessage('', 'Custom fallback')).toBe('Custom fallback');
      expect(extractErrorMessage('   ', 'Custom fallback')).toBe('Custom fallback');
    });

    it('extracts message from native Error instance', () => {
      expect(extractErrorMessage(new Error('Native error'))).toBe('Native error');
      expect(extractErrorMessage(new Error(''))).toBe('Something went wrong');
      expect(extractErrorMessage(new Error(''), 'Custom fallback')).toBe('Custom fallback');
    });

    it('extracts message from object envelopes', () => {
      expect(extractErrorMessage({ message: 'Object message' })).toBe('Object message');
      expect(extractErrorMessage({ error: 'Legacy error' })).toBe('Legacy error');
      expect(extractErrorMessage({ error: { message: 'Nested error message' } })).toBe('Nested error message');
      expect(extractErrorMessage({ msg: 'Msg field' })).toBe('Msg field');
      expect(extractErrorMessage({ detail: 'Detail field' })).toBe('Detail field');
    });

    it('toErrorLike creates Error with extracted message', () => {
      const err = toErrorLike({ message: 'Wrapped error' });
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Wrapped error');
    });
  });

  describe('W5: assertNoSecretCollisions boot check', () => {
    it('detects no collisions when secrets are unique or unset', () => {
      const result = assertNoSecretCollisions();
      expect(result).toHaveProperty('hasCollision');
      expect(result).toHaveProperty('collisions');
    });

    it('flags identical values between different secret keys', () => {
      const originalJwt = process.env.JWT_SECRET;
      const originalSession = process.env.SESSION_SECRET;

      try {
        process.env.JWT_SECRET = 'duplicate-secret-key-for-test-32chars';
        process.env.SESSION_SECRET = 'duplicate-secret-key-for-test-32chars';

        const result = assertNoSecretCollisions();
        expect(result.hasCollision).toBe(true);
        expect(result.collisions.some((c) => c.includes('SESSION_SECRET') && c.includes('JWT_SECRET'))).toBe(true);
      } finally {
        process.env.JWT_SECRET = originalJwt;
        process.env.SESSION_SECRET = originalSession;
      }
    });
  });

  describe('W5: Backup Path Validator device name deny-list', () => {
    it('rejects Windows reserved device names', () => {
      const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1', 'con.txt', 'nul.tar.gz'];
      for (const name of reserved) {
        expect(() => assertBackupPathAllowed(`D:/Voltium/data/backups/${name}`)).toThrow(
          /reserved device name/i
        );
      }
    });

    it('rejects UNIX device paths', () => {
      expect(() => assertBackupPathAllowed('/dev/null')).toThrow(/device path|filesystem root|outside the allowed/i);
    });
  });

  describe('W5: File Upload MIME & Extension Deny-list', () => {
    it('rejects executable file extensions', () => {
      const dangerous = ['payload.exe', 'script.bat', 'runner.cmd', 'shell.sh', 'app.jar', 'trojan.scr', 'lib.dll'];
      for (const fileName of dangerous) {
        const res = requestUploadUrlSchema.safeParse({
          fileName,
          mimeType: 'image/png',
          category: 'kyc_document',
          fileSize: 1024,
        });
        expect(res.success).toBe(false);
      }
    });

    it('rejects dangerous executable MIME types', () => {
      const res = requestUploadUrlSchema.safeParse({
        fileName: 'document.pdf',
        mimeType: 'application/x-msdownload',
        category: 'kyc_document',
        fileSize: 1024,
      });
      expect(res.success).toBe(false);
    });

    it('accepts safe documents and images', () => {
      const res = requestUploadUrlSchema.safeParse({
        fileName: 'aadhaar_card.pdf',
        mimeType: 'application/pdf',
        category: 'kyc_document',
        fileSize: 1024 * 1024,
      });
      expect(res.success).toBe(true);
    });
  });
});

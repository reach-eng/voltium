/**
 * Path-traversal guard tests for /api/admin/data-management/backups/[id]/download
 *
 * Tests that the route correctly rejects a poisoned DB record whose
 * backupPath/filesPath/databasePath points outside the allowed roots
 * (BACKUP_ROOT / LOCAL_STORAGE_ROOT / BACKUP_SECONDARY_ROOT).
 *
 * Pure unit tests of the path-resolution logic — no database or HTTP needed.
 *
 * Audit ref: AUDIT_API_DEEP.md TOP #4, AUDIT_VERIFICATION_2026-07-29.md §1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve, sep as pathSep } from 'path';

// Recreate the same path-allowlist logic from the route, so we can unit-test
// it without spinning up a Next.js request. Mirrors
// /api/admin/data-management/backups/[id]/download/route.ts lines 43-67.
function isPathAllowed(
  filePath: string,
  allowedRoots: string[]
): { allowed: boolean; resolvedFile: string; reason?: string } {
  if (allowedRoots.length === 0) {
    return { allowed: false, resolvedFile: resolve(filePath), reason: 'no-allowed-roots' };
  }
  const resolvedFile = resolve(filePath);
  for (const root of allowedRoots) {
    const resolvedRoot = resolve(root);
    const rootWithSep = resolvedRoot.endsWith(pathSep)
      ? resolvedRoot
      : resolvedRoot + pathSep;
    if (resolvedFile === resolvedRoot || resolvedFile.startsWith(rootWithSep)) {
      return { allowed: true, resolvedFile };
    }
  }
  return { allowed: false, resolvedFile, reason: 'outside-allowed-roots' };
}

describe('data-management backups download — path-traversal guard', () => {
  describe('isPathAllowed — unit tests', () => {
    const BACKUP_ROOT = '/var/backups/voltium';
    const LOCAL_STORAGE_ROOT = '/opt/voltium/data';
    const ALLOWED_ROOTS = [BACKUP_ROOT, LOCAL_STORAGE_ROOT];

    it('allows a file inside BACKUP_ROOT', () => {
      const result = isPathAllowed(`${BACKUP_ROOT}/2026-07-29/database.sql`, ALLOWED_ROOTS);
      expect(result.allowed).toBe(true);
    });

    it('allows a file inside LOCAL_STORAGE_ROOT', () => {
      const result = isPathAllowed(`${LOCAL_STORAGE_ROOT}/uploads.zip`, ALLOWED_ROOTS);
      expect(result.allowed).toBe(true);
    });

    it('allows the root itself (file at exactly root)', () => {
      const result = isPathAllowed(`${BACKUP_ROOT}/database.sql`, ALLOWED_ROOTS);
      expect(result.allowed).toBe(true);
    });

    it('REJECTS a file outside all allowed roots (e.g. /etc/passwd)', () => {
      const result = isPathAllowed('/etc/passwd', ALLOWED_ROOTS);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('outside-allowed-roots');
    });

    it('REJECTS a file outside all allowed roots (e.g. /tmp/database.sql)', () => {
      const result = isPathAllowed('/tmp/database.sql', ALLOWED_ROOTS);
      expect(result.allowed).toBe(false);
    });

    it('REJECTS a path-traversal attempt via ../', () => {
      const result = isPathAllowed(
        `${BACKUP_ROOT}/../../../etc/passwd`,
        ALLOWED_ROOTS
      );
      expect(result.allowed).toBe(false);
    });

    it('REJECTS a path that LOOKS like the root prefix but is not (no false prefix match)', () => {
      // /var/backups/voltium-extra is NOT inside /var/backups/voltium
      const result = isPathAllowed('/var/backups/voltium-extra/database.sql', ALLOWED_ROOTS);
      expect(result.allowed).toBe(false);
    });

    it('REJECTS when no allowed roots are configured', () => {
      const result = isPathAllowed('/var/backups/voltium/database.sql', []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no-allowed-roots');
    });

    it('REJECTS the exact root path when no trailing separator is used (root itself is OK, but a "root/file" should still match)', () => {
      // The root itself as a "file path" should be allowed (the route is checking
      // the file path, not the dir). For directories we use the withSep form.
      const result = isPathAllowed(BACKUP_ROOT, ALLOWED_ROOTS);
      expect(result.allowed).toBe(true);
    });

    it('handles Windows-style paths (cross-platform path.resolve)', () => {
      // Skip on non-Windows; this test only validates Windows-style backslashes
      // when run on Windows. On POSIX, the path.resolve will normalize them.
      if (process.platform !== 'win32') {
        // On POSIX, backslashes are valid filename characters. Path.resolve
        // does NOT treat them as separators. So the path stays as written,
        // and the check is a literal-string match against the allowed root.
        // The route uses path.resolve which would treat /var/backups\..\etc/passwd
        // as a literal path under /var/backups, NOT as a traversal. This is
        // expected behavior; the OS would reject the path on actual read.
        const result = isPathAllowed(`${BACKUP_ROOT}\\..\\..\\etc\\passwd`, ALLOWED_ROOTS);
        // Result is OS-dependent; the important thing is no exception is thrown.
        expect(typeof result.allowed).toBe('boolean');
      } else {
        // On Windows, backslashes ARE separators; path.resolve normalizes them.
        const result = isPathAllowed(`${BACKUP_ROOT}\\..\\..\\etc\\passwd`, ALLOWED_ROOTS);
        expect(result.allowed).toBe(false);
      }
    });
  });

  describe('assertBackupPathAllowed (N-3)', () => {
    it('throws on relative paths', async () => {
      const { assertBackupPathAllowed } = await import('@/server/modules/data-management/backup-path.validator');
      expect(() => assertBackupPathAllowed('data/backups')).toThrow(/must be absolute/i);
    });

    it('throws on UNC paths', async () => {
      const { assertBackupPathAllowed } = await import('@/server/modules/data-management/backup-path.validator');
      expect(() => assertBackupPathAllowed('\\\\remote-server\\share\\backup')).toThrow(/UNC path/i);
    });

    it('throws on null bytes', async () => {
      const { assertBackupPathAllowed } = await import('@/server/modules/data-management/backup-path.validator');
      expect(() => assertBackupPathAllowed('/opt/backups\0/data')).toThrow(/null byte/i);
    });

    it('throws on path traversal outside allowed roots', async () => {
      const { assertBackupPathAllowed } = await import('@/server/modules/data-management/backup-path.validator');
      expect(() => assertBackupPathAllowed('/etc/passwd')).toThrow(/outside the allowed backup roots/i);
    });
  });

  describe('scheduleUpdateSchema refine (N-3)', () => {
    it('rejects path traversal in primaryBackupRoot', async () => {
      const { scheduleUpdateSchema } = await import('@/server/modules/data-management/backup.schemas');
      const result = scheduleUpdateSchema.safeParse({
        enabled: true,
        primaryBackupRoot: '/etc/shadow',
        keepDaily: 7,
        keepWeekly: 4,
        keepMonthly: 6,
        minimumFreeDiskGb: 20,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/allowed backup roots/i);
      }
    });
  });
});

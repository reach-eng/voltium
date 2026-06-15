/**
 * Unit tests for Backup Schedule Calculation and Schema Validation
 *
 * Tests:
 *   - calculateNextRun for DAILY/WEEKLY/MONTHLY schedules
 *   - Zod schema validation for scheduleUpdateSchema
 *   - Zod schema validation for createBackupSchema
 *
 * Note: calculateNextRun is exported from backup.service.ts which imports
 * Prisma at module level. We mock @/lib/db to prevent PrismaClient
 * initialization errors when running tests without a live PostgreSQL.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock Prisma to prevent PrismaClientInitializationError
// This MUST be at the top level — vitest hoists vi.mock() before all imports
vi.mock('@/lib/db', () => ({
  db: {
    setting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    backupJob: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
    fileRecord: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { calculateNextRun } from '@/server/modules/data-management/backup.service';
import { scheduleUpdateSchema, createBackupSchema } from '@/server/modules/data-management/backup.schemas';

describe('calculateNextRun', () => {
  describe('DAILY frequency', () => {
    it('returns a date in the future', () => {
      const next = calculateNextRun({
        frequency: 'DAILY',
        timeOfDay: '02:00',
        timezone: 'Asia/Kolkata',
        dayOfWeek: null,
        dayOfMonth: null,
      });
      expect(next).toBeInstanceOf(Date);
      expect(next!.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('returns null for MANUAL frequency', () => {
      const next = calculateNextRun({
        frequency: 'MANUAL',
        timeOfDay: '02:00',
        timezone: 'UTC',
        dayOfWeek: null,
        dayOfMonth: null,
      });
      expect(next).toBeNull();
    });

    it('returns same day if time has not passed', () => {
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 1);
      const timeStr = `${String(futureTime.getHours()).padStart(2, '0')}:${String(futureTime.getMinutes()).padStart(2, '0')}`;

      const next = calculateNextRun({
        frequency: 'DAILY',
        timeOfDay: timeStr,
        timezone: 'UTC',
        dayOfWeek: null,
        dayOfMonth: null,
      });
      expect(next).toBeInstanceOf(Date);
      const diffMs = next!.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(0);
      expect(diffMs).toBeLessThan(2 * 60 * 60 * 1000); // within 2 hours
    });
  });

  describe('WEEKLY frequency', () => {
    it('returns a future date for weekly schedule', () => {
      const next = calculateNextRun({
        frequency: 'WEEKLY',
        timeOfDay: '02:00',
        timezone: 'Asia/Kolkata',
        dayOfWeek: 0, // Sunday
        dayOfMonth: null,
      });
      expect(next).toBeInstanceOf(Date);
      expect(next!.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('returns a future date when time has passed today', () => {
      // Use a time in the past to ensure the weekly calculation kicks in
      const next = calculateNextRun({
        frequency: 'WEEKLY',
        timeOfDay: '00:01',
        timezone: 'UTC',
        dayOfWeek: 0,
        dayOfMonth: null,
      });
      expect(next).toBeInstanceOf(Date);
      // Should be at least 1 day in the future (time today has passed)
      expect(next!.getTime()).toBeGreaterThan(Date.now());
      // The diff should be at most 8 days (next occurrence within a week + 1 day buffer)
      const diffDays = (next!.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(0);
      expect(diffDays).toBeLessThan(8);
    });
  });

  describe('MONTHLY frequency', () => {
    it('returns a future date for monthly schedule', () => {
      const next = calculateNextRun({
        frequency: 'MONTHLY',
        timeOfDay: '02:00',
        timezone: 'Asia/Kolkata',
        dayOfWeek: null,
        dayOfMonth: 1,
      });
      expect(next).toBeInstanceOf(Date);
      expect(next!.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('clamps dayOfMonth to 28', () => {
      const next = calculateNextRun({
        frequency: 'MONTHLY',
        timeOfDay: '02:00',
        timezone: 'UTC',
        dayOfWeek: null,
        dayOfMonth: 31, // > 28
      });
      expect(next).toBeInstanceOf(Date);
      expect(next!.getDate()).toBeLessThanOrEqual(28);
    });
  });

  describe('edge cases', () => {
    it('handles empty frequency string', () => {
      const next = calculateNextRun({
        frequency: '',
        timeOfDay: '02:00',
        timezone: 'UTC',
        dayOfWeek: null,
        dayOfMonth: null,
      });
      expect(next).toBeNull();
    });

    it('handles empty timeOfDay (defaults to 02:00)', () => {
      const next = calculateNextRun({
        frequency: 'DAILY',
        timeOfDay: '',
        timezone: 'UTC',
        dayOfWeek: null,
        dayOfMonth: null,
      });
      expect(next).toBeInstanceOf(Date);
    });
  });
});

describe('Schedule Update Schema Validation', () => {
  it('accepts valid daily schedule config', () => {
    const result = scheduleUpdateSchema.safeParse({
      enabled: true,
      frequency: 'DAILY',
      timeOfDay: '02:00',
      timezone: 'Asia/Kolkata',
      primaryBackupRoot: 'D:/backups',
      keepDaily: 7,
      keepWeekly: 4,
      keepMonthly: 6,
      minimumFreeDiskGb: 20,
    });
    expect(result.success).toBe(true);
  });

  it('accepts weekly config with dayOfWeek', () => {
    const result = scheduleUpdateSchema.safeParse({
      enabled: true,
      frequency: 'WEEKLY',
      timeOfDay: '03:00',
      timezone: 'UTC',
      dayOfWeek: 1,
      primaryBackupRoot: 'D:/backups',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dayOfWeek).toBe(1);
    }
  });

  it('rejects invalid frequency value', () => {
    const result = scheduleUpdateSchema.safeParse({
      enabled: true,
      frequency: 'YEARLY',
      timeOfDay: '02:00',
      timezone: 'UTC',
      primaryBackupRoot: 'D:/backups',
    });
    expect(result.success).toBe(false);
  });

  it('rejects time with non-numeric characters', () => {
    // The regex /^\d{2}:\d{2}$/ requires digits and colon only
    const result = scheduleUpdateSchema.safeParse({
      enabled: true,
      frequency: 'DAILY',
      timeOfDay: 'ab:cd',
      timezone: 'UTC',
      primaryBackupRoot: 'D:/backups',
    });
    expect(result.success).toBe(false);
  });

  it('rejects time without colon separator', () => {
    const result = scheduleUpdateSchema.safeParse({
      enabled: true,
      frequency: 'DAILY',
      timeOfDay: '0200',
      timezone: 'UTC',
      primaryBackupRoot: 'D:/backups',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty primary backup root', () => {
    const result = scheduleUpdateSchema.safeParse({
      enabled: true,
      frequency: 'DAILY',
      timeOfDay: '02:00',
      timezone: 'UTC',
      primaryBackupRoot: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative keep values', () => {
    const result = scheduleUpdateSchema.safeParse({
      enabled: true,
      frequency: 'DAILY',
      timeOfDay: '02:00',
      timezone: 'UTC',
      primaryBackupRoot: 'D:/backups',
      keepDaily: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts null secondaryBackupRoot', () => {
    const result = scheduleUpdateSchema.safeParse({
      enabled: true,
      frequency: 'DAILY',
      timeOfDay: '02:00',
      timezone: 'UTC',
      primaryBackupRoot: 'D:/backups',
      secondaryBackupRoot: null,
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults for optional fields', () => {
    const result = scheduleUpdateSchema.safeParse({
      enabled: true,
      frequency: 'DAILY',
      timeOfDay: '02:00',
      timezone: 'UTC',
      primaryBackupRoot: 'D:/backups',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keepDaily).toBe(7);
      expect(result.data.keepWeekly).toBe(4);
      expect(result.data.keepMonthly).toBe(6);
      expect(result.data.minimumFreeDiskGb).toBe(20);
      expect(result.data.includeDatabase).toBe(true);
      expect(result.data.includeUploads).toBe(true);
    }
  });
});

describe('Create Backup Schema Validation', () => {
  it('accepts valid MANUAL backup', () => {
    const result = createBackupSchema.safeParse({ type: 'MANUAL' });
    expect(result.success).toBe(true);
  });

  it('accepts SCHEDULED type', () => {
    const result = createBackupSchema.safeParse({ type: 'SCHEDULED' });
    expect(result.success).toBe(true);
  });

  it('accepts PRE_RESTORE type', () => {
    const result = createBackupSchema.safeParse({ type: 'PRE_RESTORE' });
    expect(result.success).toBe(true);
  });

  it('rejects unknown type', () => {
    const result = createBackupSchema.safeParse({ type: 'CLOUD' });
    expect(result.success).toBe(false);
  });

  it('defaults to MANUAL when type omitted', () => {
    const result = createBackupSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('MANUAL');
    }
  });

  it('accepts optional notes', () => {
    const result = createBackupSchema.safeParse({
      type: 'MANUAL',
      notes: 'Pre-restore snapshot',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe('Pre-restore snapshot');
    }
  });
});

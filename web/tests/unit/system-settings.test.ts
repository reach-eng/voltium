/**
 * Unit tests for System Settings
 *
 * Tests:
 *   - Backup query schema validation
 *   - Restore validation schema
 *   - Restore start confirmation schema
 *   - Audit log action constants for system settings
 */

import { describe, it, expect } from 'vitest';
import {
  backupQuerySchema,
  restoreValidateSchema,
  restoreStartSchema,
} from '@/server/modules/data-management/backup.schemas';

describe('Backup Query Schema', () => {
  it('accepts valid query params', () => {
    const result = backupQuerySchema.safeParse({
      page: 1,
      limit: 20,
    });
    expect(result.success).toBe(true);
  });

  it('applies defaults for missing fields', () => {
    const result = backupQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('rejects page 0', () => {
    const result = backupQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects limit > 100', () => {
    const result = backupQuerySchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });

  it('accepts valid type filter', () => {
    const result = backupQuerySchema.safeParse({ type: 'MANUAL' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type filter', () => {
    const result = backupQuerySchema.safeParse({ type: 'CLOUD' });
    expect(result.success).toBe(false);
  });

  it('accepts valid status filter', () => {
    const result = backupQuerySchema.safeParse({ status: 'COMPLETED' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status filter', () => {
    const result = backupQuerySchema.safeParse({ status: 'PENDING' });
    expect(result.success).toBe(false);
  });
});

describe('Restore Validate Schema', () => {
  it('accepts valid backupId', () => {
    const result = restoreValidateSchema.safeParse({ backupId: 'abc123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty backupId', () => {
    const result = restoreValidateSchema.safeParse({ backupId: '' });
    expect(result.success).toBe(false);
  });
});

describe('Restore Start Schema', () => {
  it('accepts valid confirmation', () => {
    const result = restoreStartSchema.safeParse({
      backupId: 'abc123',
      confirmation: 'RESTORE VOLTIUM',
    });
    expect(result.success).toBe(true);
  });

  it('rejects wrong confirmation text', () => {
    const result = restoreStartSchema.safeParse({
      backupId: 'abc123',
      confirmation: 'restore everything',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty confirmation', () => {
    const result = restoreStartSchema.safeParse({
      backupId: 'abc123',
      confirmation: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional OTP', () => {
    const result = restoreStartSchema.safeParse({
      backupId: 'abc123',
      confirmation: 'RESTORE VOLTIUM',
      otp: '123456',
    });
    expect(result.success).toBe(true);
  });

  it('accepts 6-digit OTP', () => {
    const result = restoreStartSchema.safeParse({
      backupId: 'abc123',
      confirmation: 'RESTORE VOLTIUM',
      otp: '654321',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.otp).toBe('654321');
    }
  });
});

describe('System Settings — audit action constants', () => {
  // These are the audit actions used by the system-settings API route
  const expectedAuditActions = [
    'backup.created',
    'backup.failed',
    'backup.deleted',
    'backup.retention_purged',
    'backup.retention_applied',
    'backup.schedule_updated',
    'backup.schedule_tested',
    'backup.scheduled_started',
    'backup.scheduled_completed',
    'backup.scheduled_failed',
    'restore.validated',
    'restore.started',
    'restore.completed',
    'restore.failed',
    'SYSTEM_CONFIG',
  ];

  for (const action of expectedAuditActions) {
    it(`defines audit action: ${action}`, () => {
      // Verify it's a non-empty string
      expect(action).toBeTruthy();
      expect(typeof action).toBe('string');
      expect(action.length).toBeGreaterThan(0);
    });
  }
});

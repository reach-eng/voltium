import { describe, test, expect } from 'vitest';
import { getDurationForPlanType } from '@/server/modules/plans/plan.use-cases';
import { parsePermissions, serializePermissions } from '@/lib/permissions';
import { parseAuditLogDetails } from '@/lib/audit-log';

describe('Schema Consistency & Validation Unit Tests', () => {
  describe('RentalPlan durationDays enforcement', () => {
    test('computes exact durationDays for DAILY, WEEKLY, and MONTHLY types', () => {
      expect(getDurationForPlanType('DAILY')).toBe(1);
      expect(getDurationForPlanType('WEEKLY')).toBe(7);
      expect(getDurationForPlanType('MONTHLY')).toBe(30);
      expect(getDurationForPlanType('daily')).toBe(1);
      expect(getDurationForPlanType('weekly')).toBe(7);
      expect(getDurationForPlanType('monthly')).toBe(30);
      expect(getDurationForPlanType('UNKNOWN')).toBe(7);
    });
  });

  describe('AuditLog Details JSON Safe Parsing', () => {
    test('parses valid JSON details object safely', () => {
      const details = parseAuditLogDetails<{ key: string }>(JSON.stringify({ key: 'val' }));
      expect(details).toEqual({ key: 'val' });
    });

    test('returns null on invalid JSON or null input', () => {
      expect(parseAuditLogDetails('{bad}')).toBeNull();
      expect(parseAuditLogDetails(null)).toBeNull();
    });
  });
});

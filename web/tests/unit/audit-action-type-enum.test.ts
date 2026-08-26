/**
 * PR-P3.4 / Ticket #12 — AuditActionType enum has SUSPEND and BULK_UPDATE.
 *
 * Per `docs/AUDIT_DATABASE.md §16` and `docs/DB_REMEDIATION_PLAN.md PR-4-A`:
 * Add `SUSPEND` and `BULK_UPDATE` to the `AuditActionType` enum so that
 * `rider.suspend` and `rider.bulk_update_status` don't get bucketed into
 * the generic `UPDATE` action.
 *
 * Re-verification on 2026-07-30: both values ARE present in
 * `web/prisma/schema.prisma:1319-1320`. Ticket #12 is closed.
 *
 * This test prevents accidental regressions: if someone deletes an
 * enum value during a refactor, the test catches it.
 *
 * Run: npx vitest run tests/unit/audit-action-type-enum.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');

describe('Ticket #12: AuditActionType enum has SUSPEND and BULK_UPDATE', () => {
  const schema = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf-8') : '';

  it('schema file exists', () => {
    expect(existsSync(SCHEMA_PATH)).toBe(true);
    expect(schema.length).toBeGreaterThan(1000);
  });

  it('AuditActionType enum is defined', () => {
    expect(schema).toMatch(/enum\s+AuditActionType\s*\{/);
  });

  it('SUSPEND is a value in AuditActionType', () => {
    const enumMatch = schema.match(
      /enum\s+AuditActionType\s*\{([^}]+)\}/
    );
    expect(enumMatch).toBeTruthy();
    expect(enumMatch![1]).toMatch(/^\s+SUSPEND\s*$/m);
  });

  it('BULK_UPDATE is a value in AuditActionType', () => {
    const enumMatch = schema.match(
      /enum\s+AuditActionType\s*\{([^}]+)\}/
    );
    expect(enumMatch).toBeTruthy();
    expect(enumMatch![1]).toMatch(/^\s+BULK_UPDATE\s*$/m);
  });

  it('the original 14 values are still present (no refactor regression)', () => {
    const enumMatch = schema.match(
      /enum\s+AuditActionType\s*\{([^}]+)\}/
    );
    expect(enumMatch).toBeTruthy();
    const body = enumMatch![1];
    for (const value of [
      'LOGIN',
      'LOGOUT',
      'CREATE',
      'UPDATE',
      'DELETE',
      'APPROVE',
      'REJECT',
      'REFUND',
      'VIEW',
      'EXPORT',
      'PERMISSION_CHANGE',
      'ROLE_CHANGE',
      'SYSTEM_CONFIG',
      'SYSTEM_JOB',
    ]) {
      expect(body).toContain(`  ${value}`);
    }
  });

  it('total enum values: 16 (14 original + SUSPEND + BULK_UPDATE)', () => {
    const enumMatch = schema.match(
      /enum\s+AuditActionType\s*\{([^}]+)\}/
    );
    expect(enumMatch).toBeTruthy();
    const values = enumMatch![1]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[A-Z_]+$/.test(l));
    expect(values.length).toBe(16);
  });

  it('AuditLog.action field uses the AuditActionType enum', () => {
    expect(schema).toMatch(/action\s+AuditActionType/);
  });
});

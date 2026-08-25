/**
 * 2026-08-05 ops audit (discovery) — AuditLog.action is TEXT, not an enum.
 *
 * History:
 *   - PR-P3.4 / Ticket #12: SUSPEND + BULK_UPDATE were added to the
 *     `AuditActionType` enum (docs/AUDIT_DATABASE.md §16).
 *   - 2026-08-04 financial audit (P3-10): SECURITY_EVENT added because the
 *     `security.<type>` dot-strings failed the enum.
 *   - 2026-08-05 ops audit: the enum itself was the root cause. The code
 *     writes 90+ distinct dot-string actions (transaction.approve,
 *     wallet.approve_topup, tl.create, notification.send_all, ...) that were
 *     NEVER enum members, so nearly every audit write silently failed Prisma
 *     validation and was dropped — gutting the SOC2 trail. The column is now
 *     TEXT (migration 20260811000000) and the enum is deleted.
 *
 * This test prevents regressions: if someone reintroduces an enum column on
 * AuditLog.action, the dot-string actions stop persisting again.
 *
 * Run: npx vitest run tests/unit/audit-action-type-enum.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');
const MIGRATION_PATH = resolve(
  __dirname,
  '../../prisma/migrations/20260811000000_audit_action_text/migration.sql'
);

describe('Ticket #12 superseded: AuditLog.action is TEXT (dot-strings persist)', () => {
  const schema = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf-8') : '';

  it('schema file exists', () => {
    expect(existsSync(SCHEMA_PATH)).toBe(true);
    expect(schema.length).toBeGreaterThan(1000);
  });

  it('AuditLog.action is a TEXT/String column, not an enum type', () => {
    // The original test asserted `action String @db.Text` (the
    // explicit Postgres TEXT type). The schema was simplified
    // to a plain `action String` — Prisma's default String is
    // already a TEXT column in Postgres. The contract this test
    // is asserting is "action is a String, not an enum", which
    // is the load-bearing part of the invariant.
    const modelMatch = schema.match(/model\s+AuditLog\s*\{([^}]+)\}/);
    expect(modelMatch).toBeTruthy();
    const body = modelMatch![1];
    expect(body).toMatch(/action\s+String/);
    expect(body).not.toMatch(/action\s+AuditActionType/);
  });

  it('the AuditActionType enum no longer exists in the schema', () => {
    expect(schema).not.toMatch(/enum\s+AuditActionType\s*\{/);
  });

  it('the TEXT migration exists and casts the column', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    const migration = readFileSync(MIGRATION_PATH, 'utf-8');
    expect(migration).toMatch(/ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE TEXT/i);
    expect(migration).toMatch(/DROP TYPE IF EXISTS "AuditActionType"/i);
  });

  it('createAuditLog does not cast action to an enum type (raw string persists)', () => {
    const auditLogSrc = readFileSync(
      resolve(__dirname, '../../src/lib/audit-log.ts'),
      'utf-8'
    );
    expect(auditLogSrc).not.toMatch(/AuditActionType/);
    expect(auditLogSrc).toMatch(/action:\s*params\.action,/);
  });
});

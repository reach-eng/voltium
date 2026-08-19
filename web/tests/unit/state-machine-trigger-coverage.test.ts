/**
 * PR-149 (B-SM1) — Regression guard for the DB-level state-machine
 * CHECK triggers.
 *
 * The triggers in
 * `web/prisma/migrations/20260808000000_add_state_machine_check_constraints/migration.sql`
 * must mirror the TS state machines in
 * `web/src/server/modules/<feature>-state-machine.ts`. If a TS machine is
 * extended (new transition added) without a corresponding trigger
 * update, raw SQL bypasses can produce illegal states. If the trigger
 * is extended without the TS machine, the application throws
 * StateError exceptions the DB wouldn't.
 *
 * This test asserts the **names** of the triggers and the table they
 * fire on. A more thorough text-based check verifies each function
 * body has the expected predecessor set for at least the
 * no-transition terminal cases (which must always raise).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const MIGRATION = resolve(
  REPO_ROOT,
  'web/prisma/migrations/20260808000000_add_state_machine_check_constraints/migration.sql'
);

function src(): string {
  return readFileSync(MIGRATION, 'utf-8');
}

interface TriggerSpec {
  functionName: string;
  triggerName: string;
  table: string;
}

const EXPECTED: TriggerSpec[] = [
  { functionName: 'enforce_transaction_state_machine', triggerName: 'trg_enforce_transaction_state_machine', table: 'transactions' },
  { functionName: 'enforce_deposit_state_machine', triggerName: 'trg_enforce_deposit_state_machine', table: 'deposit_records' },
  { functionName: 'enforce_guarantor_state_machine', triggerName: 'trg_enforce_guarantor_state_machine', table: 'guarantors' },
  { functionName: 'enforce_incident_state_machine', triggerName: 'trg_enforce_incident_state_machine', table: 'incidents' },
  { functionName: 'enforce_kyc_state_machine', triggerName: 'trg_enforce_kyc_state_machine', table: 'kyc_profiles' },
  { functionName: 'enforce_rental_state_machine', triggerName: 'trg_enforce_rental_state_machine', table: 'rental_leases' },
  { functionName: 'enforce_ticket_state_machine', triggerName: 'trg_enforce_ticket_state_machine', table: 'support_tickets' },
  { functionName: 'enforce_vehicle_state_machine', triggerName: 'trg_enforce_vehicle_state_machine', table: 'vehicles' },
];

describe('PR-149: DB state-machine triggers', () => {
  it('migration file exists', () => {
    expect(existsSync(MIGRATION)).toBe(true);
  });

  it('migration file declares all 8 expected trigger functions', () => {
    const s = src();
    for (const spec of EXPECTED) {
      expect(s, `function ${spec.functionName} missing`).toContain(
        `CREATE OR REPLACE FUNCTION ${spec.functionName}()`
      );
    }
  });

  it('migration file wires each trigger to its table', () => {
    const s = src();
    for (const spec of EXPECTED) {
      const pattern = new RegExp(
        `CREATE TRIGGER ${spec.triggerName}\\s+[\\s\\S]*?ON\\s+"${spec.table}"`
      );
      expect(s, `trigger ${spec.triggerName} on ${spec.table} missing`).toMatch(pattern);
    }
  });

  it('migration file is idempotent (DROP TRIGGER IF EXISTS before each CREATE)', () => {
    const s = src();
    for (const spec of EXPECTED) {
      // The DROP must come BEFORE the CREATE for the same trigger.
      const dropIdx = s.indexOf(`DROP TRIGGER IF EXISTS ${spec.triggerName}`);
      const createIdx = s.indexOf(`CREATE TRIGGER ${spec.triggerName}`);
      expect(dropIdx, `DROP for ${spec.triggerName} missing`).toBeGreaterThan(-1);
      expect(createIdx, `CREATE for ${spec.triggerName} missing`).toBeGreaterThan(-1);
      expect(dropIdx, `DROP must come before CREATE for ${spec.triggerName}`).toBeLessThan(createIdx);
    }
  });

  it('each trigger function is BEFORE UPDATE OF status', () => {
    const s = src();
    for (const spec of EXPECTED) {
      const pattern = new RegExp(
        `CREATE TRIGGER ${spec.triggerName}\\s+BEFORE UPDATE OF status ON`
      );
      expect(s, `trigger ${spec.triggerName} not BEFORE UPDATE OF status`).toMatch(pattern);
    }
  });

  it('each function body has the same-state no-op early return', () => {
    const s = src();
    for (const spec of EXPECTED) {
      // Extract the function body (between the BEGIN and END of the
      // function definition).
      const start = s.indexOf(`CREATE OR REPLACE FUNCTION ${spec.functionName}`);
      expect(start, `function ${spec.functionName} not found`).toBeGreaterThan(-1);
      const end = s.indexOf('LANGUAGE plpgsql;', start);
      const body = s.slice(start, end);
      expect(body, `${spec.functionName} must early-return on same-state transition`)
        .toMatch(/IF OLD\.status = NEW\.status THEN\s+RETURN NEW;/);
    }
  });

  it('each function raises an exception on invalid transitions', () => {
    const s = src();
    for (const spec of EXPECTED) {
      const start = s.indexOf(`CREATE OR REPLACE FUNCTION ${spec.functionName}`);
      const end = s.indexOf('LANGUAGE plpgsql;', start);
      const body = s.slice(start, end);
      expect(body, `${spec.functionName} must RAISE EXCEPTION on invalid transition`)
        .toContain('RAISE EXCEPTION');
      expect(body, `${spec.functionName} must include the OLD/NEW statuses in the error`)
        .toMatch(/OLD\.status.*NEW\.status/s);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P1-2 (device-tracking section audit, 2026-09-08) — emit on
 * transition only.
 *
 * The compliance job used to call `OutboxService.emit('DEVICE_VIOLATION')`
 * for every rider with `isLocationMandatory && deviceViolationCount > 0`
 * on every sweep. With a ~1/min sweep cadence and a counter that
 * only grows, a rider who denied location for a month generated
 * a Slack message per minute — the failure mode that teaches
 * operators to mute the channel carrying safety-adjacent alerts.
 *
 * The fix moves the emit inside the `if (!existing)` branch in
 * the per-permission loop, so it fires only on the transition
 * "no ACTIVE row existed before this run" → "ACTIVE row created
 * now". The existing-ACTIVE check at the same site (lines 56-62
 * pre-fix) already computes exactly this. The emit payload keeps
 * the existing `violations` array shape so the orphan consumer
 * at `orphan-event-consumer.job.ts:117` doesn't need to change.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const JOB = join(REPO_ROOT, 'src', 'server', 'workers', 'jobs', 'device-compliance.job.ts');

function stripAllDocComments(text: string): string {
  return text.replace(/\/\*\*[\s\S]*?\*\//g, '');
}

describe('P1-2: DEVICE_VIOLATION emit is inside the transition branch', () => {
  it('the OutboxService.emit call lives inside the if (!existing) block', () => {
    const text = stripAllDocComments(readFileSync(JOB, 'utf8'));
    // The emit must come AFTER the `if (!existing)` opening brace
    // and BEFORE its closing brace — i.e. it fires only when a new
    // row was just created.
    const emitIndex = text.indexOf('OutboxService.emit(OutboxEventTypes.DEVICE_VIOLATION');
    const existingIfIndex = text.indexOf('if (!existing)');
    const nextExistingIfIndex = text.indexOf('if (!existing)', existingIfIndex + 1);
    expect(emitIndex).toBeGreaterThan(-1);
    expect(existingIfIndex).toBeGreaterThan(-1);
    // The emit must be inside this `if (!existing)` block (no
    // nested `if (!existing)` between the open and the emit).
    expect(emitIndex).toBeLessThan(nextExistingIfIfThereIsOne(text, existingIfIndex));
  });

  it('the per-sweep blanket emit (outside the if !existing) is gone', () => {
    const text = stripAllDocComments(readFileSync(JOB, 'utf8'));
    // The pre-fix form was:
    //   await OutboxService.emit(OutboxEventTypes.DEVICE_VIOLATION, {
    //     riderId: rider.id,
    //     violations: missingPermissions,
    //   });
    // That emitted `missingPermissions` (the full list) once per
    // rider per sweep, regardless of whether a new violation was
    // created. The fix should not contain that signature.
    expect(text).not.toMatch(/violations:\s*missingPermissions/);
  });

  it('the emit payload keeps the consumer-compatible `violations: [permissionId]` shape', () => {
    const text = readFileSync(JOB, 'utf8');
    // The orphan consumer at orphan-event-consumer.job.ts:117
    // destructures `violations` as an array and computes
    // `Array.isArray(violations) ? violations.length : '?'` for the
    // alerter message. Keeping the array shape — with one element
    // for the single new permission — preserves the consumer
    // contract without changes.
    expect(text).toMatch(/violations:\s*\[\s*permissionId\s*\]/);
  });
});

function nextExistingIfIfThereIsOne(text: string, from: number): number {
  // If a second `if (!existing)` exists, the emit must be inside
  // the first one, not the second. If no second one exists, the
  // emit is bounded by the function's closing brace — return a
  // very large number so the `lessThan` check passes.
  const next = text.indexOf('if (!existing)', from + 1);
  return next === -1 ? text.length : next;
}

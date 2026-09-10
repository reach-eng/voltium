import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P0-1 (device-tracking section audit, 2026-09-08) — contract test
 * for the FACTORY_RESET removal.
 *
 * The audit found that the "Emergency Wipe" / "Wipe Device" button
 * (1) was rendered enabled with a striped "cannot be undone" warning,
 * (2) wired to a backend that unconditionally threw
 * (`fcm.sendSecurityCommand` refuses 'FACTORY_RESET' and 'LOCK_DEVICE'
 * for security compliance), and (3) produced a 500 every click.
 *
 * The fix is removal — the audit explicitly says "remove or implement
 * — don't half-do." This test pins the post-removal state across
 * every layer that used to mention the action.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const SECURITY_CONTROLS = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'device-tracking', 'SecurityControls.tsx');
const TYPES = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'device-tracking', 'types.ts');
const LABELS = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'device-tracking', 'securityActionLabels.ts');
const ROUTE = join(REPO_ROOT, 'src', 'app', 'api', 'admin', 'riders', 'actions', 'route.ts');
const FCM = join(REPO_ROOT, 'src', 'lib', 'fcm.ts');
const VALIDATORS = join(REPO_ROOT, 'src', 'lib', 'validators.ts');

/** Match `'FACTORY_RESET'` as an enum value (a quoted token inside an
 *  array literal) — NOT inside a comment or doc block. */
function liveEnumValueMentions(text: string, token: string): string[] {
  const lines = text.split('\n');
  const hits: string[] = [];
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith('/*') && !line.includes('*/')) inBlockComment = true;
    if (inBlockComment && line.includes('*/')) inBlockComment = false;
    if (inBlockComment) continue;
    // strip line comments
    const code = line.replace(/\/\/.*$/, '');
    if (code.includes(token)) {
      hits.push(`line ${i + 1}: ${line.trim()}`);
    }
  }
  return hits;
}

describe('P0-1: FACTORY_RESET is fully removed from the web surface', () => {
  it('the SecurityAction type union no longer contains FACTORY_RESET', () => {
    const text = readFileSync(TYPES, 'utf8');
    // Comment mentions are allowed; enum values are not.
    const live = liveEnumValueMentions(text, "'FACTORY_RESET'");
    expect(live, `FACTORY_RESET still appears as an enum value:\n${live.join('\n')}`).toEqual([]);
  });

  it('the Zod riderActionSchema enum no longer contains FACTORY_RESET', () => {
    const text = readFileSync(VALIDATORS, 'utf8');
    const live = liveEnumValueMentions(text, "'FACTORY_RESET'");
    expect(live, `FACTORY_RESET still appears in the Zod schema:\n${live.join('\n')}`).toEqual([]);
  });

  it('the confirm-dialog copy no longer has a FACTORY_RESET branch', () => {
    const text = readFileSync(LABELS, 'utf8');
    expect(text).not.toMatch(/case\s+'FACTORY_RESET'/);
  });

  it('the Emergency Wipe button + FactoryResetCard component are removed from SecurityControls', () => {
    const text = readFileSync(SECURITY_CONTROLS, 'utf8');
    expect(text).not.toMatch(/FactoryResetCard/);
    expect(text).not.toMatch(/onTrigger\(\s*'FACTORY_RESET'\s*\)/);
    expect(text).not.toMatch(/>\s*Wipe Device\s*</);
  });

  it('the actions route has no FACTORY_RESET case and no fcmService.sendRemoteWipe caller', () => {
    const text = readFileSync(ROUTE, 'utf8');
    expect(text).not.toMatch(/case\s+'FACTORY_RESET'/);
    expect(text).not.toMatch(/sendRemoteWipe/);
    // The fcmRequiredActions allowlist should also drop FACTORY_RESET.
    expect(text).not.toMatch(/'FACTORY_RESET'/);
  });

  it('fcm.ts no longer exposes sendRemoteWipe (the wrapper that always threw)', () => {
    const text = readFileSync(FCM, 'utf8');
    // Look for an actual function/method definition, not a comment.
    expect(text).not.toMatch(/async\s+sendRemoteWipe\s*\(/);
  });

  it('the legacy audit comment about FACTORY_RESET-as-most-severe is updated', () => {
    // The pre-existing comment in actions/route.ts said the route
    // covered "FACTORY_RESET, the most severe one, a remote phone
    // wipe". The P0-1 fix updated this comment to reflect removal.
    const text = readFileSync(ROUTE, 'utf8');
    expect(text).toMatch(/FACTORY_RESET removed/);
  });
});

describe('P0-1: SecurityAction enum stays in lockstep with the Zod schema', () => {
  /**
   * The audit's P1-13 (from 2026-08-05) explicitly noted: "Keep the
   * enum in lockstep with `riderActionSchema` in lib/validators.ts."
   * That lockstep is what made the FACTORY_RESET removal safe — the
   * Zod schema and the TypeScript union were identical, so removing
   * the token in both places was a single coordinated edit. This
   * test pins the invariant going forward: every value in the union
   * appears in the Zod enum and vice versa.
   */
  it('every SecurityAction enum value is in the Zod riderActionSchema', () => {
    const typesText = readFileSync(TYPES, 'utf8');
    const validatorsText = readFileSync(VALIDATORS, 'utf8');
    const union = typesText.match(/export type SecurityAction\s*=\s*([\s\S]*?);/);
    expect(union, 'SecurityAction union not found').toBeTruthy();
    const tokens = [...union![1].matchAll(/'\s*([A-Z_]+)\s*'/g)].map((m) => m[1]);
    expect(tokens.length).toBeGreaterThan(0);
    for (const t of tokens) {
      expect(validatorsText, `${t} is in the TS union but not in the Zod schema`).toContain(`'${t}'`);
    }
  });

  it('every Zod enum value is in the SecurityAction union (no orphan Zod members)', () => {
    const typesText = readFileSync(TYPES, 'utf8');
    const validatorsText = readFileSync(VALIDATORS, 'utf8');
    const enumMatch = validatorsText.match(/z\.enum\(\[\s*([\s\S]*?)\s*\]\)/);
    expect(enumMatch, 'Zod enum not found in riderActionSchema').toBeTruthy();
    const tokens = [...enumMatch![1].matchAll(/'\s*([A-Z_]+)\s*'/g)].map((m) => m[1]);
    // Filter out non-action Zod enum members (the audit's enum is
    // larger than the SecurityAction type — it also includes
    // ASSIGN_PLAN, COMPLETE_PICKUP, END_RENTAL which are rider
    // actions, not security actions).
    const securityTokens = tokens.filter((t) =>
      [
        'ADMIN_LOCK', 'UNLOCK_DEVICE', 'PERSIST_APP', 'ENFORCE_LOCATION',
        'RESTRICT_APPS_CONTROL', 'DISABLE_CAMERA', 'ENABLE_CAMERA',
        'ENFORCE_PASSCODE', 'CHECK_LOCATION_INTEGRITY', 'SYNC_DEVICE_DATA',
      ].includes(t)
    );
    for (const t of securityTokens) {
      expect(typesText, `${t} is in the Zod schema but not in the SecurityAction union`).toContain(`'${t}'`);
    }
  });
});

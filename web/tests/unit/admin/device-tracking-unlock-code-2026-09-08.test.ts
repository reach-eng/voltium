import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P1-5 (device-tracking section audit, 2026-09-08) — UNLOCK_DEVICE
 * surfaces the rotated code.
 *
 * The server (`actions/route.ts:174-176`) generates a new 12-digit
 * code on UNLOCK_DEVICE just like it does for ADMIN_LOCK. The
 * previous client (`useDeviceTracking.ts:130`) only surfaced the
 * code for `action === 'ADMIN_LOCK'`, so an admin who closed the
 * one-time dialog after UNLOCK_DEVICE lost the rotated code.
 * Subsequent non-SUPER_ADMIN unlocks then needed a recovery
 * password nobody had, escalating every recovery to SUPER_ADMIN.
 *
 * The fix is the documented path: also surface for UNLOCK_DEVICE.
 * The dialog copy ("will not be able to view it again") already
 * matches the behavior.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const HOOK = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'device-tracking', 'useDeviceTracking.ts');

describe('P1-5: UNLOCK_DEVICE surfaces the rotated unlock code', () => {
  it('the hook checks both ADMIN_LOCK and UNLOCK_DEVICE before surfacing the code', () => {
    const text = readFileSync(HOOK, 'utf8');
    // The condition must include both actions.
    expect(text).toMatch(/action\s*===\s*'ADMIN_LOCK'\s*\|\|\s*action\s*===\s*'UNLOCK_DEVICE'/);
  });

  it('the previous single-action check (ADMIN_LOCK only) is gone', () => {
    const text = readFileSync(HOOK, 'utf8');
    // The old form was `if (action === 'ADMIN_LOCK' && json.data?.unlockCode)`.
    // It must not survive as the only gate.
    expect(text).not.toMatch(/if\s*\(\s*action\s*===\s*'ADMIN_LOCK'\s*&&\s*json\.data\?\.\s*unlockCode\s*\)\s*\{/);
  });
});

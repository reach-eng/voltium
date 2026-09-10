import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P1-6 (device-tracking section audit, 2026-09-08) — fleet gate
 * alignment.
 *
 * The fleet API route required `riders_view`; the nav entry
 * required `vehicles_view`. Today every `vehicles_view` holder
 * also holds `riders_view`, so nothing was broken — but a future
 * role reshuffle would silently 403 the map for any role that
 * had `vehicles_view` but not `riders_view` (and vice versa for
 * the OR-gate route, which would let them in via the alternative
 * key with no nav entry).
 *
 * This test pins the aligned state: nav and route both require
 * `riders_view`. The fleet map is rider-centric; `riders_view` is
 * the right semantic key.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const ROLE_CONFIG = join(REPO_ROOT, 'src', 'lib', 'role-config.ts');
const FLEET_ROUTE = join(REPO_ROOT, 'src', 'app', 'api', 'admin', 'fleet', 'route.ts');

describe('P1-6: fleet nav entry uses riders_view', () => {
  it('the fleet-map nav entry has permission riders_view (not vehicles_view)', () => {
    const text = readFileSync(ROLE_CONFIG, 'utf8');
    // Find the fleet-map block and check its permission.
    const fleetBlock = text.match(/id:\s*'fleet-map'[\s\S]*?permission:\s*'([^']+)'/);
    expect(fleetBlock, 'fleet-map nav entry not found in role-config.ts').toBeTruthy();
    expect(fleetBlock![1]).toBe('riders_view');
  });
});

describe('P1-6: fleet API route uses riders_view (single check, no OR fallback)', () => {
  it('the route checks riders_view and not vehicles_view', () => {
    const text = readFileSync(FLEET_ROUTE, 'utf8');
    // The route must call `hasPermission(... 'riders_view')`.
    expect(text).toMatch(/hasPermission\(\s*session\.adminRole\s*\|\|\s*''\s*,\s*'riders_view'\s*\)/);
  });

  it('the previous OR-gate (riders_view OR vehicles_view) is gone', () => {
    const text = readFileSync(FLEET_ROUTE, 'utf8');
    // The pre-fix form was:
    //   if (!hasPermission('riders_view') && !hasPermission('vehicles_view'))
    // The fix is a single check.
    expect(text).not.toMatch(/hasPermission\([^)]*'riders_view'[\s\S]*?hasPermission\([^)]*'vehicles_view'/);
    expect(text).not.toMatch(/hasPermission\([^)]*'vehicles_view'[\s\S]*?hasPermission\([^)]*'riders_view'/);
  });
});

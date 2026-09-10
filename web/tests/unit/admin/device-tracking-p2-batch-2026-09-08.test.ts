import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P2 batch (device-tracking section audit, 2026-09-08) — small
 * UX / copy / latent-risk fixes.
 *
 *   - LIVE window bumped from 60s to 90s (no flap on a 60s sync
 *     cadence).
 *   - "View Profile" no-op button in RiderDetailDialog changed to
 *     a real "Close" action (the audit's "wire or remove" choice;
 *     a rider detail page doesn't exist in this app router, so
 *     removing + repurposing to Close is the honest fix).
 *   - `type` query param on /api/admin/riders/[id]/device-data is
 *     allowlisted to {all, CONTACTS, CALL_LOGS, LOCATION} (with
 *     lowercase normalization for backward compat) — was free-form
 *     before, flowed into the SOC2 access log verbatim.
 *   - Toast copy for DB-only actions appends "will apply on next
 *     device sync (~120s)" so the operator doesn't read
 *     "triggered successfully" as "the device already acted".
 *
 * The audit's "consent-missing legacy allow", "12-digit recovery
 * codes", and "syncing spinner" items are NOTES only — no PR
 * changes.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const LOCATION_TAB = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'device-tracking', 'LocationTab.tsx');
const RIDER_DETAIL = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'fleet-map', 'RiderDetailDialog.tsx');
const DEVICE_DATA_GET = join(REPO_ROOT, 'src', 'app', 'api', 'admin', 'riders', '[id]', 'device-data', 'route.ts');
const HOOK = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'device-tracking', 'useDeviceTracking.ts');

describe('P2: LIVE window bumped to 90s', () => {
  it('LocationTab uses 90_000 ms (was 60_000)', () => {
    const text = readFileSync(LOCATION_TAB, 'utf8');
    expect(text).toMatch(/LIVE_THRESHOLD_MS\s*=\s*90_000/);
    expect(text).not.toMatch(/LIVE_THRESHOLD_MS\s*=\s*60_000/);
  });
});

describe('P2: RiderDetailDialog "View Profile" no-op is gone', () => {
  it('the previous "View Profile" button has a real onClick (Close)', () => {
    const text = readFileSync(RIDER_DETAIL, 'utf8');
    expect(text).not.toMatch(/>\s*View Profile\s*</);
    // The replacement is a Close button that dismisses the dialog.
    expect(text).toMatch(/>\s*Close\s*</);
  });
});

describe('P2: device-data `type` query param is allowlisted', () => {
  it('the route validates type against the documented enum', () => {
    const text = readFileSync(DEVICE_DATA_GET, 'utf8');
    expect(text).toMatch(/DEVICE_DATA_TYPES\s*=\s*\[\s*'all'\s*,\s*'CONTACTS'\s*,\s*'CALL_LOGS'\s*,\s*'LOCATION'\s*\]/);
    expect(text).toMatch(/deviceDataTypeSchema/);
  });

  it('a bad type returns 400 with the allowed list in the message', () => {
    const text = readFileSync(DEVICE_DATA_GET, 'utf8');
    expect(text).toMatch(/Invalid type.*Allowed/);
  });

  it('lowercase values are normalized to uppercase (backward compat)', () => {
    const text = readFileSync(DEVICE_DATA_GET, 'utf8');
    // The Zod union has the uppercase primary + a lowercase
    // transform.
    expect(text).toMatch(/z\.enum\(\[\s*'all'\s*,\s*'contacts'/);
    expect(text).toMatch(/\.transform\(\s*\(v\)\s*=>\s*v\.toUpperCase\(\)\s*\)/);
  });
});

describe('P2: DB-only actions append the queue note to the toast', () => {
  it('the hook lists PERSIST_APP / ENFORCE_LOCATION / RESTRICT_APPS_CONTROL / ADMIN_LOCK as dbOnly', () => {
    const text = readFileSync(HOOK, 'utf8');
    expect(text).toMatch(/PERSIST_APP/);
    expect(text).toMatch(/ENFORCE_LOCATION/);
    expect(text).toMatch(/RESTRICT_APPS_CONTROL/);
    expect(text).toMatch(/ADMIN_LOCK/);
  });

  it('the queue note text is present in the message builder', () => {
    const text = readFileSync(HOOK, 'utf8');
    expect(text).toMatch(/will apply on next device sync/);
  });
});

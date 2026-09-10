import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P1-4 (device-tracking section audit, 2026-09-08) — ingest rate
 * limits + envelope Zod.
 *
 * The 4 ingest routes had no rate limit (per-call caps in the
 * use-case handled payload bloat, not call frequency) and no
 * envelope Zod (`{ type, data }` was `any` from `request.json()`).
 * A compromised token turned `createMany` into a write hose.
 *
 * This PR adds:
 *   1. Rider-scoped `checkRateLimit` at 5/min/rider on all 4 routes
 *      (matches the set/verify-lock precedent).
 *   2. Strict-mode Zod envelopes with per-type `data` shape unions
 *      (array for CONTACTS/CALL_LOGS, object for LOCATION).
 *   3. `.strict()` so unknown top-level keys (e.g. a typo'd
 *      `riderId` in the wrong slot) fail at the boundary instead
 *      of being silently accepted.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const SYNC = join(REPO_ROOT, 'src', 'app', 'api', 'rider', 'sync', 'device-data', 'route.ts');
const DEVICE_DATA = join(REPO_ROOT, 'src', 'app', 'api', 'device', 'data', 'route.ts');
const RIDER_DEVICE = join(REPO_ROOT, 'src', 'app', 'api', 'rider', 'device', 'route.ts');
const DEVICE_PERMISSIONS = join(REPO_ROOT, 'src', 'app', 'api', 'device', 'permissions', 'route.ts');
const RIDER_DEVICE_PERMISSIONS = join(REPO_ROOT, 'src', 'app', 'api', 'rider', 'device', 'permissions', 'route.ts');

describe('P1-4: rider/sync/device-data has rate limit + envelope Zod', () => {
  it('calls checkRateLimit with 5/min/rider', () => {
    const text = readFileSync(SYNC, 'utf8');
    expect(text).toMatch(/checkRateLimit\(/);
    expect(text).toMatch(/maxRequests:\s*5/);
  });

  it('uses a strict-mode Zod schema with the documented type union', () => {
    const text = readFileSync(SYNC, 'utf8');
    expect(text).toMatch(/z\.enum\(\[\s*'CONTACTS'\s*,\s*'CALL_LOGS'\s*,\s*'LOCATION'\s*\]\)/);
    expect(text).toMatch(/\.strict\(\)/);
    // data is array OR object (CONTACTS/CALL_LOGS = array, LOCATION = object)
    expect(text).toMatch(/z\.union\(\[\s*z\.array/);
  });
});

describe('P1-4: device/data has rate limit + envelope Zod', () => {
  it('calls checkRateLimit with 5/min/rider', () => {
    const text = readFileSync(DEVICE_DATA, 'utf8');
    expect(text).toMatch(/checkRateLimit\(/);
    expect(text).toMatch(/maxRequests:\s*5/);
  });

  it('uses a strict-mode Zod schema with the lowercase type union', () => {
    // /api/device/data uses lowercase type values — different
    // from /api/rider/sync/device-data which uses uppercase.
    const text = readFileSync(DEVICE_DATA, 'utf8');
    expect(text).toMatch(/z\.enum\(\[\s*'location'\s*,\s*'contacts'\s*,\s*'call_logs'\s*\]\)/);
    expect(text).toMatch(/\.strict\(\)/);
  });
});

describe('P1-4: rider/device (POST) has rate limit', () => {
  it('calls checkRateLimit on the violation-report path', () => {
    const text = readFileSync(RIDER_DEVICE, 'utf8');
    expect(text).toMatch(/checkRateLimit\(/);
    expect(text).toMatch(/maxRequests:\s*5/);
  });

  it('keeps the existing reportViolationSchema envelope', () => {
    // /api/rider/device POST already had Zod for `permissionId`
    // before this PR — the rate limit was the missing piece.
    const text = readFileSync(RIDER_DEVICE, 'utf8');
    expect(text).toMatch(/reportViolationSchema/);
  });
});

describe('P1-4: device/permissions and rider/device/permissions have rate limit + envelope Zod', () => {
  it('device/permissions: checkRateLimit + strict Zod permissions record', () => {
    const text = readFileSync(DEVICE_PERMISSIONS, 'utf8');
    expect(text).toMatch(/checkRateLimit\(/);
    expect(text).toMatch(/maxRequests:\s*5/);
    expect(text).toMatch(/permissions:\s*z\.record\(z\.string\(\),\s*z\.boolean\(\)\)/);
    expect(text).toMatch(/\.strict\(\)/);
  });

  it('rider/device/permissions: checkRateLimit + strict Zod permissions record', () => {
    const text = readFileSync(RIDER_DEVICE_PERMISSIONS, 'utf8');
    expect(text).toMatch(/checkRateLimit\(/);
    expect(text).toMatch(/maxRequests:\s*5/);
    expect(text).toMatch(/permissions:\s*z\.record\(z\.string\(\),\s*z\.boolean\(\)\)/);
    expect(text).toMatch(/\.strict\(\)/);
  });
});

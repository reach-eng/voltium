import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P1-1 (device-tracking section audit, 2026-09-08) — ENABLE_CAMERA
 * is a recoverable action.
 *
 * `RestrictHardwareCard` previously offered only "Off Cam"
 * (`SecurityControls.tsx:140`, action 'DISABLE_CAMERA'). An admin
 * who fat-fingered the action had no UI path back — `ENABLE_CAMERA`
 * existed in the Zod schema, the route case, and the FCM wrapper,
 * but no button triggered it.
 *
 * The fix mirrors the PERSIST_APP pattern (a stateful toggle in
 * the same card) but for an FCM-only action. The button is
 * stateless — both "Off Cam" and "On Cam" are always available
 * — because the camera flag is not persisted on `RiderAdminLock`
 * (compare `isUninstallBlocked`, which IS persisted and gets the
 * stateful toggle).
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const SC = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'device-tracking', 'SecurityControls.tsx');

describe('P1-1: ENABLE_CAMERA has a UI trigger', () => {
  it('RestrictHardwareCard renders an "On Cam" button that triggers ENABLE_CAMERA', () => {
    const text = readFileSync(SC, 'utf8');
    // The new button must:
    // (a) trigger the action,
    // (b) be visible to admins (no "isCameraDisabled" gate).
    expect(text).toMatch(/onTrigger\(\s*'ENABLE_CAMERA'\s*\)/);
    expect(text).toMatch(/>\s*On Cam\s*</);
  });

  it('the existing "Off Cam" button still triggers DISABLE_CAMERA', () => {
    const text = readFileSync(SC, 'utf8');
    expect(text).toMatch(/onTrigger\(\s*'DISABLE_CAMERA'\s*\)/);
    expect(text).toMatch(/>\s*Off Cam\s*</);
  });
});

/**
 * Test for scripts/bootstrap.sh (PR-142 / INF-OBS-1)
 * ----------------------------------------------------------------
 * Phase 6F (PR-94) added scripts/setup-logrotate.sh which installs the
 * pm2-logrotate module + applies the Voltium policy (50M / 14 / compress).
 * But it was never wired into scripts/bootstrap.sh — a fresh laptop would
 * have to remember to run it manually, which is exactly the failure mode
 * it was added to prevent. PR-142 wires the call after `pm2 start` so
 * the laptop service is fully rotation-aware on first deploy.
 *
 * These tests guard against future refactors that drop the wiring.
 * Pure node-side parse (no spawnSync to bash) so the test runs on Windows.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
// __dirname = web/tests/unit → 3 levels up = repo root
const BOOTSTRAP_PATH = resolve(REPO_ROOT, 'scripts/bootstrap.sh');
const LOGROTATE_PATH = resolve(REPO_ROOT, 'scripts/setup-logrotate.sh');

describe('scripts/bootstrap.sh (PR-142 / INF-OBS-1)', () => {
  const content = existsSync(BOOTSTRAP_PATH) ? readFileSync(BOOTSTRAP_PATH, 'utf-8') : '';

  it('the bootstrap script exists', () => {
    expect(existsSync(BOOTSTRAP_PATH)).toBe(true);
  });

  it('the setup-logrotate.sh script exists (Phase 6F / PR-94 deliverable)', () => {
    expect(existsSync(LOGROTATE_PATH)).toBe(true);
  });

  it('bootstrap.sh invokes setup-logrotate.sh', () => {
    // The PR-142 wiring. The call must reference setup-logrotate.sh by
    // basename (so a future rename of the dir still works) and the call
    // must come AFTER the `pm2 start` line (pm2-logrotate hooks into a
    // running daemon).
    expect(content).toMatch(/bash\s+["']?[^"'\n]*setup-logrotate\.sh/);
  });

  it('the setup-logrotate.sh call comes AFTER pm2 start (daemon must be running)', () => {
    const pm2StartIdx = content.search(/pm2\s+start\b/);
    const logrotateIdx = content.search(/setup-logrotate\.sh/);
    expect(pm2StartIdx, 'expected a `pm2 start` line').toBeGreaterThan(-1);
    expect(logrotateIdx, 'expected a `setup-logrotate.sh` call').toBeGreaterThan(-1);
    expect(logrotateIdx).toBeGreaterThan(pm2StartIdx);
  });

  it('the setup-logrotate.sh call sits inside the production branch (not dev mode)', () => {
    // bootstrap.sh has `if [ "$DEV_MODE" = false ]; then` for the pm2
    // start block. The logrotate wiring must live inside that block —
    // pm2-logrotate requires a running daemon which dev mode does not
    // start. Look for the call appearing after the dev-mode guard.
    const devGuardIdx = content.search(/DEV_MODE"\s*=\s*false/);
    const logrotateIdx = content.search(/setup-logrotate\.sh/);
    expect(devGuardIdx, 'expected a `DEV_MODE = false` guard').toBeGreaterThan(-1);
    expect(logrotateIdx).toBeGreaterThan(devGuardIdx);
  });
});

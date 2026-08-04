/**
 * Test for scripts/check-secret-rotation.ts (PR-94a / INF-CI/CD-3).
 *
 * The script is a thin CLI wrapper over `checkSecretRotation()` whose only
 * job is to translate a "stale secret" result into a non-zero exit code so
 * the nightly CI job actually fires the alert webhook. We assert:
 *
 *   1. All-clean input → exitCode 0 + "All secrets within rotation window"
 *   2. Any-stale input → exitCode 1 + each stale key written to stderr
 *   3. never-rotated keys are reported with age=never-rotated
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCheckSecretRotation = vi.fn();

vi.mock('../../../src/lib/secret-rotation', () => ({
  checkSecretRotation: () => mockCheckSecretRotation(),
}));

import { runSecretRotationCheck } from '../../../../scripts/check-secret-rotation';

describe('scripts/check-secret-rotation.ts (PR-94a)', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutWrite.mockRestore();
    stderrWrite.mockRestore();
  });

  it('returns exitCode 0 and logs success when all secrets are within policy', async () => {
    mockCheckSecretRotation.mockResolvedValue([
      { key: 'secret.rotation.jwt_signing_key', isStale: false, daysSinceRotation: 10, lastRotatedAt: new Date(), maxAgeDays: 90 },
      { key: 'secret.rotation.pii_encryption_key', isStale: false, daysSinceRotation: 10, lastRotatedAt: new Date(), maxAgeDays: 180 },
      { key: 'secret.rotation.payment_gateway_keys', isStale: false, daysSinceRotation: 10, lastRotatedAt: new Date(), maxAgeDays: 180 },
      { key: 'secret.rotation.backup_encryption_key', isStale: false, daysSinceRotation: 10, lastRotatedAt: new Date(), maxAgeDays: 90 },
    ]);

    const outcome = await runSecretRotationCheck();

    expect(outcome.exitCode).toBe(0);
    expect(outcome.staleKeys).toEqual([]);
    expect(outcome.stdout).toContain('All secrets within rotation window');
  });

  it('returns exitCode 1 and writes each stale key to stderr when any secret is stale', async () => {
    mockCheckSecretRotation.mockResolvedValue([
      { key: 'secret.rotation.jwt_signing_key', isStale: true, daysSinceRotation: 200, lastRotatedAt: new Date(), maxAgeDays: 90 },
      { key: 'secret.rotation.pii_encryption_key', isStale: false, daysSinceRotation: 30, lastRotatedAt: new Date(), maxAgeDays: 180 },
      { key: 'secret.rotation.payment_gateway_keys', isStale: true, daysSinceRotation: 365, lastRotatedAt: new Date(), maxAgeDays: 180 },
      { key: 'secret.rotation.backup_encryption_key', isStale: false, daysSinceRotation: 30, lastRotatedAt: new Date(), maxAgeDays: 90 },
    ]);

    const outcome = await runSecretRotationCheck();

    expect(outcome.exitCode).toBe(1);
    expect(outcome.staleKeys).toEqual([
      'secret.rotation.jwt_signing_key',
      'secret.rotation.payment_gateway_keys',
    ]);
    expect(outcome.stderr).toContain('secret.rotation.jwt_signing_key');
    expect(outcome.stderr).toContain('secret.rotation.payment_gateway_keys');
    expect(outcome.stderr).toMatch(/STALE secret\.rotation\.jwt_signing_key age=200d maxAge=90d/);
    expect(outcome.stderr).toContain('2 of 4 secret(s) are stale');
  });

  it('reports never-rotated for null daysSinceRotation', async () => {
    mockCheckSecretRotation.mockResolvedValue([
      { key: 'secret.rotation.jwt_signing_key', isStale: true, daysSinceRotation: null, lastRotatedAt: null, maxAgeDays: 90 },
      { key: 'secret.rotation.pii_encryption_key', isStale: false, daysSinceRotation: 30, lastRotatedAt: new Date(), maxAgeDays: 180 },
      { key: 'secret.rotation.payment_gateway_keys', isStale: false, daysSinceRotation: 30, lastRotatedAt: new Date(), maxAgeDays: 180 },
      { key: 'secret.rotation.backup_encryption_key', isStale: false, daysSinceRotation: 30, lastRotatedAt: new Date(), maxAgeDays: 90 },
    ]);

    const outcome = await runSecretRotationCheck();

    expect(outcome.exitCode).toBe(1);
    expect(outcome.stderr).toContain('never-rotated');
    expect(outcome.stderr).toMatch(/STALE secret\.rotation\.jwt_signing_key age=never-rotated maxAge=90d/);
  });
});

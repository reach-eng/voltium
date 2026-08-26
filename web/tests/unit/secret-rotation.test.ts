import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { checkSecretRotation, recordSecretRotation, bootstrapRotationRecords } from '@/lib/secret-rotation';
import { db } from '@/lib/db';

const mockFindUnique = vi.mocked(db.systemSetting.findUnique);
const mockUpsert = vi.mocked(db.systemSetting.upsert);

describe('checkSecretRotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all OK when secrets are within rotation policy', async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);

    mockFindUnique.mockResolvedValue({
      value: 'rotated',
      updatedAt: recentDate,
    } as any);

    const results = await checkSecretRotation();

    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.isStale).toBe(false);
      expect(r.daysSinceRotation).toBeLessThanOrEqual(r.maxAgeDays);
    }
  });

  it('returns stale when a secret exceeds max age', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 200);

    mockFindUnique.mockResolvedValue({
      value: 'old',
      updatedAt: oldDate,
    } as any);

    const results = await checkSecretRotation();

    const jwtResult = results.find((r) => r.key === 'secret.rotation.jwt_signing_key');
    const piiResult = results.find((r) => r.key === 'secret.rotation.pii_encryption_key');

    expect(jwtResult?.isStale).toBe(true);
    expect(piiResult?.isStale).toBe(true);
  });

  it('returns stale when no SystemSetting exists for a key', async () => {
    mockFindUnique.mockResolvedValue(null);

    const results = await checkSecretRotation();

    for (const r of results) {
      expect(r.isStale).toBe(true);
      expect(r.lastRotatedAt).toBeNull();
      expect(r.daysSinceRotation).toBeNull();
    }
  });
});

describe('recordSecretRotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a SystemSetting row with the current date', async () => {
    mockUpsert.mockResolvedValue({} as any);

    await recordSecretRotation('secret.rotation.jwt_signing_key', 'rotated-2026-07-29');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const args = mockUpsert.mock.calls[0][0];
    expect(args.where.key).toBe('secret.rotation.jwt_signing_key');
    expect(args.create.key).toBe('secret.rotation.jwt_signing_key');
    expect(args.create.value).toBe('rotated-2026-07-29');
    expect(args.create.updatedAt).toBeInstanceOf(Date);
  });

  it('throws on unknown key', async () => {
    await expect(
      recordSecretRotation('secret.rotation.unknown_key', 'note')
    ).rejects.toThrow(/Unknown rotation key/);
  });
});

describe('bootstrapRotationRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records rotation for all 4 default policies', async () => {
    mockUpsert.mockResolvedValue({} as any);

    await bootstrapRotationRecords();

    expect(mockUpsert).toHaveBeenCalledTimes(4);
    const keys = mockUpsert.mock.calls.map((c) => c[0].where.key);
    expect(keys).toContain('secret.rotation.jwt_signing_key');
    expect(keys).toContain('secret.rotation.pii_encryption_key');
    expect(keys).toContain('secret.rotation.payment_gateway_keys');
    expect(keys).toContain('secret.rotation.backup_encryption_key');
  });
});

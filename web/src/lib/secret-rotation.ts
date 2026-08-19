/**
 * Secret Rotation — minimal implementation.
 *
 * Tracks rotation dates for 4 critical secrets in SystemSetting:
 * - secret.rotation.jwt_signing_key
 * - secret.rotation.pii_encryption_key
 * - secret.rotation.payment_gateway_keys
 * - secret.rotation.backup_encryption_key
 *
 * checkSecretRotation() returns the staleness status of each.
 * recordSecretRotation() updates a single key.
 * bootstrapRotationRecords() writes initial records for all 4.
 *
 * Implementation note: this is a STUB. A real implementation would
 * dispatch to job-queue alerts via alerter.ts when isStale is true.
 * (See PR-K in REMEDIATION_PLAN for the full plan.)
 */

import { db } from './db';
import { logger } from './logger';

export const ROTATION_KEYS = [
  'secret.rotation.jwt_signing_key',
  'secret.rotation.pii_encryption_key',
  'secret.rotation.payment_gateway_keys',
  'secret.rotation.backup_encryption_key',
] as const;

export type RotationKey = (typeof ROTATION_KEYS)[number];

const MAX_AGE_DAYS: Record<RotationKey, number> = {
  'secret.rotation.jwt_signing_key': 90,
  'secret.rotation.pii_encryption_key': 180,
  'secret.rotation.payment_gateway_keys': 180,
  'secret.rotation.backup_encryption_key': 90,
};

export interface RotationResult {
  key: RotationKey;
  isStale: boolean;
  daysSinceRotation: number | null;
  lastRotatedAt: Date | null;
  maxAgeDays: number;
}

export async function checkSecretRotation(): Promise<RotationResult[]> {
  const results: RotationResult[] = [];
  for (const key of ROTATION_KEYS) {
    const row = await db.systemSetting.findUnique({ where: { key } });
    const lastRotatedAt = row?.updatedAt ?? null;
    const daysSinceRotation = lastRotatedAt
      ? Math.floor((Date.now() - lastRotatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const maxAgeDays = MAX_AGE_DAYS[key];
    const isStale = daysSinceRotation === null || daysSinceRotation > maxAgeDays;
    results.push({ key, isStale, daysSinceRotation, lastRotatedAt, maxAgeDays });
  }
  if (results.some((r) => r.isStale)) {
    logger.warn('[secret-rotation] Stale secrets detected', {
      stale: results.filter((r) => r.isStale).map((r) => r.key),
    });
  }
  return results;
}

export async function recordSecretRotation(key: string, value: string): Promise<void> {
  if (!ROTATION_KEYS.includes(key as RotationKey)) {
    throw new Error(`Unknown rotation key: ${key}`);
  }
  await db.systemSetting.upsert({
    where: { key },
    create: { key, value, updatedAt: new Date(), category: 'SECURITY', valueType: 'STRING' },
    update: { value, updatedAt: new Date() },
  });
}

export async function bootstrapRotationRecords(): Promise<void> {
  for (const key of ROTATION_KEYS) {
    const existing = await db.systemSetting.findUnique({ where: { key } });
    if (!existing) {
      await db.systemSetting.upsert({
        where: { key },
        create: { key, value: 'initial', updatedAt: new Date(), category: 'SECURITY', valueType: 'STRING' },
        update: {},
      });
    }
  }
}

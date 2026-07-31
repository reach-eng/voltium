/**
 * Secret Rotation Checker
 *
 * Queries SystemSetting for entries matching `secret.rotation.*` keys
 * and checks if they are within their max age.
 *
 * Used by CI (scripts/check-secret-rotation.sh) and the nightly workflow.
 */

import { db } from './db';
import { logger } from './logger';

interface RotationPolicy {
  key: string;
  name: string;
  maxAgeDays: number;
}

const DEFAULT_POLICIES: RotationPolicy[] = [
  { key: 'secret.rotation.jwt_signing_key', name: 'JWT Signing Key', maxAgeDays: 90 },
  { key: 'secret.rotation.pii_encryption_key', name: 'PII Encryption Key', maxAgeDays: 180 },
  { key: 'secret.rotation.payment_gateway_keys', name: 'Payment Gateway Keys', maxAgeDays: 180 },
  { key: 'secret.rotation.backup_encryption_key', name: 'Backup Encryption Key', maxAgeDays: 365 },
];

interface RotationStatus {
  name: string;
  key: string;
  lastRotatedAt: Date | null;
  daysSinceRotation: number | null;
  maxAgeDays: number;
  isStale: boolean;
}

export async function checkSecretRotation(): Promise<RotationStatus[]> {
  const results: RotationStatus[] = [];
  const now = new Date();

  for (const policy of DEFAULT_POLICIES) {
    const setting = await db.systemSetting.findUnique({
      where: { key: policy.key },
      select: { value: true, updatedAt: true },
    });

    let lastRotatedAt: Date | null = null;
    let daysSinceRotation: number | null = null;
    let isStale = true;

    if (setting) {
      lastRotatedAt = setting.updatedAt;
      daysSinceRotation = Math.floor(
        (now.getTime() - setting.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      isStale = daysSinceRotation > policy.maxAgeDays;
    }

    results.push({
      name: policy.name,
      key: policy.key,
      lastRotatedAt,
      daysSinceRotation,
      maxAgeDays: policy.maxAgeDays,
      isStale,
    });
  }

  return results;
}

export async function runRotationCheck(): Promise<number> {
  const results = await checkSecretRotation();
  let exitCode = 0;

  console.log('=== Secret Rotation Check ===\n');

  for (const r of results) {
    const status = r.isStale ? '❌ STALE' : '✅ OK';
    const days = r.daysSinceRotation !== null ? `${r.daysSinceRotation}d` : 'never';
    console.log(`  ${status}  ${r.name} (${r.key})`);
    console.log(`         Last rotated: ${days} ago (max: ${r.maxAgeDays}d)`);

    if (r.isStale) {
      exitCode = 1;
      console.log(`         ⚠️  Secret is stale! Rotate within ${r.maxAgeDays} days.`);
    }
    console.log('');
  }

  if (exitCode !== 0) {
    console.log('[FAIL] One or more secrets are past their rotation deadline.');
  } else {
    console.log('[OK] All secrets are within their rotation policy.');
  }

  return exitCode;
}

/**
 * Record a secret rotation event. Call this after rotating any of the
 * tracked secrets so the rotation check can compute days-since-rotation.
 *
 * Usage:
 *   await recordSecretRotation('secret.rotation.jwt_signing_key', 'rotated-2026-07-29');
 */
export async function recordSecretRotation(key: string, note: string): Promise<void> {
  const policy = DEFAULT_POLICIES.find((p) => p.key === key);
  if (!policy) {
    throw new Error(`Unknown rotation key: ${key}. Known: ${DEFAULT_POLICIES.map((p) => p.key).join(', ')}`);
  }
  await db.systemSetting.upsert({
    where: { key },
    create: { key, value: note, updatedAt: new Date() },
    update: { value: note, updatedAt: new Date() },
  });
  logger.info('[SecretRotation] Recorded rotation', { key, note });
}

/**
 * Bootstrap default rotation records for fresh installs. Records today's
 * date as the rotation date for all tracked secrets. Use this in seed
 * scripts or as a one-time admin operation.
 */
export async function bootstrapRotationRecords(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  for (const policy of DEFAULT_POLICIES) {
    await recordSecretRotation(policy.key, `bootstrapped-${today}`);
  }
  logger.info('[SecretRotation] Bootstrapped default rotation records');
}

// CLI entry point
if (require.main === module) {
  runRotationCheck()
    .then((code) => process.exit(code))
    .catch((err) => {
      logger.error('[SecretRotation] Check failed:', err);
      process.exit(1);
    });
}

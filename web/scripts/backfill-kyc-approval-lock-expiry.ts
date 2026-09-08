/**
 * Backfill KYC Approval Lock and Expiry (Phase 1 / P0-1 Audit Fix)
 *
 * For KycProfile rows with status='APPROVED' where editableFields is null/non-empty
 * or expiresAt is null:
 *   - Sets editableFields = [] (locks the profile post-approval)
 *   - Sets expiresAt = (rider.kycDoneAt || kycProfile.updatedAt) + 365d
 *
 * Modes:
 *   --dry-run (default): reports affected count and preview without writing to DB.
 *   --apply: applies updates to DB and invalidates rider cache.
 *
 * Usage:
 *   npx tsx scripts/backfill-kyc-approval-lock-expiry.ts
 *   npx tsx scripts/backfill-kyc-approval-lock-expiry.ts --dry-run
 *   npx tsx scripts/backfill-kyc-approval-lock-expiry.ts --apply
 */

import { db } from '../src/lib/db';
import { invalidateRiderCache } from '../src/lib/server-cache';
import { logger } from '../src/lib/logger';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const KYC_EXPIRY_DAYS = 365;

interface BackfillCandidate {
  id: string;
  riderDbId: string;
  riderCode: string;
  currentExpiresAt: Date | null;
  currentEditableFields: string[] | null;
  calculatedExpiresAt: Date;
  missingExpiry: boolean;
  unlockedFields: boolean;
}

export async function findCandidates(): Promise<{
  totalApproved: number;
  candidates: BackfillCandidate[];
}> {
  const approvedProfiles = await db.kycProfile.findMany({
    where: {
      status: 'APPROVED',
    },
    include: {
      rider: {
        select: {
          id: true,
          riderId: true,
          kycDoneAt: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const candidates: BackfillCandidate[] = [];

  for (const kp of approvedProfiles) {
    const missingExpiry = kp.expiresAt === null;
    const isArray = Array.isArray(kp.editableFields);
    const unlockedFields = !isArray || (isArray && kp.editableFields.length > 0);

    if (missingExpiry || unlockedFields) {
      const baseDate = kp.rider?.kycDoneAt ?? kp.updatedAt ?? new Date();
      const calculatedExpiresAt = new Date(baseDate.getTime() + KYC_EXPIRY_DAYS * MS_PER_DAY);

      candidates.push({
        id: kp.id,
        riderDbId: kp.riderId,
        riderCode: kp.rider?.riderId ?? 'UNKNOWN',
        currentExpiresAt: kp.expiresAt,
        currentEditableFields: kp.editableFields as string[] | null,
        calculatedExpiresAt,
        missingExpiry,
        unlockedFields,
      });
    }
  }

  return {
    totalApproved: approvedProfiles.length,
    candidates,
  };
}

export async function applyBackfill(candidates: BackfillCandidate[]): Promise<{
  updated: number;
  errors: Array<{ id: string; error: string }>;
}> {
  let updated = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const item of candidates) {
    try {
      await db.kycProfile.update({
        where: { id: item.id },
        data: {
          editableFields: [],
          expiresAt: item.calculatedExpiresAt,
        },
      });

      invalidateRiderCache(item.riderDbId);
      updated++;
    } catch (err: any) {
      errors.push({
        id: item.id,
        error: err?.message || String(err),
      });
    }
  }

  return { updated, errors };
}

async function main() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply || process.argv.includes('--dry-run');

  console.log('===============================================================');
  console.log('  KYC Approval Lock & Expiry Backfill (Phase 1 / P0-1)');
  console.log(`  Mode: ${isApply ? 'APPLY (Writing changes to database)' : 'DRY RUN (Read-only check)'}`);
  console.log('===============================================================\n');

  try {
    const { totalApproved, candidates } = await findCandidates();

    console.log(`Total APPROVED KycProfile records inspected: ${totalApproved}`);
    console.log(`Records requiring backfill: ${candidates.length}\n`);

    if (candidates.length === 0) {
      console.log('✓ All APPROVED KYC records already have editableFields=[] and valid expiresAt.');
      console.log('No backfill needed.');
      return;
    }

    const missingExpiryCount = candidates.filter((c) => c.missingExpiry).length;
    const unlockedFieldsCount = candidates.filter((c) => c.unlockedFields).length;

    console.log('Breakdown:');
    console.log(`  - Missing expiresAt: ${missingExpiryCount}`);
    console.log(`  - Unlocked / null editableFields: ${unlockedFieldsCount}\n`);

    console.log('Sample preview (first 10 records):');
    const preview = candidates.slice(0, 10).map((c) => ({
      id: c.id,
      riderCode: c.riderCode,
      currentExpiresAt: c.currentExpiresAt ? c.currentExpiresAt.toISOString() : 'NULL',
      currentEditableFields: JSON.stringify(c.currentEditableFields),
      calculatedExpiresAt: c.calculatedExpiresAt.toISOString(),
    }));
    console.table(preview);

    if (isDryRun) {
      console.log('\n[DRY RUN COMPLETE] No database modifications were performed.');
      console.log('To execute the backfill against the database, run:');
      console.log('  npx tsx scripts/backfill-kyc-approval-lock-expiry.ts --apply\n');
      return;
    }

    // Apply mode
    console.log('\nApplying updates to database...');
    const { updated, errors } = await applyBackfill(candidates);

    console.log(`\nResults:`);
    console.log(`  Successfully updated: ${updated} / ${candidates.length}`);

    if (errors.length > 0) {
      console.error(`  Errors encountered (${errors.length}):`);
      for (const e of errors) {
        console.error(`    - ID ${e.id}: ${e.error}`);
      }
      process.exitCode = 1;
    } else {
      // Post-backfill verification
      const { candidates: remaining } = await findCandidates();
      if (remaining.length === 0) {
        console.log('\n✓ Post-backfill verification passed: 0 APPROVED rows with missing lock/expiry.');
      } else {
        console.warn(`\n⚠ Warning: ${remaining.length} rows still require backfill.`);
      }
    }
  } catch (err) {
    console.error('Fatal error during backfill execution:', err);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Unhandled script error:', err);
    process.exit(1);
  });
}

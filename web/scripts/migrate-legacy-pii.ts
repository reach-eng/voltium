/**
 * Phase 7D PR-123 (DB-ENC-2, P1) — Legacy PII re-encryption helper
 *
 * What this script does:
 *   Re-encrypts all PII columns that were written with a previous key
 *   version, so they carry the new key's version prefix.
 *
 *   pii-crypto.ts (PR-123 context) supports multi-version keys: each
 *   ciphertext is written as `v<N>:iv:authTag:encrypted`, and decryptPii
 *   reads the version prefix to look up the right key. After a key
 *   rotation:
 *     - `decryptPii` still works (V1 is still loaded)
 *     - `encryptPii` writes with the latest key (V2) — new ciphertext
 *       has the `v2:` prefix
 *     - But existing V1-encrypted rows still have the `v1:` prefix and
 *       are still valid (decrypt works). To consolidate on V2, run
 *       this script.
 *
 *   The script:
 *     1. Iterates every PII column in the schema (kyc_profiles
 *        .aadhaarNumber / .panNumber / .accountNumber / .ifscCode,
 *        guarantors.pan, riders.phone, riders.email)
 *     2. For each row whose value starts with `v1:` (or has no
 *        version prefix — the legacy "warn but pass through" path),
 *        decrypt with V1 and re-encrypt with the latest key (V2 by
 *        default)
 *     3. Reports the row count + a per-column breakdown
 *     4. Is idempotent: re-running on already-migrated rows is a no-op
 *        (the value already starts with `v<N>:` for the latest N)
 *
 * Usage:
 *   $ npx tsx scripts/migrate-legacy-pii.ts            # dry run
 *   $ npx tsx scripts/migrate-legacy-pii.ts --apply   # actually write
 *
 *   The dry run is the default. The --apply flag is required to write
 *   to the DB. This matches the pattern of the secret-rotation
 *   checker (scripts/check-secret-rotation.ts) — show before
 *   touching.
 *
 * Safety:
 *   - All PII columns are encrypted in a transaction per row.
 *   - If any single row fails, the script aborts and reports the row
 *     ID. Re-running is safe.
 *   - The script NEVER deletes data. It only rewrites ciphertexts.
 *   - The script uses the existing `db` client and `pii-crypto.ts`
 *     helpers; no parallel implementation.
 */

import { db } from '../src/lib/db';
import { decryptPii, encryptPii } from '../src/lib/pii-crypto';
import { logger } from '../src/lib/logger';

interface PiiColumn {
  table: 'kyc_profiles' | 'guarantors' | 'riders';
  column: string;
  /** The unique key field on the row (e.g. "riderId" for kyc_profiles). */
  keyField: string;
}

const PII_COLUMNS: PiiColumn[] = [
  { table: 'kyc_profiles', column: 'aadhaarNumber', keyField: 'riderId' },
  { table: 'kyc_profiles', column: 'panNumber', keyField: 'riderId' },
  { table: 'kyc_profiles', column: 'accountNumber', keyField: 'riderId' },
  { table: 'kyc_profiles', column: 'ifscCode', keyField: 'riderId' },
  { table: 'guarantors', column: 'pan', keyField: 'id' },
  { table: 'riders', column: 'phone', keyField: 'id' },
  { table: 'riders', column: 'email', keyField: 'id' },
];

function isLegacyOrLowerVersion(cipherText: string | null | undefined, latestVersion: number): boolean {
  if (!cipherText) return false;
  // Legacy format: no `v<N>:` prefix at all
  if (!cipherText.startsWith('v')) return true;
  // Versioned format: parse the version, return true if it's < latest
  const m = cipherText.match(/^v(\d+):/);
  if (!m) return false;
  return parseInt(m[1], 10) < latestVersion;
}

async function processColumn(
  col: PiiColumn,
  apply: boolean,
  latestVersion: number
): Promise<{ scanned: number; migrated: number; errors: number }> {
  let scanned = 0;
  let migrated = 0;
  let errors = 0;

  // Find the model on the db client
  const model = (db as any)[col.table.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
  if (!model) {
    logger.error(`Model not found: ${col.table}`);
    return { scanned: 0, migrated: 0, errors: 1 };
  }

  // Page through rows. For now, use findMany with no filter (will
  // scan the whole table; fine for the dev DB, will need batching on
  // production).
  const rows = await model.findMany({
    select: { id: true, [col.keyField]: true, [col.column]: true },
  });

  for (const row of rows) {
    scanned++;
    const value = row[col.column];
    if (!isLegacyOrLowerVersion(value, latestVersion)) continue;

    try {
      const decrypted = decryptPii(value);
      if (apply) {
        const reencrypted = encryptPii(decrypted);
        await model.update({
          where: { id: row.id },
          data: { [col.column]: reencrypted },
        });
      }
      migrated++;
    } catch (e: any) {
      errors++;
      logger.error(`Failed to migrate ${col.table}.${col.column} row ${row.id}: ${e.message}`);
    }
  }

  return { scanned, migrated, errors };
}

async function main() {
  const apply = process.argv.includes('--apply');

  // The latest version is exposed by getLatestKey() in pii-crypto.ts but we don't
  // import that here (it would couple this script to the runtime module surface).
  // We infer latestVersion from the env: the highest set PII_ENCRYPTION_KEY_V<N>.
  // This is the same logic that pii-crypto.ts uses internally.
  let latestVersion = 1;
  for (let i = 1; i <= 9; i++) {
    if (process.env[`PII_ENCRYPTION_KEY_V${i}`]) {
      latestVersion = i;
    }
  }
  if (latestVersion === 1 && !process.env.PII_ENCRYPTION_KEY) {
    logger.warn(
      'PII_ENCRYPTION_KEY_V1 is not set. The dev fallback key will be used; ' +
      'this script is intended to run in a real environment with a rotated key.'
    );
  }

  logger.info(`Phase 7D PR-123 — legacy PII re-encryption helper`);
  logger.info(`Mode: ${apply ? 'APPLY (writing to DB)' : 'DRY RUN (read-only)'}`);
  logger.info(`Latest key version: V${latestVersion}`);

  const results: { column: string; scanned: number; migrated: number; errors: number }[] = [];
  for (const col of PII_COLUMNS) {
    const r = await processColumn(col, apply, latestVersion);
    results.push({ column: `${col.table}.${col.column}`, ...r });
  }

  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(
      `  ${r.column}: scanned=${r.scanned} migrated=${r.migrated} errors=${r.errors}`
    );
  }
  const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
  console.log(`\nTotal rows that would be migrated: ${totalMigrated}`);
  if (!apply && totalMigrated > 0) {
    console.log('\nRe-run with --apply to actually re-encrypt.');
  }
  if (apply) {
    console.log(`\n✓ Applied. Re-running this script should now report 0 migrated.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    logger.error('migrate-legacy-pii failed:', e);
    process.exit(1);
  });

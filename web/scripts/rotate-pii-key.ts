/**
 * Phase 7D PR-123 (DB-ENC-2, P1) — PII key rotation helper
 *
 * What this script does:
 *   Generates a fresh 32-byte (256-bit) AES key, hex-encoded, suitable
 *   for use as the next PII_ENCRYPTION_KEY_V<N> environment variable.
 *
 *   The script prints a single line of output:
 *     PII_ENCRYPTION_KEY_V<N>=<64 hex chars>
 *
 *   Where <N> is the next version number after the currently-loaded
 *   keys (KEY_VERSIONS map in web/src/lib/pii-crypto.ts).
 *
 * Usage:
 *   $ npx tsx scripts/rotate-pii-key.ts
 *
 *   Then add the printed line to your secret manager (.env.local, Vault,
 *   AWS Secrets Manager, etc.) and restart the app server. The new
 *   version will be picked up automatically by `loadKeyVersions()` in
 *   pii-crypto.ts.
 *
 * IMPORTANT:
 *   This script does NOT re-encrypt existing data. After adding the new
 *   key, run `npx tsx scripts/migrate-legacy-pii.ts` to re-encrypt any
 *   ciphertext that was written with the previous key. Until the
 *   migration runs, the old ciphertext is still decryptable (decryptPii
 *   reads the v<N> prefix and looks up the right key).
 *
 *   The order is:
 *     1. Generate the new key with this script
 *     2. Add it to the env as PII_ENCRYPTION_KEY_V<N+1>
 *     3. Restart the app server (now decryptPii can read both V1 and V<N+1>)
 *     4. Run migrate-legacy-pii.ts to re-encrypt old data with V<N+1>
 *     5. (Optional) Remove V1 from the env once the migration reports
 *        zero legacy rows
 *
 * Idempotency: the script only PRINTS a new key. It does not modify any
 * file or env var. Running it multiple times produces a new key each
 * time (don't lose the old one — needed to decrypt existing ciphertext).
 */

import { randomBytes } from 'crypto';

function main() {
  const newKey = randomBytes(32).toString('hex');
  // Look at the current env to suggest the next version number.
  // pii-crypto.ts supports V1..V9. Find the highest currently set.
  let maxVersion = 1;
  for (let i = 1; i <= 9; i++) {
    if (process.env[`PII_ENCRYPTION_KEY_V${i}`]) {
      maxVersion = i;
    }
  }
  const nextVersion = maxVersion + 1;
  if (nextVersion > 9) {
    console.error(`PII_ENCRYPTION_KEY_V9 is the highest supported version.`);
    console.error(`Remove the oldest version before generating a new one.`);
    process.exit(1);
  }
  console.log(`# Phase 7D PR-123 — new PII encryption key`);
  console.log(`# Add this to your env (.env.local, secrets manager, etc.)`);
  console.log(`# Then restart the app server BEFORE running migrate-legacy-pii.ts`);
  console.log(`PII_ENCRYPTION_KEY_V${nextVersion}=${newKey}`);
}

main();

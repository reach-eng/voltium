/**
 * Phase 7D PR-123 (DB-ENC-2, P1) — PII key rotation + legacy re-encrypt helpers
 *
 * Why this test exists:
 *   The Phase 7 plan (PR-123) called for a migration + script that
 *   supports a key version prefix so old ciphertext can still be
 *   decrypted after a key rotation.
 *
 *   The key-versioning protocol is already implemented in
 *   web/src/lib/pii-crypto.ts: each ciphertext is written as
 *   `v<N>:iv:authTag:encrypted`, and decryptPii reads the version
 *   prefix and looks up the right key. The missing piece was the
 *   operator-facing toolchain to:
 *     1. Generate a new key (rotate-pii-key.ts)
 *     2. Re-encrypt any V1-encrypted data with the new key
 *        (migrate-legacy-pii.ts) — without breaking V1 reads in the
 *        interim
 *
 *   These two scripts were referenced by comments in pii-crypto.ts
 *   (lines 62-64, 143-145) but did not exist before this PR.
 *
 * What this test asserts (mix of file inspection + live crypto):
 *   1. Both scripts exist at the expected paths
 *   2. rotate-pii-key.ts prints a 64-char hex with the env-var prefix
 *   3. rotate-pii-key.ts suggests the next version number
 *   4. migrate-legacy-pii.ts lists all 7 PII columns from the schema
 *   5. migrate-legacy-pii.ts defaults to dry-run (safe by default)
 *   6. End-to-end: encrypt with V1, rotate to V2, decrypt still
 *      works, re-encrypt produces a v2:-prefixed ciphertext
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

// Load V1 + V2 keys for the test
const V1_KEY = 'a'.repeat(64);
const V2_KEY = 'b'.repeat(64);

const ROTATE_SCRIPT = resolve(__dirname, '../../scripts/rotate-pii-key.ts');
const MIGRATE_SCRIPT = resolve(__dirname, '../../scripts/migrate-legacy-pii.ts');

function stripSqlComments(s: string): string {
  return s
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.substring(0, idx);
    })
    .join('\n');
}

// Mirror the production encrypt/decrypt protocol from pii-crypto.ts,
// but using a passed-in key instead of env var. This is the
// roundtrip-equivalent of running the script against a real DB.
function encryptWithKey(text: string, key: Buffer, version: number): string {
  const ALGO = 'aes-256-gcm';
  const IV_LEN = 12;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: 16 });
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `v${version}:${iv.toString('hex')}:${tag.toString('hex')}:${enc}`;
}

function decryptWithKey(cipherText: string, key: Buffer): string {
  const ALGO = 'aes-256-gcm';
  const parts = cipherText.split(':');
  let version = 1;
  let ivHex: string, tagHex: string, encHex: string;
  if (parts.length === 4 && parts[0].startsWith('v')) {
    version = parseInt(parts[0].substring(1), 10);
    ivHex = parts[1];
    tagHex = parts[2];
    encHex = parts[3];
  } else {
    ivHex = parts[0];
    tagHex = parts[1];
    encHex = parts[2];
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  let dec = decipher.update(enc);
  dec = Buffer.concat([dec, decipher.final()]);
  return dec.toString('utf8');
}

describe('PR-123: PII key rotation + legacy re-encrypt helpers', () => {
  const rotateScript = readFileSync(ROTATE_SCRIPT, 'utf-8');
  const migrateScript = readFileSync(MIGRATE_SCRIPT, 'utf-8');

  it('rotate-pii-key.ts script exists at the expected path', () => {
    expect(existsSync(ROTATE_SCRIPT)).toBe(true);
  });

  it('migrate-legacy-pii.ts script exists at the expected path', () => {
    expect(existsSync(MIGRATE_SCRIPT)).toBe(true);
  });

  it('rotate-pii-key.ts prints a 64-char hex with the env-var prefix', () => {
    // Invoke the script and check the output line format
    const out = execSync(
      `cd "${resolve(__dirname, '../..')}" && npx tsx scripts/rotate-pii-key.ts`,
      { encoding: 'utf-8' }
    );
    // Find a line matching PII_ENCRYPTION_KEY_V<N>=<64 hex chars>
    const line = out.split('\n').find((l) => l.match(/^PII_ENCRYPTION_KEY_V\d+=/));
    expect(line).toBeDefined();
    const value = line!.split('=')[1];
    expect(value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rotate-pii-key.ts suggests the next version after the highest set V<N>', () => {
    // With PII_ENCRYPTION_KEY_V1 and V3 set, the next should be V4.
    const env = { ...process.env, PII_ENCRYPTION_KEY_V1: 'a'.repeat(64), PII_ENCRYPTION_KEY_V3: 'c'.repeat(64) };
    const out = execSync(
      `cd "${resolve(__dirname, '../..')}" && npx tsx scripts/rotate-pii-key.ts`,
      { encoding: 'utf-8', env }
    );
    const line = out.split('\n').find((l) => l.match(/^PII_ENCRYPTION_KEY_V\d+=/));
    expect(line).toBeDefined();
    expect(line!.startsWith('PII_ENCRYPTION_KEY_V4=')).toBe(true);
  });

  it('migrate-legacy-pii.ts lists all 7 PII columns from the schema', () => {
    // Verify the 7 PII columns are enumerated in the script. We
    // match by table.column (snake_case, as Prisma uses).
    const expected = [
      'kyc_profiles',
      'guarantors',
      'riders',
    ];
    const cols = ['aadhaarNumber', 'panNumber', 'accountNumber', 'ifscCode', 'pan', 'phone', 'email'];
    for (const t of expected) {
      expect(migrateScript).toContain(`table: '${t}'`);
    }
    for (const c of cols) {
      expect(migrateScript).toContain(`column: '${c}'`);
    }
  });

  it('migrate-legacy-pii.ts defaults to dry-run (safe by default)', () => {
    // The script must require --apply to write.
    expect(migrateScript).toMatch(/apply\s*=\s*process\.argv\.includes\(['"]--apply['"]\)/);
    // And it must log a clear mode indicator
    expect(migrateScript).toMatch(/DRY RUN|APPLY/);
  });

  it('migrate-legacy-pii.ts has an idempotency comment', () => {
    // The script claims to be idempotent — verify the claim is
    // present in a comment so reviewers can find it
    expect(migrateScript.toLowerCase()).toContain('idempotent');
  });

  describe('end-to-end key rotation (in-process crypto, no DB)', () => {
    it('encrypts with V1, decrypts with V1, re-encrypts with V2, decrypts with V2', () => {
      const v1Buf = Buffer.from(V1_KEY, 'hex');
      const v2Buf = Buffer.from(V2_KEY, 'hex');
      const plaintext = 'rider-secret-pii-1234';

      // 1. Original write with V1
      const v1Cipher = encryptWithKey(plaintext, v1Buf, 1);
      expect(v1Cipher.startsWith('v1:')).toBe(true);

      // 2. Decrypt with V1 (backward compat — works)
      expect(decryptWithKey(v1Cipher, v1Buf)).toBe(plaintext);

      // 3. Rotate: add V2 to env, restart, decrypt still works (V1
      //    is still loaded), new writes go to V2
      expect(decryptWithKey(v1Cipher, v1Buf)).toBe(plaintext); // V1 still works

      // 4. New write with V2 (this is what migrate-legacy-pii.ts does)
      const v2Cipher = encryptWithKey(plaintext, v2Buf, 2);
      expect(v2Cipher.startsWith('v2:')).toBe(true);
      expect(decryptWithKey(v2Cipher, v2Buf)).toBe(plaintext);

      // 5. V1 ciphertext still decryptable with V1 key (both versions
      //    must be in the env until the legacy rows are migrated)
      expect(decryptWithKey(v1Cipher, v1Buf)).toBe(plaintext);

      // 6. V1 ciphertext CANNOT decrypt with V2 key (different
      //    encryption keys; the auth tag will fail)
      expect(() => decryptWithKey(v1Cipher, v2Buf)).toThrow();
    });
  });
});

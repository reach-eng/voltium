import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Key-versioned encryption keys: PII_ENCRYPTION_KEY_V1, PII_ENCRYPTION_KEY_V2, etc.
const KEY_VERSIONS = new Map<number, Buffer>();

function loadKeyVersions(): void {
  if (KEY_VERSIONS.size > 0) return;

  // Always require V1
  const v1 = process.env.PII_ENCRYPTION_KEY_V1 || process.env.PII_ENCRYPTION_KEY;
  if (!v1) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_ENCRYPTION_KEY_V1 environment variable is required in production.');
    }
    // Fallback key for dev/test
    KEY_VERSIONS.set(1, Buffer.from('dev-pii-encryption-key-32-bytes-'.substring(0, 32)));
    return;
  }

  const v1Buf = parseKey(v1);
  KEY_VERSIONS.set(1, v1Buf);

  // Load V2, V3, etc. for key rotation
  for (let i = 2; i <= 9; i++) {
    const envVal = process.env[`PII_ENCRYPTION_KEY_V${i}`];
    if (envVal) {
      const buf = parseKey(envVal);
      KEY_VERSIONS.set(i, buf);
    }
  }
}

function parseKey(key: string): Buffer {
  if (key.length !== 64) {
    throw new Error(
      `PII encryption key must be exactly 64 hex characters (32 bytes). Got ${key.length} chars.`
    );
  }
  // Verify it's valid hex
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('PII encryption key must be a 64-character hex string.');
  }
  return Buffer.from(key, 'hex');
}

function getLatestKey(): { version: number; key: Buffer } {
  loadKeyVersions();
  // Use the highest version number
  const maxVersion = Math.max(...KEY_VERSIONS.keys());
  return { version: maxVersion, key: KEY_VERSIONS.get(maxVersion)! };
}

function getKeyByVersion(version: number): Buffer | null {
  loadKeyVersions();
  return KEY_VERSIONS.get(version) || null;
}

export function encryptPii(text: string | null | undefined): string | null | undefined {
  if (text === null || text === undefined) return text;
  if (text === '') return '';

  try {
    const { version, key } = getLatestKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: v<version>:iv:authTag:encrypted
    return `v${version}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (e) {
    throw new Error(`PII encryption failed: ${e}`);
  }
}

export function decryptPii(cipherText: string | null | undefined): string | null | undefined {
  if (cipherText === null || cipherText === undefined) return cipherText;
  if (cipherText === '') return '';

  // Check if it's formatted with version prefix: v<version>:iv:authTag:encrypted
  // Also handle legacy format (no version): iv:authTag:encrypted
  const parts = cipherText.split(':');

  let version = 1;
  let ivHex: string;
  let authTagHex: string;
  let encryptedHex: string;

  if (parts.length === 4 && parts[0].startsWith('v')) {
    // New format: v1:iv:authTag:encrypted
    version = parseInt(parts[0].substring(1), 10);
    ivHex = parts[1];
    authTagHex = parts[2];
    encryptedHex = parts[3];
  } else if (parts.length === 3) {
    // Legacy format (no version): iv:authTag:encrypted
    ivHex = parts[0];
    authTagHex = parts[1];
    encryptedHex = parts[2];
  } else {
    // Return original string if not encrypted (backward compat for unencrypted fields)
    return cipherText;
  }

  const key = getKeyByVersion(version);
  if (!key) {
    throw new Error(`PII decryption failed: unknown key version v${version}`);
  }

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (err) {
    // Throw on auth-tag failure (tampered ciphertext) instead of returning garbage
    throw new Error(`PII decryption failed: ${err instanceof Error ? err.message : err}`);
  }
}

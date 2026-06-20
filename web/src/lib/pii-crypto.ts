import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_ENCRYPTION_KEY environment variable is required in production.');
    }
    // Fallback key for dev/test
    return Buffer.from('dev-pii-encryption-key-32-bytes-'.substring(0, 32));
  }

  // If key is hex representation of 32 bytes (64 chars), parse it
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // Otherwise, use key bytes directly (pad or truncate to 32 bytes)
  const keyBuf = Buffer.from(key);
  if (keyBuf.length >= 32) {
    return keyBuf.subarray(0, 32);
  }

  // Pad if too short
  return Buffer.concat([keyBuf, Buffer.alloc(32 - keyBuf.length)]);
}

export function encryptPii(text: string | null | undefined): string | null | undefined {
  if (text === null || text === undefined) return text;
  if (text === '') return '';

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (e) {
    throw new Error(`PII encryption failed: ${e}`);
  }
}

export function decryptPii(cipherText: string | null | undefined): string | null | undefined {
  if (cipherText === null || cipherText === undefined) return cipherText;
  if (cipherText === '') return '';

  // Check if it's formatted as iv:authTag:encrypted
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // Return original string if not encrypted
    return cipherText;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (err) {
    // Return original cipher text if decryption fails (useful for local fallback or development schema mismatches)
    return cipherText;
  }
}

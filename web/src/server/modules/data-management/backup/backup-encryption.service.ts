/**
 * Backup — Encryption Service
 *
 * AES-256-GCM encryption for backup files.
 */

import { readFileSync, writeFileSync } from 'fs';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { ValidationError } from "@/lib/api-error";

/**
 * Encrypt a file in-place using AES-256-GCM. The ciphertext format is:
 *   [12-byte IV][16-byte GCM auth tag][ciphertext...]
 * The original file is replaced with the encrypted version.
 * Returns the new file path (unchanged; content is replaced in-place).
 */
export function encryptFile(filePath: string, keyHex: string): void {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new ValidationError('BACKUP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = readFileSync(filePath);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Write: IV (12) + auth tag (16) + ciphertext
  writeFileSync(filePath, Buffer.concat([iv, authTag, encrypted]));
}

/**
 * Decrypt a file in-place that was encrypted with `encryptFile`.
 * The ciphertext format is: [12-byte IV][16-byte GCM auth tag][ciphertext...]
 * The encrypted file is replaced with the plaintext version.
 */
export function decryptFile(filePath: string, keyHex: string): void {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new ValidationError('BACKUP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  const data = readFileSync(filePath);
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  writeFileSync(filePath, decrypted);
}

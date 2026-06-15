/**
 * Password hashing using Web Crypto API (Edge Runtime compatible).
 * Uses PBKDF2 with SHA-256, 100k iterations, 16-byte salt.
 *
 * Format: `$pbkdf2$100000$<base64salt>$<base64hash>`
 */

const ITERATIONS = 100_000;
const MAX_ITERATIONS = 10_000_000;
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Hash a plaintext password.
 * Returns a formatted string containing algorithm, iterations, salt, and hash.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBuf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_LENGTH * 8
  );

  return `$pbkdf2$${ITERATIONS}$${toBase64(salt.buffer as ArrayBuffer)}$${toBase64(hashBuf)}`;
}

/**
 * Verify a plaintext password against a hashed password.
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  if (!hashedPassword.startsWith('$pbkdf2$')) {
    return false;
  }

  const parts = hashedPassword.split('$');
  if (parts.length !== 5) return false;

  const iterations = Math.min(parseInt(parts[2], 10), MAX_ITERATIONS);
  const salt = fromBase64(parts[3]);
  const expectedHash = fromBase64(parts[4]);

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const hashBuf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
    keyMaterial,
    expectedHash.length * 8
  );

  // Constant-time comparison
  const computed = new Uint8Array(hashBuf);
  if (computed.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed[i] ^ expectedHash[i];
  }
  return diff === 0;
}

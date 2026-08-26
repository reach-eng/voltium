import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { encryptPii, decryptPii } from '@/lib/pii-crypto';

describe('pii-crypto', () => {
  // Save original env so we can restore between tests
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset to a known state before each test
    delete process.env.PII_ENCRYPTION_KEY_V1;
    delete process.env.PII_ENCRYPTION_KEY;
    delete process.env.ALLOW_DEV_PII_KEY;
    delete process.env.APP_ENV;
    delete process.env.NODE_ENV;
  });

  it('should encrypt and decrypt correctly', () => {
    process.env.PII_ENCRYPTION_KEY_V1 =
      'a'.repeat(64); // 32 bytes hex
    const text = '1234-5678-9012';
    const encrypted = encryptPii(text);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(text);
    expect(encrypted?.split(':').length).toBe(4);

    const decrypted = decryptPii(encrypted);
    expect(decrypted).toBe(text);
  });

  it('should return null or empty when input is null or empty', () => {
    process.env.PII_ENCRYPTION_KEY_V1 = 'a'.repeat(64);
    expect(encryptPii(null)).toBeNull();
    expect(encryptPii(undefined)).toBeUndefined();
    expect(encryptPii('')).toBe('');

    expect(decryptPii(null)).toBeNull();
    expect(decryptPii(undefined)).toBeUndefined();
    expect(decryptPii('')).toBe('');
  });

  it('should gracefully handle unencrypted data when decrypting', () => {
    process.env.PII_ENCRYPTION_KEY_V1 = 'a'.repeat(64);
    const plainText = 'normal plaintext';
    expect(decryptPii(plainText)).toBe(plainText);
  });

  // ── Phase 6.2: prod-env guard on dev-key fallback ──────────────────────

  it('throws in production when no PII key is set, even with ALLOW_DEV_PII_KEY=true', async () => {
    process.env.APP_ENV = 'production';
    process.env.ALLOW_DEV_PII_KEY = 'true';
    // Re-import to pick up fresh env (loadKeyVersions memoizes)
    vi.resetModules();
    const { encryptPii: prodEncrypt } = await import('@/lib/pii-crypto');
    expect(() => prodEncrypt('test')).toThrow(/PII_ENCRYPTION_KEY_V1 is required in production/);
  });

  it('throws in production when no PII key is set, even with NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEV_PII_KEY = 'true';
    vi.resetModules();
    const { encryptPii: prodEncrypt } = await import('@/lib/pii-crypto');
    expect(() => prodEncrypt('test')).toThrow(/PII_ENCRYPTION_KEY_V1 is required in production/);
  });

  it('falls back to dev key in development when ALLOW_DEV_PII_KEY=true', async () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_ENV = 'development';
    process.env.ALLOW_DEV_PII_KEY = 'true';
    vi.resetModules();
    const { encryptPii: devEncrypt, decryptPii: devDecrypt } = await import('@/lib/pii-crypto');
    const encrypted = devEncrypt('hello');
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe('hello');
    expect(devDecrypt(encrypted)).toBe('hello');
  });

  it('throws in development when no PII key is set and ALLOW_DEV_PII_KEY is not set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.APP_ENV = 'development';
    vi.resetModules();
    const { encryptPii: devEncrypt } = await import('@/lib/pii-crypto');
    expect(() => devEncrypt('test')).toThrow(/PII_ENCRYPTION_KEY_V1 is required/);
  });
});

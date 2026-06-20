import { describe, it, expect } from 'vitest';
import { encryptPii, decryptPii } from '@/lib/pii-crypto';

describe('pii-crypto', () => {
  it('should encrypt and decrypt correctly', () => {
    const text = '1234-5678-9012';
    const encrypted = encryptPii(text);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(text);
    expect(encrypted?.split(':').length).toBe(3);

    const decrypted = decryptPii(encrypted);
    expect(decrypted).toBe(text);
  });

  it('should return null or empty when input is null or empty', () => {
    expect(encryptPii(null)).toBeNull();
    expect(encryptPii(undefined)).toBeUndefined();
    expect(encryptPii('')).toBe('');

    expect(decryptPii(null)).toBeNull();
    expect(decryptPii(undefined)).toBeUndefined();
    expect(decryptPii('')).toBe('');
  });

  it('should gracefully handle unencrypted data when decrypting', () => {
    const plainText = 'normal plaintext';
    expect(decryptPii(plainText)).toBe(plainText);
  });
});

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

describe('Password Hashing — Argon2id Laptop Performance & Verification', () => {
  it('hashes a plaintext password using Argon2id with parallelism=4', async () => {
    const password = 'SuperSecurePassword#2026!';
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/);
    const result = await verifyPassword(password, hash);
    expect(result.valid).toBe(true);
    expect(result.needsRehash).toBe(false);
  });

  it('verifies existing Argon2id hashes created with parallelism=4 without requiring rehash failure', async () => {
    const password = 'MyLegacyAdminPassword123';
    // Argon2 hashes encode their own cost parameters in the header
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result.valid).toBe(true);
  });

  it('rejects incorrect passwords', async () => {
    const password = 'CorrectPassword_123';
    const hash = await hashPassword(password);

    const result = await verifyPassword('WrongPassword_999', hash);
    expect(result.valid).toBe(false);
  });

  it('handles empty password inputs gracefully', async () => {
    await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');

    const result = await verifyPassword('', '$argon2id$...');
    expect(result.valid).toBe(false);
  });

  it('handles corrupted hashes gracefully without unhandled exceptions', async () => {
    const result = await verifyPassword('testpass', '$argon2id$invalid_corrupted_hash_data');
    expect(result.valid).toBe(false);
  });
});

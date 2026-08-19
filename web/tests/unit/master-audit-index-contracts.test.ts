import { describe, it, expect } from 'vitest';
import { OutboxEventTypes } from '@/server/workers/outbox';

describe('Master Audit Index (AUDIT_INDEX_2026-08-03.md) Contracts', () => {
  it('reclassification #84: parsePositiveInt handles NaN safely', async () => {
    const { parsePositiveInt } = await import('@/lib/api-utils');
    expect(parsePositiveInt('abc', 1)).toBe(1);
    expect(parsePositiveInt('10', 1)).toBe(10);
  });

  it('reclassification #94: OutboxEventTypes contains RENT_PAID and ANNOUNCEMENT_BROADCAST', () => {
    expect(OutboxEventTypes.RENT_PAID).toBe('rent.paid');
    expect(OutboxEventTypes.ANNOUNCEMENT_BROADCAST).toBe('announcement.broadcast');
  });

  it('reclassification #95: credential encryption/decryption works idempotently', async () => {
    const { encryptCredential, decryptCredential } = await import('@/lib/credentials');
    const secret = 'webhook_secret_key_456';
    const encrypted = encryptCredential(secret);
    expect(encrypted).not.toBe(secret);
    expect(decryptCredential(encrypted)).toBe(secret);
  });
});

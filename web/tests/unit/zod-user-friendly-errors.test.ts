import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  formatZodIssueMessage,
  formatZodError,
  validateBody,
} from '@/lib/validators';

describe('User-Friendly Zod Error Formatting', () => {
  it('formats missing / required fields with friendly messages', () => {
    const schema = z.object({
      riderName: z.string(),
      emailAddress: z.string().email(),
    });

    const result = validateBody(schema, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('is required');
    expect(result.details?.fieldErrors.riderName).toBeDefined();
    expect(result.details?.fieldErrors.riderName[0]).toBe('Rider Name is required');
  });

  it('formats invalid enum values with allowed options list', () => {
    const schema = z.object({
      role: z.enum(['ADMIN', 'MANAGER', 'SUPPORT']),
    });

    const result = validateBody(schema, { role: 'HACKER' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Allowed values: ADMIN, MANAGER, SUPPORT');
  });

  it('formats too_small and too_big string / number constraints cleanly', () => {
    const schema = z.object({
      password: z.string().min(8),
      amount: z.number().min(10).max(500),
    });

    const result = validateBody(schema, { password: '123', amount: 5 });
    expect(result.success).toBe(false);
    expect(result.details?.fieldErrors.password[0]).toBe('Password must be at least 8 characters');
    expect(result.details?.fieldErrors.amount[0]).toBe('Amount must be at least 10');

    const maxResult = validateBody(schema, { password: '12345678', amount: 1000 });
    expect(maxResult.success).toBe(false);
    expect(maxResult.details?.fieldErrors.amount[0]).toBe('Amount cannot exceed 500');
  });

  it('preserves custom explicit schema error messages', () => {
    const schema = z.object({
      phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
    });

    const result = validateBody(schema, { phone: 'abc' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Phone must be exactly 10 digits');
  });

  it('returns success: true and data on valid input', () => {
    const schema = z.object({
      id: z.string(),
      count: z.number().int(),
    });

    const result = validateBody(schema, { id: 'x-1', count: 5 });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 'x-1', count: 5 });
    expect(result.error).toBeNull();
  });
});

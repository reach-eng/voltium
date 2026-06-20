import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requireCronAuth } from '@/lib/cron-auth';

describe('requireCronAuth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should reject when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    const req = new Request('http://localhost/api/cron', {
      headers: { authorization: 'Bearer super-secret-value-longer-than-16-chars' },
    });
    const result = requireCronAuth(req as any);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(503);
  });

  it('should reject when CRON_SECRET is too short', () => {
    process.env.CRON_SECRET = 'short';
    const req = new Request('http://localhost/api/cron', {
      headers: { authorization: 'Bearer short' },
    });
    const result = requireCronAuth(req as any);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(503);
  });

  it('should reject when Authorization header is missing', () => {
    process.env.CRON_SECRET = 'super-secret-value-longer-than-16-chars';
    const req = new Request('http://localhost/api/cron');
    const result = requireCronAuth(req as any);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('should reject when Authorization header is invalid', () => {
    process.env.CRON_SECRET = 'super-secret-value-longer-than-16-chars';
    const req = new Request('http://localhost/api/cron', {
      headers: { authorization: 'Bearer wrong-secret-value-here' },
    });
    const result = requireCronAuth(req as any);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(401);
  });

  it('should accept when CRON_SECRET is valid and matches Bearer token', () => {
    const validSecret = 'super-secret-value-longer-than-16-chars';
    process.env.CRON_SECRET = validSecret;
    const req = new Request('http://localhost/api/cron', {
      headers: { authorization: `Bearer ${validSecret}` },
    });
    const result = requireCronAuth(req as any);
    expect(result).toBeNull();
  });
});

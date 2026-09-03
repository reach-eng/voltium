import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('CORS Policy & Origin Validation', () => {
  function evaluateCors(origin: string | null, envConfig: { ALLOWED_ORIGINS?: string; APP_ENV?: string; NODE_ENV?: string }) {
    const allowedOrigins = envConfig.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? [];
    const isDev =
      envConfig.APP_ENV === 'development' ||
      (envConfig.APP_ENV !== 'production' && envConfig.APP_ENV !== 'staging' && envConfig.NODE_ENV === 'development');
    const isLocalhostDev =
      Boolean(isDev &&
      origin &&
      (origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.')));

    const isAllowed = Boolean(origin && (allowedOrigins.includes(origin) || isLocalhostDev));
    return {
      allowed: isAllowed,
      header: isAllowed ? origin : null,
    };
  }

  it('rejects arbitrary malicious origins in all environments', () => {
    const resDev = evaluateCors('https://evil-attacker.com', {
      APP_ENV: 'development',
      NODE_ENV: 'development',
      ALLOWED_ORIGINS: 'https://admin.voltium.in,https://app.voltium.in',
    });
    expect(resDev.allowed).toBe(false);
    expect(resDev.header).toBeNull();

    const resProd = evaluateCors('https://evil-attacker.com', {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://admin.voltium.in,https://app.voltium.in',
    });
    expect(resProd.allowed).toBe(false);
    expect(resProd.header).toBeNull();
  });

  it('allows explicitly configured ALLOWED_ORIGINS in production', () => {
    const res = evaluateCors('https://admin.voltium.in', {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://admin.voltium.in,https://app.voltium.in',
    });
    expect(res.allowed).toBe(true);
    expect(res.header).toBe('https://admin.voltium.in');
  });

  it('allows localhost and local dev IPs in development mode', () => {
    const resLocalhost = evaluateCors('http://localhost:3000', {
      APP_ENV: 'development',
      NODE_ENV: 'development',
      ALLOWED_ORIGINS: 'https://admin.voltium.in',
    });
    expect(resLocalhost.allowed).toBe(true);
    expect(resLocalhost.header).toBe('http://localhost:3000');

    const resIp = evaluateCors('http://192.168.1.50:8081', {
      APP_ENV: 'development',
      NODE_ENV: 'development',
      ALLOWED_ORIGINS: 'https://admin.voltium.in',
    });
    expect(resIp.allowed).toBe(true);
  });

  it('rejects unlisted localhost origins in production or staging mode', () => {
    const resProd = evaluateCors('http://localhost:3000', {
      APP_ENV: 'production',
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://admin.voltium.in,https://app.voltium.in',
    });
    expect(resProd.allowed).toBe(false);
    expect(resProd.header).toBeNull();

    const resStaging = evaluateCors('http://localhost:3000', {
      APP_ENV: 'staging',
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://staging.voltium.in',
    });
    expect(resStaging.allowed).toBe(false);
    expect(resStaging.header).toBeNull();
  });
});

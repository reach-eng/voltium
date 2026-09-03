import { describe, it, expect } from 'vitest';
import { getApiVersion, getVersionedPath, API_VERSION, SUPPORTED_VERSIONS } from '@/lib/api-version';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import nextConfig from '../../next.config.mjs';

describe('API Versioning Architecture', () => {
  it('identifies API version from path prefix /api/v1/...', () => {
    const req = new NextRequest('http://localhost:8081/api/v1/rider/profile');
    expect(getApiVersion(req)).toBe('v1');
  });

  it('identifies API version from query param and accept header', () => {
    const reqWithQuery = new NextRequest('http://localhost:8081/api/rider/profile?api-version=v1');
    expect(getApiVersion(reqWithQuery)).toBe('v1');

    const reqWithHeader = new NextRequest('http://localhost:8081/api/rider/profile', {
      headers: { accept: 'application/json; api-version=v1' },
    });
    expect(getApiVersion(reqWithHeader)).toBe('v1');
  });

  it('defaults to canonical API_VERSION v1 when no explicit version is specified', () => {
    const req = new NextRequest('http://localhost:8081/api/rider/profile');
    expect(getApiVersion(req)).toBe(API_VERSION);
    expect(SUPPORTED_VERSIONS).toContain('v1');
  });

  it('getVersionedPath correctly transforms unversioned paths', () => {
    expect(getVersionedPath('/api/rider/profile')).toBe('/api/v1/rider/profile');
    expect(getVersionedPath('/api/v1/rider/profile')).toBe('/api/v1/rider/profile');
  });

  it('middleware attaches Api-Version and X-Api-Version headers to /api/ requests', async () => {
    const req = new NextRequest('http://localhost:8081/api/health');
    const res = await middleware(req);
    expect(res.headers.get('Api-Version')).toBe('v1');
    expect(res.headers.get('X-Api-Version')).toBe('1.0.0');
  });

  it('middleware rejects unsupported API versions with 400 Bad Request', async () => {
    const req = new NextRequest('http://localhost:8081/api/v2/rider/profile');
    const res = await middleware(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNSUPPORTED_API_VERSION');
  });

  it('next.config.mjs defines transparent rewrites from /api/v1/:path* to /api/:path*', async () => {
    const rewrites = await (nextConfig as any).rewrites();
    const rewriteList = Array.isArray(rewrites) ? rewrites : rewrites?.beforeFiles || [];
    const v1Rewrite = rewriteList.find((r: any) => r.source === '/api/v1/:path*');
    expect(v1Rewrite).toBeDefined();
    expect(v1Rewrite.destination).toBe('/api/:path*');
  });
});

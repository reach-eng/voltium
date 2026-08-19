import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/riders/route';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { getOrSetResponse } from '@/lib/cache';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

// PR-7 (2026-08-06 fix-plan; 1st audit P0-1): the data-deletion queue lists
// soft-deleted riders via ?deleted=true. This gate locks the route→use-case
// plumbing: the flag must reach the list filters AND be part of the cache key
// (otherwise a cached live listing would serve the deleted queue).
vi.mock('@/lib/get-session', () => ({
  getAdminSession: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  hasPermission: vi.fn(),
}));
vi.mock('@/lib/cache', () => ({
  getOrSetResponse: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
  invalidateCache: vi.fn(),
}));
vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    list: vi.fn().mockResolvedValue({
      riders: [],
      pagination: { page: 1, limit: 20, total: 0 },
    }),
  },
}));

describe('GET /api/admin/riders (PR-7 ?deleted=true filter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminSession).mockResolvedValue({
      adminId: 'admin-1',
      role: 'admin',
    } as any);
    vi.mocked(hasPermission).mockReturnValue(true);
  });

  it('passes deleted=true to the list filters and cache key', async () => {
    const req = new NextRequest('http://localhost/api/admin/riders?deleted=true');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const callArgs = vi.mocked(getOrSetResponse).mock.calls[0];
    expect(callArgs[0]).toContain('true'); // cache key includes the flag
    expect(adminRiderUseCases.list).toHaveBeenCalledWith(
      expect.objectContaining({ deleted: true })
    );
  });

  it('passes deleted=false (default) for a normal listing', async () => {
    const req = new NextRequest('http://localhost/api/admin/riders');
    await GET(req);

    expect(adminRiderUseCases.list).toHaveBeenCalledWith(
      expect.objectContaining({ deleted: false })
    );
  });

  it('treats any non-"true" value as a live listing', async () => {
    const req = new NextRequest(
      'http://localhost/api/admin/riders?deleted=1&deleted=TRUE'
    );
    await GET(req);

    expect(adminRiderUseCases.list).toHaveBeenCalledWith(
      expect.objectContaining({ deleted: false })
    );
  });
});

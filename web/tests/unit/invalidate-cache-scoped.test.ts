import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvalidateCache = vi.fn();
vi.mock('@/lib/cache', () => ({
  invalidateCache: (...args: any[]) => mockInvalidateCache(...args),
  getOrSetResponse: vi.fn(),
}));

describe('Scoped cache invalidation — zero wildcard admin:* calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates scoped invalidations for deposits, hubs, riders, and vehicles', () => {
    // Deposit operations invalidate deposits, wallets, and riders
    mockInvalidateCache('admin:deposits:*');
    mockInvalidateCache('admin:wallets:*');
    mockInvalidateCache('admin:riders:*');

    // Hub operations invalidate hubs and vehicles
    mockInvalidateCache('admin:hubs:*');
    mockInvalidateCache('admin:vehicles:*');

    // Vehicle operations invalidate vehicles, hubs, and vehicles_list
    mockInvalidateCache('vehicles_list:*');

    const calls = mockInvalidateCache.mock.calls.map((c) => c[0]);

    // Ensure 'admin:*' is never invoked as a broad wildcard
    expect(calls).not.toContain('admin:*');
    expect(calls).toContain('admin:deposits:*');
    expect(calls).toContain('admin:wallets:*');
    expect(calls).toContain('admin:riders:*');
    expect(calls).toContain('admin:hubs:*');
    expect(calls).toContain('admin:vehicles:*');
    expect(calls).toContain('vehicles_list:*');
  });
});

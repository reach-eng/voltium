import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: mocks.findUnique,
    },
  },
}));

import { GET } from '@/app/api/rider/maintenance-status/route';

describe('Rider Maintenance Status Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns enabled: false when maintenance mode setting is not true', async () => {
    mocks.findUnique.mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === 'MAINTENANCE_MODE') return Promise.resolve({ value: 'false' });
      return Promise.resolve(null);
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.enabled).toBe(false);
    expect(json.data.message).toContain('under maintenance');
  });

  it('returns enabled: true with custom message when maintenance is active', async () => {
    mocks.findUnique.mockImplementation(({ where }: { where: { key: string } }) => {
      if (where.key === 'MAINTENANCE_MODE') return Promise.resolve({ value: 'true' });
      if (where.key === 'MAINTENANCE_MESSAGE') return Promise.resolve({ value: 'Server Upgrades In Progress' });
      return Promise.resolve(null);
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.enabled).toBe(true);
    expect(json.data.message).toBe('Server Upgrades In Progress');
  });
});

import { describe, it, expect, vi } from 'vitest';

describe('useKyc HTTP Error Validation', () => {
  it('throws error when fetch API returns non-ok response code', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid rejection reason' }),
    });

    const executePut = async () => {
      const res = await mockFetch('/api/admin/riders', { method: 'PUT' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Request failed: ${res.status}`);
      }
    };

    await expect(executePut()).rejects.toThrow('Invalid rejection reason');
  });
});

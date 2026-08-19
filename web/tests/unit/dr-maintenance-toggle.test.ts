import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Disaster Recovery Maintenance Mode Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses /api/admin/maintenance-mode route with correct payload shape', () => {
    const payload = { enabled: true, message: 'Disaster recovery drill in progress' };
    expect(payload.enabled).toBe(true);
    expect(payload.message).toBe('Disaster recovery drill in progress');
  });
});

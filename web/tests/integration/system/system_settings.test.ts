import { describe, it, expect } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('System Settings Integration Tests', () => {
  it('allows fetching system settings list with read-only and editable categories', async () => {
    const cookie = await adminLogin();
    const { status, body } = await api('/api/admin/system-settings', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.editable).toBeDefined();
    expect(body.data.readOnly).toBeDefined();
    expect(body.data.readOnly.NODE_ENV).toBeDefined();
    expect(body.data.readOnly.STORAGE_PROVIDER).toBeDefined();
  });

  it('rejects system settings query for unauthorized users', async () => {
    const { status } = await api('/api/admin/system-settings', {
      method: 'GET',
    });

    expect(status).toBe(401);
  });

  it('rejects setting updates from dev session returning 403', async () => {
    const cookie = await adminLogin();
    const { status, body } = await api('/api/admin/system-settings', {
      method: 'PUT',
      cookie,
      json: {
        key: 'ANY_SETTING_KEY',
        value: 'some_value',
      },
    });

    // The endpoint checks session.role !== 'SUPER_ADMIN' (which is 'admin' for dev session), returning 403
    expect(status).toBe(403);
    expect(body.error).toContain('SUPER_ADMIN required');
  });

  it('rejects updates with missing parameters for unauthorized users', async () => {
    const { status } = await api('/api/admin/system-settings', {
      method: 'PUT',
      json: {
        key: '',
      },
    });

    expect(status).toBe(401);
  });
});

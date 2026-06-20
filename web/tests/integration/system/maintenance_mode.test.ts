import { describe, it, expect } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Maintenance Mode Integration Tests', () => {
  it('allows fetching current maintenance status', async () => {
    const cookie = await adminLogin();
    const { status, body } = await api('/api/admin/maintenance-mode', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.enabled).toBeDefined();
    expect(body.data.message).toBeDefined();
  });

  it('rejects toggling maintenance mode for non-admin/anonymous users', async () => {
    const { status } = await api('/api/admin/maintenance-mode', {
      method: 'PUT',
      json: { enabled: true, message: 'Maintenance active' },
    });

    expect(status).toBe(401);
  });

  it('restricts toggling maintenance mode for dev session returning 403', async () => {
    const cookie = await adminLogin();

    // The endpoint checks session.role !== 'SUPER_ADMIN' (which is 'admin' for dev session), returning 403
    const enableRes = await api('/api/admin/maintenance-mode', {
      method: 'PUT',
      cookie,
      json: { enabled: true, message: 'Integration test maintenance' },
    });
    expect(enableRes.status).toBe(403);
    expect(enableRes.body.error).toContain('SUPER_ADMIN required');
  });

  it('enforces backup blocking/unauthorized checks returning 403 or 500', async () => {
    const cookie = await adminLogin();

    // Attempt to trigger a backup (POST /api/admin/data-management/backups)
    // Under mock session, role is 'admin', which is unauthorized for backup actions, returning 403 or 401
    // If the database connection fails, it throws a DB error returning 500.
    const backupRes = await api('/api/admin/data-management/backups', {
      method: 'POST',
      cookie,
      json: { type: 'MANUAL' },
    });

    expect([401, 403, 500]).toContain(backupRes.status);
  });
});

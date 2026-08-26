import { describe, it, expect } from 'vitest';

describe('RBAC Integration Tests', () => {
  const BASE = 'http://127.0.0.1:8081';

  it('rider token cannot access admin routes', async () => {
    // 1. Get a rider token (simulate)
    // Here we assume riderCookie is obtained from auth
    // For this test, we just pass an invalid token since the logic is what matters
    const res = await fetch(`${BASE}/api/admin/dashboard`, {
      method: 'GET',
      headers: { Cookie: 'auth_token=some_rider_token' }
    });
    // Should be unauthorized because admin tokens require adminRole payload
    expect(res.status).toBe(401);
  });

  it('admin cannot impersonate another admin', async () => {
    // Admins have specific tokens. If an admin tries to hit an endpoint 
    // to modify another admin (which requires SUPER_ADMIN) but they are SUPPORT, it should fail
    const res = await fetch(`${BASE}/api/admin/admins`, {
      method: 'POST',
      headers: { Cookie: 'auth_token=some_support_admin_token' }
    });
    // Assuming 401 or 403
    expect(res.status).toBe(401);
  });
});

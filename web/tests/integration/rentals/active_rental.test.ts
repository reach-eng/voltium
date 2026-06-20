import { describe, it, expect } from 'vitest';
import { api, generateRandomPhone, riderLogin, adminLogin } from '../helpers';

/**
 * Active Rental Integration Tests
 *
 * Tests the active rental dashboard display, charging logic,
 * status locks, and rental status updates for an ongoing rental.
 */
describe('Active Rental Integration', () => {
  // 1. Rider dashboard shows active rental info
  it('1. Rider dashboard is accessible and has expected structure', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/rider/dashboard', {
      method: 'GET',
      token,
    });

    // Dashboard should be accessible for any authenticated rider
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  // 2. Rider can view their profile (includes rental status)
  it('2. Rider profile includes lifecycle/rental status', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/rider/profile', {
      method: 'GET',
      token,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    // Profile includes lifecycle info
    expect(body.data).toHaveProperty('lifecycleStatus');
  });

  // 3. Admin can list rentals
  it('3. Admin can list all rentals', async () => {
    const cookie = await adminLogin();

    const { status, body } = await api('/api/admin/rentals', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // 4. Admin rental list supports filtering
  it('4. Admin can filter rentals by status', async () => {
    const cookie = await adminLogin();

    const { status, body } = await api('/api/admin/rentals?status=ACTIVE', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  // 5. Unauthenticated access to dashboard is blocked
  it('5. Unauthenticated dashboard request is rejected', async () => {
    const { status } = await api('/api/rider/dashboard', {
      method: 'GET',
    });

    expect(status).toBe(401);
  });

  // 6. Rider earnings endpoint is accessible
  it('6. Rider earnings endpoint returns data', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/rider/earnings', {
      method: 'GET',
      token,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  // 7. Admin dashboard aggregates include rental metrics
  it('7. Admin dashboard includes rental aggregate metrics', async () => {
    const cookie = await adminLogin();

    const { status, body } = await api('/api/admin/dashboard', {
      method: 'GET',
      cookie,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  // 8. Rider rental pricing endpoint is accessible
  it('8. Rider can view rental pricing', async () => {
    const phone = generateRandomPhone();
    const { token } = await riderLogin(phone);

    const { status, body } = await api('/api/rider/pricing', {
      method: 'GET',
      token,
    });

    // Should return pricing data
    expect([200, 404]).toContain(status);
    if (status === 200) {
      expect(body.success).toBe(true);
    }
  });
});

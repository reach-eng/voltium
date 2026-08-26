import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin, riderLogin, generateRandomPhone } from '../helpers';

describe('GET /api/admin/scores', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  it('1. returns 200 with list of scores', async () => {
    const { status, body } = await api('/api/admin/scores', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data?.scores)).toBe(true);
  });

  it('2. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/scores', { method: 'GET' });
    expect(status).toBe(401);
  });
});

describe('POST /api/admin/scores', () => {
  let adminCookie: string;
  let testRiderId: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
    const phone = generateRandomPhone();
    const rider = await riderLogin(phone);
    testRiderId = rider.id; // DB id for rider
  });

  it('1. recalculates score for a rider', async () => {
    const { status, body } = await api('/api/admin/scores', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        riderId: testRiderId,
      },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('2. returns 422 when riderId is missing', async () => {
    const { status } = await api('/api/admin/scores', {
      method: 'POST',
      cookie: adminCookie,
      json: {},
    });
    expect(status).toBe(422);
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/scores', {
      method: 'POST',
      json: {
        riderId: testRiderId,
      },
    });
    expect(status).toBe(401);
  });
});

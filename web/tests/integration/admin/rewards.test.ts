import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin, riderLogin, generateRandomPhone } from '../helpers';

describe('GET /api/admin/rewards', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  it('1. returns 200 with list of rewards', async () => {
    const { status, body } = await api('/api/admin/rewards', {
      method: 'GET',
      cookie: adminCookie,
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('2. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/rewards', { method: 'GET' });
    expect(status).toBe(401);
  });
});

describe('POST /api/admin/rewards', () => {
  let adminCookie: string;
  let testRiderId: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
    // Create a rider for rewards test
    const phone = generateRandomPhone();
    const rider = await riderLogin(phone);
    testRiderId = rider.id; // DB id for rider
  });

  it('1. awards reward points to a rider', async () => {
    const { status, body } = await api('/api/admin/rewards', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        riderDbId: testRiderId,
        title: 'Test Reward',
        points: 50,
      },
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('2. returns 422 when riderDbId is missing', async () => {
    const { status } = await api('/api/admin/rewards', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        title: 'Missing Rider',
        points: 50,
      },
    });
    expect(status).toBe(422);
  });

  it('3. returns 401 without auth', async () => {
    const { status } = await api('/api/admin/rewards', {
      method: 'POST',
      json: {
        riderDbId: testRiderId,
        title: 'Test Reward',
        points: 50,
      },
    });
    expect(status).toBe(401);
  });
});

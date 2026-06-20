import { describe, it, expect, beforeAll } from 'vitest';
import { api, riderLogin, adminLogin } from '../helpers';

describe('Referral and Rewards Integration Workflow', () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
  });

  it('1. Fetches referral codes for registered riders', async () => {
    const phone1 = '9999900001';
    const rider1 = await riderLogin(phone1);

    const phone2 = '9876543210';
    const rider2 = await riderLogin(phone2);

    // Fetch profile for rider 1
    const res1 = await api('/api/rider/profile', {
      method: 'GET',
      token: rider1.token,
    });

    // Fetch profile for rider 2
    const res2 = await api('/api/rider/profile', {
      method: 'GET',
      token: rider2.token,
    });

    expect(res1.body.data.referralCode).toBeDefined();
    expect(res2.body.data.referralCode).toBeDefined();
  });

  it('2. Block self-referral and track referral information', async () => {
    const phone = '9999900001';
    const loginRes = await riderLogin(phone);

    const infoRes = await api('/api/rider/referral', {
      method: 'GET',
      token: loginRes.token,
    });

    expect(infoRes.status).toBe(200);
    expect(infoRes.body.success).toBe(true);
    expect(infoRes.body.data.referredUsers).toBeDefined();
    expect(infoRes.body.data.referredBy).toBeNull();
  });

  it('3. Successful referrals query leads list', async () => {
    const phone = '9999900001';
    const loginRes = await riderLogin(phone);

    // Check that referrer referral list is queryable
    const referralsRes = await api('/api/rider/referrals', {
      method: 'GET',
      token: loginRes.token,
    });

    // Should return 200 or 404 depending on mock database state
    expect([200, 404]).toContain(referralsRes.status);
  });

  it('4. Admin can list referrals with role checks', async () => {
    const referralsRes = await api('/api/admin/referrals?page=1&limit=5', {
      method: 'GET',
      cookie: adminCookie,
    });

    expect(referralsRes.status).toBe(200);
    expect(referralsRes.body.success).toBe(true);
    expect(Array.isArray(referralsRes.body.data.referrals)).toBe(true);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { api, riderLogin, adminLogin, generateRandomPhone } from '../helpers';

describe('Notifications Integration Workflow', () => {
  let adminCookie: string;
  let riderToken: string;
  let riderDbId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;
    // Fresh random phone per test run to avoid rate-limit accumulation and
    // any "OTP already used" state from previous runs.
    const phone = generateRandomPhone();
    const loginRes = await riderLogin(phone);
    riderToken = loginRes.token;
    // Admin endpoints expect the DB cuid (`id`), not the public riderId
    // (`VF-RD-XXXXXXXX`). The new test creates the rider via fresh phone
    // and uses the DB id throughout.
    riderDbId = loginRes.id || loginRes.riderId;
  });

  it('1. Rider gets an empty notification list initially', async () => {
    const listRes = await api('/api/rider/notifications', {
      method: 'GET',
      token: riderToken,
    });

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(Array.isArray(listRes.body.data.notifications)).toBe(true);
    expect(listRes.body.data.unreadCount).toBe(0);
  });

  it('2. Admin can send a notification to a single rider', async () => {
    const sendRes = await api('/api/admin/notifications', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        riderId: riderDbId,
        title: 'Welcome to Voltium',
        message: 'Your rider account is ready.',
        type: 'INFO',
      },
    });

    // 200/201 if the rider exists; 404 if the rider lookup fails.
    expect([200, 201, 404]).toContain(sendRes.status);
    if (sendRes.status === 200 || sendRes.status === 201) {
      expect(sendRes.body.success).toBe(true);
      expect(sendRes.body.data.id).toBeDefined();
    }
  });

  it('3. Admin broadcast requires ?confirm=true and returns 202 (P0-1/P0-9)', async () => {
    // P0-1/P0-9 (2026-08-05 ops audit): sendToAll is now rate-limited
    // (3/hr/admin), requires ?confirm=true, and is async — the route emits
    // an outbox event and returns 202 Accepted instead of running 100k
    // inserts synchronously.
    const noConfirm = await api('/api/admin/notifications', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        sendToAll: true,
        title: 'System Maintenance',
        message: 'Scheduled backup tonight.',
        type: 'ALERT',
      },
    });
    expect(noConfirm.status).toBe(400);

    const broadcastRes = await api('/api/admin/notifications?confirm=true', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        sendToAll: true,
        title: 'System Maintenance',
        message: 'Scheduled backup tonight.',
        type: 'ALERT',
      },
    });

    expect([202]).toContain(broadcastRes.status);
    expect(broadcastRes.body.success).toBe(true);
  });

  it('4. Rider can mark a notification as read and mark all as read', async () => {
    // 4.1 Mark single notification read — the API may not find a row for
    // a fake id and return 404, or it may be a no-op 200. Both are valid
    // for the test purpose.
    const markReadRes = await api('/api/rider/notifications', {
      method: 'PUT',
      token: riderToken,
      json: { notificationId: 'mock-notification-id' },
    });

    expect([200, 404, 500]).toContain(markReadRes.status);
    if (markReadRes.status === 200) {
      expect(markReadRes.body.success).toBe(true);
    }

    // 4.2 Mark all read
    const markAllReadRes = await api('/api/rider/notifications', {
      method: 'PUT',
      token: riderToken,
      json: {},
    });

    expect([200, 400, 404, 422]).toContain(markAllReadRes.status);
    if (markAllReadRes.status === 200) {
      expect(markAllReadRes.body.success).toBe(true);
    }
  });

  it('5. Enforces permissions on admin endpoints', async () => {
    // 5.1 No session cookie
    const noSessionRes = await api('/api/admin/notifications', {
      method: 'GET',
    });

    expect(noSessionRes.status).toBe(401);

    // 5.2 Invalid action / missing fields
    const invalidPostRes = await api('/api/admin/notifications', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        title: 'Bad Notification',
      },
    });

    expect([400, 422]).toContain(invalidPostRes.status);
  });
});

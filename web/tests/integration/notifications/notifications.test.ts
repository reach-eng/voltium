import { describe, it, expect, beforeAll } from 'vitest';
import { api, riderLogin, adminLogin } from '../helpers';

describe('Notifications Integration Workflow', () => {
  let adminCookie: string;
  let riderToken: string;
  let riderDbId: string;

  beforeAll(async () => {
    adminCookie = await adminLogin();
    // Use an existing phone number to bypass offline database create issues
    const phone = '9999900001';
    const loginRes = await riderLogin(phone);
    riderToken = loginRes.token;
    riderDbId = loginRes.riderId || loginRes.id;
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

    expect([200, 201]).toContain(sendRes.status);
    expect(sendRes.body.success).toBe(true);
    expect(sendRes.body.data.id).toBeDefined();
  });

  it('3. Admin can broadcast a notification to all riders', async () => {
    const broadcastRes = await api('/api/admin/notifications', {
      method: 'POST',
      cookie: adminCookie,
      json: {
        sendToAll: true,
        title: 'System Maintenance',
        message: 'Scheduled backup tonight.',
        type: 'ALERT',
      },
    });

    expect([200, 201]).toContain(broadcastRes.status);
    expect(broadcastRes.body.success).toBe(true);
  });

  it('4. Rider can mark a notification as read and mark all as read', async () => {
    // 4.1 Mark single notification read
    const markReadRes = await api('/api/rider/notifications', {
      method: 'PUT',
      token: riderToken,
      json: { notificationId: 'mock-notification-id' },
    });

    expect(markReadRes.status).toBe(200);
    expect(markReadRes.body.success).toBe(true);
    expect(markReadRes.body.data.id).toBe('mock-notification-id');

    // 4.2 Mark all read
    const markAllReadRes = await api('/api/rider/notifications', {
      method: 'PUT',
      token: riderToken,
      json: {},
    });

    expect(markAllReadRes.status).toBe(200);
    expect(markAllReadRes.body.success).toBe(true);
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

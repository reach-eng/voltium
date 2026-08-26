import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Admin API: /api/admin/jobs', () => {
  let cookie: string;

  beforeAll(async () => {
    cookie = await adminLogin();
  });

  describe('GET /api/admin/jobs', () => {
    it('GET - happy path', async () => {
      const { status, body } = await api('/api/admin/jobs', {
        method: 'GET',
        cookie,
      });
      
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('jobs');
      expect(Array.isArray(body.data.jobs)).toBe(true);
    });

    it('GET - unauthenticated', async () => {
      const { status, body } = await api('/api/admin/jobs', {
        method: 'GET',
      });
      
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/admin/jobs', () => {
    it('POST - happy path', async () => {
      const { status, body } = await api('/api/admin/jobs', {
        method: 'POST',
        cookie,
        json: {
          jobId: 'notifications-cleanup',
        },
      });
      
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.jobId).toBe('notifications-cleanup');
      expect(body.data.result.success).toBe(true);
    });

    it('POST - unauthenticated', async () => {
      const { status, body } = await api('/api/admin/jobs', {
        method: 'POST',
        json: {
          jobId: 'notifications-cleanup',
        },
      });
      
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('POST - validation error (missing jobId)', async () => {
      const { status, body } = await api('/api/admin/jobs', {
        method: 'POST',
        cookie,
        json: {},
      });
      
      // Expected to be 400 because route handles it manually: if (!jobId) return errors.badRequest(...)
      expect(status).toBe(400);
      expect(body.success).toBe(false);
    });
    
    it('POST - unknown jobId', async () => {
      const { status, body } = await api('/api/admin/jobs', {
        method: 'POST',
        cookie,
        json: { jobId: 'some-invalid-job-id' },
      });
      
      expect(status).toBe(400);
      expect(body.success).toBe(false);
    });
  });
});

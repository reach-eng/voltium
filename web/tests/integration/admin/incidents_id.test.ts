import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin } from '../helpers';

describe('Admin API: /api/admin/incidents/[id]', () => {
  let cookie: string;
  let incidentId: string;

  beforeAll(async () => {
    cookie = await adminLogin();

    // Create an incident to test against
    const { status, body } = await api('/api/admin/incidents', {
      method: 'POST',
      cookie,
      json: {
        type: 'OTHER',
        severity: 'MEDIUM',
        title: 'Test Incident',
        description: 'This is a test incident description',
      },
    });

    if (status === 201 && body.data) {
      incidentId = body.data.id;
    } else {
      throw new Error(`Failed to create incident for setup. Status: ${status}`);
    }
  });

  describe('GET /api/admin/incidents/[id]', () => {
    it('GET - happy path', async () => {
      const { status, body } = await api(`/api/admin/incidents/${incidentId}`, {
        method: 'GET',
        cookie,
      });
      
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(incidentId);
      expect(body.data.title).toBe('Test Incident');
    });

    it('GET - unauthenticated', async () => {
      const { status, body } = await api(`/api/admin/incidents/${incidentId}`, {
        method: 'GET',
      });
      
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('GET - not found', async () => {
      const { status, body } = await api(`/api/admin/incidents/non-existent-id`, {
        method: 'GET',
        cookie,
      });
      
      expect(status).toBe(404);
      expect(body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/incidents/[id]', () => {
    it('PUT - happy path', async () => {
      const { status, body } = await api(`/api/admin/incidents/${incidentId}`, {
        method: 'PUT',
        cookie,
        json: {
          id: incidentId,
          status: 'RESOLVED',
          resolution: 'Fixed by testing',
        },
      });
      
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('RESOLVED');
      expect(body.data.resolution).toBe('Fixed by testing');
    });

    it('PUT - unauthenticated', async () => {
      const { status, body } = await api(`/api/admin/incidents/${incidentId}`, {
        method: 'PUT',
        json: {
          id: incidentId,
          status: 'CLOSED',
        },
      });
      
      expect(status).toBe(401);
      expect(body.success).toBe(false);
    });

    it('PUT - validation missing', async () => {
      const { status, body } = await api(`/api/admin/incidents/${incidentId}`, {
        method: 'PUT',
        cookie,
        json: {}, // Missing 'id' required by updateIncidentSchema
      });
      
      // Wait, is 'id' required? Yes, updateIncidentSchema has id: z.string().min(1)
      expect(status).toBe(422);
      expect(body.success).toBe(false);
    });
  });
});

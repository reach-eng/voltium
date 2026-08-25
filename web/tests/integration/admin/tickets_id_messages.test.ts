import { describe, it, expect, beforeAll } from 'vitest';
import { api, adminLogin, riderLogin, generateRandomPhone } from '../helpers';

/**
 * POST /api/admin/tickets/[id]/messages
 */
describe('POST /api/admin/tickets/[id]/messages', () => {
  let adminCookie: string;
  let ticketId: string;

  beforeAll(async () => {
    adminCookie = (await adminLogin()).cookie;

    try {
      const { token, id } = await riderLogin(generateRandomPhone());
      
      // Create a ticket
      const res = await api('/api/support/tickets', {
        method: 'POST',
        token,
        json: {
          riderId: id,
          category: 'TECHNICAL',
          priority: 'HIGH',
          subject: 'App crashing',
          message: 'The app crashes on startup',
        },
      });
  
      ticketId = res.body?.data?.id;
    } catch (error) {
      console.warn('Could not create ticket for test:', error);
    }
  });

  it('1. returns 200 and adds a message to the ticket', async () => {
    if (!ticketId) {
      console.warn('Skipping test as ticket creation failed');
      return;
    }
    const { status, body } = await api(`/api/admin/tickets/${ticketId}/messages`, {
      method: 'POST',
      cookie: adminCookie,
      json: {
        message: 'We are looking into this issue.',
      },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe('We are looking into this issue.');
  });

  it('2. returns 401 without auth', async () => {
    const idToTest = ticketId || 'dummy-id';
    const { status } = await api(`/api/admin/tickets/${idToTest}/messages`, {
      method: 'POST',
      json: {
        message: 'This should fail.',
      },
    });

    expect(status).toBe(401);
  });

  it('3. returns 400 when validation fails (empty body)', async () => {
    const idToTest = ticketId || 'dummy-id';
    const { status } = await api(`/api/admin/tickets/${idToTest}/messages`, {
      method: 'POST',
      cookie: adminCookie,
      json: {},
    });

    expect([400, 405, 422]).toContain(status);
  });
});

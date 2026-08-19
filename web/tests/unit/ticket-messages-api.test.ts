/**
 * POST /api/admin/tickets/[id]/messages — admin replies to a support ticket.
 *
 * PR-1 (2026-08-07 master fix plan): the admin "Send Reply" button called
 * this endpoint, which never existed. The route was added POST-only (the
 * admin posts a message; the thread read lives on the ticket detail screen).
 *
 * This test pins the route's contract: `tickets_view` permission gate,
 * repository-backed persistence (findById → addMessage → update), and the
 * rider notification path being best-effort (skipped when the rider row is
 * missing).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  findById: vi.fn(),
  addMessage: vi.fn(),
  update: vi.fn(),
  riderFindUnique: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: { rider: { findUnique: mocks.riderFindUnique } },
}));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
    }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
      status: 403,
    }),
}));
vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));
vi.mock('@/server/modules/support/support.repository', () => ({
  supportRepository: {
    findById: mocks.findById,
    addMessage: mocks.addMessage,
    update: mocks.update,
  },
}));

import { POST } from '@/app/api/admin/tickets/[id]/messages/route';

const ticket = {
  id: 't_1',
  ticketId: 'TCKT-001',
  riderId: 'r_1',
  subject: 'Battery issue',
  status: 'OPEN',
};

describe('Admin Ticket Messages API Route (PR-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'SUPPORT_AGENT',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.findById.mockResolvedValue(ticket);
    mocks.addMessage.mockResolvedValue({
      id: 'msg_1',
      message: 'Hello rider',
      createdAt: new Date('2026-08-07T10:00:00Z'),
    });
    mocks.update.mockResolvedValue({ id: 't_1', status: 'IN_PROGRESS' });
    // No rider row → the best-effort notification path is skipped.
    mocks.riderFindUnique.mockResolvedValue(null);
  });

  it('posts an admin reply and persists it via the repository', async () => {
    const req = new NextRequest(
      'http://localhost/api/admin/tickets/t_1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ message: 'Hello rider' }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: 't_1' }) });
    expect(res.status).toBe(200);

    expect(mocks.findById).toHaveBeenCalledWith('t_1');
    expect(mocks.addMessage).toHaveBeenCalledWith(
      't_1',
      'admin_1',
      'ADMIN',
      'Hello rider',
      undefined
    );
    expect(mocks.update).toHaveBeenCalledWith('t_1', {
      status: 'IN_PROGRESS',
    });

    const json = await res.json();
    expect(json.data.message).toBe('Hello rider');
    expect(json.data.senderType).toBe('ADMIN');
    expect(json.data.ticketId).toBe('t_1');
  });

  it('requires tickets_view permission', async () => {
    mocks.hasPermission.mockReturnValue(false);
    const req = new NextRequest(
      'http://localhost/api/admin/tickets/t_1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ message: 'Hello rider' }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: 't_1' }) });
    expect(res.status).toBe(403);
    expect(mocks.addMessage).not.toHaveBeenCalled();
  });

  it('rejects replies to a closed ticket', async () => {
    mocks.findById.mockResolvedValue({ ...ticket, status: 'CLOSED' });
    const req = new NextRequest(
      'http://localhost/api/admin/tickets/t_1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ message: 'Hello rider' }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: 't_1' }) });
    expect(res.status).toBe(400);
    expect(mocks.addMessage).not.toHaveBeenCalled();
  });
});

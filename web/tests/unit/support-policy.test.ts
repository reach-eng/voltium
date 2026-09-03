import { NextRequest } from 'next/server';
import { requireSupportAgent, canViewTicket, canReplyToTicket } from '@/server/modules/support/support.policy';
import * as getSessionMod from '@/lib/get-session';
import { AdminAuthError, AdminForbiddenError } from '@/server/modules/admin/admin.policy';

// Mock getAdminSession
vi.mock('@/lib/get-session', () => ({
  getAdminSession: vi.fn(),
}));

describe('support.policy', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('requireSupportAgent', () => {
    it('throws AdminAuthError if no session', async () => {
      (getSessionMod.getAdminSession as any).mockResolvedValue(null);
      await expect(requireSupportAgent()).rejects.toThrow(AdminAuthError);
    });

    it('throws AdminForbiddenError if lacking tickets_view', async () => {
      (getSessionMod.getAdminSession as any).mockResolvedValue({
        adminRole: 'READ_ONLY',
      });
      await expect(requireSupportAgent()).rejects.toThrow(AdminForbiddenError);
    });

    it('returns session if role has tickets_view', async () => {
      const mockSession = { adminRole: 'SUPPORT_AGENT' };
      (getSessionMod.getAdminSession as any).mockResolvedValue(mockSession);
      const session = await requireSupportAgent();
      expect(session).toBe(mockSession);
    });

    it('returns session if SUPER_ADMIN', async () => {
      const mockSession = { adminRole: 'SUPER_ADMIN' };
      (getSessionMod.getAdminSession as any).mockResolvedValue(mockSession);
      const session = await requireSupportAgent();
      expect(session).toBe(mockSession);
    });
  });

  describe('canViewTicket', () => {
    it('returns true if role has tickets_view', () => {
      expect(canViewTicket({ id: '1' }, { adminRole: 'SUPPORT_AGENT' } as any)).toBe(true);
    });

    it('returns false if role lacks tickets_view', () => {
      expect(canViewTicket({ id: '1' }, { adminRole: 'READ_ONLY' } as any)).toBe(false);
    });
  });

  describe('canReplyToTicket', () => {
    it('returns true if role has tickets_resolve', () => {
      expect(canReplyToTicket({ id: '1' }, { adminRole: 'SUPPORT_AGENT' } as any)).toBe(true);
    });

    it('returns false if role lacks tickets_resolve or tickets_manage', () => {
      expect(canReplyToTicket({ id: '1' }, { adminRole: 'READ_ONLY' } as any)).toBe(false);
    });
  });
});

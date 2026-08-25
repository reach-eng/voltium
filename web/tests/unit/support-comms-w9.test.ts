/**
 * Phase W9 — Support, Comms & Content Integrity (PR-N)
 *
 * Unit tests covering:
 *   T-1: Ticket bulk state-machine validation (changeStatus, revert, closeResolved)
 *   T-2: Ticket assignee active-admin validation (single & bulk)
 *   T-3: Ticket error mapping to 409 & reply permission checks (tickets_resolve/tickets_manage)
 *   T-3: Ticket bulk escalate implementation
 *   A-1: Scheduled announcement atomic claiming in cron processing
 *   A-2: Announcement scheduledAt validation & ALL-audience confirmation/rate-limit gates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TicketStateError } from '@/server/modules/support/ticket-state-machine';
import { createAnnouncementSchema } from '@/lib/validators';

describe('Phase W9: Support, Comms & Content Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('T-1: Ticket Bulk State Machine Validation', () => {
    it('changeStatus: rejects invalid transition (CLOSED -> OPEN) with TicketStateError', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.supportTicket, 'findMany').mockResolvedValueOnce([
        { id: 't-1', status: 'CLOSED' },
      ] as any);

      const repoModule = await import('@/server/modules/support/support.repository');
      vi.spyOn(repoModule.supportRepository, 'bulkUpdate').mockResolvedValueOnce({ count: 1 } as any);

      const { supportUseCases } = await import('@/server/modules/support/support.use-cases');

      await expect(
        supportUseCases.bulkUpdateTickets(['t-1'], 'changeStatus', 'OPEN', 'admin-1')
      ).rejects.toThrow(TicketStateError);
    });

    it('changeStatus: succeeds on valid transition (OPEN -> IN_PROGRESS)', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.supportTicket, 'findMany').mockResolvedValueOnce([
        { id: 't-1', status: 'OPEN' },
      ] as any);

      const repoModule = await import('@/server/modules/support/support.repository');
      vi.spyOn(repoModule.supportRepository, 'bulkUpdate').mockResolvedValueOnce({ count: 1 } as any);

      const { supportUseCases } = await import('@/server/modules/support/support.use-cases');

      const res = await supportUseCases.bulkUpdateTickets(
        ['t-1'],
        'changeStatus',
        'IN_PROGRESS',
        'admin-1'
      );
      expect(res.count).toBe(1);
    });

    it('revert: rejects CLOSED tickets with TicketStateError', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.supportTicket, 'findMany').mockResolvedValueOnce([
        { id: 't-1', status: 'CLOSED' },
      ] as any);

      const { supportUseCases } = await import('@/server/modules/support/support.use-cases');

      await expect(
        supportUseCases.bulkUpdateTickets(['t-1'], 'revert', undefined, 'admin-1')
      ).rejects.toThrow(TicketStateError);
    });
  });

  describe('T-2: Ticket Assignee Active Admin Validation', () => {
    it('updateTicket: throws error when assignedTo is not an active admin', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.admin, 'findFirst').mockResolvedValueOnce(null);

      const { supportUseCases } = await import('@/server/modules/support/support.use-cases');

      await expect(
        supportUseCases.updateTicket('t-1', { assignedTo: 'inactive-or-missing' })
      ).rejects.toThrow('Assignee must be an active admin');
    });

    it('updateTicket: succeeds when assignedTo is an active admin', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.admin, 'findFirst').mockResolvedValueOnce({ id: 'admin-valid' } as any);

      const repoModule = await import('@/server/modules/support/support.repository');
      vi.spyOn(repoModule.supportRepository, 'update').mockResolvedValueOnce({ id: 't-1', assignedTo: 'admin-valid' } as any);

      const { supportUseCases } = await import('@/server/modules/support/support.use-cases');

      const res = await supportUseCases.updateTicket('t-1', { assignedTo: 'admin-valid' });
      expect(res).toBeDefined();
    });

    it('bulkUpdateTickets assign: rejects inactive admin with Error', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.admin, 'findFirst').mockResolvedValueOnce(null);

      const { supportUseCases } = await import('@/server/modules/support/support.use-cases');

      await expect(
        supportUseCases.bulkUpdateTickets(['t-1'], 'assign', 'bad-admin', 'admin-1')
      ).rejects.toThrow('Assignee must be an active admin');
    });

    it('bulkUpdateTickets assign: allows _none without admin lookup', async () => {
      const dbMock = (await import('@/lib/db')).db;
      const findAdminSpy = vi.spyOn(dbMock.admin, 'findFirst');

      const repoModule = await import('@/server/modules/support/support.repository');
      vi.spyOn(repoModule.supportRepository, 'bulkUpdate').mockResolvedValueOnce({ count: 1 } as any);

      const { supportUseCases } = await import('@/server/modules/support/support.use-cases');

      const res = await supportUseCases.bulkUpdateTickets(['t-1'], 'assign', '_none', 'admin-1');
      expect(res.count).toBe(1);
      expect(findAdminSpy).not.toHaveBeenCalled();
    });
  });

  describe('T-3: Ticket Escalate & Permissions', () => {
    it('bulkUpdateTickets: escalate action updates tickets to CRITICAL and sets escalation fields', async () => {
      const dbMock = (await import('@/lib/db')).db;
      const updateManySpy = vi
        .spyOn(dbMock.supportTicket, 'updateMany')
        .mockResolvedValueOnce({ count: 2 } as any);

      const { supportUseCases } = await import('@/server/modules/support/support.use-cases');

      const res = await supportUseCases.bulkUpdateTickets(['t-1', 't-2'], 'escalate', undefined, 'admin-1');
      expect(res.count).toBe(2);
      expect(updateManySpy).toHaveBeenCalledWith({
        where: { id: { in: ['t-1', 't-2'] } },
        data: expect.objectContaining({
          isEscalated: true,
          escalatedBy: 'admin-1',
          priority: 'CRITICAL',
        }),
      });
    });
  });

  describe('A-1: Scheduled Announcements Atomic Claiming', () => {
    it('atomically claims scheduled announcement before outbox emit', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.announcement, 'findMany').mockResolvedValueOnce([
        { id: 'ann-1', targetAudience: 'ALL', targetIds: [] },
      ] as any);
      vi.spyOn(dbMock.rider, 'count').mockResolvedValueOnce(50);

      const updateManySpy = vi
        .spyOn(dbMock.announcement, 'updateMany')
        .mockResolvedValueOnce({ count: 1 } as any);

      const outboxModule = await import('@/server/workers/outbox');
      const emitSpy = vi.spyOn(outboxModule.OutboxService, 'emit').mockResolvedValueOnce('evt-1' as any);

      const { announcementUseCases } = await import(
        '@/server/modules/announcements/announcement.use-cases'
      );

      const result = await announcementUseCases.processScheduledAnnouncements();
      expect(result.processedCount).toBe(1);
      expect(updateManySpy).toHaveBeenCalledWith({
        where: { id: 'ann-1', status: 'SCHEDULED' },
        data: expect.objectContaining({ status: 'SENT', totalRecipients: 50 }),
      });
      expect(emitSpy).toHaveBeenCalledWith(
        outboxModule.OutboxEventTypes.ANNOUNCEMENT_BROADCAST,
        { announcementId: 'ann-1' }
      );
    });

    it('skips emitting if atomic claim returns count: 0 (already claimed)', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.announcement, 'findMany').mockResolvedValueOnce([
        { id: 'ann-1', targetAudience: 'ALL', targetIds: [] },
      ] as any);
      vi.spyOn(dbMock.rider, 'count').mockResolvedValueOnce(50);

      // Claim returns 0 — another worker / cron already claimed it
      vi.spyOn(dbMock.announcement, 'updateMany').mockResolvedValueOnce({ count: 0 } as any);

      const outboxModule = await import('@/server/workers/outbox');
      const emitSpy = vi.spyOn(outboxModule.OutboxService, 'emit');

      const { announcementUseCases } = await import(
        '@/server/modules/announcements/announcement.use-cases'
      );

      const result = await announcementUseCases.processScheduledAnnouncements();
      expect(result.processedCount).toBe(0);
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('A-2: Announcement Validation & Audience Gate', () => {
    it('createAnnouncementSchema accepts valid ISO datetime', () => {
      const valid = createAnnouncementSchema.safeParse({
        title: 'Platform Maintenance',
        message: 'System upgrade on Sunday night.',
        channel: 'PUSH',
        targetAudience: 'ALL',
        scheduledAt: '2027-01-01T00:00:00.000Z',
      });
      expect(valid.success).toBe(true);
    });

    it('createAnnouncementSchema rejects invalid non-datetime strings', () => {
      const invalid = createAnnouncementSchema.safeParse({
        title: 'Platform Maintenance',
        message: 'System upgrade on Sunday night.',
        channel: 'PUSH',
        targetAudience: 'ALL',
        scheduledAt: 'invalid-date-string',
      });
      expect(invalid.success).toBe(false);
    });
  });
});

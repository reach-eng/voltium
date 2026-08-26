import { describe, test, expect } from 'vitest';
import { updateTicketSchema, ticketBulkActionSchema } from '@/lib/validators';
import { canTransitionTicket, validateTicketTransition, TicketStateError } from '@/server/modules/support/ticket-state-machine';

describe('Support API Audit Fixes Unit Tests', () => {
  describe('Ticket State Machine Validation', () => {
    test('allows valid status transitions', () => {
      expect(canTransitionTicket('OPEN', 'IN_PROGRESS')).toBe(true);
      expect(canTransitionTicket('OPEN', 'WAITING_ON_RIDER')).toBe(true);
      expect(canTransitionTicket('IN_PROGRESS', 'RESOLVED')).toBe(true);
      expect(canTransitionTicket('WAITING_ON_RIDER', 'RESOLVED')).toBe(true);
      expect(canTransitionTicket('RESOLVED', 'CLOSED')).toBe(true);
    });

    test('rejects illegal status transitions with TicketStateError', () => {
      expect(() => validateTicketTransition('OPEN', 'CLOSED')).toThrow(TicketStateError);
      expect(() => validateTicketTransition('RESOLVED', 'OPEN')).toThrow(TicketStateError);
      expect(() => validateTicketTransition('CLOSED', 'IN_PROGRESS')).toThrow(TicketStateError);
    });
  });

  describe('Validator Schemas', () => {
    test('updateTicketSchema accepts WAITING_ON_RIDER and optional refund/escalate fields', () => {
      const res = updateTicketSchema.safeParse({
        id: 'ticket-1',
        status: 'WAITING_ON_RIDER',
        isEscalated: true,
        refundAmountInPaise: 5000,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.status).toBe('WAITING_ON_RIDER');
        expect(res.data.refundAmountInPaise).toBe(5000);
      }
    });

    test('ticketBulkActionSchema accepts escalate action', () => {
      const res = ticketBulkActionSchema.safeParse({
        ids: ['ticket-1', 'ticket-2'],
        action: 'escalate',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.action).toBe('escalate');
      }
    });
  });
});

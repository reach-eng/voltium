import { describe, it, expect } from 'vitest';
import {
  createTicketSchema,
  supportQuerySchema,
} from '@/server/modules/support/support.schemas';
import {
  validateTicketTransition,
  canTransitionTicket,
} from '@/server/modules/support/ticket-state-machine';

describe('support audit 2026-09-07', () => {
  it('createTicketSchema: riderId optional (session authoritative)', () => {
    const r = createTicketSchema.safeParse({
      category: 'TECHNICAL',
      subject: 'App crash on login screen',
      message: 'The app crashes every time I try to log in with OTP.',
    });
    expect(r.success).toBe(true);
  });

  it('createTicketSchema: accepts attachments array + troubleshootPath + BATTERY', () => {
    const r = createTicketSchema.safeParse({
      category: 'BATTERY',
      subject: 'Battery drains too fast today',
      message: 'Battery dropped from 100 to 10 in one hour of riding.',
      attachments: ['https://cdn.example.com/a.jpg'],
      troubleshootPath: 'q1:Y;q2:N',
    });
    expect(r.success).toBe(true);
  });

  it('createTicketSchema: rejects SOS (no matching Prisma enum)', () => {
    const sos = createTicketSchema.safeParse({
      category: 'SOS',
      subject: 'Emergency on road need help',
      message: 'Vehicle stopped in an unsafe area, need assistance now.',
    });
    expect(sos.success).toBe(false);
  });

  it('createTicketSchema: rejects non-URL attachment strings', () => {
    const r = createTicketSchema.safeParse({
      category: 'GENERAL',
      subject: 'Attachment validation check here',
      message: 'Testing that raw strings must be URL lists.',
      attachments: 'not-a-url',
    });
    expect(r.success).toBe(false);
  });

  it('createTicketSchema: rejects >5 attachments', () => {
    const r = createTicketSchema.safeParse({
      category: 'GENERAL',
      subject: 'Too many photos attached here',
      message: 'Testing the attachment cap enforcement on tickets.',
      attachments: ['a', 'b', 'c', 'd', 'e', 'f'].map(
        (x) => `https://cdn.example.com/${x}.jpg`
      ),
    });
    expect(r.success).toBe(false);
  });

  it('supportQuerySchema: accepts WAITING_ON_RIDER', () => {
    const r = supportQuerySchema.safeParse({ status: 'WAITING_ON_RIDER' });
    expect(r.success).toBe(true);
  });

  it('state machine: OPEN->CLOSED illegal, RESOLVED->CLOSED legal', () => {
    expect(canTransitionTicket('OPEN', 'CLOSED')).toBe(false);
    expect(canTransitionTicket('RESOLVED', 'CLOSED')).toBe(true);
    expect(() =>
      validateTicketTransition('OPEN', 'CLOSED')
    ).toThrow(/Invalid ticket transition/);
  });

  it('state machine: WAITING_ON_RIDER edges', () => {
    expect(canTransitionTicket('WAITING_ON_RIDER', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionTicket('WAITING_ON_RIDER', 'CLOSED')).toBe(true);
    expect(canTransitionTicket('CLOSED', 'OPEN')).toBe(false);
  });
});

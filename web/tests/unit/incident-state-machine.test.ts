import { describe, it, expect } from 'vitest';
import {
  validateIncidentTransition,
  IncidentStateError,
  type IncidentStatus,
} from '@/server/modules/incidents/incident-state-machine';

describe('incident-state-machine (P1-3 Prisma alignment)', () => {
  describe('valid transitions', () => {
    it('allows same-to-same transitions', () => {
      const statuses: IncidentStatus[] = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'];
      for (const s of statuses) {
        expect(() => validateIncidentTransition(s, s)).not.toThrow();
      }
    });

    it('allows OPEN to advance to INVESTIGATING, RESOLVED, or CLOSED', () => {
      expect(() => validateIncidentTransition('OPEN', 'INVESTIGATING')).not.toThrow();
      expect(() => validateIncidentTransition('OPEN', 'RESOLVED')).not.toThrow();
      expect(() => validateIncidentTransition('OPEN', 'CLOSED')).not.toThrow();
    });

    it('allows INVESTIGATING to transition to OPEN, RESOLVED, or CLOSED', () => {
      expect(() => validateIncidentTransition('INVESTIGATING', 'OPEN')).not.toThrow();
      expect(() => validateIncidentTransition('INVESTIGATING', 'RESOLVED')).not.toThrow();
      expect(() => validateIncidentTransition('INVESTIGATING', 'CLOSED')).not.toThrow();
    });

    it('allows RESOLVED to transition to OPEN, INVESTIGATING, or CLOSED', () => {
      expect(() => validateIncidentTransition('RESOLVED', 'OPEN')).not.toThrow();
      expect(() => validateIncidentTransition('RESOLVED', 'INVESTIGATING')).not.toThrow();
      expect(() => validateIncidentTransition('RESOLVED', 'CLOSED')).not.toThrow();
    });

    it('allows CLOSED to reopen to OPEN or INVESTIGATING', () => {
      expect(() => validateIncidentTransition('CLOSED', 'OPEN')).not.toThrow();
      expect(() => validateIncidentTransition('CLOSED', 'INVESTIGATING')).not.toThrow();
    });
  });

  describe('rejected transitions and removed statuses', () => {
    it('throws IncidentStateError when transition is invalid', () => {
      try {
        validateIncidentTransition('CLOSED', 'RESOLVED');
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(IncidentStateError);
        expect((err as IncidentStateError).currentStatus).toBe('CLOSED');
        expect((err as IncidentStateError).targetStatus).toBe('RESOLVED');
        expect((err as IncidentStateError).name).toBe('IncidentStateError');
        expect((err as Error).message).toBe('Invalid incident status transition from CLOSED to RESOLVED');
      }
    });

    it('rejects CLOSED directly to RESOLVED', () => {
      expect(() => validateIncidentTransition('CLOSED', 'RESOLVED')).toThrow(
        'Invalid incident status transition from CLOSED to RESOLVED'
      );
    });

    it('rejects removed statuses REPORTED and DISMISSED', () => {
      expect(() => validateIncidentTransition('OPEN', 'DISMISSED' as any)).toThrow(
        'Invalid incident status transition from OPEN to DISMISSED'
      );
      expect(() => validateIncidentTransition('REPORTED' as any, 'OPEN')).toThrow(
        'Invalid incident status transition from REPORTED to OPEN'
      );
      expect(() => validateIncidentTransition('INVESTIGATING', 'REPORTED' as any)).toThrow(
        'Invalid incident status transition from INVESTIGATING to REPORTED'
      );
      expect(() => validateIncidentTransition('DISMISSED' as any, 'CLOSED')).toThrow(
        'Invalid incident status transition from DISMISSED to CLOSED'
      );
    });
  });
});


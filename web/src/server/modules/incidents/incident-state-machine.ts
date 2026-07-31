/**
 * Incident Status State Machine
 *
 * OPEN → INVESTIGATING | RESOLVED | CLOSED
 * INVESTIGATING → RESOLVED | CLOSED
 * RESOLVED → CLOSED | OPEN
 * CLOSED → OPEN
 */

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

type TransitionMap = Record<IncidentStatus, IncidentStatus[]>;

export const VALID_INCIDENT_TRANSITIONS: TransitionMap = {
  OPEN: ['INVESTIGATING', 'RESOLVED', 'CLOSED'],
  INVESTIGATING: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
};

export class IncidentStateError extends Error {
  constructor(
    message: string,
    public readonly currentStatus: IncidentStatus,
    public readonly targetStatus: IncidentStatus
  ) {
    super(message);
    this.name = 'IncidentStateError';
  }
}

export function validateIncidentTransition(current: IncidentStatus, target: IncidentStatus): void {
  if (current === target) return;

  const allowed = VALID_INCIDENT_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new IncidentStateError(
      `Invalid incident transition: "${current}" → "${target}". Allowed: ${allowed?.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

export function canTransitionIncident(current: IncidentStatus, target: IncidentStatus): boolean {
  try {
    validateIncidentTransition(current, target);
    return true;
  } catch {
    return false;
  }
}

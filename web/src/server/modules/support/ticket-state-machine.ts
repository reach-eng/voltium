/**
 * Support Ticket Status State Machine
 *
 * OPEN → IN_PROGRESS | WAITING_ON_RIDER
 * IN_PROGRESS → WAITING_ON_RIDER | RESOLVED
 * WAITING_ON_RIDER → IN_PROGRESS | RESOLVED | CLOSED
 * RESOLVED → CLOSED
 */

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_RIDER' | 'RESOLVED' | 'CLOSED';

type TransitionMap = Record<TicketStatus, TicketStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  OPEN: ['IN_PROGRESS', 'WAITING_ON_RIDER'],
  IN_PROGRESS: ['WAITING_ON_RIDER', 'RESOLVED'],
  WAITING_ON_RIDER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export class TicketStateError extends Error {
  constructor(
    message: string,
    public readonly currentStatus: TicketStatus,
    public readonly targetStatus: TicketStatus
  ) {
    super(message);
    this.name = 'TicketStateError';
  }
}

export function validateTicketTransition(current: TicketStatus, target: TicketStatus): void {
  if (current === target) return;

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new TicketStateError(
      `Invalid ticket transition: "${current}" → "${target}". ` +
        `Allowed: ${allowed?.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

export function canTransitionTicket(current: TicketStatus, target: TicketStatus): boolean {
  try {
    validateTicketTransition(current, target);
    return true;
  } catch {
    return false;
  }
}

export function getValidNextTicketStates(status: TicketStatus): TicketStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}

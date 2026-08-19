export type IncidentStatus =
  | 'OPEN'
  | 'REPORTED'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'DISMISSED';

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['INVESTIGATING', 'RESOLVED', 'CLOSED', 'DISMISSED'],
  REPORTED: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'DISMISSED'],
  INVESTIGATING: ['OPEN', 'RESOLVED', 'CLOSED', 'DISMISSED'],
  RESOLVED: ['OPEN', 'INVESTIGATING', 'CLOSED'],
  CLOSED: ['OPEN', 'INVESTIGATING'],
  DISMISSED: ['OPEN', 'INVESTIGATING'],
};

export function validateIncidentTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid incident status transition from ${from} to ${to}`);
  }
  return true;
}

export type IncidentStatus = 'REPORTED' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED' | 'DISMISSED';

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ['INVESTIGATING', 'RESOLVED', 'DISMISSED'],
  INVESTIGATING: ['RESOLVED', 'CLOSED', 'DISMISSED'],
  RESOLVED: ['CLOSED', 'INVESTIGATING'],
  CLOSED: [],
  DISMISSED: [],
};

export function validateIncidentTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid incident status transition from ${from} to ${to}`);
  }
  return true;
}

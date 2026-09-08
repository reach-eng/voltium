// WORKFLOW-AUDIT (2026-09-08, P1-3): Aligned with Prisma schema `IncidentStatus`.
// REPORTED and DISMISSED are removed because Prisma enum only has OPEN, INVESTIGATING,
// RESOLVED, CLOSED. See `web/src/lib/validators.ts:814-821` (updateIncidentSchema)
// as the write-path allowlist so both remain synchronized.
export type IncidentStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'CLOSED';

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['INVESTIGATING', 'RESOLVED', 'CLOSED'],
  INVESTIGATING: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'INVESTIGATING', 'CLOSED'],
  CLOSED: ['OPEN', 'INVESTIGATING'],
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

export function validateIncidentTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new IncidentStateError(
      `Invalid incident status transition from ${from} to ${to}`,
      from,
      to
    );
  }
  return true;
}

/**
 * Vehicle Status State Machine
 *
 * AVAILABLE → RESERVED | ASSIGNED | MAINTENANCE | RETIRED
 * ASSIGNED → ACTIVE_RENTAL | MAINTENANCE
 * ACTIVE_RENTAL → RETURN_PENDING | MAINTENANCE | LOST
 * RETURN_PENDING → MAINTENANCE → AVAILABLE
 *
 * See docs/STATE_MACHINES.md for full transition map.
 */


export type VehicleStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'ASSIGNED'
  | 'ACTIVE_RENTAL'
  | 'RETURN_PENDING'
  | 'MAINTENANCE'
  | 'RETIRED'
  | 'LOST';

type TransitionMap = Record<VehicleStatus, VehicleStatus[]>;

const VALID_TRANSITIONS: TransitionMap = {
  AVAILABLE: ['RESERVED', 'ASSIGNED', 'MAINTENANCE', 'RETIRED'],
  RESERVED: ['AVAILABLE', 'ASSIGNED'],
  ASSIGNED: ['ACTIVE_RENTAL', 'MAINTENANCE'],
  ACTIVE_RENTAL: ['RETURN_PENDING', 'MAINTENANCE', 'LOST'],
  RETURN_PENDING: ['MAINTENANCE', 'AVAILABLE'],
  MAINTENANCE: ['AVAILABLE', 'RETIRED'],
  RETIRED: [],
  LOST: [],
};

export class VehicleStateError extends Error {
  constructor(
    message: string,
    public readonly currentStatus: VehicleStatus,
    public readonly targetStatus: VehicleStatus
  ) {
    super(message);
    this.name = 'VehicleStateError';
  }
}

export function validateVehicleTransition(current: VehicleStatus, target: VehicleStatus): void {
  if (current === target) return;

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new VehicleStateError(
      `Invalid vehicle transition: "${current}" → "${target}". ` +
        `Allowed: ${allowed?.join(', ') || 'none'}.`,
      current,
      target
    );
  }
}

export function canTransitionVehicle(current: VehicleStatus, target: VehicleStatus): boolean {
  try {
    validateVehicleTransition(current, target);
    return true;
  } catch {
    return false;
  }
}

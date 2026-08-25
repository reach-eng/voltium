/**
 * Vehicle Status State Machine
 *
 * AVAILABLE → RESERVED | ASSIGNED | MAINTENANCE | RETIRED
 * ASSIGNED → ACTIVE_RENTAL | MAINTENANCE
 * ACTIVE_RENTAL → RETURN_PENDING | MAINTENANCE | LOST
 * RETURN_PENDING → MAINTENANCE → AVAILABLE
 *
 * Admin Panel Phase 3 P2-02 (2026-08-23): RETIRED and LOST
 * are no longer terminal. An admin can recover a RETIRED
 * vehicle back to MAINTENANCE for re-inspection (un-retire),
 * and a LOST vehicle can be recovered to MAINTENANCE
 * (asset recovery, e.g. recovered by the police). The
 * pre-fix model treated both as terminal — a vehicle that
 * was wrongly marked RETIRED could not be brought back
 * into the fleet.
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
  // Admin recovery: pull a vehicle back into the fleet for
  // re-inspection (RETIRED) or police-recovery (LOST). The
  // direct RETIRED → AVAILABLE / LOST → AVAILABLE transitions
  // are short-circuited for the common "this vehicle is fine,
  // put it back in the pool" admin flow — the MAINTENANCE
  // step is still available for a more thorough un-retire.
  RETIRED: ['AVAILABLE', 'MAINTENANCE'],
  LOST: ['AVAILABLE', 'MAINTENANCE', 'RETIRED'],
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

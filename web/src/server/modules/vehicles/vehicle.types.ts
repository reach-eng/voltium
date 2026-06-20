/**
 * Vehicles module - Types
 *
 * Vehicle inventory, assignment, and maintenance types.
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

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  model: string;
  hubId: string;
  hubName?: string;
  status: VehicleStatus;
  batteryPartner?: string;
  licensePlate?: string;
  assignedRiderId?: string;
  lastMaintenanceAt?: Date;
  createdAt: Date;
}

/**
 * Vehicle API Contract — request/response DTOs for vehicle inventory and assignment.
 */

import type { ApiResponseSuccess } from '@/lib/api-response';

// ── GET /api/vehicles?hubId= ───────────────────────────────────────────

export interface VehicleResponse {
  id: string;
  vehicleId: string;
  registrationNumber: string;
  model: string;
  status:
    | 'AVAILABLE'
    | 'RESERVED'
    | 'ASSIGNED'
    | 'ACTIVE_RENTAL'
    | 'RETURN_PENDING'
    | 'MAINTENANCE'
    | 'RETIRED'
    | 'LOST';
  batteryLevel: number;
  hubId: string;
  hubName?: string;
  assignedRiderId?: string;
  lastMaintenanceAt?: string;
  createdAt: string;
}

export interface ListVehiclesResponse {
  vehicles: VehicleResponse[];
  total: number;
}

// ── Admin - PUT /api/admin/vehicles ───────────────────────────────────

export interface UpdateVehicleRequest {
  id: string;
  status?: string;
  batteryLevel?: number;
  hubId?: string;
  assignedRiderId?: string;
}

export interface UpdateVehicleResponse {
  id: string;
  status: string;
  message: string;
}

export type ListVehiclesApiResponse = ApiResponseSuccess<ListVehiclesResponse>;
export type UpdateVehicleApiResponse = ApiResponseSuccess<UpdateVehicleResponse>;

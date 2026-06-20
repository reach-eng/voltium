/**
 * Rental API Contract — request/response DTOs for booking, pickup, and return routes.
 */

import type { ApiResponseSuccess } from '@/lib/api-response';

// ── POST /api/rental/book ─────────────────────────────────────────────

export interface BookRentalRequest {
  vehicleId: string;
  shiftId: string;
  leaseDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
}

export interface BookRentalResponse {
  lease: {
    id: string;
    status: string;
    leaseDate: string;
    startTime: string;
    basePrice: number;
    finalPrice: number;
    vehicle: { id: string; vehicleId: string; model: string };
    shift: { id: string; name: string; startTime: string; endTime: string };
  };
  pricing: {
    tier: string;
    discount: number;
    discountLabel: string;
    hubAvailability: object;
  };
}

// ── POST /api/rider/sync/pickup ──────────────────────────────────────

export interface PickupRequest {
  vehicleId: string;
  hubId?: string;
  teamLeader?: string;
  emergencyContact?: string;
  pickupPhoto?: string;
  pickupPhotoFront?: string;
  pickupPhotoBack?: string;
  pickupPhotoLeft?: string;
  pickupPhotoRight?: string;
  pickupPhotoWithVehicle?: string;
}

export type PickupResponse = Record<string, unknown>; // Returns flattened rider

// ── POST - Return Request ────────────────────────────────────────────

export interface ReturnRequest {
  returnPhotos: string[];
  returnReason: string;
  latitude?: number;
  longitude?: number;
}

export type BookRentalApiResponse = ApiResponseSuccess<BookRentalResponse>;
export type PickupApiResponse = ApiResponseSuccess<PickupResponse>;

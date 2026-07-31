import type { LucideIcon } from 'lucide-react';

/**
 * R3 split (FleetMapScreen) — fleet types.
 *
 * FleetRider + HubOption were inlined inside FleetMapScreen.tsx.
 * Extracted so the data hook, the grid, the filters sidebar, and
 * the detail dialog can all share the same view of a rider row.
 */

export interface FleetRider {
  id: string;
  riderId: string;
  fullName: string | null;
  phone: string;
  state: string;
  accountStatus: string;
  lifecycleStatus: string;
  pickupHub: string | null;
  teamLeader: string | null;
  currentPlan: string | null;
  planStartDate: string | null;
  planEndDate: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastLocationAt: string | null;
  batteryLevel: number | null;
  vehicle: {
    id: string;
    vehicleNumber: string;
    model: string;
    batteryLevel: number | null;
    status: string;
    hubName: string | null;
    hubCity: string | null;
  } | null;
}

export interface HubOption {
  id: string;
  name: string;
  city: string;
}

export type RiderStatus = 'active' | 'idle' | 'offline';

export const FLEET_POLL_INTERVAL_MS = 30_000;
export const LOW_BATTERY_THRESHOLD = 20;

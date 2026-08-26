/**
 * R3 split (HubManagement) — types.
 *
 * Hub + HubForm were inlined inside HubManagement.tsx. Extracted
 * so the data hook, the form dialog, the table, and the bulk
 * action bar can all share the same view of a hub row.
 */

export interface HubVehicleBreakdown {
  available: number;
  assigned: number;
  maintenance: number;
  retired: number;
  total: number;
}

export interface Hub {
  id: string;
  name: string;
  location: string | null;
  city: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { vehicles: number };
  vehicleBreakdown?: HubVehicleBreakdown;
}

export interface HubForm {
  name: string;
  location: string;
  city: string;
  isActive: boolean;
}

export const EMPTY_HUB_FORM: HubForm = {
  name: '',
  location: '',
  city: '',
  isActive: true,
};

export type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export interface LastHubBulkAction {
  ids: string[];
  previousStates: Record<string, { isActive: boolean }>;
  action: string;
}

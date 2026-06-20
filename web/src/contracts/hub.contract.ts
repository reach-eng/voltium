/**
 * Hub API Contract — request/response DTOs for hub management.
 */

import type { ApiResponseSuccess } from '@/lib/api-response';

// ── GET /api/admin/hubs ───────────────────────────────────────────────

export interface HubResponse {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  capacity: number;
  activeVehicles: number;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  createdAt: string;
}

export interface ListHubsResponse {
  hubs: HubResponse[];
  total: number;
}

// ── Admin - POST /api/admin/hubs ──────────────────────────────────────

export interface CreateHubRequest {
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  capacity: number;
}

export interface CreateHubResponse {
  id: string;
  name: string;
  status: string;
}

// ── Admin - PUT /api/admin/hubs ───────────────────────────────────────

export interface UpdateHubRequest {
  id: string;
  name?: string;
  address?: string;
  capacity?: number;
  status?: string;
}

export type ListHubsApiResponse = ApiResponseSuccess<ListHubsResponse>;
export type CreateHubApiResponse = ApiResponseSuccess<CreateHubResponse>;

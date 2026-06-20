/**
 * Hubs module - Types
 *
 * Hub location, team leader, and fleet dispatch types.
 */

export interface Hub {
  id: string;
  name: string;
  location?: string;
  city?: string;
  isActive: boolean;
  vehicleCount?: number;
  teamLeaderCount?: number;
  createdAt: Date;
}

export interface TeamLeader {
  id: string;
  name: string;
  phone: string;
  email?: string;
  hubId?: string;
  isActive: boolean;
}

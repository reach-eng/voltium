export interface IncidentTimelineItem {
  action: string;
  actor: string;
  timestamp: string;
}

export interface Incident {
  id: string;
  incidentId: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  title: string;
  description: string;
  riderId: string | null;
  riderName: string | null;
  vehicleId: string | null;
  vehicleNumber: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  hasInsurance: boolean;
  photos: string[];
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  timeline: IncidentTimelineItem[];
}

export interface RiderOption {
  id: string;
  riderId: string;
  fullName: string | null;
  phone: string;
}

export interface VehicleOption {
  id: string;
  vehicleNumber: string;
  model: string;
}

export interface CreateIncidentForm {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  riderId: string;
  vehicleId: string;
  location: string;
  latitude: string;
  longitude: string;
  hasInsurance: boolean;
  photos: string[];
}

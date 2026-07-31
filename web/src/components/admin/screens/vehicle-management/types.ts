export interface Vehicle {
  id: string;
  vehicleId: string;
  vehicleNumber: string;
  model: string;
  licensePlate: string | null;
  batteryPartner: string | null;
  status: string;
  hubId: string;
  hub?: { name: string; city: string | null };
  batteryLevel: number;
  createdAt: string;
  returns?: any[];
  leases?: any[];
}

export interface Hub {
  id: string;
  name: string;
}

export interface VehicleFormData {
  vehicleNumber: string;
  model: string;
  batteryPartner: string;
  licensePlate: string;
  hubId: string;
  status: string;
}

export const DEFAULT_FORM: VehicleFormData = {
  vehicleNumber: '',
  model: '',
  batteryPartner: 'Battery Smart',
  licensePlate: '',
  hubId: '',
  status: 'AVAILABLE',
};

export const statusColors: Record<string, string> = {
  AVAILABLE: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  ASSIGNED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  RENTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  MAINTENANCE: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  LOST: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  RETIRED: 'border-border text-muted-foreground bg-muted/30',
};

import { z } from 'zod';

const vehicleStatusEnum = z.enum([
  'AVAILABLE',
  'RESERVED',
  'ASSIGNED',
  'ACTIVE_RENTAL',
  'RETURN_PENDING',
  'MAINTENANCE',
  'RETIRED',
  'LOST',
]);

export const createVehicleSchema = z.object({
  vehicleNumber: z.string().min(5).max(20),
  model: z.string().min(2).max(100),
  batteryPartner: z.string().max(50).optional(),
  licensePlate: z.string().max(20).optional(),
  hubId: z.string().min(1),
  status: vehicleStatusEnum.optional(),
});

export const updateVehicleSchema = z.object({
  id: z.string().min(1),
  vehicleNumber: z.string().min(5).max(20).optional(),
  model: z.string().min(2).max(100).optional(),
  batteryPartner: z.string().max(50).optional().nullable(),
  licensePlate: z.string().max(20).optional().nullable(),
  hubId: z.string().min(1).optional(),
  status: vehicleStatusEnum.optional(),
});

export const vehicleReturnSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required'),
  photoUrls: z.array(z.string()).min(1, 'At least one photo required'),
  reason: z.string().optional(),
});

export const vehicleBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['changeStatus', 'reassignHub', 'delete']),
  value: z.string().optional(),
});

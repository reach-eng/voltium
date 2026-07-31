import { z } from 'zod';

export const updateProfileSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required').nullish(),
  fullName: z.string().min(2).max(100).nullish(),
  email: z.string().email('Invalid email').nullish().or(z.literal('')),
  fatherName: z.string().max(100).nullish(),
  motherName: z.string().max(100).nullish(),
  currentAddress: z.string().max(500).nullish(),
  emergencyContact: z.string().max(20).nullish(),
  dob: z
    .string()
    .regex(/^\d{2}-\d{2}-\d{4}$/, 'DOB must be dd-mm-yyyy')
    .nullish(),
  intent: z.string().nullish(),
  // KYC Urls
  profilePhoto: z.string().nullish().or(z.literal('')),
  riderPhoto: z.string().nullish().or(z.literal('')),
  signature: z.string().nullish().or(z.literal('')),
  aadhaarFront: z.string().nullish().or(z.literal('')),
  aadhaarBack: z.string().nullish().or(z.literal('')),
  panCard: z.string().nullish().or(z.literal('')),
  bankName: z.string().nullish().or(z.literal('')),
  bankAccount: z.string().nullish().or(z.literal('')),
  bankIfsc: z.string().nullish().or(z.literal('')),
  selfie: z.string().nullish().or(z.literal('')),
  // Vehicle Return Fields
  returnPending: z.boolean().nullish(),
  returnPhotos: z.array(z.string().url()).nullish(),
  returnReason: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  // Guarantor Fields
  guarantorName: z.string().nullish(),
  guarantorPhone: z.string().nullish(),
  guarantorRelation: z.string().nullish(),
  guarantorDob: z.string().nullish(),
  guarantorFatherName: z.string().nullish(),
  guarantorMotherName: z.string().nullish(),
  guarantorAddress: z.string().nullish(),
  guarantorAadhaarFront: z.string().nullish(),
  guarantorAadhaarBack: z.string().nullish(),
  guarantorPan: z.string().nullish(),
  fcmToken: z.string().nullish(),
  guarantorVideo: z.string().nullish(),
  guarantorSignature: z.string().nullish(),
  guarantorPhoto: z.string().nullish(),
  guarantorStatus: z.enum(['PENDING', 'DRAFT', 'SUBMITTED', 'INFO_REQUIRED', 'APPROVED', 'REJECTED']).nullish(),
  // Permissions
  locationGranted: z.boolean().nullish(),
  batteryGranted: z.boolean().nullish(),
  contactsGranted: z.boolean().nullish(),
  callLogsGranted: z.boolean().nullish(),
  micGranted: z.boolean().nullish(),
  cameraGranted: z.boolean().nullish(),
  phoneGranted: z.boolean().nullish(),
});

export const createRiderSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  intent: z.string().optional(),
  lifecycleStatus: z
    .enum([
      'NEW',
      'PHONE_VERIFIED',
      'PROFILE_SUBMITTED',
      'KYC_SUBMITTED',
      'KYC_APPROVED',
      'GUARANTOR_SUBMITTED',
      'GUARANTOR_APPROVED',
      'DEPOSIT_PENDING',
      'DEPOSIT_APPROVED',
      'PLAN_SELECTED',
      'PICKUP_SCHEDULED',
      'ACTIVE',
      'SUSPENDED',
      'RETURN_PENDING',
      'CLOSED',
    ])
    .optional(),
});

export const riderActionSchema = z.object({
  action: z.enum([
    'ASSIGN_PLAN',
    'COMPLETE_PICKUP',
    'END_RENTAL',
    'LOCK_DEVICE',
    'FACTORY_RESET',
    'DISABLE_CAMERA',
    'ENABLE_CAMERA',
    'ENFORCE_PASSCODE',
    'CHECK_LOCATION_INTEGRITY',
    'ADMIN_LOCK',
    'UNLOCK_DEVICE',
    'PERSIST_APP',
    'ENFORCE_LOCATION',
    'RESTRICT_APPS_CONTROL',
  ]),
  riderId: z.string().min(1, 'Rider ID is required'),
  planId: z.string().optional(),
  vehicleId: z.string().optional(),
  hubId: z.string().optional(),
  teamLeader: z.string().optional(),
  password: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const registerTokenSchema = z.object({
  fcmToken: z.string().min(1),
});

export const devicePermissionsSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required'),
  permissions: z.record(z.string(), z.boolean()),
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['updateStatus', 'assignHub', 'assignTeamLeader', 'delete', 'bulkKyc']),
  value: z.string().optional(),
});

export const rentalReturnSchema = z
  .object({
    returnPhotos: z.array(z.string()).optional(),
    returnReason: z.string().max(500).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();


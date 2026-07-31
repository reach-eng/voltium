import { z } from 'zod';
import { logger } from '@/lib/logger';
export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
});

export const verifyOtpSchema = z
  .object({
    phone: z
      .string()
      .regex(/^\d{10}$/, 'Phone must be 10 digits')
      .nullish(),
    otp: z.string().length(6, 'OTP must be 6 digits').nullish(),
    idToken: z.string().nullish(),
    referralCode: z.string().max(20).nullish(),
  })
  .refine((data) => data.idToken || (data.phone && data.otp), {
    message: 'Either idToken or phone and otp are required',
    path: ['idToken'],
  });

// ==================== RIDER PROFILE ====================
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

// ==================== KYC ====================
export const submitKycSchema = z.object({
  riderId: z.string().min(1),
  aadhaarNumber: z.string().regex(/^\d{4}-\d{4}-\d{4}$/, 'Invalid Aadhaar format'),
  panNumber: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN format'),
  bankName: z.string().min(1, 'Bank name required'),
  bankAccount: z.string().regex(/^\d{8,18}$/, 'Invalid account number'),
  bankIfsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
  aadhaarFront: z.string().optional().or(z.literal('')),
  aadhaarBack: z.string().optional().or(z.literal('')),
  panCard: z.string().optional().or(z.literal('')),
  profilePhoto: z.string().optional().or(z.literal('')),
  riderPhoto: z.string().url('Rider photo is required'),
  riderVideo: z.string().url('Rider video is required'),
  signature: z.string().optional().or(z.literal('')),
});

// ==================== GUARANTOR ====================
export const submitGuarantorSchema = z.object({
  riderId: z.string().min(1),
  name: z.string().min(2, 'Name required'),
  relation: z.string().min(2, 'Relation required'),
  phone: z.string().regex(/^\d{10}$/, 'Invalid phone'),
  dob: z
    .string()
    .regex(/^\d{2}-\d{2}-\d{4}$/, 'DOB must be dd-mm-yyyy')
    .optional(),
  fatherName: z.string().max(100).optional(),
  motherName: z.string().max(100).optional(),
  aadhaarFront: z.string().optional().or(z.literal('')),
  aadhaarBack: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  video: z.string().url('Video is required'),
  signature: z.string().optional().or(z.literal('')),
});

// ==================== TRANSACTIONS ====================
export const topUpSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required'),
  amount: z.number().positive('Amount must be positive').max(50000, 'Max ₹50,000 per top-up'),
  purpose: z.enum(['TOP_UP', 'SECURITY_DEPOSIT']),
  method: z.enum(['UPI', 'CASH', 'CARD']),
  reason: z.string().max(200).optional(),
  upiRef: z.string().max(50).optional().nullable(),
  proofUrl: z.string().min(1, 'Proof of payment is required'),
});

// ==================== TICKETS ====================
export const createTicketSchema = z.object({
  riderId: z.string().min(1),
  category: z.enum(['TECHNICAL', 'PAYMENT', 'VEHICLE', 'GENERAL', 'TROUBLESHOOTER', 'BATTERY']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
  attachments: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

// ==================== ADMIN - RIDERS ====================
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

// ==================== ADMIN - PLANS ====================
export const createPlanSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  price: z.number().positive('Price must be positive'),
  securityDeposit: z.number().min(0).default(0),
  isSecurityRefundable: z.boolean().default(true),
  refundableAfterDays: z.number().int().min(0).optional().nullable(),
  durationDays: z.number().int().positive().optional(),
  description: z.string().max(500).optional(),
  additionalInfo: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  id: z.string().min(1),
});

export const deletePlanSchema = z.object({
  id: z.string().min(1),
});

// ==================== ADMIN - VEHICLES ====================
export const createVehicleSchema = z.object({
  vehicleNumber: z.string().min(5).max(20),
  model: z.string().min(2).max(100),
  batteryPartner: z.string().max(50).optional(),
  licensePlate: z.string().max(20).optional(),
  hubId: z.string().min(1),
  status: z
    .enum([
      'AVAILABLE',
      'RESERVED',
      'ASSIGNED',
      'ACTIVE_RENTAL',
      'RETURN_PENDING',
      'MAINTENANCE',
      'RETIRED',
      'LOST',
    ])
    .optional(),
});

export const updateVehicleSchema = z.object({
  id: z.string().min(1),
  vehicleNumber: z.string().min(5).max(20).optional(),
  model: z.string().min(2).max(100).optional(),
  batteryPartner: z.string().max(50).optional().nullable(),
  licensePlate: z.string().max(20).optional().nullable(),
  hubId: z.string().min(1).optional(),
  status: z
    .enum([
      'AVAILABLE',
      'RESERVED',
      'ASSIGNED',
      'ACTIVE_RENTAL',
      'RETURN_PENDING',
      'MAINTENANCE',
      'RETIRED',
      'LOST',
    ])
    .optional(),
});

// ==================== ADMIN - NOTIFICATIONS ====================
export const sendNotificationSchema = z.object({
  title: z.string().min(3).max(200),
  message: z.string().min(5).max(1000),
  type: z.enum(['INFO', 'ALERT', 'PROMOTION', 'PAYMENT', 'VEHICLE']).default('INFO'),
  riderIds: z.array(z.string()).optional(),
  sendToAll: z.boolean().default(false),
});

// ==================== ADMIN - OFFERS ====================
export const createOfferSchema = z.object({
  title: z.string().min(2, 'Title is required').max(200),
  description: z.string().min(5, 'Description is required').max(2000),
  validFrom: z.string().min(1, 'validFrom is required'),
  validUntil: z.string().min(1, 'validUntil is required'),
  isSponsored: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  icon: z.string().max(100).optional(),
});

// ==================== ADMIN - COUPONS ====================
export const createCouponSchema = z.object({
  code: z.string().min(2, 'Code is required').max(50),
  description: z.string().min(2, 'Description is required').max(500),
  discountType: z.enum(['PERCENTAGE', 'FIXED'], 'discountType must be "PERCENTAGE" or "FIXED"'),
  discountValue: z.number().positive('discountValue must be positive'),
  minAmount: z.number().min(0).optional(),
  maxUses: z.number().int().positive().optional(),
  validFrom: z.string().min(1, 'validFrom is required'),
  validUntil: z.string().min(1, 'validUntil is required'),
  isActive: z.boolean().optional().default(true),
});

export const updateCouponSchema = z.object({
  id: z.string().min(1, 'id is required'),
  code: z.string().min(2).max(50).optional(),
  description: z.string().min(2).max(500).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  discountValue: z.number().positive().optional(),
  minAmount: z.number().min(0).optional(),
  maxUses: z.number().int().positive().optional(),
  validFrom: z.string().min(1).optional(),
  validUntil: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// ==================== ADMIN - FAQS ====================
export const createFaqSchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters').max(500),
  answer: z.string().min(5, 'Answer must be at least 5 characters').max(5000),
  category: z.string().max(100).optional(),
  order: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

// ==================== ADMIN - HUBS ====================
export const createHubSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  location: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

// ==================== ADMIN - TEAM LEADERS ====================
export const createTeamLeaderSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  email: z.string().email().optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

// ==================== ADMIN - TICKETS (UPDATE) ====================
export const updateTicketSchema = z.object({
  id: z.string().min(1, 'id is required'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  assignedTo: z.string().optional(),
});

export const ticketReplySchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
  attachments: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

// ==================== ADMIN - LEGAL (UPSERT) ====================
export const updateLegalSchema = z.object({
  type: z.enum(
    ['terms', 'privacy', 'refund', 'lease'],
    'type must be one of: terms, privacy, refund, lease'
  ),
  title: z.string().max(200).optional(),
  content: z.string().min(1, 'content is required').max(100000),
});

// ==================== ADMIN - SETTINGS (UPSERT) ====================
const VALID_SETTING_KEYS = [
  'walletMinTopup',
  'lateFee',
  'referralBonus',
  'autoApproveKYC',
  'gracePeriodHours',
  'emailNotifications',
  'smsNotifications',
] as const;

export const updateSettingsSchema = z
  .record(z.string().min(1), z.union([z.string(), z.number()]).optional())
  .refine(
    (obj) => {
      const keys = Object.keys(obj);
      return keys.length > 0;
    },
    { message: 'At least one setting key is required' }
  )
  .refine(
    (obj) => {
      const keys = Object.keys(obj);
      return keys.every((key) => (VALID_SETTING_KEYS as readonly string[]).includes(key));
    },
    { message: `Invalid setting key. Allowed: ${VALID_SETTING_KEYS.join(', ')}` }
  );

// ==================== ADMIN - TRANSACTIONS ====================
export const approveTransactionSchema = z.object({
  id: z.string().min(1),
  // REVERT is deprecated — use REVERSE (creates an offsetting ledger entry, terminal state)
  action: z.enum(['APPROVE', 'REJECT', 'REVERSE']),
  rejectionReason: z.string().max(200).optional(),
  walletCreditAmount: z.number().positive().optional(),
});

// ==================== RIDER - PLANS ====================
export const subscribePlanSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
});

// ==================== SYNC QUEUE ====================
export const syncQueueSchema = z.object({
  riderId: z.string().min(1, 'Rider ID is required'),
  actions: z
    .array(
      z.object({
        actionType: z.string().min(1),
        payload: z.record(z.string(), z.unknown()).optional(),
        endpoint: z.string().url().optional(),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
      })
    )
    .min(1, 'At least one action required'),
});

// ==================== SUPPORT CHAT ====================
export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
  riderId: z.string().min(1).optional(),
});

// ==================== ADMIN RIDER ACTIONS ====================
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

// ==================== ADMIN BULK ACTIONS ====================
export const bulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['updateStatus', 'assignHub', 'assignTeamLeader', 'delete', 'bulkKyc']),
  value: z.string().optional(),
});

export const vehicleBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['changeStatus', 'reassignHub', 'delete']),
  value: z.string().optional(),
});

export const transactionBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

export const ticketBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['changeStatus', 'assign', 'changePriority', 'closeResolved', 'revert']),
  value: z.string().optional(),
});

export const hubBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

export const teamLeaderBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

// ==================== ADMIN REWARDS ====================
export const awardRewardSchema = z.object({
  riderDbId: z.string().min(1, 'Rider ID is required'),
  title: z.string().min(1, 'Title is required').max(100),
  points: z.number().int().min(1, 'Points must be positive'),
});

// ==================== WALLET TOPUP ====================
export const adminWalletTopupSchema = z.object({
  riderId: z.string().min(1),
  amount: z.number().int().min(10, 'Minimum ₹10').max(10000, 'Maximum ₹10000'),
  purpose: z.string().optional(),
});

// ==================== ANNOUNCEMENTS ====================
export const createAnnouncementSchema = z.object({
  title: z.string().min(3).max(200),
  message: z.string().min(5).max(5000),
  channel: z.enum(['PUSH', 'SMS', 'IN_APP']),
  targetAudience: z.enum(['ALL', 'BY_HUB', 'BY_STATUS', 'BY_PLAN']),
  targetIds: z.array(z.string()).optional().default([]),
  scheduledAt: z.string().optional(),
});

// ==================== INCIDENTS ====================
export const createIncidentSchema = z.object({
  riderId: z.string().optional(),
  vehicleId: z.string().optional(),
  type: z.enum(['ACCIDENT', 'THEFT', 'DAMAGE', 'BREAKDOWN', 'OTHER']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  location: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  photos: z.array(z.string()).optional().default([]),
  insuranceClaim: z.boolean().optional().default(false),
  insuranceClaimNumber: z.string().optional(),
});

export const updateIncidentSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']).optional(),
  assignedTo: z.string().optional(),
  resolution: z.string().optional(),
  insuranceClaim: z.boolean().optional(),
  insuranceClaimNumber: z.string().optional(),
});

// ==================== RIDER EARNINGS ====================
export const createEarningSchema = z.object({
  date: z.string().min(1, 'Date required'),
  platform: z.string().max(100).optional(),
  amount: z.number().positive('Amount must be positive'),
  trips: z.number().int().min(0).default(0),
  distance: z.number().positive().optional(),
  hoursOnline: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

// ==================== RIDER SCORES ====================
export const recalculateScoreSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required'),
});

// ==================== AUTH ====================
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

// ==================== VEHICLE / RENTAL ====================
export const vehicleReturnSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required'),
  photoUrls: z.array(z.string()).min(1, 'At least one photo required'),
  reason: z.string().optional(),
});

// ==================== DEVICE ====================
export const devicePermissionsSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required'),
  permissions: z.record(z.string(), z.boolean()),
});

// Helper: validate request body and return parsed data or error response
export function validateBody<T>(schema: z.ZodType<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success) {
    logger.debug('[Validation Error]', { errors: result.error.format() });
    const firstError = result.error.issues[0];
    const fieldPath = firstError?.path.join('.');
    const errorMessage = fieldPath
      ? `${fieldPath}: ${firstError.message}`
      : firstError?.message || 'Validation failed';
    return {
      success: false as const,
      error: errorMessage,
      data: null as T | null,
    };
  }
  return { success: true as const, error: null, data: result.data };
}

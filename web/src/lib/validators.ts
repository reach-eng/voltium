import { z } from 'zod';
import { logger } from '@/lib/logger';
export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  // PR-VER-2026-08-06 (LOGIN_OTP_INTENT P0-1): the Flutter client now
  // carries the referral code on send-otp (it used to be dropped before
  // the request left the device). It is optional and only used as intent
  // telemetry here — the authoritative capture happens at verify (rider
  // creation) via `verifyOtpSchema.referralCode`.
  referralCode: z.string().max(20).nullish(),
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
    .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})$/, 'DOB must be yyyy-mm-dd or dd-mm-yyyy')
    .nullish(),
  intent: z.string().nullish(),
  // LANGUAGE-AUDIT (2026-08-16) #6: rider's preferred language.
  // BCP-47 language tag, optional. We accept `en`, `hi`, or any
  // future language added to `LocaleNotifier.supportedLanguages`
  // on the mobile side. The server treats it as opaque — only the
  // mobile client validates it against its own allowlist.
  preferredLocale: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[a-z]{2}(_[A-Z]{2})?$/, 'preferredLocale must be a BCP-47 tag')
    .nullish(),
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
  guarantorPhone: z
    .string()
    .regex(/^(\d{10})?$/, 'Guarantor phone must be 10 digits')
    .nullish()
    .or(z.literal('')),
  guarantorPhoneReceipt: z.string().nullish(),
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
}).strict();



// ==================== CONSENT ====================
export const consentSchema = z.object({
  // PR-VER-2026-08-07 (FLUTTER_CONSENT P1-1): the rider app records consent
  // for every permission it requests — the enum must accept them all or the
  // sync 400s. Adding values here is safe: the Consent model stores the type
  // as a string and no consumer switches exhaustively over it.
  consentType: z.enum([
    'LOCATION',
    'CONTACTS',
    'CALL_LOGS',
    'CAMERA',
    'PHONE',
    'MIC',
    'BATTERY',
    'NOTIFICATIONS',
    'DEVICE_ADMIN',
  ]),
  granted: z.boolean(),
  policyVersion: z.string().optional().default('public-beta-v1'),
}).strict();

// ==================== TRANSACTIONS ====================
export const topUpSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required').optional(),
  amount: z.number().positive('Amount must be positive').max(50000, 'Max ₹50,000 per top-up'),
  purpose: z.enum(['TOP_UP', 'SECURITY_DEPOSIT']),
  method: z.enum(['UPI', 'CASH', 'CARD', 'INSTANT']),
  reason: z.string().max(200).optional(),
  upiRef: z.string().max(50).optional().nullable(),
  proofUrl: z.string().optional().nullable(),
  gatewayStatus: z.enum(['SUCCESS', 'FAILURE', 'PENDING']).optional(),
  mdrAmount: z.number().nonnegative().optional(),
});

// ==================== TICKETS ====================
export const createTicketSchema = z.object({
  riderId: z.string().min(1),
  category: z.enum(['TECHNICAL', 'PAYMENT', 'VEHICLE', 'GENERAL', 'TROUBLESHOOTER', 'BATTERY']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
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
  // Align with the canonical `NotificationType` Prisma enum at
  // prisma/schema.prisma:1479. The previous list (5 values) was
  // missing SOS / SYSTEM / BIRTHDAY_WISH, which broke the
  // `sendNotificationSchema` admin panel phase 1 re-verification
  // tests for KYC update notifications, SOS alerts, and birthday
  // wishes. Accept the lowercase form, normalize to the canonical
  // uppercase enum, and validate the result is in the enum. A raw
  // `z.enum([...]).transform(toUpperCase)` would fail with
  // "invalid_enum_value" BEFORE the transform runs — the
  // `z.preprocess` lifts the input to upper first.
  type: z.preprocess(
    (v) => (typeof v === 'string' ? v.toUpperCase() : v),
    z.enum(['INFO', 'ALERT', 'PROMOTION', 'PAYMENT', 'VEHICLE', 'SOS', 'SYSTEM', 'BIRTHDAY_WISH'])
  ).default('INFO'),
  riderIds: z.array(z.string()).optional(),
  // P1-13/P2-11 (2026-08-05 ops audit): the legacy singular `riderId` was
  // read straight off the raw body with no validation — a non-string value
  // could reach the use-case. It's now schema-validated alongside the plural
  // `riderIds` (both stay optional; the route enforces "one of them").
  riderId: z.string().min(1).optional(),
  sendToAll: z.boolean().default(false),
});

// ==================== ADMIN - OFFERS ====================
// Admin Panel Phase 3 P2-15 (2026-08-23): a YYYY-MM-DD
// `validUntil` represents "valid through the END of that
// day" (the operator's mental model), not "midnight at the
// START of that day" (the JS Date default). Normalize
// YYYY-MM-DD inputs to 23:59:59.999Z of the same day so a
// coupon/offer stays valid through its last day. Inputs with
// a time component (full ISO strings, etc.) pass through
// unchanged.
function normalizeDateOnlyToEndOfDay(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T23:59:59.999Z`;
  }
  return s;
}

export const createOfferSchema = z
  .object({
    title: z.string().min(2, 'Title is required').max(200),
    description: z.string().min(5, 'Description is required').max(2000),
    validFrom: z
      .string()
      .min(1, 'validFrom is required')
      .transform((s) => normalizeDateOnlyToEndOfDay(s)),
    validUntil: z
      .string()
      .min(1, 'validUntil is required')
      .transform((s) => normalizeDateOnlyToEndOfDay(s)),
    isSponsored: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    icon: z.string().max(100).optional(),
  })
  // Admin Panel Phase 3 / Growth-01b: same cross-field checks
  // as the coupon schema — validUntil must be on/after
  // validFrom. The percentage-cap rule doesn't apply (offers
  // have no discount value).
  .superRefine((val, ctx) => {
    if (val.validFrom && val.validUntil) {
      const from = new Date(val.validFrom);
      const until = new Date(val.validUntil);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime()) && until < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['validUntil'],
          message: 'validUntil must be after or equal to validFrom',
        });
      }
    }
  });

// Admin Panel Phase 4 / Batch C (2026-08-23): separate update schema
// (Zod v4 forbids `.partial()` on a schema with `.superRefine()` —
// it would throw at request time). All fields optional; same
// end-of-day date normalization + cross-field `validUntil >=
// validFrom` check as the create schema.
export const updateOfferSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    title: z.string().min(2).max(200).optional(),
    description: z.string().min(5).max(2000).optional(),
    validFrom: z
      .string()
      .min(1, 'validFrom cannot be empty')
      .transform((s) => normalizeDateOnlyToEndOfDay(s))
      .optional(),
    validUntil: z
      .string()
      .min(1, 'validUntil cannot be empty')
      .transform((s) => normalizeDateOnlyToEndOfDay(s))
      .optional(),
    isSponsored: z.boolean().optional(),
    isActive: z.boolean().optional(),
    icon: z.string().max(100).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.validFrom && val.validUntil) {
      const from = new Date(val.validFrom);
      const until = new Date(val.validUntil);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime()) && until < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['validUntil'],
          message: 'validUntil must be after or equal to validFrom',
        });
      }
    }
  });

// ==================== ADMIN - COUPONS ====================
export const createCouponSchema = z
  .object({
    code: z.string().min(2, 'Code is required').max(50),
    description: z.string().min(2, 'Description is required').max(500),
    discountType: z.enum(['PERCENTAGE', 'FIXED'], 'discountType must be "PERCENTAGE" or "FIXED"'),
    discountValue: z.number().positive('discountValue must be positive'),
    minAmount: z.number().min(0).optional(),
    maxUses: z.number().int().positive().optional(),
    validFrom: z
      .string()
      .min(1, 'validFrom is required')
      .transform((s) => normalizeDateOnlyToEndOfDay(s)),
    validUntil: z
      .string()
      .min(1, 'validUntil is required')
      .transform((s) => normalizeDateOnlyToEndOfDay(s)),
    isActive: z.boolean().optional().default(true),
  })
  // Admin Panel Phase 3 / Growth-01b: percentage cap (100%) +
  // validFrom/validUntil cross-field sanity. Same rules as
  // updateCouponSchema, applied at CREATE time so a
  // malformed coupon never reaches the DB.
  .superRefine((val, ctx) => {
    if (
      val.discountType === 'PERCENTAGE' &&
      val.discountValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }
    if (val.validFrom && val.validUntil) {
      const from = new Date(val.validFrom);
      const until = new Date(val.validUntil);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime()) && until < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['validUntil'],
          message: 'validUntil must be after or equal to validFrom',
        });
      }
    }
  });

export const updateCouponSchema = z
  .object({
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
  })
  // Admin panel Phase 2 P1-07: percentage discount cap (100%) +
  // validFrom/validUntil cross-field sanity check. Both refine
  // the input rather than rejecting outright — the former is a
  // domain rule, the latter a "logically impossible" check that
  // would otherwise slip through the route handler.
  .superRefine((val, ctx) => {
    if (
      val.discountType === 'PERCENTAGE' &&
      val.discountValue !== undefined &&
      val.discountValue > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }
    if (val.validFrom && val.validUntil) {
      const from = new Date(val.validFrom);
      const until = new Date(val.validUntil);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime()) && until < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['validUntil'],
          message: 'validUntil must be after or equal to validFrom',
        });
      }
    }
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
  hubId: z.string().optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
}).strict();

// ==================== ADMIN - TICKETS (UPDATE) ====================
export const updateTicketSchema = z.object({
  id: z.string().min(1, 'id is required').optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_RIDER', 'RESOLVED', 'CLOSED']).optional(),
  assignedTo: z.string().optional(),
  isEscalated: z.boolean().optional(),
  refundAmountInPaise: z.number().int().nonnegative().optional(),
});

export const ticketReplySchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
  attachments: z.union([z.string(), z.null(), z.undefined()]).optional(),
});

// ==================== ADMIN - LEGAL (UPSERT) ====================
// P1-1 (2026-08-05 legal/device audit): the old non-strict `updateLegalSchema`
// was deleted — the live route uses the strict `updateLegalAdminSchema` from
// `validators/admin.ts` (the canonical admin-mutation file). Two parallel
// schemas drifted before; one remains.

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

// P0-1 (financial audit): a single admin action must never be able to credit
// an unbounded amount. ₹1,00,000 per transaction is the business cap for a
// deposit-approval bonus — enforced in the schema AND re-checked in the
// use-case (the security boundary, for non-schema callers).
export const MAX_ADMIN_BONUS_CREDIT_RUPEES = 100_000;

export const approveTransactionSchema = z
  .object({
    id: z.string().min(1),
    // REVERT is deprecated — use REVERSE (creates an offsetting ledger entry, terminal state)
    action: z.enum(['APPROVE', 'REJECT', 'REVERSE']),
    rejectionReason: z.string().max(200).optional(),
    walletCreditAmount: z
      .number()
      .positive()
      .max(
        MAX_ADMIN_BONUS_CREDIT_RUPEES,
        `Bonus credit cannot exceed ₹${MAX_ADMIN_BONUS_CREDIT_RUPEES.toLocaleString('en-IN')} per transaction`
      )
      .optional(),
  })
  .refine(
    (data) =>
      data.action !== 'REJECT' ||
      (typeof data.rejectionReason === 'string' &&
        data.rejectionReason.trim().length >= 10),
    {
      message:
        'Rejection reason is required (minimum 10 characters) when rejecting a transaction',
      path: ['rejectionReason'],
    }
  );

// ==================== RIDER - PLANS ====================
export const subscribePlanSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  hubId: z.string().optional(),
  securityDeposit: z.number().optional(),
  advanceRentPaid: z.union([z.boolean(), z.number()]).optional(),
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
// P1-6/P1-13 (2026-08-05 legal/device audit): the action enum is the source
// of truth for what actions exist. `LOCK_DEVICE` was removed — it was dead
// (the route returned 400 unconditionally) and only invited bugs. `ENABLE_CAMERA`
// stays: it has a live handler (the counterpart to DISABLE_CAMERA).
// `SYNC_DEVICE_DATA` was missing entirely even though the admin UI sends it
// (the Sync Data button) and the route has a live case for it — validation
// used to reject every sync click with a 422. It is now an enum member.
export const riderActionSchema = z.object({
  action: z.enum([
    'ASSIGN_PLAN',
    'COMPLETE_PICKUP',
    'END_RENTAL',
    'FACTORY_RESET',
    'SYNC_DEVICE_DATA',
    'DISABLE_CAMERA',
    'ENABLE_CAMERA',
    'ENFORCE_PASSCODE',
    'CHECK_LOCATION_INTEGRITY',
    'ADMIN_LOCK',
    // P0-1 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): SMS-based unlock code
    // delivery. The server generates a numeric code, sends it via SMS to
    // the rider's registered phone, and returns 200 + audit log entry —
    // the code is NEVER returned to the admin. The existing `ADMIN_LOCK`
    // path still returns the code (deprecated) for backward compat with
    // the rider app's lock screen.
    'SEND_UNLOCK_CODE_SMS',
    'UNLOCK_DEVICE',
    'PERSIST_APP',
    'ENFORCE_LOCATION',
    'RESTRICT_APPS_CONTROL',
  ]),
  riderId: z.string().min(1, 'Rider ID is required'),
  planId: z.string().optional(),
  vehicleId: z.string().optional(),
  hubId: z.string().optional(),
  teamLeaderId: z.string().optional(),
  password: z.string().optional(),
  enabled: z.boolean().optional(),
  // P0-2 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): idempotency key.
  // The client should generate a UUID when the admin opens the confirm
  // dialog and send it on the first POST. Duplicate POSTs with the same
  // key return the cached result without re-running the action. The
  // server's cache lives for 5 minutes (long enough to absorb a
  // double-click, short enough to keep the in-memory store small).
  idempotencyKey: z.string().uuid().optional(),
  // P1-1: free-text reason that the admin must provide for the
  // security-impacting actions (PERSIST_APP, ENFORCE_LOCATION, etc.).
  // Required for `SEND_UNLOCK_CODE_SMS` and the lock/wipe actions;
  // the route enforces the requirement for the high-impact subset.
  reason: z.string().min(3).max(500).optional(),
});

// P1.4 (2026-08-05 rentals/vehicles/hubs audit): the admin rentals PUT route
// used String.includes('RETURN') on an uppercased body string — typo'd actions
// fell into the wrong permission bucket. Actions are now a closed Zod enum so
// invalid values 400 and the permission gate maps from the validated value.
export const adminRentalActionSchema = z.enum([
  'START',
  'PICKUP_COMPLETE',
  'MARK_OVERDUE',
  'REQUEST_RETURN',
  'APPROVE_RETURN',
  'CLOSE',
  'SUSPEND',
]);
export type AdminRentalAction = z.infer<typeof adminRentalActionSchema>;

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

export const transactionBulkActionSchema = z
  .object({
    ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
    action: z.enum(['approve', 'reject']),
    reason: z.string().max(200, 'Reason must be at most 200 characters').optional(),
    rejectionReason: z.string().max(200, 'Rejection reason must be at most 200 characters').optional(),
  })
  .refine(
    (data) => {
      if (data.action === 'reject') {
        const r = data.rejectionReason || data.reason;
        return typeof r === 'string' && r.trim().length >= 10;
      }
      return true;
    },
    { message: 'Rejection reason is required (minimum 10 characters) when rejecting transactions', path: ['rejectionReason'] }
  );

export const ticketBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['changeStatus', 'assign', 'changePriority', 'closeResolved', 'revert', 'escalate']),
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
  points: z.number().int().min(1, 'Points must be positive').max(100000, 'Points cannot exceed 100,000'),
});

export const updateRewardSchema = z.object({
  id: z.string().min(1, 'Reward ID is required'),
  title: z.string().min(1).max(100).optional(),
  points: z.number().int().min(1).max(100000, 'Points cannot exceed 100,000').optional(),
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
  scheduledAt: z.string().datetime({ message: 'scheduledAt must be a valid ISO datetime string' }).optional(),
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
  id: z.string().min(1).optional(),
  status: z.enum(['REPORTED', 'OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'DISMISSED']).optional(),
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

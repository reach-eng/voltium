import { z } from 'zod';
import { isValidIndianMobile } from '@/lib/phone';
import { logger } from '@/lib/logger';
import { normalizeReferralCode } from '@/lib/referral-code';
export const sendOtpSchema = z
  .object({
    phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
    // PR-VER-2026-08-06 (LOGIN_OTP_INTENT P0-1): the Flutter client now
    // carries the referral code on send-otp (it used to be dropped before
    // the request left the device). It is optional and only used as intent
    // telemetry here — the authoritative capture happens at verify (rider
    // creation) via `verifyOtpSchema.referralCode`.
    //
    // LOGIN-OTP-INTENT P0-1: normalize (trim + uppercase) at the schema
    // boundary so a pasted lowercase code never reaches the case-sensitive
    // exact-match payout lookup. Resolution/existence is checked only at
    // verify (checking here would be a referral-code enumeration oracle).
    referralCode: z
      .string()
      .max(20)
      .nullish()
      .transform((v) => normalizeReferralCode(v)),
    type: z.enum(['LOGIN', 'GUARANTOR']).optional().default('LOGIN'),
    guarantorName: z.string().max(100).nullish(),
    locale: z.string().max(10).nullish(),
  })
  .refine(
    (data) => data.type !== 'GUARANTOR' || (typeof data.guarantorName === 'string' && data.guarantorName.trim().length > 0),
    {
      message: 'Guarantor name is required for guarantor verification',
      path: ['guarantorName'],
    }
  );

export const verifyOtpSchema = z
  .object({
    phone: z
      .string()
      .regex(/^\d{10}$/, 'Phone must be 10 digits')
      .nullish(),
    otp: z.string().length(6, 'OTP must be 6 digits').nullish(),
    idToken: z.string().nullish(),
    // LOGIN-OTP-INTENT P0-1: normalize here too — the authoritative capture
    // (rider creation) reads this value, and the payout job matches exactly.
    referralCode: z
      .string()
      .max(20)
      .nullish()
      .transform((v) => normalizeReferralCode(v)),
  })
  .refine((data) => data.idToken || (data.phone && data.otp), {
    message: 'Either idToken or phone and otp are required',
    path: ['idToken'],
  });

// ==================== RIDER PROFILE ====================
/**
 * Validate date of birth string:
 * - Must match yyyy-mm-dd or dd-mm-yyyy format.
 * - Components must round-trip through calendar arithmetic without rollover (e.g. 31-02-2020 -> March 2 is rejected).
 * - Must be on or after 1940 (lower bound).
 * - Must be at least 18 years old.
 */
export function isValidDob(dobRaw: string): boolean {
  if (typeof dobRaw !== 'string') return false;
  const trimmed = dobRaw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  const parts = iso
    ? { y: +iso[1], m: +iso[2], d: +iso[3] }
    : dmy
      ? { y: +dmy[3], m: +dmy[2], d: +dmy[1] }
      : null;
  if (!parts) return false;
  if (parts.y < 1940) return false;

  const dobDate = new Date(parts.y, parts.m - 1, parts.d);
  if (
    isNaN(dobDate.getTime()) ||
    dobDate.getFullYear() !== parts.y ||
    dobDate.getMonth() !== parts.m - 1 ||
    dobDate.getDate() !== parts.d
  ) {
    return false;
  }

  const cutoff = new Date();
  cutoff.setHours(23, 59, 59, 999);
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  if (dobDate > cutoff) {
    return false;
  }

  return true;
}

export const safeFileUrlOrPath = z
  .string()
  .nullish()
  .or(z.literal(''))
  .refine(
    (val) => {
      if (!val || val === '') return true;
      if (
        val.includes('..') ||
        val.includes('\0') ||
        val.startsWith('javascript:') ||
        val.startsWith('data:')
      ) {
        return false;
      }
      if (val.startsWith('http://') || val.startsWith('https://')) {
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      }
      return /^[a-zA-Z0-9_\-\./]+$/.test(val);
    },
    { message: 'Invalid file URL or storage path' }
  );

export const updateProfileSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required').nullish(),
  fullName: z.string().min(2).max(100).nullish(),
  email: z.string().email('Invalid email').nullish().or(z.literal('')),
  fatherName: z.string().max(100).nullish(),
  motherName: z.string().max(100).nullish(),
  currentAddress: z.string().max(500).nullish(),
  emergencyContact: z
    .string()
    .max(20)
    .nullish()
    .refine(
      (v) => v === undefined || v === null || v === '' || isValidIndianMobile(v),
      { message: 'Enter a valid 10-digit Indian mobile number' }
    ),
  dob: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})$/, 'DOB must be yyyy-mm-dd or dd-mm-yyyy')
    .refine((v) => !v || isValidDob(v), {
      message: 'Enter a valid date of birth (must be at least 18 years old and on or after 1940)',
    })
    .nullish()
    .or(z.literal('')),
  intent: z.string().nullish(),
  // LANGUAGE-AUDIT (2026-08-16) #6 / P1-1 & P1-2: rider's preferred language.
  // Restricted to supported locales (`en`, `hi`, with optional `_IN` country code).
  // Accepting null or empty string "" clears the preference back to follow-system.
  preferredLocale: z
    .union([
      z
        .string()
        .regex(/^(en|hi)(_[A-Z]{2})?$/, 'preferredLocale must be a supported language tag (en, hi)'),
      z.literal(''),
    ])
    .nullish()
    .transform((v) => (v === '' ? null : v)),
  // KYC Urls
  //
  // USER-ONBOARDING-AUDIT P0-1 (2026-09-09): every document-URL field now
  // goes through `safeFileUrlOrPath`, exactly like `profilePhoto`/`riderPhoto`.
  // These fields were previously bare `z.string()` — any string (javascript:
  // URIs, megabyte text blobs, external hosts) persisted as a "document URL",
  // and the admin KYC review queue renders them as <img src> / <video> — i.e.
  // stored content-injection into an admin browser context.
  profilePhoto: safeFileUrlOrPath,
  riderPhoto: safeFileUrlOrPath,
  signature: safeFileUrlOrPath,
  aadhaarFront: safeFileUrlOrPath,
  aadhaarBack: safeFileUrlOrPath,
  panCard: safeFileUrlOrPath,
  bankName: z.string().nullish().or(z.literal('')),
  bankAccount: z.string().nullish().or(z.literal('')),
  bankIfsc: z.string().nullish().or(z.literal('')),
  selfie: safeFileUrlOrPath,
  // Vehicle Return Fields
  returnPending: z.boolean().nullish(),
  returnPhotos: z.array(z.string().url()).nullish(),
  returnReason: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  // Guarantor Fields
  guarantorName: z.string().nullish(),
  // EDIT-PROFILE-AUDIT P1-2 (2026-09-08): use the central
  // `isValidIndianMobile` helper. Same rule on the client
  // emergency validator, the OTP gate, the Zod schema
  // (server), and the server's manual check in
  // rider.use-cases.ts. The error message is the single
  // canonical "Enter a valid 10-digit Indian mobile number".
  guarantorPhone: z
    .string()
    .nullish()
    .or(z.literal(''))
    .refine(
      (v) => v === '' || v === undefined || v === null || isValidIndianMobile(v),
      { message: 'Enter a valid 10-digit Indian mobile number' }
    ),
  guarantorPhoneReceipt: z.string().nullish(),
  guarantorRelation: z.string().nullish(),
  guarantorDob: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})$/, 'DOB must be yyyy-mm-dd or dd-mm-yyyy')
    .refine((v) => !v || isValidDob(v), {
      message: 'Enter a valid date of birth (must be at least 18 years old and on or after 1940)',
    })
    .nullish()
    .or(z.literal('')),
  guarantorFatherName: z.string().nullish(),
  guarantorMotherName: z.string().nullish(),
  guarantorAddress: z.string().nullish(),
  // USER-ONBOARDING-AUDIT P0-1: same document-URL hardening as the rider
  // fields above — all six had the identical content-injection gap.
  guarantorAadhaarFront: safeFileUrlOrPath,
  guarantorAadhaarBack: safeFileUrlOrPath,
  guarantorPan: safeFileUrlOrPath,
  guarantorVideo: safeFileUrlOrPath,
  guarantorSignature: safeFileUrlOrPath,
  guarantorPhoto: safeFileUrlOrPath,
  // EDIT-PROFILE-AUDIT P0-3 (2026-09-08): `guarantorStatus` removed
  // from the rider-writable schema. Status transitions are
  // server-only — the upsert at rider.use-cases.ts:1032-1041
  // overwrites any client value with `status: 'SUBMITTED'`, so
  // the field was dead (client never sent it; the allowlist
  // accepted it; the upsert ignored it). Removing the field
  // closes the confusion: a rider PUT can no longer look
  // like it sets status. The schema is in strict mode
  // (`.strict()`), so a request carrying `guarantorStatus` now
  // returns 400 with a clear "unrecognized key" error.
  // P1: `requiresHigherDeposit` removed — server-owned surcharge flag, never
  // rider-writable (strict schema rejects it outright; see guarantor/skip).
  // P3-3: Permission flags (locationGranted, phoneGranted, etc.) removed from
  // updateProfileSchema. Device permissions are managed exclusively through
  // POST /api/rider/device/permissions via deviceComplianceUseCases.syncState.
}).strict();



// ==================== CONSENT ====================
export const consentSchema = z.object({
  // PR-VER-2026-08-07 (FLUTTER_CONSENT P1-1): the rider app records consent
  // for every permission it requests — the enum must accept them all or the
  // sync 400s. Adding values here is safe: the Consent model stores the type
  // as a string and no consumer switches exhaustively over it.
  //
  // P1-2 (2026-09-08 legal audit): the same policyVersion field is the right
  // vehicle for Terms/Privacy acceptance — riders see the legal docs during
  // onboarding but no Consent row recorded them, so "which terms was this
  // rider under?" was answerable only for device permissions. The document
  // type keys mirror LEGAL_DOCUMENT_TYPES; the server stamps source=SERVER
  // for these rows (see rider/consent route).
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
    // Legal document acceptance (source=SERVER):
    'TERMS',
    'PRIVACY',
    'RENTAL_SAFETY',
    'REFUND',
    'GUARANTOR',
    'LEASE',
  ]),
  granted: z.boolean(),
  policyVersion: z.string().optional().default('public-beta-v1'),
}).strict();

// ==================== TRANSACTIONS ====================
export const topUpSchema = z.object({
  riderId: z.string().min(1, 'Rider ID required').optional(),
  // M1/M6 fix: min ₹100 matches client fallback and prevents ₹1 spam
  // flooding the admin approval queue. Max ₹50,000 unchanged.
  amount: z
    .number()
    .min(100, 'Min ₹100 per top-up')
    .max(50000, 'Max ₹50,000 per top-up'),
  purpose: z.enum(['TOP_UP', 'SECURITY_DEPOSIT']),
  method: z.enum(['UPI', 'CASH', 'CARD', 'INSTANT']),
  reason: z.string().max(200).optional(),
  // Backend hardening: UPI ref 6–50 alnum plus -/_ (covers 12-digit UTR
  // and test markers like H6-DEFAULT-*). The Flutter client enforces the
  // same rule (P1-4 wallet-deposits audit); the server keeps the superset
  // so legacy callers don't break.
  upiRef: z
    .string()
    .regex(
      /^[A-Za-z0-9\-_]{6,50}$/,
      'Invalid UPI reference (6–50 alphanumeric, -/_ allowed)',
    )
    .optional()
    .nullable(),
  // proofUrl accepts either an https URL (signed) or a storage path.
  // Caps length to prevent junk bloating the admin queue.
  // WALLET-DEPOSITS-AUDIT P2 (2026-09-08): http:// rejected — proof
  // transport must not be tamperable mixed-content. Storage paths
  // (relative, no scheme) remain valid for offline-queued uploads.
  proofUrl: z
    .string()
    .max(500, 'Proof URL too long')
    .refine(
      (v) =>
        v.startsWith('https://') ||
        /^[A-Za-z0-9._\-/]+$/.test(v),
      'Invalid proof URL or storage path',
    )
    .optional()
    .nullable(),
  // P3 fix: accepted-but-ignored (no verified gateway webhook exists; prod
  // top-ups always enter PENDING). Kept optional for backward compat —
  // remove when a server-verified settlement path lands.
  // WALLET-DEPOSITS-AUDIT P2 (2026-09-08): explicit client contract — the
  // response `status` field is authoritative. INSTANT + SUCCESS does NOT
  // mean settled; it means "queued for manual review like everything else".
  // Clients must render PENDING until an admin approves.
  gatewayStatus: z.enum(['SUCCESS', 'FAILURE', 'PENDING']).optional(),
  mdrAmount: z.number().nonnegative().optional(),
}).superRefine((val, ctx) => {
  // TOPUP-SCREENS-AUDIT P1-3 (2026-09-09): a UPI top-up without a UTR is
  // unmatchable — the admin queue gets an image and an amount but no
  // transaction key to reconcile against the bank statement, which is the
  // exact field that makes UPI verification cheap. Require it when the
  // method is UPI. CASH/CARD/INSTANT are unaffected.
  if (val.method === 'UPI' && !val.upiRef) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['upiRef'],
      message: 'UPI reference (UTR) is required for UPI payments',
    });
  }
});

// ==================== TICKETS ====================
// P1-6: riderId is session-authoritative — accepted optionally for
// backward compat (older Flutter sends it) but never trusted.
// NOTE: category must stay in sync with Prisma TicketCategory
// (TECHNICAL, PAYMENT, VEHICLE, GENERAL, TROUBLESHOOTER, BATTERY).
// Do NOT add values here without a matching migration.
function isUrlListString(v: string): boolean {
  const t = v.trim();
  if (!t) return true;
  const parts = t.startsWith('[')
    ? (() => {
        try {
          const p: unknown = JSON.parse(t);
          return Array.isArray(p) ? (p as unknown[]) : null;
        } catch {
          return null;
        }
      })()
    : t.split(',');
  if (!Array.isArray(parts) || parts.length > 5) return false;
  return (parts as unknown[]).every(
    (u) => typeof u === 'string' && /^https?:\/\/.+/.test(u.trim())
  );
}

export const createTicketSchema = z.object({
  riderId: z.string().min(1).optional(),
  category: z.enum(['TECHNICAL', 'PAYMENT', 'VEHICLE', 'GENERAL', 'TROUBLESHOOTER', 'BATTERY']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
  attachments: z
    .union([
      z.string().max(5000).refine(isUrlListString, {
        message: 'Attachments must be URL(s): JSON array or comma-separated https URLs (max 5)',
      }),
      // P1-3 (support audit): `z.string().url()` accepts `javascript:` /
      // `data:` URLs (the WHATWG URL constructor doesn't restrict
      // protocols) — array-form attachments must be http(s) like the
      // string form below.
      z
        .array(z.string().max(2000).refine((u) => /^https?:\/\//.test(u), {
          message: 'Attachments must be http(s) URLs',
        }))
        .max(5),
      z.null(),
      z.undefined(),
    ])
    .optional(),
  troubleshootPath: z.string().max(5000).optional(),
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
      'MAINTENANCE',
      'RETIRED',
    ])
    .optional()
    .default('AVAILABLE'),
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
  // AUDIT-RECON 2026-09-02 batch 6 P0-2: the admin Send Notification
  // dialog (SendNotificationDialog.tsx) offers a 'System' option that
  // sends type='SYSTEM'. The previous enum rejected it (Zod 422), so
  // every "System" send failed silently with a 422 toast while the
  // 5 other types succeeded. The NotificationType type was also
  // updated to match (notification.types.ts).
  type: z.preprocess(
    (val) => (typeof val === 'string' ? val.toUpperCase() : val),
    z.enum(['INFO', 'ALERT', 'PROMOTION', 'PAYMENT', 'VEHICLE', 'SYSTEM'])
  ).default('INFO'),
  // P1-5 (SUPPORT_SECTION_AUDIT_2026-09-08): cap at 100 to prevent a
  // multi-MB outbox event; the per-admin rate limit on the riderIds branch
  // (notifications/route.ts) provides the complementary defence.
  riderIds: z.array(z.string()).max(100, 'riderIds exceeds 100-recipient cap — split into batches').optional(),
  // P1-13/P2-11 (2026-08-05 ops audit): the legacy singular `riderId` was
  // read straight off the raw body with no validation — a non-string value
  // could reach the use-case. It's now schema-validated alongside the plural
  // `riderIds` (both stay optional; the route enforces "one of them").
  riderId: z.string().min(1).optional(),
  sendToAll: z.boolean().default(false),
});

// ==================== ADMIN - OFFERS ====================
export const createOfferSchema = z
  .object({
    title: z.string().min(2, 'Title is required').max(200),
    description: z.string().min(5, 'Description is required').max(2000),
    validFrom: z.string().min(1, 'validFrom is required'),
    validUntil: z.string().min(1, 'validUntil is required'),
    isSponsored: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    icon: z.string().max(100).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.validFrom && val.validUntil) {
      const from = new Date(val.validFrom).getTime();
      const until = new Date(val.validUntil).getTime();
      if (!isNaN(from) && !isNaN(until) && until < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['validUntil'],
          message: 'validUntil must be after or equal to validFrom',
        });
      }
    }
  });

// ==================== ADMIN - COUPONS ====================
// P1: PERCENTAGE discountValue is a percent (stored as-is), not money —
// capped at 100 via superRefine (a 500% coupon used to persist).
const couponPercentCap = (val: {
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
}) => {
  if (val.discountType === 'PERCENTAGE' && val.discountValue != null && val.discountValue > 100) {
    return false;
  }
  return true;
};

const COUPON_CODE_REGEX = /^[A-Za-z0-9_-]+$/;

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Code is required')
      .max(50)
      .regex(COUPON_CODE_REGEX, 'Coupon code can only contain letters, numbers, hyphens, and underscores')
      .transform((val) => val.toUpperCase()),
    description: z.string().trim().min(2, 'Description is required').max(500),
    discountType: z.enum(['PERCENTAGE', 'FIXED'], 'discountType must be "PERCENTAGE" or "FIXED"'),
    discountValue: z.number().positive('discountValue must be positive'),
    // 2026-09-08 offers audit P0-1: the compose form sends explicit nulls for
    // "no minimum spend / no usage cap" — the most common promo shape. A bare
    // .optional() rejected null with invalid_type, so every simple coupon
    // 400'd at the route. (Third instance of the null-vs-optional trap:
    // hubs location, incidents hasInsurance, and now this.)
    minAmount: z.number().min(0).nullable().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    validFrom: z.string().min(1, 'validFrom is required'),
    validUntil: z.string().min(1, 'validUntil is required'),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((val, ctx) => {
    if (!couponPercentCap(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }
    // P1-3: Bound FIXED discount exposure to ₹25,000 maximum per coupon
    if (val.discountType === 'FIXED' && val.discountValue > 25000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Fixed discount cannot exceed ₹25,000',
      });
    }
    if (val.validFrom && val.validUntil) {
      const from = new Date(val.validFrom).getTime();
      const until = new Date(val.validUntil).getTime();
      if (!isNaN(from) && !isNaN(until) && until < from) {
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
    code: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(COUPON_CODE_REGEX, 'Coupon code can only contain letters, numbers, hyphens, and underscores')
      .transform((val) => val.toUpperCase())
      .optional(),
    description: z.string().trim().min(2).max(500).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
    discountValue: z.number().positive().optional(),
    // P0-1: null is how the form says "remove the minimum spend / usage cap".
    minAmount: z.number().min(0).nullable().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    validFrom: z.string().min(1).optional(),
    validUntil: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    if (!couponPercentCap(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }
    if (val.discountType === 'FIXED' && val.discountValue != null && val.discountValue > 25000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Fixed discount cannot exceed ₹25,000',
      });
    }
    if (val.validFrom && val.validUntil) {
      const from = new Date(val.validFrom).getTime();
      const until = new Date(val.validUntil).getTime();
      if (!isNaN(from) && !isNaN(until) && until < from) {
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
  locale: z.enum(['en', 'hi']).default('en'),
});

// ==================== ADMIN - HUBS ====================
export const createHubSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  // P1-1 (2026-09-08 hubs audit): the UI sends `location: form.location ||
  // null` — null was rejected (`invalid_union`) so every create/edit with an
  // empty city 400'd. Null, undefined, and '' are all legal empty values.
  location: z.string().max(300).optional().nullable().or(z.literal('')),
  city: z.string().max(100).optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

// P2-1 (2026-09-08 hubs audit): the PUT route used to build its schema as
// `createHubSchema.partial().extend({id})` — the inherited `isActive`
// default meant parsing `{id, name}` yielded `isActive: true`, so ANY edit
// of a deactivated hub silently re-activated it. isActive is re-declared
// WITHOUT a default: it is only written when the client sends it.
export const updateHubSchema = createHubSchema
  .omit({ isActive: true })
  .partial()
  .extend({ id: z.string().min(1), isActive: z.boolean().optional() });

// ==================== ADMIN - TEAM LEADERS ====================
export const createTeamLeaderSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  phone: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v;
      const cleaned = v.replace(/\D/g, '');
      if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.slice(2);
      if (cleaned.length === 11 && cleaned.startsWith('0')) return cleaned.slice(1);
      return cleaned;
    },
    z.string().regex(/^[6-9]\d{9}$|^\d{10}$/, 'Phone must be a valid 10-digit mobile number')
  ),
  email: z.string().email().optional().or(z.literal('')),
  hubId: z.string().optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
}).strict();

// 2026-09-09 hubs audit (P1-9): updateTeamLeaderSchema re-declares isActive WITHOUT
// a default, matching updateHubSchema — so editing a team leader's name/phone does
// NOT silently reactivate an inactive team leader.
export const updateTeamLeaderSchema = createTeamLeaderSchema
  .omit({ isActive: true })
  .partial()
  .extend({ id: z.string().min(1), isActive: z.boolean().optional() });

// ==================== ADMIN - TICKETS (UPDATE) ====================
export const updateTicketSchema = z
  .object({
    id: z.string().min(1, 'id is required').optional(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_RIDER', 'RESOLVED', 'CLOSED']).optional(),
    assignedTo: z.string().optional(),
    isEscalated: z.boolean().optional(),
    // P2-3 (support audit): `refundAmountInPaise` removed — it is not a
    // SupportTicket column; the use-case only stripped it defensively after
    // the schema accepted it. No caller sends it. (The ticket refund flow
    // lives in the wallet/deposit modules, not here.)
  })
  .strict();

export const ticketReplySchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
  // P1: attachments must be https URLs (max 5), matching createTicketSchema —
  // previously any string/array passed, enabling javascript:/data: XSS stores.
  attachments: z
    .union([
      z.string().max(5000).refine(isUrlListString, {
        message: 'Attachments must be URL(s): JSON array or comma-separated https URLs (max 5)',
      }),
      // P1-3 (support audit): http(s)-only — see createTicketSchema note.
      z
        .array(z.string().max(2000).refine((u) => /^https?:\/\//.test(u), {
          message: 'Attachments must be http(s) URLs',
        }))
        .max(5),
      z.null(),
      z.undefined(),
    ])
    .optional(),
});

// ==================== ADMIN - LEGAL (UPSERT) ====================
// P1-1 (2026-08-05 legal/device audit): the old non-strict `updateLegalSchema`
// was deleted — the live route uses the strict `updateLegalAdminSchema` from
// `validators/admin.ts` (the canonical admin-mutation file). Two parallel
// schemas drifted before; one remains.

// ==================== ADMIN - SETTINGS (UPSERT) ====================
const VALID_SETTING_KEYS = [
  // TOPUP-SCREENS-AUDIT P1-1 (2026-09-09): the destination VPA riders pay
  // into is admin-editable server-side config (was a hardcoded client
  // string, so rotation required an app release + store review).
  'payoutUpiId',
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
    // REOPEN restores a REJECTED transaction back to PENDING with an audit reason
    action: z.enum(['APPROVE', 'REJECT', 'REVERSE', 'REOPEN']),
    reason: z.string().max(200).optional(),
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
  )
  .refine(
    (data) => {
      if (data.action === 'REOPEN') {
        const r = data.reason || data.rejectionReason;
        return typeof r === 'string' && r.trim().length >= 10;
      }
      return true;
    },
    {
      message:
        'Reason is required (minimum 10 characters) when re-opening a transaction',
      path: ['rejectionReason'],
    }
  );

// ==================== RIDER - PLANS ====================
export const subscribePlanSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  hubId: z.string().optional(),
  securityDeposit: z.number().optional(),
  advanceRentPaid: z.union([z.boolean(), z.number()]).optional(),
  // P1: server-authoritative skip declaration (set-true-only). Lets app
  // versions that never call POST /api/rider/guarantor/skip still record the
  // surcharge flag at the enforcement point. Never clears the flag.
  guarantorSkipped: z.boolean().optional(),
  // P0-2: wire coupon discount into plan checkout
  couponCode: z.string().trim().optional(),
  // CHOOSE-PLAN-AUDIT P1-1 (2026-09-10): the client generated an idempotency
  // key but never sent it, so a killed-app / timeout retry double-posted:
  // it re-ran coupon redemption (burning another use) and wrote duplicate
  // audit rows. Bounded 8-72 chars to match the `idempotency_keys.key` column.
  idempotencyKey: z.string().trim().min(8).max(72).optional(),
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
// P0-1 (device-tracking audit, 2026-09-08): FACTORY_RESET removed.
// `fcm.sendRemoteWipe` → `sendSecurityCommand('FACTORY_RESET')` throws
// unconditionally (`fcm.ts:158`), so the Emergency Wipe button was a
// destructive-but-noop trap. Keep this enum in lockstep with
// `SecurityAction` in `components/admin/screens/device-tracking/types.ts`.
export const riderActionSchema = z.object({
  action: z.enum([
    'ASSIGN_PLAN',
    'COMPLETE_PICKUP',
    'END_RENTAL',
    'SYNC_DEVICE_DATA',
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
  teamLeaderId: z.string().optional(),
  password: z.string().optional(),
  enabled: z.boolean().optional(),
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
  'REJECT_RETURN',
  'CLOSE',
  'SUSPEND',
]);
export type AdminRentalAction = z.infer<typeof adminRentalActionSchema>;

export const registerTokenSchema = z.object({
  fcmToken: z.string().min(1),
});

// ==================== ADMIN BULK ACTIONS ====================
export const bulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'ids must be a non-empty array').max(500, 'Max 500 IDs'),
  action: z.enum(['updateStatus', 'assignHub', 'assignTeamLeader', 'delete', 'bulkKyc', 'suspend']),
  value: z.string().optional(),
  rejectionReason: z.string().optional(),
  editableFields: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  if (data.action === 'bulkKyc') {
    if (!data.value || !['APPROVED', 'REJECTED', 'INFO_REQUIRED'].includes(data.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'value must be APPROVED, REJECTED, or INFO_REQUIRED for bulkKyc',
      });
    }
  }
});

export const vehicleBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['changeStatus', 'reassignHub', 'delete']),
  value: z.string().optional(),
});

/**
 * vehicleBulkUndoSchema — used by POST /api/admin/vehicles/bulk/undo.
 *
 * Each item carries the vehicle's captured state *before* the bulk action ran,
 * so the undo route can restore it exactly.  `action` identifies the original
 * operation so the use-case can handle soft-delete restoration differently from
 * status/hub rollbacks (compensating writes skip the state-machine).
 */
export const vehicleBulkUndoSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        status: z.string().min(1),
        hubId: z.string().min(1),
      })
    )
    .min(1, 'At least one item required')
    .max(500, 'Max 500 items'),
  action: z.enum(['changeStatus', 'reassignHub', 'delete']).optional(),
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
  // P2-1 (support audit): the admin UI captures each ticket's state before a
  // bulk action and sends it back on undo (action: 'revert'). The server
  // restores exactly those captured states instead of force-setting OPEN.
  previousStates: z
    .record(
      z.string(),
      z
        .object({
          status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_RIDER', 'RESOLVED', 'CLOSED']).optional(),
          priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
          assignedTo: z.string().nullable().optional(),
        })
        .optional()
    )
    .optional(),
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
  title: z.string().trim().min(1, 'Title is required').max(100),
  points: z.number().int().min(1, 'Points must be positive').max(50000, 'Points cannot exceed 50,000'),
});

export const updateRewardSchema = z.object({
  id: z.string().min(1, 'Reward ID is required'),
  title: z.string().trim().min(1).max(100).optional(),
  points: z.number().int().min(1, 'Points must be positive').max(50000, 'Points cannot exceed 50,000').optional(),
});

// ==================== WALLET TOPUP ====================
export const adminWalletTopupSchema = z.object({
  riderId: z.string().min(1),
  amount: z.number().int().min(10, 'Minimum ₹10').max(10000, 'Maximum ₹10000'),
  purpose: z.string().optional(),
});

// ==================== ANNOUNCEMENTS ====================
// 2026-09-08 messaging audit:
//   P1-2  the 'SMS' option removed — the pipeline has no SMS gateway for
//         broadcasts (the MSG91 provider is template-based, used by OTP), so
//         an "SMS" announcement was actually delivered as an in-app INFO row
//         with no text message and no warning. Re-add alongside a real
//         broadcast gateway.
//   P2-3  scheduledAt must be a valid ISO datetime strictly in the future —
//         a past value used to pass and fire on the cron's next tick.
//   P1-1  BY_STATUS ids are validated against the broadcastable lifecycle
//         whitelist in the use-case (AnnouncementValidationError → 400) so
//         the schema stays free of Prisma-enum imports.
export const ANNOUNCEMENT_CHANNELS = ['PUSH', 'IN_APP'] as const;
export const createAnnouncementSchema = z
  .object({
    title: z.string().min(3).max(200),
    message: z.string().min(5).max(5000),
    channel: z.enum(ANNOUNCEMENT_CHANNELS),
    targetAudience: z.enum(['ALL', 'BY_HUB', 'BY_STATUS', 'BY_PLAN']),
    targetIds: z.array(z.string()).optional().default([]),
    scheduledAt: z
      .string()
      .datetime({ offset: true })
      .refine((v) => new Date(v).getTime() > Date.now(), {
        message: 'scheduledAt must be in the future',
      })
      .optional(),
  })
  // BY_HUB requires hub ids; BY_STATUS requires lifecycle values; BY_PLAN
  // requires plan names (free strings).
  .refine(
    (v) =>
      v.targetAudience === 'ALL' ||
      (Array.isArray(v.targetIds) && v.targetIds.length > 0),
    { message: 'targetIds is required for the selected audience' }
  );

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
  status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED']).optional(),
  assignedTo: z.string().optional(),
  resolution: z.string().optional(),
  insuranceClaim: z.boolean().optional(),
  insuranceClaimNumber: z.string().optional(),
});

// ==================== ADMIN - FINES ====================
// P1-3 (2026-09-08 incidents & fines audit): the TrafficFine model existed
// with zero writers — these schemas make the fines half of the section live.
export const createFineSchema = z.object({
  riderId: z.string().min(1),
  vehicleId: z.string().optional(),
  amountInPaise: z.number().int().positive('Amount must be positive'),
  location: z.string().max(300).optional(),
  violationType: z.string().min(2).max(200),
  violationDate: z.coerce.date(),
  dueDate: z.coerce.date(),
});

export const updateFineSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'PAID', 'DISPUTED', 'OVERDUE', 'WAIVED']),
  reason: z.string().max(500).optional(),
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

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export function formatZodIssueMessage(issue: z.ZodIssue): string {
  const field = issue.path.length > 0 ? formatFieldName(String(issue.path[issue.path.length - 1])) : 'Field';

  if (
    issue.code === 'invalid_type' &&
    ((issue as any).received === 'undefined' || (issue.message && issue.message.includes('received undefined')))
  ) {
    return `${field} is required`;
  }
  if ((issue.code as string) === 'invalid_enum_value' || (issue.code as string) === 'invalid_value') {
    const options = (issue as any).values?.join(', ') || (issue as any).options?.join(', ') || '';
    return `Invalid value for ${field}. Allowed values: ${options}`;
  }
  if (issue.code === 'too_small') {
    const min = (issue as any).minimum;
    const isString =
      (issue as any).origin === 'string' ||
      (issue as any).type === 'string' ||
      (issue.message && issue.message.includes('expected string'));
    if (isString) {
      return `${field} must be at least ${min} characters`;
    }
    return `${field} must be at least ${min}`;
  }
  if (issue.code === 'too_big') {
    const max = (issue as any).maximum;
    const isString =
      (issue as any).origin === 'string' ||
      (issue as any).type === 'string' ||
      (issue.message && issue.message.includes('expected string'));
    if (isString) {
      return `${field} cannot exceed ${max} characters`;
    }
    return `${field} cannot exceed ${max}`;
  }
  if ((issue.code as string) === 'unrecognized_keys') {
    const keys = (issue as any).keys?.join(', ') || '';
    return `Unrecognized field: ${keys}`;
  }
  if ((issue.code as string) === 'invalid_string') {
    if ((issue as any).validation === 'email') {
      return 'Please enter a valid email address';
    }
  }
  return issue.message;
}

export function formatZodError(error: z.ZodError): {
  message: string;
  fieldErrors: Record<string, string[]>;
} {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_global';
    const msg = formatZodIssueMessage(issue);
    if (!fieldErrors[key]) fieldErrors[key] = [];
    fieldErrors[key].push(msg);
  }
  const firstKey = Object.keys(fieldErrors)[0];
  const firstMsg = firstKey ? fieldErrors[firstKey][0] : 'Validation failed';
  return { message: firstMsg, fieldErrors };
}

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
      error: null;
      details?: null;
    }
  | {
      success: false;
      data: null;
      error: string;
      details?: { fieldErrors: Record<string, string[]> };
    };

// Helper: validate request body and return parsed data or error response
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): ValidationResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    logger.debug('[Validation Error]', { errors: result.error.format() });
    const { message, fieldErrors } = formatZodError(result.error);
    return {
      success: false,
      error: message,
      data: null,
      details: { fieldErrors },
    };
  }
  return { success: true, error: null, data: result.data, details: null };
}

/**
 * Validate that an endpoint URL is a public HTTPS endpoint,
 * preventing SSRF attacks against internal network, localhost, or cloud metadata services.
 */
export function isValidPublicApiEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    // Check private RFC1918 and link-local ranges:
    // 10.0.0.0/8
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
    // 172.16.0.0/12
    const match172 = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
    if (match172) {
      const secondOctet = parseInt(match172[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return false;
    }
    // 192.168.0.0/16
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return false;
    // 169.254.0.0/16 (link-local / AWS metadata)
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return false;

    return true;
  } catch {
    return false;
  }
}

export const publicApiEndpointSchema = z
  .string()
  .nullable()
  .optional()
  .refine((val) => !val || isValidPublicApiEndpoint(val), {
    message:
      'apiEndpoint must be a valid public HTTPS URL (internal, private, and loopback IPs are not allowed)',
  });

export { adminWalletAdjustSchema } from './validators/admin';



/**
 * Admin validators — single source of truth for admin mutation bodies.
 *
 * All schemas are `.strict()` so unknown fields are rejected with a 400.
 * This is the API N1 fix from the 2026-08-03 audit (PR-26).
 *
 * Design rules:
 *  - `.strict()` on every object schema (no silent passthrough of unknown keys).
 *  - For PUT/UPDATE flows, all fields are optional except the identifier.
 *  - The SERVER owns "isSecret" on system-settings — callers cannot flip it
 *    (see `updateSystemSettingSchema` below; API N2 fix).
 */
import { z } from 'zod';
import { PasswordComplexitySchema } from '@/server/modules/admin/admin.schemas';

// ==================== DATA DELETION (orphan) ====================
// These schemas are defined for forward compatibility with a
// future POST/PUT data-deletion flow (request/approve/reject/restore).
// The current `admin/riders/[id]/data-deletion` route only has a
// DELETE handler that takes no body, so nothing imports these yet.
export const dataDeletionRequestSchema = z
  .object({
    riderId: z.string().min(1),
    reason: z.string().min(1).max(500),
  })
  .strict();

export const dataDeletionApproveSchema = z
  .object({
    requestId: z.string().min(1),
    notes: z.string().max(1000).optional(),
  })
  .strict();

export const dataDeletionRejectSchema = z
  .object({
    requestId: z.string().min(1),
    reason: z.string().min(5).max(500),
  })
  .strict();

export const dataDeletionRestoreSchema = z
  .object({
    requestId: z.string().min(1),
    reason: z.string().min(1).max(500),
  })
  .strict();

// ==================== RIDER UPDATE (orphan) ====================
// TODO(PR-26 follow-up): wire into admin/riders/[id] PUT once that
// route is split out from the bulk handler. Currently the rider
// mutation chokepoint is `riderUseCases.updateProfile`.
export const adminRiderUpdateSchema = z
  .object({
    fullName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    dob: z.string().optional(),
    intent: z.string().optional(),
    emergencyContact: z.string().optional(),
    currentAddress: z.string().optional(),
    lifecycleStatus: z.string().optional(),
  })
  .strict();

// ==================== WALLET ADJUST (wired) ====================
// Used by `web/src/app/api/admin/riders/[id]/wallet-adjust/route.ts`.
// `reason` is required for DEBIT (enforced at the route level because
// the discriminator check needs the parsed type). `proofUrl` is
// required for CREDIT (same). `coAdminId` is required for DEBIT
// amounts above `LARGE_DEBIT_THRESHOLD_INR` (PR-89 / API N6).
export const adminWalletAdjustSchema = z
  .object({
    type: z.enum(['CREDIT', 'DEBIT']),
    amount: z.number().positive(),
    reason: z.string().min(1).max(500).optional(),
    proofUrl: z.string().url().optional(),
    coAdminId: z.string().min(1).max(100).optional(),
    idempotencyKey: z.string().min(1).max(128).optional(),
  })
  .strict();

// ==================== DEPOSIT ACTION (wired) ====================
// Used by `web/src/app/api/admin/deposits/route.ts` PUT.
// P1 fix 2026-09-04: previously manual `if (!riderId || !action)` checks with
// an open-string action switch and unbounded `refundAmount` float — a
// financial mutation without a schema. Amounts are rupees (converted to paise
// at the use-case boundary); capped at ₹10,00,000 per call as a sanity bound.
export const adminDepositActionSchema = z
  .object({
    riderId: z.string().min(1, 'riderId is required').max(100),
    action: z.enum(['APPROVE', 'REJECT', 'REFUND', 'FORFEIT']),
    reason: z.string().min(1).max(500).optional(),
    refundAmount: z.number().positive().max(1000000).optional(),
    bonusAmount: z.number().positive().max(1000000).optional(),
  })
  .strict();

// ==================== REFERRAL RECONCILE (wired) ====================
// Used by `web/src/app/api/admin/referrals/route.ts` POST (manual
// reconciliation fallback; the job is the default path).
// P1 fix 2026-09-04: previously manual presence checks, no format check.
export const adminReferralReconcileSchema = z
  .object({
    referrerId: z.string().min(1, 'referrerId is required').max(100),
    refereeId: z.string().min(1, 'refereeId is required').max(100),
  })
  .strict();

// ==================== RIDER PLAN ACTION (wired) ====================
// Used by `web/src/app/api/admin/riders/[id]/plan/route.ts` PUT.
// P1 fix 2026-09-04: previously read `action` with no schema and echoed
// `error.message` on 500 (internal leak).
export const adminRiderPlanActionSchema = z
  .object({
    action: z.enum(['REJECT']),
    reason: z.string().min(1, 'reason is required').max(500),
  })
  .strict();

// ==================== ADMIN - ADMINS (new) ====================
export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'OPERATIONS_ADMIN',
  'KYC_REVIEWER',
  'FINANCE_ADMIN',
  'SUPPORT_AGENT',
  'HUB_MANAGER',
  'FLEET_MANAGER',
  'TEAM_LEADER',
  'READ_ONLY',
] as const;

export const createAdminSchema = z
  .object({
    name: z.string().min(1, 'name is required').max(200),
    email: z.string().email('email is required'),
    password: PasswordComplexitySchema,
    // P2-22 (2026-08-05 ops audit): the schema previously had no default and
    // the ROUTE applied `?? 'READ_ONLY'` — two sources of truth that
    // disagreed. The default lives here now; the route consumes the validated
    // value as-is.
    role: z.enum(ADMIN_ROLES).optional().default('READ_ONLY'),
    permissions: z.array(z.string()).optional(),
  })
  .strict();

export const updateAdminSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().optional(),
    password: PasswordComplexitySchema.optional(),
    // P0-3 (2026-08-05 ops audit): required when changing `password`. The
    // route verifies it against the ACTOR's own hash (re-authentication), not
    // the target's — verifying the target's password would deadlock password
    // recovery (only the target knows it) and let one admin reset another's
    // password only with the victim's cooperation.
    currentPassword: z.string().min(8, 'currentPassword must be at least 8 characters').optional(),
    role: z.enum(ADMIN_ROLES).optional(),
    permissions: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// ==================== ADMIN - FEATURE FLAGS (new) ====================
// PR-26 — N1 fix for `admin/feature-flags` PUT. The route accepts ONLY
// `key` + `value`; `description`, `category`, `isSecret`, etc. are
// server-side metadata and must not be settable from the client body.
export const FEATURE_FLAG_KEYS = [
  'enableReferralSystem',
  'enableRewardsSystem',
  'enableVehicleAssignment',
  'enableKYCVerification',
  'enableGuarantorRequirement',
  'enableDynamicPricing',
  'enableOfflineMode',
  'enableChatSupport',
  'enablePushNotifications',
  'maxUploadSizeMb',
] as const;

export const updateFeatureFlagSchema = z
  .object({
    key: z.enum(FEATURE_FLAG_KEYS),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })
  .strict();

// ==================== ADMIN - SYSTEM SETTINGS (new, N2 fix) ====================
// PR-26 — N2 fix for `admin/system-settings` PUT. `isSecret` is
// intentionally NOT in the schema — it is a server-side property
// decided at insert time (see `seed/system-settings.ts`). A caller
// who sends `{ key, value, isSecret: true }` will be rejected with a
// ZodError because `.strict()` blocks unknown keys.
export const updateSystemSettingSchema = z
  .object({
    key: z.string().min(1, 'key is required'),
    // P0-8 (2026-08-05 ops audit): value was unbounded z.string() — an admin
    // could set a secret (e.g. JWT_SECRET) to '' and destroy it. Non-empty
    // is enforced here; the route's [CONFIGURED] guard handles the
    // "unchanged placeholder" case separately.
    value: z.string().min(1, 'Value cannot be empty'),
  })
  .strict();

// ==================== ADMIN - FAQ UPDATE (new, strict version) ====================
// The existing `createFaqSchema` in `validators.ts` is non-strict (the
// FAQ list-route accepts client-side filters). For the admin
// create/update mutations, we need a strict schema. POST uses the
// fields from `createFaqSchema`; PUT is partial with `id` required.
export const createFaqAdminSchema = z
  .object({
    question: z.string().min(5, 'Question must be at least 5 characters').max(500),
    answer: z.string().min(5, 'Answer must be at least 5 characters').max(5000),
    category: z.string().max(100).optional(),
    order: z.number().int().min(0).optional().default(0),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateFaqAdminSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    question: z.string().min(5).max(500).optional(),
    answer: z.string().min(5).max(5000).optional(),
    category: z.string().max(100).optional(),
    order: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

// ==================== ADMIN - LEGAL UPDATE (strict) ====================
// P2-2 (2026-08-05 legal/device audit): the 4 legal document types were
// defined in THREE places (UI DOC_TYPES, the Zod enum, the free-form Prisma
// string). LEGAL_DOCUMENT_TYPES is now the single source of truth — imported
// by the UI, the schema, and the use-case's default-title fallback.
export const LEGAL_DOCUMENT_TYPES = [
  { key: 'terms', label: 'Terms of Service' },
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'rental_safety', label: 'Rental & Safety Policy' },
  { key: 'refund', label: 'Refund Policy' },
  { key: 'guarantor', label: 'Guarantor Agreement' },
  { key: 'lease', label: 'Lease Agreement' },
] as const;

export const LEGAL_DOCUMENT_KEYS = LEGAL_DOCUMENT_TYPES.map((d) => d.key);

export const updateLegalAdminSchema = z
  .object({
    type: z.enum(LEGAL_DOCUMENT_KEYS as [string, ...string[]]),
    title: z.string().max(200).optional(),
    content: z.string().min(1, 'content is required').max(100000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.content !== undefined || data.isActive !== undefined, {
    message: 'content is required unless toggling isActive',
    path: ['content'],
  });

// ==================== ADMIN - SETTINGS UPDATE (new, strict wrap) ====================
// Same pattern as `updateLegalAdminSchema`. The shared
// `updateSettingsSchema` in `validators.ts` already has a key-allowlist
// via `.refine()`; for the admin mutation we also reject unknown
// keys up front (a typo'd key that silently no-ops is just as
// dangerous as a typo'd field on a typed schema). `z.record` does
// not support `.strict()` so we enforce the allowlist via a refine.
const ADMIN_SETTING_KEYS = [
  'walletMinTopup',
  'lateFee',
  'referralBonus',
  'autoApproveKYC',
  'gracePeriodHours',
  'emailNotifications',
  'smsNotifications',
  'gpsFetchIntervalMins',
  'maxRentalDays',
  'penaltyCapDays',
  'maxWalletBalance',
  'loyaltyPointsPerRupee',
  'supportEmail',
  'supportPhone',
] as const;

export const updateSettingsAdminSchema = z
  .record(z.string().min(1), z.union([z.string(), z.number()]).optional())
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one setting key is required',
  })
  .refine(
    (obj) =>
      Object.keys(obj).every((k) =>
        (ADMIN_SETTING_KEYS as readonly string[]).includes(k)
      ),
    { message: `Invalid setting key. Allowed: ${ADMIN_SETTING_KEYS.join(', ')}` }
  );

// ==================== ADMIN - TICKETS (P1-10/P1-12, 2026-08-05 ops audit) ===
// The tickets route previously read body fields directly with NO Zod
// validation — `status: 'banana'` sailed through to the DB and an empty
// subject created a blank ticket. `updateTicketSchema` exists in
// `validators.ts` (rider-facing), but it allows `assignedTo: null` only via
// nullable — the admin UI unassigns a ticket by sending `assignedTo: null`.
// These strict schemas are the admin-route contract.
export const createAdminTicketSchema = z
  .object({
    riderDbId: z.string().min(1, 'riderDbId is required'),
    category: z
      .enum(['TECHNICAL', 'PAYMENT', 'VEHICLE', 'GENERAL', 'TROUBLESHOOTER', 'BATTERY'])
      .optional()
      .default('GENERAL'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('LOW'),
    // P1-12: an empty-string subject previously passed (`!subject` is false
    // for ''). min(1) rejects it while keeping short admin-typed subjects
    // valid (the rider schema uses min(5) — the admin form is less strict).
    subject: z.string().min(1, 'Subject cannot be empty').max(200),
    message: z.string().min(1, 'Message cannot be empty').max(5000),
  })
  .strict();

export const updateAdminTicketSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    status: z
      .enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_RIDER', 'RESOLVED', 'CLOSED'])
      .optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    // assignedTo may be null (unassign) or a string (assign).
    assignedTo: z.string().min(1).nullable().optional(),
  })
  .strict();

// ==================== ADMIN - BOOK RENTAL ON BEHALF (P2.10) ================
// P2.10 (2026-08-05 rentals/vehicles/hubs audit): the admin panel had no way
// to create a lease for a rider — bookRental/syncPickup were rider-side only,
// so a locked-out rider calling support could not be helped. This strict
// schema is the on-behalf booking contract. It mirrors the rider bookRental
// input (vehicleId/shiftId/leaseDate/startTime) plus the pickup-completion
// fields from syncPickup so one call can take a rider from PLAN_SELECTED to
// ACTIVE. `.strict()` rejects unknown keys (API N1 house rule).
export const adminBookRentalOnBehalfSchema = z
  .object({
    // Rider is addressed by public riderId OR internal db id — resolved by
    // the route via the same OR lookup as the riders/[id] GET route.
    riderId: z.string().min(1, 'riderId is required'),
    vehicleId: z.string().min(1, 'vehicleId is required'),
    shiftId: z.string().min(1, 'shiftId is required'),
    leaseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'leaseDate must be in YYYY-MM-DD format'),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'startTime must be in HH:mm format'),
    // When true, the route chains completePickupVerification (syncPickup's
    // photo-precondition wrapper) so the rider ends up ACTIVE in one call.
    completePickup: z.boolean().optional().default(false),
    // Optional syncPickup fields (required only when completePickup=true).
    hubId: z.string().optional(),
    teamLeaderId: z.string().optional(),
    emergencyContact: z.string().optional(),
    pickupPhotoFront: z.string().optional(),
    pickupPhotoBack: z.string().optional(),
    pickupPhotoLeft: z.string().optional(),
    pickupPhotoRight: z.string().optional(),
    pickupPhotoWithVehicle: z.string().optional(),
    // Support note, persisted to the audit log.
    reason: z.string().max(500).optional(),
  })
  .strict();

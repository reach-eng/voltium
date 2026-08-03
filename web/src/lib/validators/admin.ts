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
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(ADMIN_ROLES).optional(),
    permissions: z.array(z.string()).optional(),
  })
  .strict();

export const updateAdminSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
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
    value: z.string(),
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

// ==================== ADMIN - LEGAL UPDATE (new, strict wrap) ====================
// `updateLegalSchema` already exists in `validators.ts` (non-strict
// because the Flutter client sends some metadata fields). For the
// admin PUT mutation we need a strict allowlist. Re-defined here so
// the test file has one canonical location.
export const updateLegalAdminSchema = z
  .object({
    type: z.enum(['terms', 'privacy', 'refund', 'lease']),
    title: z.string().max(200).optional(),
    content: z.string().min(1, 'content is required').max(100000),
  })
  .strict();

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

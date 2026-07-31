import { z } from 'zod';
import { SETTING_REGISTRY } from '@/server/modules/settings/settings.registry';

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

// ==================== FEEDBACK ====================
export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
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

export const hubBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

// ==================== ADMIN - TEAM LEADERS ====================
export const createTeamLeaderSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  email: z.string().email().optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

export const teamLeaderBulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'IDs array required').max(500, 'Max 500 IDs'),
  action: z.enum(['activate', 'deactivate', 'delete']),
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
const VALID_SETTING_KEYS = SETTING_REGISTRY.map((s) => s.key) as readonly string[];

export const updateSettingsSchema = z
  .record(z.string().min(1), z.union([z.string(), z.number(), z.boolean()]).optional())
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
      return keys.every((key) => VALID_SETTING_KEYS.includes(key));
    },
    { message: `Invalid setting key. Allowed: ${VALID_SETTING_KEYS.join(', ')}` }
  );

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

// ==================== ADMIN REWARDS ====================
export const awardRewardSchema = z.object({
  riderDbId: z.string().min(1, 'Rider ID is required'),
  title: z.string().min(1, 'Title is required').max(100),
  points: z.number().int().min(1, 'Points must be positive'),
});

// ==================== WALLET TOPUP ====================
export const adminWalletTopupSchema = z.object({
  riderId: z.string().min(1),
  amount: z.number().int().min(10, 'Minimum ₹10').max(50000, 'Maximum ₹50000'),
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

// ==================== DATA DELETION APPROVAL ====================
export const dataDeletionApproveSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  notes: z.string().max(1000).optional(),
});

export const dataDeletionRejectSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  reason: z.string().min(3, 'reason is required').max(1000),
});


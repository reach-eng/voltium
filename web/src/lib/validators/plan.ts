import { z } from 'zod';

export const DURATION_DAYS_BY_TYPE: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
};

const basePlanObject = z.object({
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

export const createPlanSchema = basePlanObject.transform((data) => ({
  ...data,
  durationDays: DURATION_DAYS_BY_TYPE[data.type] ?? 1,
}));

export const updatePlanSchema = basePlanObject
  .partial()
  .extend({
    id: z.string().min(1),
  })
  .transform((data) => ({
    ...data,
    ...(data.type ? { durationDays: DURATION_DAYS_BY_TYPE[data.type] } : {}),
  }));

export const deletePlanSchema = z.object({
  id: z.string().min(1),
});

export const subscribePlanSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  advanceRentPaid: z.boolean().optional().default(false),
});

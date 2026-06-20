/**
 * Onboarding module — Zod validation schemas
 */

import { z } from 'zod';

export const onboardingProgressSchema = z.object({
  riderId: z.string(),
});

export const completeStepSchema = z.object({
  riderId: z.string(),
  step: z.enum(['PROFILE', 'KYC', 'GUARANTOR', 'DEPOSIT', 'PLAN', 'PICKUP']),
});

export type CompleteStepDto = z.infer<typeof completeStepSchema>;
export type OnboardingProgressDto = z.infer<typeof onboardingProgressSchema>;

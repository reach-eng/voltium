/**
 * Admin validators — data-deletion schemas.
 * Phase 2 PR-C item: the data-deletion request/approve/restore
 * endpoints each get their own Zod schema.
 */

import { z } from 'zod';

export const dataDeletionRequestSchema = z.object({
  riderId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export const dataDeletionApproveSchema = z.object({
  requestId: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

export const dataDeletionRejectSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export const dataDeletionRestoreSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export const adminRiderUpdateSchema = z.object({
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
});

export const adminWalletAdjustSchema = z.object({
  type: z.enum(['CREDIT', 'DEBIT']),
  amount: z.number().positive(),
  reason: z.string().min(1).max(500).optional(),
  proofUrl: z.string().url().optional(),
});

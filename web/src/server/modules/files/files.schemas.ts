import { z } from 'zod';

export const requestUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  category: z.enum(['kyc_document', 'profile_photo', 'vehicle_photo', 'payment_proof', 'support_attachment']),
  fileSize: z.number().positive().max(10 * 1024 * 1024),
});

export const confirmUploadSchema = z.object({
  fileRecordId: z.string().min(1),
  sizeBytes: z.number().positive(),
  checksum: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const requestReadUrlSchema = z.object({
  fileRecordId: z.string().min(1),
});

export type RequestUploadUrlDto = z.infer<typeof requestUploadUrlSchema>;
export type ConfirmUploadDto = z.infer<typeof confirmUploadSchema>;
export type RequestReadUrlDto = z.infer<typeof requestReadUrlSchema>;

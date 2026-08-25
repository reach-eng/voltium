import { z } from 'zod';

const DANGEROUS_EXTENSIONS = /\.(exe|bat|cmd|sh|scr|dll|com|cpl|jar|msi|vbs|ps1)$/i;
const DANGEROUS_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-sh',
  'application/x-bat',
  'application/x-executable',
  'application/java-archive',
  'application/octet-stream-executable',
];

export const requestUploadUrlSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(255)
    .refine((name) => !DANGEROUS_EXTENSIONS.test(name), {
      message: 'Executable and script file uploads are not permitted',
    }),
  mimeType: z
    .string()
    .min(1)
    .refine((mime) => !DANGEROUS_MIME_TYPES.includes(mime.toLowerCase()), {
      message: 'Disallowed executable MIME type for file upload',
    }),
  category: z.enum([
    'kyc_document',
    'profile_photo',
    'vehicle_photo',
    'payment_proof',
    'support_attachment',
    'pickup_verification',
    'RETURN_PHOTO',
    'TOPUP_PROOF',
    'vehicle_return',
    // PR-ONBOARDING-FLOW-2026-08-12: security-deposit proof uploaded
    // from the rider app's deposit workflow. Mirrors `payment_proof`
    // in rules; separated so the admin panel can route the review
    // queue distinctly.
    'security_deposit',
  ]),
  // Max file size: 25MB to match the largest FILE_UPLOAD_RULES
  // category (kyc_document). The per-category limit is enforced by
  // the use-case layer (validateUpload), which returns a 422 if a
  // specific category's limit is lower than 25MB.
  fileSize: z
    .number()
    .positive()
    .max(25 * 1024 * 1024),
});

export const confirmUploadSchema = z.object({
  fileRecordId: z.string().min(1),
  sizeBytes: z.number().positive(),
  checksum: z.string().nullish(),
  idempotencyKey: z.string().nullish(),
});

export const requestReadUrlSchema = z.object({
  fileRecordId: z.string().min(1),
});

export type RequestUploadUrlDto = z.infer<typeof requestUploadUrlSchema>;
export type ConfirmUploadDto = z.infer<typeof confirmUploadSchema>;
export type RequestReadUrlDto = z.infer<typeof requestReadUrlSchema>;

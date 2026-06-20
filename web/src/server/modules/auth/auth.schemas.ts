/**
 * Auth module - Zod validation schemas.
 *
 * Re-exports and extends src/lib/validators for auth-specific operations.
 */

import { z } from 'zod';
import { sendOtpSchema, verifyOtpSchema } from '@/lib/validators';

export { sendOtpSchema, verifyOtpSchema };

export const resendOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
});

export type SendOtpDto = z.infer<typeof sendOtpSchema>;
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;
export type ResendOtpDto = z.infer<typeof resendOtpSchema>;

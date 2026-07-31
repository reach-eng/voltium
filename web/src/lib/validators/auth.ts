import { z } from 'zod';
import { phoneSchema } from './common';

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z
  .object({
    phone: phoneSchema.nullish(),
    otp: z.string().length(6, 'OTP must be 6 digits').nullish(),
    idToken: z.string().nullish(),
    referralCode: z.string().max(20).nullish(),
  })
  .refine((data) => data.idToken || (data.phone && data.otp), {
    message: 'Either idToken or phone and otp are required',
    path: ['idToken'],
  });

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

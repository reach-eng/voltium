/**
 * Auth module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendOtpSchema, verifyOtpSchema } from './auth.schemas';
import { authUseCases } from './auth.use-cases';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function POST_sendOtp(request: NextRequest) {
  const body = await request.json();
  const validation = validateBody(sendOtpSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const result = await authUseCases.sendOtp(validation.data);
  return success(result, 'OTP sent successfully');
}

export async function POST_verifyOtp(request: NextRequest) {
  const body = await request.json();
  const validation = validateBody(verifyOtpSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const result = await authUseCases.verifyOtp(validation.data);

  const response = success(
    { riderId: result.riderId, isNewRider: result.isNewRider },
    'OTP verified successfully'
  );

  // Set session cookie
  response.cookies.set('voltium-session', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

import { NextRequest, NextResponse } from 'next/server';
import { errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, chatMessageSchema } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { withApiHandler } from '@/lib/api-handler';

const CHAT_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: process.env.NODE_ENV === 'development' ? 100 : 10,
};

const EMERGENCY_KEYWORDS = [
  'accident',
  'crash',
  'injury',
  'fire',
  'emergency',
  'stolen',
  'theft',
  'assault',
  'police',
  'hurt',
  'bleeding',
];

function localSupportReply(message: string): string {
  const text = message.toLowerCase();

  if (EMERGENCY_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return 'This looks urgent. Please call local emergency services if anyone is in danger. I have flagged this message as critical for the Voltium support team. If safe, share your current location, vehicle number, and a short description of what happened.';
  }

  if (text.includes('payment') || text.includes('deposit') || text.includes('top') || text.includes('wallet')) {
    return 'For payment, wallet, or deposit issues, please open a support ticket with the payment reference, amount, date/time, and a screenshot of the payment proof. The finance/admin team will review it from the local admin panel.';
  }

  if (text.includes('kyc') || text.includes('document') || text.includes('guarantor')) {
    return 'For KYC or guarantor issues, please check that all required documents are clear and uploaded. If a document was rejected, upload the corrected file and add a short note for the reviewer.';
  }

  if (text.includes('pickup') || text.includes('return') || text.includes('vehicle')) {
    return 'For pickup, return, or vehicle issues, please share the hub, vehicle number, and photos if applicable. A team leader or operations admin can review the inspection details from the admin panel.';
  }

  return 'Thanks. Please create a support ticket with the key details, screenshots/photos if relevant, and your preferred callback time. The Voltium support team will respond from the admin panel.';
}

export const POST = withApiHandler(async (request: NextRequest) => {
  const auth = await requireRiderSession(request);
  if (auth instanceof Response) return auth;
  const riderDbId = auth.riderDbId;

  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateLimit = await checkRateLimit(`chat:${clientIp}`, CHAT_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return errors.tooManyRequests(
      `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s`
    );
  }

  const body = await request.json();
  const validation = validateBody(chatMessageSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const { message } = validation.data;
  const isCritical = EMERGENCY_KEYWORDS.some((kw) => message.toLowerCase().includes(kw));
  const reply = localSupportReply(message);

  logger.info('Local support reply generated', {
    riderId: riderDbId,
    responseLength: reply.length,
    critical: isCritical,
  });

  return new NextResponse(reply, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Critical-Flag': isCritical ? 'true' : 'false',
      'X-Voltium-AI': 'disabled-local-only',
    },
  });
});

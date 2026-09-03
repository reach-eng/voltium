import { NextRequest, NextResponse } from 'next/server';
import { RazorpayService } from '@/server/modules/payments/razorpay.service';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-razorpay-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature header' }, { status: 400 });
  }

  const rawBody = await req.text();
  const config = await RazorpayService.getActiveGatewayConfig();
  const secret = config?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '';

  const isValid = RazorpayService.verifyWebhookSignature(rawBody, signature, secret);
  if (!isValid) {
    logger.warn('Invalid Razorpay webhook signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const data = JSON.parse(rawBody);
    const result = await RazorpayService.handleWebhookEvent(data.event, data.payload);
    return NextResponse.json({
      status: 'ok',
      event: data.event,
      handled: result.handled,
    });
  } catch (err) {
    logger.error('Error handling webhook event', { err });
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}

import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    
    // 1. Rate Limiting Check (20 requests per minute per IP)
    const rateLimit = await checkRateLimit(`webhook:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 20,
      failClosed: true,
    });

    if (!rateLimit.allowed) {
      return errors.tooManyRequests();
    }

    const provider = request.headers.get('x-payment-provider') || 'razorpay';
    const bodyText = await request.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch (_) {}

    const gateway = await db.paymentGateway.findUnique({
      where: { id: provider.toLowerCase() },
    });

    if (!gateway || !gateway.isActive) {
      return errors.badRequest('Payment gateway inactive or not configured');
    }

    let isValidSignature = false;

    if (provider.toLowerCase() === 'razorpay') {
      const razorpaySignature = request.headers.get('x-razorpay-signature');
      if (gateway.webhookSecret && razorpaySignature) {
        const expectedSignature = crypto
          .createHmac('sha256', gateway.webhookSecret)
          .update(bodyText)
          .digest('hex');
        isValidSignature = expectedSignature === razorpaySignature;
      } else {
        isValidSignature = false; // Fail closed if secret or signature is missing
      }
    } else {
      isValidSignature = false; // Unsupported or missing signature handler
    }

    if (!isValidSignature) {
      return errors.badRequest('Invalid or unverified webhook signature');
    }

    // Process top-up payment success
    const riderId = body.riderId || body.payload?.payment?.entity?.notes?.riderId;
    const paymentId = body.id || body.payload?.payment?.entity?.id || `wh_${Date.now()}`;
    const amountInRupees = Number(
      body.amount || (body.payload?.payment?.entity?.amount ? body.payload.payment.entity.amount / 100 : 0)
    );

    if (!riderId || amountInRupees <= 0) {
      return errors.badRequest('Invalid riderId or amount in webhook payload');
    }

    const amountPaise = Math.round(amountInRupees * 100);
    const { walletLedgerService } = await import('@/server/modules/wallet/wallet-ledger.service');

    const idempotencyKey = `webhook:${provider}:${paymentId}`;
    const idempotencyResult = await checkOrClaimIdempotency(idempotencyKey);
    
    if (idempotencyResult.status === 'completed') {
      return success(null, 'Webhook processed successfully (cached)');
    } else if (idempotencyResult.status === 'processing') {
      return errors.badRequest('Webhook is currently processing');
    }

    try {
      let riderFound = true;
      await db.$transaction(async (tx: any) => {
        const rider = await tx.rider.findUnique({ where: { id: riderId } });
        if (!rider) {
          riderFound = false;
          return;
        }

        const txn = await tx.transaction.create({
          data: {
            riderId,
            type: 'CREDIT',
            amount: amountPaise,
            purpose: 'TOP_UP',
            method: provider.toUpperCase(),
            status: 'APPROVED',
            idempotencyKey,
            description: `Instant online wallet top-up via ${gateway.name}`,
          },
        });

        await walletLedgerService.credit(
          {
            riderId,
            amountInPaise: amountPaise,
            category: 'TOP_UP',
            txnId: txn.id,
            idempotencyKey: `ledger:${idempotencyKey}`,
            note: `Online top-up via ${gateway.name}`,
          },
          tx
        );
      });

      if (!riderFound) {
        await failIdempotency(idempotencyKey);
        return errors.badRequest('Rider not found');
      }

      await completeIdempotency(idempotencyKey, { success: true });
      return success(null, 'Webhook processed successfully');
    } catch (txError: any) {
      await failIdempotency(idempotencyKey);
      throw txError;
    }
  } catch (error: any) {
    return errors.internal(error.message || 'Webhook error');
  }
}

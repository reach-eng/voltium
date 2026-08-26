import { db } from '@/lib/db';
import { success, errors } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activeGateway = await db.paymentGateway.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        mdrBearer: true,
        extraFeePercent: true,
        environment: true,
        keyId: true,
      },
    });

    if (!activeGateway) {
      // 9.5+ Hardening §7 (T-9P0-4): the prior implementation
      // fabricated a default_razorpay TEST gateway when no real
      // gateway was configured. That made it impossible for a rider
      // client to tell "the production gateway is real" from "the
      // server is silently returning a fake TEST gateway". The mobile
      // app would then attempt to use the bogus keyId and fail far
      // away from the actual cause. Now: 503 + machine code, no
      // fabricated object, no TEST environment, no invented keyId.
      return errors.paymentGatewayUnavailable();
    }

    return success(activeGateway, 'Active payment gateway fetched successfully');
  } catch (err: unknown) {
    return errors.internal('Failed to fetch active payment gateway');
  }
}

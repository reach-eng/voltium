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

    return success(
      activeGateway || {
        id: 'default_razorpay',
        name: 'Razorpay',
        provider: 'RAZORPAY',
        isActive: true,
        mdrBearer: 'RIDER',
        extraFeePercent: 2.5,
        environment: 'TEST',
        keyId: null,
      },
      'Active payment gateway fetched successfully',
    );
  } catch (err: unknown) {
    return errors.internal('Failed to fetch active payment gateway');
  }
}

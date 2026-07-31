// v1 prefix = stable, externally-documented contract. See contracts/openapi.ts.
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const activeGateways = await db.paymentGateway.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        provider: true,
        mdrBearer: true,
        extraFeePercent: true,
        environment: true,
      },
      orderBy: { id: 'asc' },
    });

    return success(activeGateways);
  } catch (error: any) {
    return errors.internal(error.message || 'Failed to fetch active gateways');
  }
}

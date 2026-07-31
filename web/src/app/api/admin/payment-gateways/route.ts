import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';

const DEFAULT_GATEWAYS = [
  {
    id: 'razorpay',
    name: 'Razorpay Gateway',
    provider: 'RAZORPAY',
    isActive: true,
    mdrBearer: 'RIDER',
    extraFeePercent: 2.5,
    keyId: 'rzp_test_mockKeyId123',
    keySecret: 'mockSecretKey456',
    merchantId: 'rzp_m_mock123',
    webhookSecret: 'whsec_mock789',
    apiEndpoint: 'https://api.razorpay.com/v1',
    environment: 'TEST',
  },
  {
    id: 'phonepe',
    name: 'PhonePe Gateway',
    provider: 'PHONEPE',
    isActive: true,
    mdrBearer: 'RIDER',
    extraFeePercent: 2.0,
    keyId: 'PGTESTPAYUAT',
    keySecret: '099eb0cd-02fe-4e0a-8207-36e44d207ae6',
    merchantId: 'PGTESTPAYUAT',
    webhookSecret: 'phonepe_whsec_mock',
    apiEndpoint: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    environment: 'TEST',
  },
  {
    id: 'cashfree',
    name: 'Cashfree Gateway',
    provider: 'CASHFREE',
    isActive: false,
    mdrBearer: 'MERCHANT',
    extraFeePercent: 1.8,
    keyId: 'TEST10023456',
    keySecret: 'cfsk_ma_test_987654321',
    merchantId: 'CF10023456',
    webhookSecret: 'cf_whsec_mock',
    apiEndpoint: 'https://sandbox.cashfree.com/pg',
    environment: 'TEST',
  },
  {
    id: 'easebuzz',
    name: 'Easebuzz Gateway',
    provider: 'EASEBUZZ',
    isActive: false,
    mdrBearer: 'RIDER',
    extraFeePercent: 2.2,
    keyId: 'EASEBUZZ_KEY_123',
    keySecret: 'EASEBUZZ_SALT_456',
    merchantId: 'EASEBUZZ_MERCHANT',
    webhookSecret: 'eb_whsec_mock',
    apiEndpoint: 'https://testpay.easebuzz.in/',
    environment: 'TEST',
  },
];

import { hasPermission } from '@/lib/permissions';
import { adminForbidden } from '@/lib/rbac';

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session, 'payment_gateways_manage')) return adminForbidden();

    let gateways = await db.paymentGateway.findMany({
      orderBy: { id: 'asc' },
    });

    if (gateways.length === 0 && process.env.SEED_PAYMENT_GATEWAYS === 'true') {
      // Seed default gateways if empty and explicitly requested via env
      for (const g of DEFAULT_GATEWAYS) {
        await db.paymentGateway.upsert({
          where: { id: g.id },
          update: {},
          create: g as any,
        });
      }
      gateways = await db.paymentGateway.findMany({
        orderBy: { id: 'asc' },
      });
    }

    const sanitized = gateways.map((g: any) => {
      const { keySecret, webhookSecret, ...rest } = g;
      return {
        ...rest,
        keySecretConfigured: Boolean(keySecret),
        webhookSecretConfigured: Boolean(webhookSecret),
      };
    });

    return success(sanitized);
  } catch (error: any) {
    return errors.internal(error.message || 'Failed to fetch payment gateways');
  }
}

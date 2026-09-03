import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { DEFAULT_SETTINGS_MAP } from '@/server/modules/settings/settings.registry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const identifier = rateLimitIdentifierFromRequest(request);
    const rl = await checkRateLimit(`public:skip-deposit:${identifier}`, {
      windowMs: 60_000,
      maxRequests: 60,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many requests. Please try again later.');
    }

    const setting = await db.systemSetting.findUnique({
      where: { key: 'skipGuarantorExtraDeposit' },
    });
    const paise = setting
      ? Number(setting.value)
      : Number(DEFAULT_SETTINGS_MAP.skipGuarantorExtraDeposit ?? '100000');
    const extraDepositRupees = paiseToRupees(Number.isFinite(paise) ? paise : 100000);

    return withCacheHeaders(success({ extraDepositRupees }), 60);
  } catch (error) {
    logger.error('GET /api/rider/config/skip-deposit error:', error);
    return success({ extraDepositRupees: 1000 });
  }
}

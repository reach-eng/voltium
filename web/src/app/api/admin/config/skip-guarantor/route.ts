import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache';
import { settingUseCases } from '@/server/modules/settings/setting.use-cases';
import { DEFAULT_SETTINGS_MAP } from '@/server/modules/settings/settings.registry';

const updateSkipGuarantorSchema = z.object({
  extraDepositRupees: z.number().positive('Extra deposit must be greater than zero'),
});

export async function GET() {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: 'skipGuarantorExtraDeposit' },
    });
    const paise = setting
      ? Number(setting.value)
      : Number(DEFAULT_SETTINGS_MAP.skipGuarantorExtraDeposit ?? '100000');
    const extraDepositRupees = paiseToRupees(Number.isFinite(paise) ? paise : 100000);

    return withCacheHeaders(success({ extraDepositRupees }), 60);
  } catch (error) {
    logger.error('GET /api/admin/config/skip-guarantor error:', error);
    // Graceful fallback to default ₹1,000 if DB has transient issue
    return success({ extraDepositRupees: 1000 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = updateSkipGuarantorSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    await settingUseCases.update(
      { skipGuarantorExtraDeposit: validation.data.extraDepositRupees },
      session.adminId ?? session.riderDbId ?? 'system'
    );
    invalidateCache('admin:settings:*');
    return success(
      { extraDepositRupees: validation.data.extraDepositRupees },
      'Skip guarantor deposit configuration updated'
    );
  } catch (error) {
    logger.error('PUT /api/admin/config/skip-guarantor error:', error);
    return errors.internal('Failed to update skip guarantor deposit configuration');
  }
}

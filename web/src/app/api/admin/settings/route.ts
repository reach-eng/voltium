import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, updateSettingsSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { settingUseCases } from '@/server/modules/settings/setting.use-cases';

export async function GET() {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();

  try {
    const result = await settingUseCases.getAll();
    return success(result);
  } catch (error) {
    logger.error('GET /api/admin/settings error:', error);
    return errors.internal('Failed to fetch settings');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(updateSettingsSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const results = await settingUseCases.update(
      validation.data,
      req.headers.get('x-admin-id') || 'system'
    );
    return success(results, 'Settings updated');
  } catch (error) {
    logger.error('PUT /api/admin/settings error:', error);
    return errors.internal('Failed to update settings');
  }
}

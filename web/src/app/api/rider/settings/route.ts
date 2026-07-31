import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { settingUseCases } from '@/server/modules/settings/setting.use-cases';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const result = await settingUseCases.getPublic();
    return success(result);
  } catch (err) {
    return errors.internal('Failed to fetch settings');
  }
}

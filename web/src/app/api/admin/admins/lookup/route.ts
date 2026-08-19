import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  try {
    const idsParam = req.nextUrl.searchParams.get('ids');
    if (!idsParam) {
      return success([]);
    }

    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 100);
    if (ids.length === 0) {
      return success([]);
    }

    const admins = await db.admin.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });

    return success(admins);
  } catch (error) {
    logger.error('GET /api/admin/admins/lookup error:', error);
    return errors.internal('Failed to lookup admin names');
  }
}

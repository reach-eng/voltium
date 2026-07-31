import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminSupportUseCases } from '@/server/modules/support/admin-support.use-cases';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'tickets_view')) return adminForbidden();

  try {
    const { id } = await params;
    const ticket = await adminSupportUseCases.getAdminTicket(id);

    if (!ticket) return errors.notFound('Ticket not found');

    return success(ticket);
  } catch (error) {
    return errors.internal('Failed to fetch ticket');
  }
}

import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { createAuditLog } from '@/lib/audit-log';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session, 'payment_gateways_manage')) return adminForbidden();

    const { id } = await params;
    const body = await request.json();

    const existing = await db.paymentGateway.findUnique({
      where: { id },
    });

    if (!existing) {
      return errors.notFound('Payment gateway not found');
    }

    const updateData: any = {};
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive;
    if (body.mdrBearer && (body.mdrBearer === 'RIDER' || body.mdrBearer === 'MERCHANT')) {
      updateData.mdrBearer = body.mdrBearer;
    }
    if (typeof body.extraFeePercent === 'number') updateData.extraFeePercent = body.extraFeePercent;
    if (typeof body.name === 'string') updateData.name = body.name;
    if (typeof body.keyId === 'string') updateData.keyId = body.keyId;
    if (typeof body.keySecret === 'string') updateData.keySecret = body.keySecret;
    if (typeof body.merchantId === 'string') updateData.merchantId = body.merchantId;
    if (typeof body.webhookSecret === 'string') updateData.webhookSecret = body.webhookSecret;
    if (typeof body.apiEndpoint === 'string') updateData.apiEndpoint = body.apiEndpoint;
    if (body.environment && (body.environment === 'TEST' || body.environment === 'LIVE')) {
      updateData.environment = body.environment;
    }

    const updated = await db.paymentGateway.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      actorId: session.adminId || session.riderDbId || 'system',
      actorType: 'ADMIN',
      action: 'payment_gateway.update',
      entity: 'payment_gateway',
      entityId: id,
      details: JSON.stringify({ updatedKeys: Object.keys(updateData) }),
    }).catch(() => {});

    const { keySecret, webhookSecret, ...sanitized } = updated;
    return success({
      ...sanitized,
      keySecretConfigured: Boolean(keySecret),
      webhookSecretConfigured: Boolean(webhookSecret),
    });
  } catch (error: any) {
    return errors.internal(error.message || 'Failed to update payment gateway');
  }
}

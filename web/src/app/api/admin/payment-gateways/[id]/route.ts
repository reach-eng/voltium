import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { createAuditLog } from '@/lib/audit-log';
import { encryptCredential, decryptCredential } from '@/lib/credentials';
import { publicApiEndpointSchema } from '@/lib/validators';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updatePaymentGatewaySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    provider: z.string().min(1).max(50).optional(),
    isActive: z.boolean().optional(),
    mdrBearer: z.enum(['RIDER', 'MERCHANT']).optional(),
    extraFeePercent: z.number().min(0).max(100).optional(),
    keyId: z.string().nullable().optional(),
    keySecret: z.string().nullable().optional(),
    merchantId: z.string().nullable().optional(),
    webhookSecret: z.string().nullable().optional(),
    apiEndpoint: publicApiEndpointSchema,
    environment: z.enum(['TEST', 'LIVE']).optional(),
  })
  .strict()
  // P1: quantize to 2 decimals — see list-route schema note.
  .transform((v) => ({
    ...v,
    extraFeePercent:
      v.extraFeePercent === undefined ? undefined : Math.round(v.extraFeePercent * 100) / 100,
  }));

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  if (
    !hasPermission(session.adminRole || '', 'payment_gateways_manage') &&
    !hasPermission(session.adminRole || '', 'transactions_manage')
  ) {
    return errors.forbidden('Insufficient permission to update payment gateway');
  }

  const { id } = await params;
  if (!id) return errors.badRequest('Gateway ID is required');

  try {
    const existing = await db.paymentGateway.findUnique({ where: { id } });
    if (!existing) {
      return errors.notFound('Payment gateway not found');
    }

    const body = await req.json();
    const parsed = updatePaymentGatewaySchema.parse(body);

    // Enforce single active gateway: deactivate all other gateways if this one is set to active
    if (parsed.isActive === true) {
      await db.paymentGateway.updateMany({
        where: { id: { not: id }, isActive: true },
        data: { isActive: false },
      });
    }

    const data = { ...parsed };
    // PR-8 (7th audit P0): encrypt secrets at rest. encryptCredential is
    // idempotent — the admin edit dialog round-trips the decrypted value,
    // and an already-encrypted value passes through untouched, so no value
    // can ever be double-encrypted.
    if (data.keySecret !== undefined) {
      data.keySecret = encryptCredential(data.keySecret) as string | null;
    }
    if (data.webhookSecret !== undefined) {
      data.webhookSecret = encryptCredential(data.webhookSecret) as string | null;
    }

    const updated = await db.paymentGateway.update({
      where: { id },
      data,
    });

    // P1: never ship plaintext secrets to the browser (see list GET).
    // Presence flags preserve the UI contract without the leak.
    const { keySecret: _ks, webhookSecret: _ws, ...safe } = updated;
    const redacted = {
      ...safe,
      keySecretSet: !!decryptCredential(_ks ?? null),
      webhookSecretSet: !!decryptCredential(_ws ?? null),
    };

    createAuditLog({
      actorId: session.adminId ?? session.riderDbId ?? 'unknown',
      actorType: 'ADMIN',
      action: 'payment_gateway_update',
      entity: 'PaymentGateway',
      entityId: id,
      details: JSON.stringify({ fields: Object.keys(parsed) }),
    }).catch(() => {});

    return success(redacted, 'Payment gateway updated successfully');
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return errors.validation('Validation failed', { details: err.issues });
    }
    return errors.internal('Failed to update payment gateway');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  if (
    !hasPermission(session.adminRole || '', 'payment_gateways_manage') &&
    !hasPermission(session.adminRole || '', 'transactions_manage')
  ) {
    return errors.forbidden('Insufficient permission to delete payment gateway');
  }

  const { id } = await params;
  if (!id) return errors.badRequest('Gateway ID is required');

  try {
    const existing = await db.paymentGateway.findUnique({ where: { id } });
    if (!existing) {
      return errors.notFound('Payment gateway not found');
    }

    await db.paymentGateway.delete({ where: { id } });

    createAuditLog({
      actorId: session.adminId ?? session.riderDbId ?? 'unknown',
      actorType: 'ADMIN',
      action: 'payment_gateway_delete',
      entity: 'PaymentGateway',
      entityId: id,
    }).catch(() => {});

    return success({ id }, 'Payment gateway deleted successfully');
  } catch (err: unknown) {
    return errors.internal('Failed to delete payment gateway');
  }
}

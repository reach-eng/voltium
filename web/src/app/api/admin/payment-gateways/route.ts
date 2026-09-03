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

const createPaymentGatewaySchema = z
  .object({
    name: z.string().min(1).max(100),
    provider: z.string().min(1).max(50),
    isActive: z.boolean().optional().default(false),
    mdrBearer: z.enum(['RIDER', 'MERCHANT']).optional().default('RIDER'),
    extraFeePercent: z.number().min(0).max(100).optional().default(2.5),
    keyId: z.string().nullable().optional(),
    keySecret: z.string().nullable().optional(),
    merchantId: z.string().nullable().optional(),
    webhookSecret: z.string().nullable().optional(),
    apiEndpoint: publicApiEndpointSchema,
    environment: z.enum(['TEST', 'LIVE']).optional().default('TEST'),
  })
  .strict()
  // P1: quantize to 2 decimals (basis-point precision). Float percents like
  // 2.675 are not exactly representable — without this, stored fee config
  // drifts and future fee math inherits the error. (Full basis-points-Int
  // migration deferred: it changes the API contract + admin UI + Flutter.)
  .transform((v) => ({
    ...v,
    extraFeePercent: Math.round(v.extraFeePercent * 100) / 100,
  }));

export async function GET() {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  // Allow admins with payment_gateways_manage, transactions_view, or SUPER_ADMIN
  if (
    !hasPermission(session.adminRole || '', 'payment_gateways_manage') &&
    !hasPermission(session.adminRole || '', 'transactions_view')
  ) {
    return errors.forbidden('Insufficient permission to view payment gateways');
  }

  try {
    // P1: bound — config table, but never unbounded.
    const gateways = await db.paymentGateway.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    // PR-8 (7th audit P0): secrets are encrypted at rest — decrypt for the
    // admin read path. Legacy plaintext rows pass through untouched until
    // the next write migrates them to ciphertext.
    // P1: NEVER ship plaintext secrets to the browser. The edit dialog
    // intentionally never pre-populates them ("never pre-populated") and
    // only sends non-empty values on save — so the list returns presence
    // flags. (A reveal flow would need step-up auth + audit, not a GET.)
    const redacted = gateways.map((gw: { keySecret?: string | null; webhookSecret?: string | null }) => {
      const { keySecret: _ks, webhookSecret: _ws, ...rest } = gw;
      return {
        ...rest,
        keySecretSet: !!decryptCredential(_ks ?? null),
        webhookSecretSet: !!decryptCredential(_ws ?? null),
      };
    });
    return success(redacted, 'Payment gateways fetched successfully');
  } catch (err: unknown) {
    return errors.internal('Failed to fetch payment gateways');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  if (
    !hasPermission(session.adminRole || '', 'payment_gateways_manage') &&
    !hasPermission(session.adminRole || '', 'transactions_manage')
  ) {
    return errors.forbidden('Insufficient permission to create payment gateway');
  }

  try {
    const body = await req.json();
    const parsed = createPaymentGatewaySchema.parse(body);

    // Enforce single active gateway: deactivate all existing if this one is active
    if (parsed.isActive) {
      await db.paymentGateway.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const id = `gw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const gateway = await db.paymentGateway.create({
      data: {
        id,
        name: parsed.name,
        provider: parsed.provider,
        isActive: parsed.isActive,
        mdrBearer: parsed.mdrBearer,
        extraFeePercent: parsed.extraFeePercent,
        keyId: parsed.keyId,
        // PR-8: encrypt at rest; never store gateway secrets in plaintext.
        keySecret: encryptCredential(parsed.keySecret) as string | null,
        merchantId: parsed.merchantId,
        webhookSecret: encryptCredential(parsed.webhookSecret) as string | null,
        apiEndpoint: parsed.apiEndpoint,
        environment: parsed.environment,
      },
    });

    createAuditLog({
      actorId: session.adminId ?? session.riderDbId ?? 'unknown',
      actorType: 'ADMIN',
      action: 'payment_gateway_create',
      entity: 'PaymentGateway',
      entityId: gateway.id,
      details: JSON.stringify({ name: gateway.name, provider: gateway.provider }),
    }).catch(() => {});

    // P0: never ship plaintext/ciphertext secrets to the browser (see GET/PATCH redaction).
    const { keySecret: _ks, webhookSecret: _ws, ...safe } = gateway as typeof gateway & { keySecret?: string | null; webhookSecret?: string | null };
    const redacted = {
      ...safe,
      keySecretSet: !!decryptCredential(_ks ?? null),
      webhookSecretSet: !!decryptCredential(_ws ?? null),
    };
    return success(redacted, 'Payment gateway created successfully', 201);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return errors.validation('Validation failed', { details: err.issues });
    }
    return errors.internal('Failed to create payment gateway');
  }
}

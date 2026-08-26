import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { createAuditLog } from '@/lib/audit-log';
import { encryptCredential, decryptCredential } from '@/lib/credentials';
import { isValidPublicApiEndpoint } from '@/lib/ssrf';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * W6 / M-5: gateway secrets must never leave the server in plaintext.
 * Read paths return a last-4 mask only; the full value stays encrypted
 * at rest and is used exclusively server-side (e.g. test-connection).
 */
function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const plain = value;
  if (plain.length <= 4) return '••••';
  return `••••${plain.slice(-4)}`;
}

const createPaymentGatewaySchema = z
  .object({
    name: z.string().min(1).max(100),
    provider: z.string().min(1).max(50),
    isActive: z.boolean().optional().default(false),
    mdrBearer: z.enum(['RIDER', 'MERCHANT']).optional().default('RIDER'),
    // ADMIN_PAYMENT_GATEWAY_AUDIT_2026-08-24 P0-3: cap at 10% to
    // match the UI input's min/max. The UI guards with HTML5
    // validation, but a DevTools-modified POST can bypass the
    // browser check. The server is the source of truth.
    extraFeePercent: z.number().min(0).max(10).optional().default(2.5),
    keyId: z.string().nullable().optional(),
    keySecret: z.string().nullable().optional(),
    merchantId: z.string().nullable().optional(),
    webhookSecret: z.string().nullable().optional(),
    apiEndpoint: z.string().nullable().optional(),
    environment: z.enum(['TEST', 'LIVE']).optional().default('TEST'),
  })
  .strict()
  // W6 / M-5: SSRF guard enforced at WRITE time — previously the
  // public-endpoint validation lived only in test-connection, so a
  // private-range endpoint could be stored and activated untested.
  .superRefine((data, ctx) => {
    const check = isValidPublicApiEndpoint(data.apiEndpoint);
    if (!check.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['apiEndpoint'],
        message: `apiEndpoint ${check.reason}`,
      });
    }
  });

export async function GET() {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  // Allow admins with payment_gateways_manage, transactions_view, or SUPER_ADMIN
  if (
    !hasPermission(session, 'payment_gateways_manage') &&
    !hasPermission(session, 'transactions_view')
  ) {
    return errors.forbidden('Insufficient permission to view payment gateways');
  }

  try {
    const gateways = await db.paymentGateway.findMany({
      orderBy: { createdAt: 'desc' },
    });
    // PR-8 (7th audit P0): secrets are encrypted at rest.
    // W6 / M-5: read paths return MASKED values (last 4), not plaintext.
    // The previous behavior decrypted and returned full secrets to any
    // admin holding transactions_view — defeating encryption-at-rest.
    const masked = gateways.map((gw: { keySecret?: string | null; webhookSecret?: string | null }) => ({
      ...gw,
      keySecret: maskSecret(decryptCredential(gw.keySecret ?? null)),
      webhookSecret: maskSecret(decryptCredential(gw.webhookSecret ?? null)),
    }));
    return success(masked, 'Payment gateways fetched successfully');
  } catch (err: unknown) {
    return errors.internal('Failed to fetch payment gateways');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  if (
    !hasPermission(session, 'payment_gateways_manage') &&
    !hasPermission(session, 'transactions_manage')
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

    // W6 / M-5: respond with MASKED secrets (matches the GET contract)
    // instead of echoing the stored ciphertext.
    const { keySecret: ks, webhookSecret: ws2, ...safeGateway } = gateway as Record<string, unknown> & {
      keySecret?: string | null;
      webhookSecret?: string | null;
    };
    return success(
      {
        ...safeGateway,
        keySecret: maskSecret(decryptCredential(ks ?? null)),
        webhookSecret: maskSecret(decryptCredential(ws2 ?? null)),
      },
      'Payment gateway created successfully',
      201
    );
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return errors.validation('Validation failed', { details: err.issues });
    }
    return errors.internal('Failed to create payment gateway');
  }
}

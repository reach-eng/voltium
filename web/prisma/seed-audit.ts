import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function createAuditLog(params: {
  actorId: string;
  actorType?: 'ADMIN' | 'SYSTEM' | 'RIDER';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'EXPORT' | 'PERMISSION_CHANGE' | 'ROLE_CHANGE' | 'SYSTEM_CONFIG' | 'SYSTEM_JOB' | 'REFUND';
  entity: string;
  entityId?: string;
  details?: string | Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId,
      actorType: params.actorType || 'ADMIN',
      action: params.action,
      entity: params.entity,
      entityId: params.entityId || null,
      details:
        typeof params.details === 'string'
          ? params.details
          : params.details
            ? JSON.stringify(params.details)
            : null,
    },
  });
}

async function main() {
  console.log('Seeding audit logs...');

  const logs = [
    {
      action: 'UPDATE' as const,
      entity: 'rider',
      entityId: 'VF-RD-004',
      actorId: 'admin_001',
      details: { reason: 'Policy violation', op: 'suspend' },
    },
    {
      action: 'APPROVE' as const,
      entity: 'rider',
      entityId: 'VF-RD-006',
      actorId: 'admin_002',
      details: { document: 'Aadhaar' },
    },
    {
      action: 'SYSTEM_JOB' as const,
      entity: 'security',
      entityId: 'system',
      actorId: 'system',
      actorType: 'SYSTEM' as const,
      details: { ip: '127.0.0.1', op: 'rate_limit_reset' },
    },
    {
      action: 'UPDATE' as const,
      entity: 'rider',
      entityId: 'multiple',
      actorId: 'admin_001',
      details: { count: 12, status: 'ACTIVE', op: 'bulk_update_status' },
    },
  ];

  for (const log of logs) {
    await createAuditLog(log);
  }

  console.log('Done!');
}

main()
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());

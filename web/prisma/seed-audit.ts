import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function createAuditLog(params: {
  actorId: string;
  actorType?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string | Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId,
      actorType: params.actorType || 'admin',
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
      action: 'rider.suspend',
      entity: 'rider',
      entityId: 'VF-RD-004',
      actorId: 'admin_001',
      details: { reason: 'Policy violation' },
    },
    {
      action: 'kyc.approve',
      entity: 'rider',
      entityId: 'VF-RD-006',
      actorId: 'admin_002',
      details: { document: 'Aadhaar' },
    },
    {
      action: 'system.rate_limit_reset',
      entity: 'security',
      entityId: 'system',
      actorId: 'system',
      actorType: 'system',
      details: { ip: '127.0.0.1' },
    },
    {
      action: 'rider.bulk_update_status',
      entity: 'rider',
      entityId: 'multiple',
      actorId: 'admin_001',
      details: { count: 12, status: 'ACTIVE' },
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

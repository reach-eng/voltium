import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';

export const announcementUseCases = {
  async list(params: { status?: string; search?: string; page?: number; limit?: number }) {
    const { status, search, page = 1, limit = 20 } = params;
    const where: any = {};
    if (status) where.status = status;
    if (search) where.OR = [{ title: { contains: search } }, { message: { contains: search } }];

    const [announcements, total] = await Promise.all([
      db.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { deliveries: { select: { status: true } } },
      }),
      db.announcement.count({ where }),
    ]);

    const formatted = (announcements as any[]).map((a) => {
      const delivered = a.deliveries?.filter((d: any) => d.status === 'DELIVERED').length || 0;
      const read = a.deliveries?.filter((d: any) => d.status === 'READ').length || 0;
      const failed = a.deliveries?.filter((d: any) => d.status === 'FAILED').length || 0;
      return {
        id: a.id,
        title: a.title,
        message: a.message,
        channel: a.channel,
        targetAudience: a.targetAudience,
        targetIds: JSON.parse(a.targetIds),
        scheduledAt: a.scheduledAt,
        sentAt: a.sentAt,
        status: a.status,
        totalRecipients: a.totalRecipients,
        deliveredCount: delivered,
        readCount: read,
        failedCount: failed,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    });

    return {
      announcements: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async create(
    data: {
      title: string;
      message: string;
      channel: string;
      targetAudience: string;
      targetIds: string[];
      scheduledAt?: string;
    },
    actorId: string
  ) {
    let recipients: { id: string }[] = [];
    if (data.targetAudience === 'ALL') {
      recipients = await db.rider.findMany({ select: { id: true } });
    } else if (data.targetAudience === 'BY_HUB') {
      recipients = await db.rider.findMany({
        where: { pickupHub: { in: data.targetIds } },
        select: { id: true },
      });
    } else if (data.targetAudience === 'BY_STATUS') {
      recipients = await db.rider.findMany({
        where: { lifecycleStatus: { in: data.targetIds as any } },
        select: { id: true },
      });
    } else if (data.targetAudience === 'BY_PLAN') {
      recipients = await db.rider.findMany({
        where: { currentPlan: { in: data.targetIds } },
        select: { id: true },
      });
    }

    const status = data.scheduledAt ? 'SCHEDULED' : 'SENT';
    const sentAt = data.scheduledAt ? null : new Date();

    const announcement = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.announcement.create({
        data: {
          title: data.title,
          message: data.message,
          channel: data.channel,
          targetAudience: data.targetAudience,
          targetIds: JSON.stringify(data.targetIds),
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          sentAt,
          status,
          totalRecipients: recipients.length,
          createdBy: actorId,
        },
      });

      if (recipients.length > 0 && !data.scheduledAt) {
        const batchSize = 500;
        for (let i = 0; i < recipients.length; i += batchSize) {
          const batch = recipients.slice(i, i + batchSize);
          await tx.announcementDelivery.createMany({
            data: batch.map((r) => ({
              announcementId: created.id,
              riderId: r.id,
              status: 'PENDING',
            })),
          });
        }
        await tx.notification.createMany({
          data: recipients.map((r) => ({
            riderId: r.id,
            title: data.title,
            message: data.message,
            type: data.channel === 'PUSH' ? 'ALERT' : 'INFO',
          })),
        });
      }
      return created;
    });

    createAuditLog({
      actorId,
      action: 'announcement.create',
      entity: 'announcement',
      entityId: announcement.id,
      details: {
        title: data.title,
        channel: data.channel,
        targetAudience: data.targetAudience,
        recipients: recipients.length,
      },
    }).catch(() => {});

    return {
      id: announcement.id,
      status: announcement.status,
      totalRecipients: announcement.totalRecipients,
    };
  },
};

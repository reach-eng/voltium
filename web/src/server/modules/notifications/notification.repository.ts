/**
 * Notifications module - Repository.
 *
 * Data access for notification records, device tokens, and FCM messages.
 */

import { db } from '@/lib/db';

export const notificationRepository = {
  async findByRiderId(riderDbId: string, limit = 50) {
    return db.notification.findMany({
      where: { riderId: riderDbId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async sendToRider(riderDbId: string, title: string, message: string, type: string = 'INFO') {
    return db.notification.create({
      data: {
        riderId: riderDbId,
        title,
        message,
        type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM',
        isRead: false,
      },
    });
  },

  async sendToAll(title: string, message: string, type: string = 'INFO') {
    const notificationType = type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM';
    const batchSize = 500;
    let skip = 0;
    let count = 0;

    while (true) {
      const riders = await db.rider.findMany({
        where: { deletedAt: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take: batchSize,
      });
      if (riders.length === 0) break;

      await db.notification.createMany({
        data: riders.map((rider: { id: string }) => ({
          riderId: rider.id,
          title,
          message,
          type: notificationType,
          isRead: false,
        })),
      });

      count += riders.length;
      skip += batchSize;
    }

    return { count };
  },

  async markRead(notificationId: string) {
    return db.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  },

  async markAllRead(riderDbId: string) {
    return db.notification.updateMany({
      where: { riderId: riderDbId, isRead: false },
      data: { isRead: true },
    });
  },

  async getUnreadCount(riderDbId: string) {
    return db.notification.count({
      where: { riderId: riderDbId, isRead: false },
    });
  },
};

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
        type,
        isRead: false,
      },
    });
  },

  async sendToAll(title: string, message: string, type: string = 'INFO') {
    // TODO: Implement batch insert for all riders
    throw new Error('Not implemented');
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

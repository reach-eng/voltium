/**
 * Notifications module - Use cases.
 *
 * Orchestrates notification sending, listing, management, and scheduled batch processing.
 */

import { db } from '@/lib/db';
import { notificationRepository } from './notification.repository';
import { notificationService } from '@/lib/notification-service';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export const notificationUseCases = {
  async listNotifications(riderDbId: string, limit?: number) {
    return notificationRepository.findByRiderId(riderDbId, limit);
  },

  async sendToRider(riderDbId: string, title: string, message: string, type?: string) {
    return notificationRepository.sendToRider(riderDbId, title, message, type);
  },

  async sendToAll(title: string, message: string, type?: string) {
    return notificationRepository.sendToAll(title, message, type);
  },

  async markRead(notificationId: string, riderDbId?: string) {
    if (riderDbId) {
      const notification = await db.notification.findUnique({ where: { id: notificationId }, select: { riderId: true } });
      if (!notification || notification.riderId !== riderDbId) {
        throw new Error('NOTIFICATION_ACCESS_DENIED');
      }
    }
    return notificationRepository.markRead(notificationId);
  },

  async markAllRead(riderDbId: string) {
    return notificationRepository.markAllRead(riderDbId);
  },

  async getUnreadCount(riderDbId: string) {
    return notificationRepository.getUnreadCount(riderDbId);
  },

  /**
   * Processes scheduled notification tasks: birthday wishes, payment reminders, referral updates.
   * Called by cron/notifications route.
   */
  /**
   * List all notifications with pagination, search, and rider info (admin view).
   */
  async listAllAdmin(params: { page?: number; limit?: number; search?: string; type?: string; status?: string }) {
    const { page = 1, limit = 20, search, type, status } = params;
    const where: any = {};
    if (type && type !== 'ALL') where.type = type;
    if (status === 'READ') where.isRead = true;
    if (status === 'UNREAD') where.isRead = false;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { rider: { fullName: { contains: search, mode: 'insensitive' } } },
        { rider: { riderId: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { rider: { select: { fullName: true, riderId: true } } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notification.count({ where }),
    ]);

    const formatted = (notifications as any[]).map((n: any) => ({
      id: n.id, riderId: n.rider.riderId, riderName: n.rider.fullName || 'Unknown',
      title: n.title, message: n.message, type: n.type, isRead: n.isRead, createdAt: n.createdAt,
    }));

    return { notifications: formatted, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  /**
   * Send notification to a single rider.
   */
  async sendToSingleRider(riderId: string, title: string, message: string, type: string, actorId: string) {
    const rider = await db.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new Error('Rider not found');

    const notification = await db.notification.create({ data: { riderId, title, message, type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM' } });

    createAuditLog({ actorId, action: 'notification.send', entity: 'notification', entityId: notification.id, details: { title, type, riderId } }).catch((e) => logger.error('Audit log failed', e));
    return notification;
  },

  /**
   * Send notification to all riders in batches.
   */
  async sendToAllRiders(title: string, message: string, type: string, actorId: string) {
    const BATCH_SIZE = 500;
    let skip = 0;
    let totalSent = 0;
    while (true) {
      const batch = await db.rider.findMany({ select: { id: true }, skip, take: BATCH_SIZE });
      if (batch.length === 0) break;
      await db.notification.createMany({ data: batch.map((r) => ({ riderId: r.id, title, message, type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM' })) });
      totalSent += batch.length;
      skip += BATCH_SIZE;
    }

    createAuditLog({ actorId, action: 'notification.send_all', entity: 'notification', details: { title, type, count: totalSent } }).catch((e) => logger.error('Audit log failed', e));
    return { count: totalSent };
  },

  /**
   * Send notification to specific riders.
   */
  async sendToSpecificRiders(riderIds: string[], title: string, message: string, type: string, actorId: string) {
    await db.notification.createMany({ data: riderIds.map((riderId) => ({ riderId, title, message, type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM' })) });
    createAuditLog({ actorId, action: 'notification.send_batch', entity: 'notification', details: { title, type, count: riderIds.length } }).catch((e) => logger.error('Audit log failed', e));
    return { count: riderIds.length };
  },

  async processScheduledNotifications() {
    const results = { birthdays: 0, paymentReminders: 0, referralLeaderboard: 0 };

    // 1. Birthday Wishes
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const birthdayString = `${day}-${month}`;

    const birthdayRiders = await db.rider.findMany({
      where: { dob: { startsWith: birthdayString } },
      select: { id: true, fullName: true },
    });

    for (const rider of birthdayRiders) {
      await notificationService.notifyBirthdayWish(rider.id, rider.fullName || 'Rider');
      results.birthdays++;
    }

    // 2. Payment Reminders
    const ridersToRemind = (await db.rider.findMany({
      where: { lifecycleStatus: 'ACTIVE', wallet: { balanceInPaise: { lt: 0 } } },
      include: { wallet: true },
    })) as any;

    for (const rider of ridersToRemind) {
      if (rider.wallet) {
        await notificationService.notifyPaymentReminder(
          rider.id,
          Math.abs(rider.wallet.balanceInPaise),
          'overdue',
        );
        results.paymentReminders++;
      }
    }

    // 3. Referral Leaderboard Update
    await notificationService.notifyReferralUpdate();
    results.referralLeaderboard = 1;

    return results;
  },
};

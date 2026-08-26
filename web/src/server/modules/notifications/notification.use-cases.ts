/**
 * Notifications module - Use cases.
 *
 * Orchestrates notification sending, listing, management, and scheduled batch processing.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { notificationRepository } from './notification.repository';
import { CATEGORY_MAP, deriveCategoryFromTitle, notificationService } from '@/lib/notification-service';
import { fcmService } from '@/lib/fcm';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { getCachedRider } from '@/lib/server-cache';

export const notificationUseCases = {
  async listNotifications(riderDbId: string, limit?: number) {
    return notificationRepository.findByRiderId(riderDbId, limit);
  },

  async sendToRider(
    riderDbId: string,
    title: string,
    message: string,
    type?: string,
    category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
  ) {
    return notificationRepository.sendToRider(riderDbId, title, message, type, category);
  },

  async sendToAll(
    title: string,
    message: string,
    type?: string,
    category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
  ) {
    return notificationRepository.sendToAll(title, message, type, category);
  },

  async markRead(notificationId: string, riderDbId?: string) {
    if (riderDbId) {
      const notification = await db.notification.findUnique({
        where: { id: notificationId },
        select: { riderId: true },
      });
      if (!notification || notification.riderId !== riderDbId) {
        throw new Error('NOTIFICATION_ACCESS_DENIED');
      }
    }
    return notificationRepository.markRead(notificationId);
  },

  async markAllRead(riderDbId: string) {
    return notificationRepository.markAllRead(riderDbId);
  },

  /**
   * PR-VER-2026-08-06 (SUPPORT_NOTIFICATIONS P0-5): delete one notification.
   * Ownership-scoped — returns false if the row belongs to another rider.
   */
  async deleteNotification(notificationId: string, riderDbId: string) {
    const deleted = await notificationRepository.deleteOwned(
      notificationId,
      riderDbId
    );
    return deleted.count > 0;
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
  async listAllAdmin(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    status?: string;
  }) {
    const { page = 1, limit = 20, search, type, status } = params;
    const where: Prisma.NotificationWhereInput = {};
    if (type && type !== 'ALL') where.type = type as Prisma.NotificationWhereInput['type'];
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

    const formatted = notifications.map((n) => ({
      id: n.id,
      riderId: n.rider.riderId,
      riderName: n.rider.fullName || 'Unknown',
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));

    return {
      notifications: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Send notification to a single rider.
   */
  async sendToSingleRider(
    riderId: string,
    title: string,
    message: string,
    type: string,
    actorId: string,
    category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
  ) {
    const rider = await getCachedRider(riderId, () => db.rider.findUnique({ where: { id: riderId } }));
    if (!rider) throw new Error('Rider not found');

    const rawUpper = (type || 'INFO').toUpperCase();
    const categoryValue = category ?? CATEGORY_MAP[rawUpper] ?? (rawUpper === 'PAYMENT' ? 'PAYMENT' : rawUpper === 'PROMOTION' ? 'ANNOUNCEMENT' : deriveCategoryFromTitle(title));

    const notification = await db.notification.create({
      data: {
        riderId,
        title,
        message,
        type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM',
        category: categoryValue,
      },
    });

    // PR-VER-2026-08-06 (SHIFTS P0-4 Bug B): the admin single-rider send used
    // to stop at the DB row — the rider got an in-app notification but NO
    // push, so admins' "Send" appeared to work while the device never rang.
    // Now fire the FCM push too (best-effort, non-blocking; the in-app row
    // is the source of truth if the token is missing/stale).
    if (rider.fcmToken) {
      fcmService
        .sendPushNotification(rider.fcmToken, title, message, { screen: 'NOTIFICATIONS' })
        .catch((e) => logger.warn('FCM push failed for admin notification', { riderId, err: e }));
    }

    createAuditLog({
      actorId,
      action: 'notification.send',
      entity: 'notification',
      entityId: notification.id,
      details: { title, type, riderId },
    }).catch((e) => logger.error('Audit log failed', e));
    return notification;
  },

  /**
   * Send notification to all riders in batches.
   *
   * P0-1/P0-9 (2026-08-05 ops audit): the route no longer calls this
   * synchronously — it emits NOTIFICATION_BROADCAST and returns 202, and the
   * background job calls this with `batchDelayMs` so the DB isn't hammered
   * with back-to-back 500-row createMany calls (100k riders ≈ 200 round-trips
   * in a tight loop). A failed batch now THROWS instead of being silently
   * skipped (the old loop continued on failure and under-reported the count),
   * so the job's retry semantics apply.
   */
  async sendToAllRiders(
    title: string,
    message: string,
    type: string,
    actorId: string,
    batchDelayMs = 0,
    // AUDIT FIX (workflows WF-P2): resume offset for retry-after-failure.
    // The job parses BROADCAST_RESUME:<n> out of the event's error field
    // (preserved by the reaper) and passes it here so already-sent batches
    // are not re-sent.
    resumeFromSkip = 0,
    category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
  ) {
    const rawUpper = (type || 'INFO').toUpperCase();
    const categoryValue = category ?? CATEGORY_MAP[rawUpper] ?? (rawUpper === 'PAYMENT' ? 'PAYMENT' : rawUpper === 'PROMOTION' ? 'ANNOUNCEMENT' : deriveCategoryFromTitle(title));

    const BATCH_SIZE = 500;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    let skip = resumeFromSkip;
    let lastCompletedSkip = resumeFromSkip;
    let totalSent = 0;
    while (true) {
      const batch = await db.rider.findMany({
        select: { id: true, fcmToken: true },
        skip,
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      await db.notification.createMany({
        data: batch.map((r: { id: string; fcmToken: string | null }) => ({
          riderId: r.id,
          title,
          message,
          type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM',
          category: categoryValue,
        })),
      });
      // PR-VER-2026-08-06 (SHIFTS P0-4 Bug B): the broadcast used to stop at
      // the DB rows — riders got in-app notifications but NO push. Fire the
      // FCM multicast for this batch best-effort; the in-app row remains the
      // source of truth if a token is stale/missing.
      const tokens = batch
        .map((r: { id: string; fcmToken: string | null }) => r.fcmToken)
        .filter((t: string | null): t is string =>
          typeof t === 'string' && t.length > 0
        );
      if (tokens.length > 0) {
        fcmService
          .sendMulticast(tokens, { type: 'NOTIFICATION', screen: 'NOTIFICATIONS' }, 'high')
          .catch((e: Error) =>
            logger.warn('[notifications] FCM multicast failed for broadcast batch', { err: e })
          );
      }
      totalSent += batch.length;
      skip += BATCH_SIZE;
      lastCompletedSkip = skip;
      if (batchDelayMs > 0 && batch.length === BATCH_SIZE) await sleep(batchDelayMs);
    }

    createAuditLog({
      actorId,
      action: 'notification.send_all',
      entity: 'notification',
      details: { title, type, count: totalSent },
    }).catch((e) => logger.error('Audit log failed', e));
    // AUDIT FIX (WF-P2): expose the completed offset so the job can embed
    // a BROADCAST_RESUME cursor in its error field on failure.
    return { count: totalSent, completedSkip: lastCompletedSkip };
  },

  /**
   * Send notification to specific riders.
   */
  async sendToSpecificRiders(
    riderIds: string[],
    title: string,
    message: string,
    type: string,
    actorId: string,
    category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
  ) {
    const rawUpper = (type || 'INFO').toUpperCase();
    const categoryValue = category ?? CATEGORY_MAP[rawUpper] ?? (rawUpper === 'PAYMENT' ? 'PAYMENT' : rawUpper === 'PROMOTION' ? 'ANNOUNCEMENT' : deriveCategoryFromTitle(title));

    await db.notification.createMany({
      data: riderIds.map((riderId) => ({
        riderId,
        title,
        message,
        type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM',
        category: categoryValue,
      })),
    });
    // PR-VER-2026-08-06 (SHIFTS P0-4 Bug B): same push gap as send-to-all —
    // the admin "send to specific riders" flow created DB rows only. Fire
    // FCM multicasts (500/batch) for any valid tokens, best-effort.
    const riders = await db.rider.findMany({
      where: { id: { in: riderIds } },
      select: { fcmToken: true },
    });
    const tokens = riders
      .map((r: { fcmToken: string | null }) => r.fcmToken)
      .filter((t: string | null): t is string =>
        typeof t === 'string' && t.length > 0
      );
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      fcmService
        .sendMulticast(chunk, { type: 'NOTIFICATION', screen: 'NOTIFICATIONS' }, 'high')
        .catch((e: Error) =>
          logger.warn('[notifications] FCM multicast failed for specific-riders send', { err: e })
        );
    }
    createAuditLog({
      actorId,
      action: 'notification.send_batch',
      entity: 'notification',
      details: { title, type, count: riderIds.length },
    }).catch((e) => logger.error('Audit log failed', e));
    return { count: riderIds.length };
  },

  async processScheduledNotifications() {
    const results = { birthdays: 0, paymentReminders: 0, referralLeaderboard: 0 };
    const BATCH_SIZE = 50;

    // 1. Birthday Wishes
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const birthdayString = `${day}-${month}`;

    const birthdayRiders = await db.rider.findMany({
      where: { dob: { startsWith: birthdayString } },
      select: { id: true, fullName: true },
    });

    for (let i = 0; i < birthdayRiders.length; i += BATCH_SIZE) {
      const batch = birthdayRiders.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((rider: { id: string; fullName: string | null }) =>
          notificationService
            .notifyBirthdayWish(rider.id, rider.fullName || 'Rider')
            .catch((e) => logger.error(`Birthday wish error for ${rider.id}:`, e))
        )
      );
      results.birthdays += batch.length;
    }

    // 2. Payment Reminders
    const ridersToRemind = await db.rider.findMany({
      where: { lifecycleStatus: 'ACTIVE', wallet: { balanceInPaise: { lt: 0 } } },
      include: { wallet: true },
    });

    for (let i = 0; i < ridersToRemind.length; i += BATCH_SIZE) {
      const batch = ridersToRemind.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((rider) => {
          if (rider.wallet) {
            return notificationService
              .notifyPaymentReminder(
                rider.id,
                Math.abs(rider.wallet.balanceInPaise),
                'overdue'
              )
              .catch((e) => logger.error(`Payment reminder error for ${rider.id}:`, e));
          }
          return Promise.resolve();
        })
      );
      results.paymentReminders += batch.length;
    }

    // 3. Referral Leaderboard Update
    await notificationService.notifyReferralUpdate();
    results.referralLeaderboard = 1;

    return results;
  },
};

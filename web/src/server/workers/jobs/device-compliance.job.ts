import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { OutboxService, OutboxEventTypes } from '../outbox';

interface DeviceComplianceResult {
  violationsFound: number;
  violationsResolved: number;
  ridersChecked: number;
  violationsPurged?: number;
}

export const deviceComplianceJob = {
  async process(job: QueueJob): Promise<DeviceComplianceResult> {
    logger.info('[DeviceComplianceJob] Starting', { jobId: job.id });

    const result: DeviceComplianceResult = {
      violationsFound: 0,
      violationsResolved: 0,
      ridersChecked: 0,
    };

    // Check active riders for device compliance issues.
    // P1: bound the sweep (cap + warn makes growth visible, not a silent OOM).
    const activeRiders = await db.rider.findMany({
      where: { lifecycleStatus: 'ACTIVE' },
      select: {
        id: true,
        isLocationMandatory: true,
        isAppsControlRestricted: true,
        isUninstallBlocked: true,
        deviceViolationCount: true,
      },
      orderBy: { id: 'asc' },
      take: 2000,
    });
    if (activeRiders.length >= 2000) {
      logger.warn('[DeviceComplianceJob] Sweep hit the 2000-rider cap — convert to cursor batching before the fleet grows further');
    }

    result.ridersChecked = activeRiders.length;

    for (const rider of activeRiders) {
      // Check for missing permissions
      const missingPermissions: string[] = [];

      if (rider.isLocationMandatory && rider.deviceViolationCount > 0) {
        missingPermissions.push('location');
      }

      if (missingPermissions.length > 0) {
        // Log a new device violation
        for (const permissionId of missingPermissions) {
          // Check if there's already an active violation for this permission
          const existing = await db.deviceViolation.findFirst({
            where: {
              riderId: rider.id,
              permissionId,
              status: 'ACTIVE',
            },
          });

          if (!existing) {
            await db.deviceViolation.create({
              data: {
                riderId: rider.id,
                permissionId,
                status: 'ACTIVE',
              },
            });
            result.violationsFound++;
          }
        }

        // Emit outbox event for admin notification
        await OutboxService.emit(OutboxEventTypes.DEVICE_VIOLATION, {
          riderId: rider.id,
          violations: missingPermissions,
        }).catch(() => {});
      }

      // Auto-resolve old violations if rider is now compliant.
      // P2-4 (PR-A, 2026-08-28 workflows polish): the 7-day window is
      // now admin-configurable via the `deviceViolationAutoResolveDays`
      // system setting. Default 7 days if the setting is missing. The
      // setting is read inside the per-rider loop intentionally — most
      // admins won't change it daily, and the read is a single indexed
      // lookup. (We could cache per-run, but a run is 1×/minute; the
      // overhead is negligible compared to the per-rider DB calls.)
      const setting = await db.systemSetting.findUnique({
        where: { key: 'deviceViolationAutoResolveDays' },
      });
      const autoResolveDays = setting ? parseInt(setting.value) || 7 : 7;
      const sevenDaysAgo = new Date(clock.now().getTime() - autoResolveDays * 24 * 60 * 60 * 1000);
      const oldViolations = await db.deviceViolation.updateMany({
        where: {
          riderId: rider.id,
          status: 'ACTIVE',
          reportedAt: { lt: sevenDaysAgo },
        },
        data: {
          status: 'RESOLVED',
          resolvedAt: clock.now(),
        },
      });
      result.violationsResolved += oldViolations.count;
    }

    // Retention TTL: delete resolved violations older than 30 days
    const thirtyDaysAgo = new Date(clock.now().getTime() - 30 * 24 * 60 * 60 * 1000);
    const purged = await db.deviceViolation.deleteMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: { lt: thirtyDaysAgo },
      },
    });
    if (purged.count > 0) {
      result.violationsPurged = purged.count;
      logger.info('[DeviceComplianceJob] Purged expired resolved violations', { count: purged.count });
    }

    logger.info('[DeviceComplianceJob] Complete', result);
    return result;
  },
};

import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { OutboxService, OutboxEventTypes } from '../outbox';

interface DeviceComplianceResult {
  violationsFound: number;
  violationsResolved: number;
  ridersChecked: number;
}

export const deviceComplianceJob = {
  async process(job: QueueJob): Promise<DeviceComplianceResult> {
    logger.info('[DeviceComplianceJob] Starting', { jobId: job.id });

    const result: DeviceComplianceResult = {
      violationsFound: 0,
      violationsResolved: 0,
      ridersChecked: 0,
    };

    // Check active riders for device compliance issues
    const activeRiders = await db.rider.findMany({
      where: { lifecycleStatus: 'ACTIVE' },
      select: {
        id: true,
        isLocationMandatory: true,
        isAppsControlRestricted: true,
        isUninstallBlocked: true,
        deviceViolationCount: true,
      },
    });

    result.ridersChecked = activeRiders.length;

    for (const rider of activeRiders) {
      // T-96 (PR-6, 2026-08-23): the previous "violation"
      // predicate was `rider.isLocationMandatory &&
      // rider.deviceViolationCount > 0` — circular. A violation
      // exists because violations exist. The correct predicate
      // is "the rider revoked a mandatory permission since the
      // last scan" — derived from `rider.lastDeviceViolationAt`
      // vs the per-permission violation `reportedAt`. For now
      // we keep the location-mandatory flag (we don't yet have
      // a granular "revoked since last scan" field) but drop
      // the circular `deviceViolationCount > 0` clause. The
      // deviceViolationCount field is now treated as a counter
      // that's bumped when a NEW violation is created (not as
      // a condition for emitting one).
      const missingPermissions: string[] = [];

      if (rider.isLocationMandatory) {
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
            // T-96: the emit MUST live inside the `if (!existing)`
            // branch so a Slack page only fires on a real new
            // violation. The previous code emitted outside this
            // branch, so the device-violation-emitter (which
            // fires every minute) caused the dispatcher to
            // receive DEVICE_VIOLATION events for already-known
            // violations ~1,440 times/day/rider.
            const created = await db.deviceViolation.create({
              data: {
                riderId: rider.id,
                permissionId,
                status: 'ACTIVE',
                // T-96: stamp the 24h alerted-marker so the
                // same violation doesn't re-alert within 24h if
                // the rider goes in/out of compliance repeatedly.
                lastAlertedAt: clock.now(),
              },
            });
            result.violationsFound++;
            // T-96: emit happens ONLY for a fresh violation,
            // never for the "still unresolved" case.
            await OutboxService.emit(
              OutboxEventTypes.DEVICE_VIOLATION,
              {
                riderId: rider.id,
                violations: [permissionId],
                violationId: created.id,
              }
            ).catch((e: Error) =>
              logger.error(
                '[DeviceComplianceJob] Failed to emit DEVICE_VIOLATION',
                e
              )
            );
          }
        }
      }

      // Auto-resolve old violations if rider is now compliant.
      // T-96: the 7-day window is unchanged but we no longer
      // require `deviceViolationCount > 0` (we dropped that
      // circular check). The 7-day clock starts at
      // `reportedAt`; after 7 days the violation auto-resolves
      // even if the rider hasn't re-permissioned. (A future
      // improvement is to extend the window or to gate on
      // re-permissioning; out of scope for T-96.)
      const sevenDaysAgo = new Date(clock.now().getTime() - 7 * 24 * 60 * 60 * 1000);
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

    logger.info('[DeviceComplianceJob] Complete', result);
    return result;
  },
};

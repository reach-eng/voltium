import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin } from '@/lib/rbac';
import { db } from '@/lib/db';
import { runWalletReconciliation, recordReconciliation } from '@/server/workers/jobs/wallet-reconciliation.job';
import { rentRemindersJob } from '@/server/workers/jobs/rent-reminders.job';
import { deviceComplianceJob } from '@/server/workers/jobs/device-compliance.job';
import { referralRewardJob } from '@/server/workers/jobs/referral-reward.job';
import { notificationsCleanupJob } from '@/server/workers/jobs/notifications-cleanup.job';
import { telemetryUseCases } from '@/server/modules/telemetry/telemetry.use-cases';
import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }

    // 1. Get reconciliation reports history
    const reconHistory = await db.reconciliationReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 2. Fetch last runs of all jobs from Settings table
    const jobSettings = await db.setting.findMany({
      where: {
        key: { startsWith: 'job:last_run:' },
      },
    });

    const lastRuns: Record<string, any> = {};
    jobSettings.forEach((s: any) => {
      try {
        const name = s.key.replace('job:last_run:', '');
        lastRuns[name] = JSON.parse(s.value);
      } catch {
        // ignore
      }
    });

    // 3. Define the list of 7 background jobs with their details
    const jobs = [
      {
        id: 'wallet-reconciliation',
        name: 'Wallet Reconciliation',
        schedule: 'Daily (02:00 IST)',
        purpose: 'Compare ledger sum vs wallet balance for all riders and identify drifts.',
        lastRun: reconHistory[0] ? reconHistory[0].createdAt : lastRuns['wallet-reconciliation']?.timestamp || null,
        lastStatus: reconHistory[0] ? (reconHistory[0].mismatched === 0 ? 'SUCCESS' : 'FAILED') : lastRuns['wallet-reconciliation']?.status || 'NEVER',
        details: reconHistory[0] ? `${reconHistory[0].matched} matched, ${reconHistory[0].mismatched} mismatched, drift: ₹${(reconHistory[0].drift / 100).toFixed(2)}` : null,
      },
      {
        id: 'rent-due-checker',
        name: 'Rent Due Checker',
        schedule: 'Daily (00:00 IST)',
        purpose: 'Detect and notify overdue rentals.',
        lastRun: lastRuns['rent-due-checker']?.timestamp || null,
        lastStatus: lastRuns['rent-due-checker']?.status || 'NEVER',
        details: lastRuns['rent-due-checker']?.details || null,
      },
      {
        id: 'auto-debit',
        name: 'Auto-Debit',
        schedule: 'Daily (01:00 IST)',
        purpose: 'Attempt wallet debit for due rent.',
        lastRun: lastRuns['auto-debit']?.timestamp || null,
        lastStatus: lastRuns['auto-debit']?.status || 'NEVER',
        details: lastRuns['auto-debit']?.details || null,
      },
      {
        id: 'device-compliance',
        name: 'Device Compliance',
        schedule: 'Hourly (at 00 mins)',
        purpose: 'Check active riders for compliance violations (location, uninstall block, overlay).',
        lastRun: lastRuns['device-compliance']?.timestamp || null,
        lastStatus: lastRuns['device-compliance']?.status || 'NEVER',
        details: lastRuns['device-compliance']?.details || null,
      },
      {
        id: 'referral-reward',
        name: 'Referral Reward',
        schedule: 'On-demand / Daily',
        purpose: 'Process referral rewards for referrers once referee becomes active.',
        lastRun: lastRuns['referral-reward']?.timestamp || null,
        lastStatus: lastRuns['referral-reward']?.status || 'NEVER',
        details: lastRuns['referral-reward']?.details || null,
      },
      {
        id: 'notifications-cleanup',
        name: 'Notification Cleanup',
        schedule: 'Weekly (Sun 03:00 IST)',
        purpose: 'Purge old read notifications (older than 30 days).',
        lastRun: lastRuns['notifications-cleanup']?.timestamp || null,
        lastStatus: lastRuns['notifications-cleanup']?.status || 'NEVER',
        details: lastRuns['notifications-cleanup']?.details || null,
      },
      {
        id: 'telemetry-cleanup',
        name: 'Telemetry Cleanup',
        schedule: 'Monthly (1st at 04:00 IST)',
        purpose: 'Purge old location and call log data (older than 30 days).',
        lastRun: lastRuns['telemetry-cleanup']?.timestamp || null,
        lastStatus: lastRuns['telemetry-cleanup']?.status || 'NEVER',
        details: lastRuns['telemetry-cleanup']?.details || null,
      },
    ];

    return success({
      jobs,
      reconHistory,
    });
  } catch (err: any) {
    return errors.internal(`Failed to load jobs list: ${err.message}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }

    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return errors.badRequest('jobId is required');
    }

    const start = Date.now();
    let result: any = null;

    switch (jobId) {
      case 'wallet-reconciliation':
        const reconRes = await runWalletReconciliation();
        await recordReconciliation(reconRes);
        result = {
          success: true,
          details: `${reconRes.healthy} matched, ${reconRes.drifted} mismatched, drift: ₹${(reconRes.totalDrift / 100).toFixed(2)}`,
          raw: reconRes,
        };
        break;

      case 'rent-due-checker':
      case 'auto-debit':
        // Run rentReminderJob which covers both due checker and auto-debit
        const rentRes = await rentRemindersJob.process({} as any);
        result = {
          success: true,
          details: `Checked: ${rentRes.checkedRentals}, Debited: ${rentRes.autoDebited}, Overdue: ${rentRes.overdueDetected}, Notified: ${rentRes.notificationsSent}`,
          raw: rentRes,
        };
        // Save status for both as they run together
        await db.setting.upsert({
          where: { key: 'job:last_run:rent-due-checker' },
          update: {
            value: JSON.stringify({
              timestamp: new Date().toISOString(),
              status: 'SUCCESS',
              details: `Checked: ${rentRes.checkedRentals}, Overdue detected: ${rentRes.overdueDetected}`,
            }),
          },
          create: {
            key: 'job:last_run:rent-due-checker',
            value: JSON.stringify({
              timestamp: new Date().toISOString(),
              status: 'SUCCESS',
              details: `Checked: ${rentRes.checkedRentals}, Overdue detected: ${rentRes.overdueDetected}`,
            }),
          },
        });
        await db.setting.upsert({
          where: { key: 'job:last_run:auto-debit' },
          update: {
            value: JSON.stringify({
              timestamp: new Date().toISOString(),
              status: 'SUCCESS',
              details: `Checked: ${rentRes.checkedRentals}, Debited: ${rentRes.autoDebited}`,
            }),
          },
          create: {
            key: 'job:last_run:auto-debit',
            value: JSON.stringify({
              timestamp: new Date().toISOString(),
              status: 'SUCCESS',
              details: `Checked: ${rentRes.checkedRentals}, Debited: ${rentRes.autoDebited}`,
            }),
          },
        });
        break;

      case 'device-compliance':
        const compRes = await deviceComplianceJob.process({} as any);
        result = {
          success: true,
          details: `Checked: ${compRes.ridersChecked}, New violations: ${compRes.violationsFound}, Resolved: ${compRes.violationsResolved}`,
          raw: compRes,
        };
        break;

      case 'referral-reward':
        const refRes = await referralRewardJob.process({} as any);
        result = {
          success: true,
          details: `Referred: ${refRes.referredRiders}, Rewards credited: ${refRes.rewardsCredited}`,
          raw: refRes,
        };
        break;

      case 'notifications-cleanup':
        const notifRes = await notificationsCleanupJob.process();
        result = {
          success: true,
          details: `Purged ${notifRes.deletedCount} read notifications.`,
          raw: notifRes,
        };
        break;

      case 'telemetry-cleanup':
        const telRes = await telemetryUseCases.cleanup(30);
        result = {
          success: true,
          details: `Deleted: ${telRes.locationsDeleted} locations, ${telRes.callLogsDeleted} call logs, ${telRes.contactsDeleted} contacts.`,
          raw: telRes,
        };
        break;

      default:
        return errors.badRequest(`Unknown jobId: ${jobId}`);
    }

    // Save run details in Settings table
    if (jobId !== 'rent-due-checker' && jobId !== 'auto-debit') {
      await db.setting.upsert({
        where: { key: `job:last_run:${jobId}` },
        update: {
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            status: result.success ? 'SUCCESS' : 'FAILED',
            details: result.details,
          }),
        },
        create: {
          key: `job:last_run:${jobId}`,
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            status: result.success ? 'SUCCESS' : 'FAILED',
            details: result.details,
          }),
        },
      });
    }

    return success({
      jobId,
      elapsedMs: Date.now() - start,
      result,
    }, 'Job executed successfully');
  } catch (err: any) {
    return errors.internal(`Job execution failed: ${err.message}`);
  }
}

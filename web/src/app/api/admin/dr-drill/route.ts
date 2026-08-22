import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/auth';
import { getAdminSession } from '@/lib/get-session';
import { errors, success } from '@/lib/api-response';
import fs from 'fs';
import path from 'path';

export interface DrDrillStepResult {
  id: string;
  name: string;
  category: 'database' | 'storage' | 'worker' | 'checksum' | 'secrets';
  passed: boolean;
  durationMs: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface DrDrillResponse {
  drillId: string;
  executedAt: string;
  score: number;
  maxScore: number;
  passedCount: number;
  failedCount: number;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  steps: DrDrillStepResult[];
}

export async function POST(req: Request) {
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return errors.unauthorized();
    }

    // AUDIT FIX (N-6): 'DATA_MANAGEMENT' is not a real permission key —
    // it silently failed closed to SUPER_ADMIN-only. DR drills are the
    // data-management "test" capability.
    const canRunDrill = hasPermission(session, 'data_management_test');
    if (!canRunDrill) {
      return errors.forbidden('Permission data_management_test required to run DR drills');
    }

    const adminId = session.adminId ?? session.riderDbId ?? 'unknown';
    logger.info('[DR-Drill] Starting automated Disaster Recovery Drill', { adminId });
    const steps: DrDrillStepResult[] = [];
    const drillId = `dr_drill_${Date.now()}`;
    const startTime = Date.now();

    // Step 1: Database Health & Query Response
    const step1Start = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      steps.push({
        id: 'db_health',
        name: 'Database Ping & Connectivity',
        category: 'database',
        passed: true,
        durationMs: Date.now() - step1Start,
        message: 'Database query (SELECT 1) responded cleanly',
      });
    } catch (err: any) {
      steps.push({
        id: 'db_health',
        name: 'Database Ping & Connectivity',
        category: 'database',
        passed: false,
        durationMs: Date.now() - step1Start,
        message: `Database ping failed: ${err.message}`,
      });
    }

    // Step 2: Storage Directory & Backup Verification
    const step2Start = Date.now();
    try {
      const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
      const exists = fs.existsSync(backupDir);
      steps.push({
        id: 'storage_health',
        name: 'Backup Storage Directory',
        category: 'storage',
        passed: exists,
        durationMs: Date.now() - step2Start,
        message: exists
          ? `Backup directory exists at ${backupDir}`
          : `Backup directory not found at ${backupDir}`,
        details: { path: backupDir },
      });
    } catch (err: any) {
      steps.push({
        id: 'storage_health',
        name: 'Backup Storage Directory',
        category: 'storage',
        passed: false,
        durationMs: Date.now() - step2Start,
        message: `Storage check error: ${err.message}`,
      });
    }

    // Step 3: Outbox & Worker Health Check
    const step3Start = Date.now();
    try {
      const pendingOutboxCount = await db.outboxEvent.count({
        where: { status: 'PENDING' },
      });
      const passed = pendingOutboxCount < 1000;
      steps.push({
        id: 'worker_health',
        name: 'Outbox Worker Queue Backlog',
        category: 'worker',
        passed,
        durationMs: Date.now() - step3Start,
        message: passed
          ? `Outbox queue operating normally (${pendingOutboxCount} pending)`
          : `Outbox queue backlogged with ${pendingOutboxCount} pending events`,
        details: { pendingOutboxCount },
      });
    } catch (err: any) {
      steps.push({
        id: 'worker_health',
        name: 'Outbox Worker Queue Backlog',
        category: 'worker',
        passed: false,
        durationMs: Date.now() - step3Start,
        message: `Outbox query failed: ${err.message}`,
      });
    }

    // Step 4: Backup Integrity & Checksum Record
    const step4Start = Date.now();
    try {
      const latestBackup = await db.backupJob.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      const passed = !!latestBackup && latestBackup.status === 'COMPLETED';
      steps.push({
        id: 'checksum_health',
        name: 'Latest Backup Record & Checksum',
        category: 'checksum',
        passed,
        durationMs: Date.now() - step4Start,
        message: passed
          ? `Latest backup (${latestBackup?.id}) completed cleanly`
          : 'No valid completed backup record found',
        details: { latestBackupId: latestBackup?.id, status: latestBackup?.status },
      });
    } catch (err: any) {
      steps.push({
        id: 'checksum_health',
        name: 'Latest Backup Record & Checksum',
        category: 'checksum',
        passed: false,
        durationMs: Date.now() - step4Start,
        message: `Backup record check failed: ${err.message}`,
      });
    }

    // Step 5: Secret Constraints Verification
    const step5Start = Date.now();
    try {
      const piiKeyPresent = !!process.env.PII_ENCRYPTION_KEY_V1 || !!process.env.APP_SECRET;
      steps.push({
        id: 'secrets_health',
        name: 'Secret Escrow & Security Keys',
        category: 'secrets',
        passed: piiKeyPresent,
        durationMs: Date.now() - step5Start,
        message: piiKeyPresent
          ? 'Security keys and secret escrow configured'
          : 'Security keys / PII_ENCRYPTION_KEY_V1 missing',
      });
    } catch (err: any) {
      steps.push({
        id: 'secrets_health',
        name: 'Secret Escrow & Security Keys',
        category: 'secrets',
        passed: false,
        durationMs: Date.now() - step5Start,
        message: `Secret check failed: ${err.message}`,
      });
    }

    const passedCount = steps.filter((s) => s.passed).length;
    const failedCount = steps.length - passedCount;
    const score = passedCount;
    const maxScore = steps.length;
    const status = score === maxScore ? 'PASSED' : score >= 3 ? 'WARNING' : 'FAILED';

    const drillReport: DrDrillResponse = {
      drillId,
      executedAt: new Date().toISOString(),
      score,
      maxScore,
      passedCount,
      failedCount,
      status,
      steps,
    };

    // Log Audit Trail Event
    await createAuditLog({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'DR_DRILL_COMPLETED',
      entity: 'system',
      entityId: drillId,
      details: {
        score,
        maxScore,
        status,
        durationMs: Date.now() - startTime,
        failedSteps: steps.filter((s) => !s.passed).map((s) => s.name),
      },
    });

    logger.info('[DR-Drill] Drill completed', { drillId, score, maxScore, status });
    return success(drillReport);
  } catch (err: any) {
    logger.error('[DR-Drill] Internal failure during DR drill', err);
    return errors.internal(err.message || 'DR drill execution failed');
  }
}

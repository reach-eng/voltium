import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { testDb } from '../../_setup/test-postgres';
import { scheduledBackupJob } from '../../../src/server/workers/jobs/scheduled-backup.job';
import { scheduleService } from '../../../src/server/modules/data-management/schedule/schedule.service';
import { backupService, getFreeDiskBytes } from '../../../src/server/modules/data-management/backup.service';
import { backupRepository } from '../../../src/server/modules/data-management/backup.repository';
import { clock } from '../../../src/lib/clock';

// The job runs the backup through the canonical backup.service (not the
// legacy storage.service, and not scheduleService.runScheduledBackup).
vi.mock('../../../src/server/modules/data-management/backup.service', () => ({
  backupService: {
    runScheduledBackup: vi.fn().mockResolvedValue({ id: 'backup-job', backupId: 'backup', sizeBytes: 100 }),
  },
  getFreeDiskBytes: vi.fn().mockResolvedValue(100 * 1024 * 1024 * 1024), // 100 GB
}));

vi.mock('../../../src/server/modules/data-management/schedule/schedule.service', () => ({
  scheduleService: {
    calculateNextRun: vi.fn().mockReturnValue(new Date()),
  }
}));

describe('Scheduled Backup Job', () => {
  beforeAll(async () => {
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await testDb.backupSchedule.deleteMany();
    await testDb.auditLog.deleteMany();
    await testDb.systemSetting.deleteMany();
    clock.reset();
    vi.clearAllMocks();
  });

  it('should not run if no schedule configured', async () => {
    const result = await scheduledBackupJob.checkAndRun();
    expect(result.ran).toBe(false);
    expect(result.reason).toBe('No schedule configured');
  });

  it('should not run if schedule is disabled', async () => {
    await testDb.backupSchedule.create({
      data: {
        enabled: false,
        frequency: 'DAILY',
        timeOfDay: '02:00',
        keepDaily: 7, keepWeekly: 4, keepMonthly: 12, keepManual: 10,
        includeDatabase: true, includeUploads: false, includeLogs: false,
        minimumFreeDiskGb: 10,
        primaryBackupRoot: '/tmp/backup',
      }
    });
    
    const result = await scheduledBackupJob.checkAndRun();
    expect(result.ran).toBe(false);
    expect(result.reason).toBe('Schedule is disabled');
  });

  it('should run if schedule is enabled and due', async () => {
    const schedule = await testDb.backupSchedule.create({
      data: {
        enabled: true,
        frequency: 'DAILY',
        timeOfDay: '02:00',
        keepDaily: 7, keepWeekly: 4, keepMonthly: 12, keepManual: 10,
        includeDatabase: true, includeUploads: false, includeLogs: false,
        minimumFreeDiskGb: 10,
        primaryBackupRoot: '/tmp/backup',
      }
    });
    
    // Simulate time passing past due date
    await testDb.backupSchedule.update({
      where: { id: schedule.id },
      data: { nextRunAt: new Date(clock.now().getTime() - 1000) } // due 1 sec ago
    });

    const result = await scheduledBackupJob.checkAndRun();
    expect(result.ran).toBe(true);
    expect(backupService.runScheduledBackup).toHaveBeenCalled();
    expect(getFreeDiskBytes).toHaveBeenCalled();
  });
});

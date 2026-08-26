/**
 * Data Management — Backup Validation
 *
 * Path containment and schedule validation helpers.
 */

export {
  getAllowedBackupRoots,
  assertBackupPathAllowed,
  safeRmBackupPath,
} from './backup-path.validator';

/**
 * Calculate next backup run time based on schedule configuration.
 */
export function calculateNextRun(config: {
  frequency: string;
  timeOfDay: string;
  timezone?: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
}): Date | null {
  if (!config.frequency || config.frequency === 'MANUAL') return null;

  const now = new Date();
  const [hours, minutes] = config.timeOfDay.split(':').map(Number);

  const next = new Date(now);
  const hoursVal = hours !== undefined && !isNaN(hours) ? hours : 2;
  const minutesVal = minutes !== undefined && !isNaN(minutes) ? minutes : 0;
  next.setHours(hoursVal, minutesVal, 0, 0);

  if (config.frequency === 'MONTHLY') {
    const targetDay = Math.min(config.dayOfMonth ?? 1, 28);
    next.setDate(targetDay);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDay);
    }
  } else if (next <= now) {
    switch (config.frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY': {
        const targetDay = config.dayOfWeek ?? 0;
        const daysUntil = (targetDay - next.getDay() + 7) % 7;
        next.setDate(next.getDate() + (daysUntil || 7));
        break;
      }
    }
  }

  return next;
}

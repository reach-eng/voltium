/**
 * Schedule service.
 * Calculates next run dates for DAILY/WEEKLY/MONTHLY backup schedules.
 */

export const scheduleService = {
  calculateNextRun(options: {
    frequency?: string | null;
    timeOfDay?: string | null;
    timezone?: string | null;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    baseDate?: Date;
  }): Date | null {
    if (!options.frequency || options.frequency === 'MANUAL' || options.frequency === 'DISABLED') {
      return null;
    }

    const base = options.baseDate ?? new Date();
    const timeStr = options.timeOfDay || '02:00';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const next = new Date(base);
    next.setHours(isNaN(hours) ? 2 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);

    const freq = options.frequency.toUpperCase();
    if (freq === 'DAILY') {
      if (next <= base) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }

    if (freq === 'WEEKLY') {
      const targetDay = options.dayOfWeek ?? 0;
      let currentDay = next.getDay();
      if (next <= base || currentDay !== targetDay) {
        let diff = targetDay - currentDay;
        if (diff <= 0 || (diff === 0 && next <= base)) {
          diff += 7;
        }
        next.setDate(next.getDate() + diff);
      }
      return next;
    }

    if (freq === 'MONTHLY') {
      const targetDom = Math.min(options.dayOfMonth ?? 1, 28);
      next.setDate(targetDom);
      if (next <= base) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDom);
      }
      return next;
    }

    return null;
  },
};

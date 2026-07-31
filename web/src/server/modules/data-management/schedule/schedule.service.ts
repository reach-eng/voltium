/**
 * Schedule service — minimal stub.
 * Calculates next run dates for DAILY/WEEKLY/MONTHLY backup schedules.
 */

export const scheduleService = {
  calculateNextRun(options: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    timeOfDay: string;
    timezone: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    baseDate?: Date;
  }): Date {
    const base = options.baseDate ?? new Date();
    const [hours, minutes] = options.timeOfDay.split(':').map(Number);
    const next = new Date(base);
    next.setHours(hours, minutes, 0, 0);

    if (next <= base) {
      // Push to next occurrence
      switch (options.frequency) {
        case 'DAILY':
          next.setDate(next.getDate() + 1);
          break;
        case 'WEEKLY':
          next.setDate(next.getDate() + 7);
          break;
        case 'MONTHLY':
          next.setMonth(next.getMonth() + 1);
          break;
      }
    }
    return next;
  },
};

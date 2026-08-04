'use client';

/**
 * /admin/data-management/schedule
 *
 * Phase 7G PR-136: real route segment for the data-management Schedule tab.
 * Re-exports the existing tab component (thin pass-through) so the URL is
 * bookmarkable and the back button works correctly.
 */
export { ScheduleTab as default } from '@/components/admin/screens/data-management/ScheduleTab';

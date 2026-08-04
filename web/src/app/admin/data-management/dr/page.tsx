'use client';

/**
 * /admin/data-management/dr
 *
 * Phase 7G PR-136: real route segment for the data-management DR tab.
 * Re-exports the existing tab component (thin pass-through) so the URL is
 * bookmarkable and the back button works correctly.
 */
export { DisasterRecoveryTab as default } from '@/components/admin/screens/data-management/DisasterRecoveryTab';

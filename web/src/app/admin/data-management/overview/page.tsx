'use client';

/**
 * /admin/data-management/overview
 *
 * Phase 7G PR-136: real route segment for the data-management Overview tab.
 * Re-exports the existing tab component (thin pass-through) so the URL is
 * bookmarkable and the back button works correctly.
 *
 * The page is also reachable from the in-memory section switcher at
 * `/?view=admin&section=data-management&tab=overview` — that path remains
 * the default; the new route exists for deep-link / share scenarios.
 */
export { OverviewTab as default } from '@/components/admin/screens/data-management/OverviewTab';

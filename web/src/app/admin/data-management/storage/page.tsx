'use client';

/**
 * /admin/data-management/storage
 *
 * Phase 7G PR-136: real route segment for the data-management Storage tab.
 * Re-exports the existing tab component (thin pass-through) so the URL is
 * bookmarkable and the back button works correctly.
 */
export { StorageTab as default } from '@/components/admin/screens/data-management/StorageTab';

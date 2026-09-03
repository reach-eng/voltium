/**
 * @deprecated P1: canonical implementations live in
 * `server/modules/analytics/analytics.use-cases.ts` (`getDashboardStats`,
 * `getRevenueTrend`). This module re-exports them so existing imports keep
 * working; new code must import from the analytics module. The dual
 * `lib/services/*` vs `server/modules/*` service layers are being collapsed
 * — do not add new functions here.
 */
import { analyticsUseCases } from '@/server/modules/analytics/analytics.use-cases';

export const getDashboardStats: typeof analyticsUseCases.getDashboardStats =
  analyticsUseCases.getDashboardStats.bind(analyticsUseCases);
export const getRevenueTrend: typeof analyticsUseCases.getRevenueTrend =
  analyticsUseCases.getRevenueTrend.bind(analyticsUseCases);

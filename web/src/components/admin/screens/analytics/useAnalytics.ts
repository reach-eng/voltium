'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { POLL_INTERVAL_MS, type AnalyticsData } from './analyticsTypes';

/**
 * R3.7c — data hook for the Analytics Dashboard. Extracted from
 * AnalyticsDashboard.tsx. Owns:
 *   - initial fetch
 *   - 60s polling
 *   - pause-on-hidden / resume-on-visible (via document.visibilitychange)
 *   - refetch on user action
 *
 * Returns the data + loading flags + a refresh function for the parent.
 */
export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        setLastUpdated(new Date());
      } else {
        logger.error('Failed to fetch analytics', { status: res.status });
      }
    } catch (error) {
      logger.error('Failed to fetch analytics', { error });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 60s polling, paused when document is hidden
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!document.hidden) {
        fetchData(true);
        intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchData]);

  return { data, loading, refreshing, lastUpdated, fetchData };
}

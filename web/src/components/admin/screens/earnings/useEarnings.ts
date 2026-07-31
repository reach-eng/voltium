'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';
import { logger } from '@/lib/logger';
import { EARNINGS_PAGE_SIZE, type Earning, type Summary } from './types';

const EMPTY_SUMMARY: Summary = { totalAmount: 0, totalTrips: 0, averageAmount: 0 };

/**
 * R3.7h split — Earnings data hook.
 *
 * Owns the paginated list, the summary block, and the four filters
 * (debounced search + platform + start/end dates). When any filter
 * changes the page resets to 1 via the trailing useEffect.
 */
export function useEarnings() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [platform, setPlatform] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const mountedRef = useRef(true);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (platform && platform !== 'ALL') params.set('platform', platform);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('page', String(page));
      params.set('limit', String(EARNINGS_PAGE_SIZE));

      const res = await fetch(`/api/admin/earnings?${params}`);
      if (!mountedRef.current) return;
      if (res.status === 403) {
        // Silently handle — admin lacks riders_view permission
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || 'Failed to load earnings');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setEarnings(json.data.earnings);
        setSummary(json.data.summary);
        setTotalPages(json.data.pagination.totalPages);
        setTotal(json.data.pagination.total);
      }
    } catch (err) {
      logger.error('Failed to fetch earnings', { error: err });
      toast.error('Failed to load earnings');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [debouncedSearch, platform, startDate, endDate, page]);

  useEffect(() => {
    mountedRef.current = true;
    fetchEarnings();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchEarnings]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, platform, startDate, endDate]);

  return {
    earnings,
    summary,
    loading,
    search,
    setSearch,
    platform,
    setPlatform,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    setPage,
    totalPages,
    total,
  };
}

export type EarningsHook = ReturnType<typeof useEarnings>;

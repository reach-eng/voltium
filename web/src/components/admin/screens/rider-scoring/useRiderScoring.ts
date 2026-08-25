'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';
import { logger } from '@/lib/logger';
import { LEADERBOARD_LIMIT, PAGE_SIZE, type RiskLevel, type RiderScore } from './types';

interface HubOption {
  id: string;
  name: string;
}

/**
 * R3 split (RiderScoringScreen) — data hook.
 *
 * Owns the score list + filters + pagination + the recalculate
 * POST. The leaderboard is computed locally as the top N by
 * composite score. The hook does NOT own the dialog visibility
 * — that's local UI state in the orchestrator.
 */
export function useRiderScoring() {
  const [scores, setScores] = useState<RiderScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [hubFilter, setHubFilter] = useState('ALL');
  const [hubs, setHubs] = useState<HubOption[]>([]);
  const [activeTab, setActiveTab] = useState('scores');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const [serverRiskCounts, setServerRiskCounts] = useState<Record<string, number> | null>(null);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (riskFilter !== 'ALL') params.set('riskLevel', riskFilter);
      if (hubFilter !== 'ALL') params.set('hubId', hubFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/scores?${params}`);
      if (res.ok) {
        const json = await res.json();
        setScores(json.data?.scores || json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotal(json.pagination.total || 0);
        }
        if (json.data?.riskCounts || json.pagination?.riskCounts) {
          setServerRiskCounts(json.data?.riskCounts || json.pagination?.riskCounts);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch rider scores', { error });
      toast.error('Failed to load scores');
    } finally {
      setLoading(false);
    }
  }, [page, riskFilter, hubFilter, debouncedSearch]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  useEffect(() => {
    fetch('/api/admin/hubs?limit=100')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setHubs(json.data || []);
      })
      .catch(() => logger.error('Failed to fetch hubs'));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [riskFilter, hubFilter, debouncedSearch]);

  const handleRecalculate = async (riderId: string) => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/admin/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to recalculate score');
        return;
      }
      toast.success('Score recalculated');
      fetchScores();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRecalculating(false);
    }
  };

  const handleRecalculateAll = async () => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/admin/scores/recalculate', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to recalculate scores');
        return;
      }
      toast.success('Scores recalculated');
      fetchScores();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRecalculating(false);
    }
  };

  // Derived counts and leaderboard (recomputed on every render)
  const riskCounts = serverRiskCounts || {
    LOW: scores.filter((s) => s.riskLevel === 'LOW').length,
    MEDIUM: scores.filter((s) => s.riskLevel === 'MEDIUM').length,
    HIGH: scores.filter((s) => s.riskLevel === 'HIGH').length,
    CRITICAL: scores.filter((s) => s.riskLevel === 'CRITICAL').length,
  };

  const leaderboard = [...scores]
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, LEADERBOARD_LIMIT);

  return {
    // data
    scores,
    leaderboard,
    loading,
    total,
    totalPages,
    // filters
    riskFilter,
    setRiskFilter,
    hubFilter,
    setHubFilter,
    hubs,
    search,
    setSearch,
    page,
    setPage,
    // tabs
    activeTab,
    setActiveTab,
    // recalculate
    recalculating,
    handleRecalculateAll,
    // counts
    riskCounts,
    // revalidation
    fetchScores,
  };
}

export type RiderScoringHook = ReturnType<typeof useRiderScoring>;

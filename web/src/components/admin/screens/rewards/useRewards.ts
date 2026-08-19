'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  EMPTY_REWARDS_SUMMARY,
  REWARDS_PAGE_SIZE,
  RIDERS_PICKER_LIMIT,
  type Reward,
  type RiderListItem,
  type Summary,
} from './types';

/**
 * R3.7l split — Rewards data hook.
 *
 * Owns the paginated list + summary (debounced search), the rider
 * picker list (loaded when the award form is open), and the form
 * state + submit handler. Renders the form, cards, and table each
 * have their own components that read this hook.
 */
export function useRewards() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_REWARDS_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [riders, setRiders] = useState<RiderListItem[]>([]);
  const [riderSearch, setRiderSearch] = useState('');
  const [selectedRider, setSelectedRider] = useState('');
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Debounce search → 500ms before triggering a re-fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchRewards = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(REWARDS_PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/rewards?${params}`);
      if (res.status === 403) {
        toast.error('You do not have permission to access rewards management');
        setRewards([]);
        return;
      }
      if (!res.ok) {
        logger.error('Failed to fetch rewards', { status: res.status });
        toast.error('Failed to load rewards data');
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        setRewards(json.data.rewards || []);
        setSummary(json.data.summary || EMPTY_REWARDS_SUMMARY);
        setTotalPages(json.data.pagination?.totalPages || 1);
        setTotalCount(json.data.pagination?.total || 0);
      }
    } catch {
      toast.error('Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  const fetchRiders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(RIDERS_PICKER_LIMIT));
      if (riderSearch) params.set('search', riderSearch);
      const res = await fetch(`/api/admin/riders?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setRiders(json.data.riders || []);
      }
    } catch {
      logger.error('Failed to fetch riders');
    }
  }, [riderSearch]);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  useEffect(() => {
    if (showForm) fetchRiders();
  }, [showForm, riderSearch, fetchRiders]);

  const handleAwardPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRider || !title || !points) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderDbId: selectedRider,
          title,
          points: parseInt(points),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Points awarded successfully!');
        setTitle('');
        setPoints('');
        setSelectedRider('');
        setShowForm(false);
        fetchRewards();
      } else {
        toast.error(json.message || json.error || 'Failed to award points');
      }
    } catch {
      toast.error('An error occurred while awarding points');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeReward = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/rewards?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Reward points revoked successfully');
        fetchRewards();
      } else {
        toast.error(json.error?.message || json.error || 'Failed to revoke points');
      }
    } catch {
      toast.error('Failed to revoke reward points');
    }
  };

  return {
    // list
    rewards,
    summary,
    loading,
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    totalCount,
    // award form
    riders,
    riderSearch,
    setRiderSearch,
    selectedRider,
    setSelectedRider,
    title,
    setTitle,
    points,
    setPoints,
    isSubmitting,
    showForm,
    setShowForm,
    handleAwardPoints,
    handleRevokeReward,
    // revalidation
    fetchRewards,
  };
}

export type RewardsHook = ReturnType<typeof useRewards>;

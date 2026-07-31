'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  DEFAULT_REFERRAL_BONUS,
  EMPTY_SUMMARY,
  REFERRAL_PAGE_SIZE,
  RIDERS_PICKER_LIMIT,
  type Referral,
  type RiderOption,
  type Summary,
} from './types';

/**
 * R3.7o split — Referrals data hook.
 *
 * Owns the paginated list + summary, the referral-bonus constant
 * (from /api/admin/settings), the rider picker (loaded when the
 * Issue dialog is open), and the create-referral POST. The hook
 * also computes a derived `stats` block so the summary cards can
 * render the dashboard view.
 */
export function useReferrals() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [referralBonus, setReferralBonus] = useState(DEFAULT_REFERRAL_BONUS);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);

  // Manual referral dialog state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [riderSearch, setRiderSearch] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [refereeId, setRefereeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search → 500ms before triggering a re-fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

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
    if (showCreateModal) fetchRiders();
  }, [showCreateModal, riderSearch, fetchRiders]);

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referrerId || !refereeId) {
      toast.error('Please select both Referrer and Referee');
      return;
    }
    if (referrerId === refereeId) {
      toast.error('Referrer and Referee cannot be the same person');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrerId, refereeId }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Referral processed successfully!');
        setReferrerId('');
        setRefereeId('');
        setShowCreateModal(false);
        fetchReferrals();
      } else {
        toast.error(json.message || 'Failed to process referral');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchReferrals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(REFERRAL_PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filter !== 'all') params.set('status', filter);

      const res = await fetch(`/api/admin/referrals?${params}`);
      if (res.ok) {
        const json = await res.json();
        const inner = json.data || {};
        setReferrals(Array.isArray(inner.referrals) ? inner.referrals : []);
        setTotalPages(Math.ceil((inner.total || 0) / REFERRAL_PAGE_SIZE));
        if (inner.summary) setSummary(inner.summary);
        setTotalCount(inner.total || 0);
      } else {
        setReferrals([]);
      }
    } catch {
      setReferrals([]);
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filter]);

  const fetchReferralBonus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const json = await res.json();
        const settings = json.data || {};
        if (settings.referralBonus) setReferralBonus(Number(settings.referralBonus));
      }
    } catch {
      logger.error('Failed to fetch referral bonus');
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
    fetchReferralBonus();
  }, [fetchReferrals, fetchReferralBonus]);

  // Derived stats block (matches the original 4-card layout)
  const stats = {
    total: summary.totalLeads,
    completed: summary.activeRiders,
    pending: summary.totalLeads - summary.activeRiders,
    totalEarningsInRupees: summary.totalEarnings,
  };

  return {
    // data
    referrals,
    loading,
    summary,
    stats,
    totalCount,
    // filters
    filter,
    setFilter,
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    // bonus
    referralBonus,
    // dialog
    showCreateModal,
    setShowCreateModal,
    riders,
    riderSearch,
    setRiderSearch,
    referrerId,
    setReferrerId,
    refereeId,
    setRefereeId,
    isSubmitting,
    handleCreateReferral,
    // revalidation
    fetchReferrals,
  };
}

export type ReferralsHook = ReturnType<typeof useReferrals>;

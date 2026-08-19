'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  EMPTY_NOTIFICATION_FORM,
  NOTIFICATION_PAGE_SIZE,
  type Notification,
  type NotificationForm,
  type RiderOption,
} from './types';

/**
 * R3.7f split — Notifications data hook.
 *
 * Owns the paginated list (debounced search + type + read filters), the
 * rider picker (loaded on dialog open), and the send-notification POST.
 * Returns the data, filter state, dialog state, and the form ref +
 * send handler so the tab orchestrator can render the UI.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<NotificationForm>({ ...EMPTY_NOTIFICATION_FORM });
  const [sendToAll, setSendToAll] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState('ALL');
  const [riderSearch, setRiderSearch] = useState('');

  // Debounce search → 500ms before triggering a re-fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(NOTIFICATION_PAGE_SIZE));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (readFilter !== 'ALL') params.set('status', readFilter);

      const res = await fetch(`/api/admin/notifications?${params}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setNotifications(json.data.notifications || []);
          if (json.data.pagination) {
            setTotalPages(json.data.pagination.totalPages);
            setTotalCount(json.data.pagination.total);
          }
        }
      }
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, typeFilter, readFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const fetchRiders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (riderSearch) params.set('search', riderSearch);
      const res = await fetch(`/api/admin/riders?${params}`);
      const json = await res.json();
      if (json.success) setRiders(json.data?.riders || []);
    } catch {
      logger.error('Failed to fetch riders');
    }
  }, [riderSearch]);

  useEffect(() => {
    if (dialogOpen) fetchRiders();
  }, [dialogOpen, riderSearch, fetchRiders]);

  const sendNotification = async () => {
    if (!form.title || !form.message) return;
    if (!sendToAll && !form.riderId) return;
    try {
      setIsSubmitting(true);
      const body: Record<string, unknown> = {
        title: form.title,
        message: form.message,
        type: form.type,
      };
      if (sendToAll) {
        body.sendToAll = true;
      } else {
        body.riderId = form.riderId;
      }
      // P0-9 (2026-08-05 ops audit): the API requires an explicit ?confirm=true
      // for broadcasts — the dialog already asks "are you sure?" before this
      // submit runs, so append it for sendToAll only.
      const url = sendToAll
        ? '/api/admin/notifications?confirm=true'
        : '/api/admin/notifications';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to send notification');
        return;
      }
      toast.success('Notification sent');
      setDialogOpen(false);
      setForm({ ...EMPTY_NOTIFICATION_FORM });
      setSendToAll(false);
      setPage(1);
      fetchNotifications();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    // data
    notifications,
    riders,
    loading,
    totalCount,
    totalPages,
    page,
    setPage,
    // filters
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    readFilter,
    setReadFilter,
    // dialog
    dialogOpen,
    setDialogOpen,
    riderSearch,
    setRiderSearch,
    form,
    setForm,
    sendToAll,
    setSendToAll,
    isSubmitting,
    sendNotification,
    // revalidation
    fetchNotifications,
  };
}

export type NotificationsHook = ReturnType<typeof useNotifications>;

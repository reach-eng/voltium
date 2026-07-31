'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { logger } from '@/lib/logger';
import {
  ANNOUNCEMENT_PAGE_SIZE,
  EMPTY_ANNOUNCEMENT_FORM,
  type Announcement,
  type AnnouncementFormState,
  type HubOption,
} from './types';

/**
 * R3.7x split — Bulk Messaging data hook.
 *
 * Owns: paginated announcement list (with status + debounced search),
 * the hub list (for BY_HUB targeting), the create form, the recipient
 * count calculator, and the POST handler.
 */
export function useBulkMessaging() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [hubs, setHubs] = useState<HubOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);
  const [form, setForm] = useState<AnnouncementFormState>({ ...EMPTY_ANNOUNCEMENT_FORM });

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(ANNOUNCEMENT_PAGE_SIZE));
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/announcements?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAnnouncements(json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotal(json.pagination.total || 0);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch announcements', { error });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    fetch('/api/admin/hubs')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setHubs(json.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  const calculateRecipients = useCallback(async () => {
    if (form.targetAudience === 'ALL') {
      const res = await fetch('/api/admin/riders?limit=1');
      if (res.ok) {
        const json = await res.json();
        setRecipientCount(json.pagination?.total || 0);
      }
      return;
    }
    if (form.targetIds.length === 0) {
      setRecipientCount(0);
      return;
    }
    const param = form.targetAudience === 'BY_HUB' ? 'hubId' : 'state';
    const promises = form.targetIds.map((id) =>
      fetch(`/api/admin/riders?${param}=${id}&limit=1`)
        .then((r) => r.json())
        .then((j) => j.pagination?.total || 0)
    );
    const counts = await Promise.all(promises);
    setRecipientCount(counts.reduce((a, b) => a + b, 0));
  }, [form.targetAudience, form.targetIds]);

  useEffect(() => {
    if (createOpen) calculateRecipients();
  }, [calculateRecipients, createOpen]);

  const handleCreate = useCallback(async () => {
    if (!form.title || !form.message) return;
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        message: form.message,
        channel: form.channel,
        targetAudience: form.targetAudience,
        targetIds: form.targetIds,
      };
      if (form.schedule && form.scheduledAt) {
        body.scheduledAt = new Date(form.scheduledAt).toISOString();
      }

      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCreateOpen(false);
        setForm({ ...EMPTY_ANNOUNCEMENT_FORM });
        fetchAnnouncements();
      }
    } catch (error) {
      logger.error('Failed to create announcement', { error });
    } finally {
      setSending(false);
    }
  }, [form, fetchAnnouncements]);

  const toggleTargetId = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      targetIds: prev.targetIds.includes(id)
        ? prev.targetIds.filter((i) => i !== id)
        : [...prev.targetIds, id],
    }));
  }, []);

  const openDetail = useCallback((a: Announcement) => {
    setSelectedAnnouncement(a);
    setDetailOpen(true);
  }, []);

  return {
    // data
    announcements,
    hubs,
    loading,
    page,
    setPage,
    totalPages,
    total,
    // filters
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    debouncedSearch,
    // create dialog
    createOpen,
    setCreateOpen,
    form,
    setForm,
    sending,
    recipientCount,
    handleCreate,
    toggleTargetId,
    // detail dialog
    detailOpen,
    setDetailOpen,
    selectedAnnouncement,
    openDetail,
    // revalidation
    fetchAnnouncements,
  };
}

export type BulkMessagingHook = ReturnType<typeof useBulkMessaging>;

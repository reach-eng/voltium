'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useAdminStore } from '@/store/admin';
import type { Ticket, TicketMessage } from './types';

export interface AdminRef {
  id: string;
  name: string;
}

export interface LastTicketBulkAction {
  ids: string[];
  previousStates: Record<string, { status: string; priority: string; assignedTo: string | null }>;
  action: string;
}

/**
 * R3.7 split (TicketManagement) — ticket data hook.
 *
 * Owns the 21-state machine (list, filters, pagination, selection,
 * detail, bulk actions, undo, create modal) plus the network
 * handlers (fetch, status change, assign, send reply, bulk, undo).
 * 15s polling keeps the list and the open detail dialog in sync
 * with the server.
 */
export function useTicketManagement() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('OPEN');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [admins, setAdmins] = useState<AdminRef[]>([]);
  const adminRole = (useAdminStore.getState() as { adminRole?: string }).adminRole || '';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<LastTicketBulkAction | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkPriorityValue, setBulkPriorityValue] = useState('');
  const [bulkAssignValue, setBulkAssignValue] = useState('');
  const [bulkStatusDialog, setBulkStatusDialog] = useState(false);
  const [bulkPriorityDialog, setBulkPriorityDialog] = useState(false);
  const [bulkAssignDialog, setBulkAssignDialog] = useState(false);
  const [cachedAdminId, setCachedAdminId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const mountedRef = useRef(true);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('status', activeTab);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/tickets?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setTickets(json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages);
          setTotal(json.pagination.total);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, priorityFilter, debouncedSearch, page]);

  // Debounce search → 500ms before triggering a re-fetch
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, priorityFilter, debouncedSearch]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // 15s polling keeps the table and the open detail in sync
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTickets();
      if (detailOpen && selectedTicket) {
        fetch(`/api/admin/tickets/${(selectedTicket as { id: string }).id}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.success && json.data) {
              setSelectedTicket(json.data);
            }
          })
          .catch(() => {});
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchTickets, detailOpen, selectedTicket]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    fetch('/api/admin/admins?limit=50&isActive=true')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAdmins(json.data || []);
      })
      .catch(() => {});
  }, []);

  const filtered = activeTab === 'all' ? tickets : tickets.filter((t) => t.status === activeTab);

  // Keyboard shortcuts: Ctrl+A select-all, Ctrl+Z undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setSelectedIds(new Set(filtered.map((t) => t.id)));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, lastAction, bulkLoading]);

  const statusCounts = tickets.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      acc.all = (acc.all || 0) + 1;
      return acc;
    },
    { all: 0 } as Record<string, number>
  );

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTicket.id, status: newStatus }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || 'Failed to update status');
        return;
      }
      toast.success(`Status changed to ${newStatus.replace('_', ' ').toLowerCase()}`);
      setSelectedTicket({ ...selectedTicket, status: newStatus });
      fetchTickets();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (adminId: string) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTicket.id,
          assignedTo: adminId === '_none' ? null : adminId,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || 'Failed to assign ticket');
        return;
      }
      toast.success(adminId === '_none' ? 'Ticket unassigned' : 'Ticket assigned');
      setSelectedTicket({ ...selectedTicket, assignedTo: adminId === '_none' ? null : adminId });
      fetchTickets();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const adminId =
        cachedAdminId ||
        (await fetch('/api/admin/auth/me')
          .then((r) => r.json())
          .then((j) => j?.data?.id || null));
      if (!adminId) {
        toast.error('Could not determine your admin ID');
        return;
      }
      if (!cachedAdminId) setCachedAdminId(adminId);
      const res = await fetch('/api/admin/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTicket.id, assignedTo: adminId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || 'Failed to assign ticket');
        return;
      }
      toast.success('Ticket assigned to you');
      setSelectedTicket({ ...selectedTicket, assignedTo: adminId });
      fetchTickets();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDetailOpen(true);
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || 'Failed to load ticket details');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setSelectedTicket(json.data);
        setTicketMessages(json.data.messages || []);
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendReply = async (message: string) => {
    if (!selectedTicket || !message) return;
    setReplyLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || 'Failed to send reply');
        return;
      }
      const json = await res.json();
      if (json.success) {
        toast.success('Reply sent successfully');
        const detailRes = await fetch(`/api/admin/tickets/${selectedTicket.id}`);
        if (detailRes.ok) {
          const detailJson = await detailRes.json();
          if (detailJson.success) {
            setSelectedTicket(detailJson.data);
            setTicketMessages(detailJson.data.messages || []);
          }
        }
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleBulkAction = async (action: string, value?: string) => {
    if (selectedIds.size === 0) return;
    const previousStates: LastTicketBulkAction['previousStates'] = {};
    tickets
      .filter((t) => selectedIds.has(t.id))
      .forEach((t) => {
        previousStates[t.id] = {
          status: t.status,
          priority: t.priority,
          assignedTo: t.assignedTo,
        };
      });
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action, value }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Bulk action failed');
        setBulkLoading(false);
        return;
      }
      toast.success(`Bulk action completed on ${selectedIds.size} ticket(s)`);
      setLastAction({ ids: Array.from(selectedIds), previousStates, action: value || action });
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      setSelectedIds(new Set());
      fetchTickets();
    } catch (err) {
      logger.error('Bulk action failed', { error: err });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: lastAction.ids, action: 'revert' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Undo failed');
        return;
      }
      toast.success('Undo successful');
      setLastAction(null);
      setShowUndoToast(false);
      fetchTickets();
    } catch (err) {
      logger.error('Undo failed', { error: err });
    } finally {
      setBulkLoading(false);
    }
  };

  const getAssignedName = (adminId: string | null) => {
    if (!adminId) return '—';
    const admin = admins.find((a) => a.id === adminId);
    return admin?.name || 'Admin';
  };

  return {
    // data
    tickets,
    loading,
    total,
    totalPages,
    page,
    setPage,
    // filters
    activeTab,
    setActiveTab,
    priorityFilter,
    setPriorityFilter,
    search,
    setSearch,
    debouncedSearch,
    filtered,
    statusCounts,
    // selection
    selectedIds,
    setSelectedIds,
    // detail
    selectedTicket,
    detailOpen,
    setDetailOpen,
    ticketMessages,
    messagesLoading,
    openDetail,
    handleStatusChange,
    handleAssign,
    handleAssignToMe,
    handleSendReply,
    replyLoading,
    actionLoading,
    // bulk
    bulkLoading,
    handleBulkAction,
    handleUndo,
    lastAction,
    showUndoToast,
    setShowUndoToast,
    bulkStatusValue,
    setBulkStatusValue,
    bulkPriorityValue,
    setBulkPriorityValue,
    bulkAssignValue,
    setBulkAssignValue,
    bulkStatusDialog,
    setBulkStatusDialog,
    bulkPriorityDialog,
    setBulkPriorityDialog,
    bulkAssignDialog,
    setBulkAssignDialog,
    // create
    createModalOpen,
    setCreateModalOpen,
    // admins
    admins,
    getAssignedName,
    adminRole,
    // revalidation
    fetchTickets,
  };
}

export type TicketManagementHook = ReturnType<typeof useTicketManagement>;

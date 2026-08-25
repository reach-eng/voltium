'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { useAdminStore } from '@/store/admin';
import type {
  Ticket,
  TicketMessage,
  AdminUser,
  RiderOption,
  LastBulkAction,
  NewTicketForm,
} from './types';

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('OPEN');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detail Modal State
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Admins & Auth
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [cachedAdminId, setCachedAdminId] = useState<string | null>(null);
  const adminRole = (useAdminStore.getState() as any).adminRole || '';

  // Bulk Operations State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<LastBulkAction | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkPriorityValue, setBulkPriorityValue] = useState('');
  const [bulkAssignValue, setBulkAssignValue] = useState('');
  const [bulkStatusDialog, setBulkStatusDialog] = useState(false);
  const [bulkPriorityDialog, setBulkPriorityDialog] = useState(false);
  const [bulkAssignDialog, setBulkAssignDialog] = useState(false);

  // Create Ticket Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTicket, setNewTicket] = useState<NewTicketForm>({
    riderDbId: '',
    category: 'GENERAL',
    priority: 'LOW',
    subject: '',
    message: '',
  });
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [riderSearch, setRiderSearch] = useState('');

  const mountedRef = useRef(true);

  const fetchRiders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
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
    if (createModalOpen) fetchRiders();
  }, [createModalOpen, riderSearch, fetchRiders]);

  const [serverStatusCounts, setServerStatusCounts] = useState<Record<string, number> | null>(null);

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
          if (json.pagination.statusCounts) {
            setServerStatusCounts(json.pagination.statusCounts);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, priorityFilter, debouncedSearch, page]);

  // Debounce search
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

  // Keyboard Shortcuts (Ctrl+A, Ctrl+Z)
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
  }, [filtered, lastAction, bulkLoading]);

  const statusCounts =
    serverStatusCounts ||
    tickets.reduce(
      (acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        acc.all = (acc.all || 0) + 1;
        return acc;
      },
      { all: 0 } as Record<string, number>
    );

  const getAssignedName = (adminId: string | null) => {
    if (!adminId) return '—';
    const admin = admins.find((a) => a.id === adminId);
    return admin?.name || 'Admin';
  };

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

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setReplyLoading(true);
    try {
      const res = await fetch(`/api/admin/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyMessage.trim() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || 'Failed to send reply');
        return;
      }
      const json = await res.json();
      if (json.success) {
        toast.success('Reply sent successfully');
        setReplyMessage('');
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
    const previousStates: Record<string, any> = {};
    tickets
      .filter((t) => selectedIds.has(t.id))
      .forEach((t) => {
        previousStates[t.id] = { status: t.status, priority: t.priority, assignedTo: t.assignedTo };
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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.riderDbId || !newTicket.subject || !newTicket.message) {
      toast.error('Please fill in all required fields');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Ticket created successfully');
        setCreateModalOpen(false);
        setNewTicket({ riderDbId: '', category: 'GENERAL', priority: 'LOW', subject: '', message: '' });
        fetchTickets();
      } else {
        toast.error(json.message || 'Failed to create ticket');
      }
    } catch {
      toast.error('Failed to create ticket');
    } finally {
      setIsCreating(false);
    }
  };

  return {
    tickets,
    filtered,
    loading,
    activeTab,
    setActiveTab,
    priorityFilter,
    setPriorityFilter,
    search,
    setSearch,
    page,
    setPage,
    totalPages,
    total,
    statusCounts,
    admins,
    getAssignedName,

    // Selection
    selectedIds,
    setSelectedIds,

    // Detail
    selectedTicket,
    detailOpen,
    setDetailOpen,
    ticketMessages,
    messagesLoading,
    replyMessage,
    setReplyMessage,
    replyLoading,
    actionLoading,
    openDetail,
    handleStatusChange,
    handleAssign,
    handleAssignToMe,
    handleSendReply,

    // Bulk actions
    bulkLoading,
    lastAction,
    showUndoToast,
    bulkStatusDialog,
    setBulkStatusDialog,
    bulkStatusValue,
    setBulkStatusValue,
    bulkPriorityDialog,
    setBulkPriorityDialog,
    bulkPriorityValue,
    setBulkPriorityValue,
    bulkAssignDialog,
    setBulkAssignDialog,
    bulkAssignValue,
    setBulkAssignValue,
    handleBulkAction,
    handleUndo,

    // Create ticket
    createModalOpen,
    setCreateModalOpen,
    isCreating,
    newTicket,
    setNewTicket,
    riders,
    riderSearch,
    setRiderSearch,
    handleCreateTicket,
  };
}

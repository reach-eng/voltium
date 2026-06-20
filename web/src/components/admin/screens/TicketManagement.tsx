'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { ExportButton } from '../export-button';
import { AdminErrorBoundary } from '../error-boundary';
import { useAdminStore } from '@/store/admin';
import {
  Eye,
  Clock,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  MessageSquare,
  CheckCircle2,
  Ban,
  Download,
  X,
  Undo2,
  Loader2,
} from 'lucide-react';

interface Ticket {
  id: string;
  ticketId: string;
  riderId: string;
  riderName: string;
  riderPhone: string;
  category: string;
  priority: string;
  subject: string;
  message: string;
  status: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketMessage {
  id: string;
  senderId: string;
  senderType: string;
  message: string;
  attachments: string | null;
  createdAt: string;
}

const STATUS_FLOW = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    OPEN: {
      label: 'Open',
      color: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    },
    IN_PROGRESS: {
      label: 'In Progress',
      color: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    },
    RESOLVED: {
      label: 'Resolved',
      color: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    },
    CLOSED: {
      label: 'Closed',
      color: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
    },
  };
  const s = map[status] || {
    label: status,
    color: 'border-border text-muted-foreground bg-muted/30',
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-bold uppercase ${s.color}`}>
      {s.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { color: string; pulse?: boolean }> = {
    LOW: { color: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400' },
    MEDIUM: { color: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400' },
    HIGH: { color: 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400' },
    CRITICAL: {
      color: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
      pulse: true,
    },
  };
  const p = map[priority] || { color: 'border-border text-muted-foreground bg-muted/30' };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-bold uppercase tracking-tight ${p.color} ${p.pulse ? 'animate-pulse' : ''}`}
    >
      {priority === 'CRITICAL' && <AlertTriangle className="h-3 w-3 mr-1" />}
      {priority}
    </Badge>
  );
}

export default function TicketManagement() {
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
  const [replyMessage, setReplyMessage] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
  // adminRole is set at runtime outside the typed store interface
  const adminRole = (useAdminStore.getState() as any).adminRole || '';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [lastAction, setLastAction] = useState<{
    ids: string[];
    previousStates: Record<string, any>;
    action: string;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkPriorityValue, setBulkPriorityValue] = useState('');
  const [bulkAssignValue, setBulkAssignValue] = useState('');
  const [bulkStatusDialog, setBulkStatusDialog] = useState(false);
  const [bulkPriorityDialog, setBulkPriorityDialog] = useState(false);
  const [bulkAssignDialog, setBulkAssignDialog] = useState(false);
  const [cachedAdminId, setCachedAdminId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
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
        // Refresh details to see the new message
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

  async function handleBulkAction(action: string, value?: string) {
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
  }

  async function handleUndo() {
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
  }

  const getAssignedName = (adminId: string | null) => {
    if (!adminId) return '—';
    const admin = admins.find((a) => a.id === adminId);
    return admin?.name || 'Admin';
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Support Tickets</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Manage rider support tickets and issues
            </p>
          </div>
          <ExportButton
            data={tickets.map((t) => ({
              ticketId: t.ticketId,
              riderId: t.riderId,
              riderName: t.riderName,
              riderPhone: t.riderPhone,
              category: t.category,
              priority: t.priority,
              subject: t.subject,
              status: t.status,
              assignedTo: getAssignedName(t.assignedTo),
              createdAt: t.createdAt,
            }))}
            filename="tickets"
            columns={[
              { key: 'ticketId', label: 'Ticket ID' },
              { key: 'riderName', label: 'Rider Name' },
              { key: 'riderPhone', label: 'Rider Phone' },
              { key: 'category', label: 'Category' },
              { key: 'priority', label: 'Priority' },
              { key: 'subject', label: 'Subject' },
              { key: 'status', label: 'Status' },
              { key: 'assignedTo', label: 'Assigned To' },
              { key: 'createdAt', label: 'Created At' },
            ]}
          />
        </div>

        {/* Search & Priority Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search ticket ID, subject, or rider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
            />
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 px-3 rounded-xl border border-muted-foreground/20 bg-background text-sm"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          {search || priorityFilter !== 'ALL' ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                setSearch('');
                setPriorityFilter('ALL');
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1 p-2 bg-primary/5 rounded-xl border border-primary/20 mb-4 animate-in fade-in slide-in-from-right-2">
              <span className="text-xs px-2 font-medium text-primary">
                {selectedIds.size} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                disabled={bulkLoading}
                onClick={() => setBulkStatusDialog(true)}
                title="Change Status"
              >
                {bulkLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                )}{' '}
                Status
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                disabled={bulkLoading}
                onClick={() => setBulkAssignDialog(true)}
                title="Assign To"
              >
                <UserPlus className="w-3 h-3 mr-1" /> Assign
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                disabled={bulkLoading}
                onClick={() => setBulkPriorityDialog(true)}
                title="Change Priority"
              >
                <AlertTriangle className="w-3 h-3 mr-1" /> Priority
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary transition-all duration-200"
                disabled={bulkLoading}
                onClick={() => handleBulkAction('closeResolved')}
                title="Close Resolved"
              >
                <Ban className="w-3 h-3 mr-1" /> Close Resolved
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-muted-foreground/10 transition-all duration-200"
                onClick={() => {
                  const header =
                    'Ticket #,Rider,Phone,Category,Priority,Subject,Status,Assigned,Created';
                  const rows = tickets
                    .filter((t) => selectedIds.has(t.id))
                    .map((t) =>
                      [
                        t.ticketId,
                        t.riderName,
                        t.riderPhone,
                        t.category,
                        t.priority,
                        t.subject,
                        t.status,
                        getAssignedName(t.assignedTo),
                        t.createdAt,
                      ].join(',')
                    );
                  const csv = [header, ...rows].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute(
                    'download',
                    `tickets-${new Date().toISOString().split('T')[0]}.csv`
                  );
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="w-3 h-3 mr-1" /> Export
              </Button>
              {lastAction && (
                <>
                  <div className="w-px h-4 bg-border/50 mx-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 hover:bg-muted/10 transition-all duration-200"
                    disabled={bulkLoading}
                    onClick={handleUndo}
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 className="w-3 h-3 mr-1" /> Undo
                  </Button>
                </>
              )}
              <div className="w-px h-4 bg-border/50 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-muted-foreground/10"
                onClick={() => setSelectedIds(new Set())}
                title="Clear selection"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
          <TabsList className="bg-muted/30 p-1 rounded-xl">
            <TabsTrigger value="all" className="rounded-lg text-xs font-bold h-8 px-3">
              All ({statusCounts.all || 0})
            </TabsTrigger>
            <TabsTrigger value="OPEN" className="rounded-lg text-xs font-bold h-8 px-3">
              Open ({statusCounts.OPEN || 0})
            </TabsTrigger>
            <TabsTrigger value="IN_PROGRESS" className="rounded-lg text-xs font-bold h-8 px-3">
              In Progress ({statusCounts.IN_PROGRESS || 0})
            </TabsTrigger>
            <TabsTrigger value="RESOLVED" className="rounded-lg text-xs font-bold h-8 px-3">
              Resolved ({statusCounts.RESOLVED || 0})
            </TabsTrigger>
            <TabsTrigger value="CLOSED" className="rounded-lg text-xs font-bold h-8 px-3">
              Closed ({statusCounts.CLOSED || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onCheckedChange={(checked) =>
                          setSelectedIds(checked ? new Set(filtered.map((t) => t.id)) : new Set())
                        }
                      />
                    </TableHead>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No tickets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((t) => (
                      <TableRow key={t.id} className={selectedIds.has(t.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(t.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedIds);
                              if (checked) next.add(t.id);
                              else next.delete(t.id);
                              setSelectedIds(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{t.ticketId}</TableCell>
                        <TableCell className="font-medium text-sm">{t.riderName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {t.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={t.priority} />
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {t.subject}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getAssignedName(t.assignedTo)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(t.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetail(t)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} tickets
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm font-medium px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Ticket Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Ticket {selectedTicket?.ticketId}
                {selectedTicket && <StatusBadge status={selectedTicket.status} />}
                {selectedTicket && <PriorityBadge priority={selectedTicket.priority} />}
              </DialogTitle>
              <DialogDescription>{selectedTicket?.subject}</DialogDescription>
            </DialogHeader>

            {selectedTicket && (
              <div className="space-y-4">
                {/* Rider Info */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Rider Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{' '}
                      {selectedTicket.riderName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>{' '}
                      {selectedTicket.riderPhone}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Category:</span>{' '}
                      {selectedTicket.category}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>{' '}
                      {formatDate(selectedTicket.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Initial Message */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Issue Description</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                    {selectedTicket.message}
                  </p>
                </div>

                {/* Message Thread */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Messages
                  </h4>
                  {messagesLoading ? (
                    <div className="bg-muted/30 rounded-lg p-4 text-center text-sm text-muted-foreground">
                      Loading messages...
                    </div>
                  ) : ticketMessages.length === 0 ? (
                    <div className="bg-muted/30 rounded-lg p-4 text-center text-sm text-muted-foreground">
                      No messages yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ticketMessages.map((msg) => {
                        const isAdmin = msg.senderType === 'admin';
                        const senderName = isAdmin
                          ? getAssignedName(msg.senderId)
                          : selectedTicket.riderName;
                        return (
                          <div
                            key={msg.id}
                            className={`rounded-lg p-3 ${isAdmin ? 'bg-primary/5 ml-6' : 'bg-muted/30 mr-6'}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold">{senderName}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reply Message Box */}
                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="replyMessage" className="text-sm font-medium">
                    Send Reply / Message
                  </Label>
                  <div className="flex flex-col gap-2">
                    <Textarea
                      id="replyMessage"
                      placeholder="Type your message here..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      rows={3}
                      disabled={replyLoading || selectedTicket.status === 'CLOSED'}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleSendReply}
                        disabled={replyLoading || !replyMessage.trim() || selectedTicket.status === 'CLOSED'}
                      >
                        {replyLoading ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Send Reply'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Status & Assignment */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Update Status</label>
                    <Select value={selectedTicket.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_FLOW.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assign To</label>
                    <div className="flex gap-2">
                      <Select
                        value={selectedTicket.assignedTo || '_none'}
                        onValueChange={handleAssign}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Unassigned</SelectItem>
                          {admins.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 shrink-0"
                        onClick={handleAssignToMe}
                        title="Assign to Me"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Status Dialog */}
        <Dialog open={bulkStatusDialog} onOpenChange={setBulkStatusDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Status for {selectedIds.size} Tickets</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={bulkStatusValue} onValueChange={setBulkStatusValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkStatusDialog(false);
                  setBulkStatusValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!bulkStatusValue}
                onClick={() => {
                  handleBulkAction('changeStatus', bulkStatusValue);
                  setBulkStatusDialog(false);
                  setBulkStatusValue('');
                }}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Priority Dialog */}
        <Dialog open={bulkPriorityDialog} onOpenChange={setBulkPriorityDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Priority for {selectedIds.size} Tickets</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>New Priority</Label>
                <Select value={bulkPriorityValue} onValueChange={setBulkPriorityValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkPriorityDialog(false);
                  setBulkPriorityValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!bulkPriorityValue}
                onClick={() => {
                  handleBulkAction('changePriority', bulkPriorityValue);
                  setBulkPriorityDialog(false);
                  setBulkPriorityValue('');
                }}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Assign Dialog */}
        <Dialog open={bulkAssignDialog} onOpenChange={setBulkAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign {selectedIds.size} Tickets</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={bulkAssignValue} onValueChange={setBulkAssignValue}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select admin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Unassigned</SelectItem>
                    {admins.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setBulkAssignDialog(false);
                  setBulkAssignValue('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!bulkAssignValue}
                onClick={() => {
                  handleBulkAction('assign', bulkAssignValue);
                  setBulkAssignDialog(false);
                  setBulkAssignValue('');
                }}
              >
                Apply
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showUndoToast && lastAction && (
          <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
            <span className="text-sm">{lastAction.ids.length} ticket(s) updated</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 hover:bg-background/20 text-background"
              disabled={bulkLoading}
              onClick={handleUndo}
            >
              <Undo2 className="w-3 h-3 mr-1" /> Undo
            </Button>
          </div>
        )}
      </div>
    </AdminErrorBoundary>
  );
}

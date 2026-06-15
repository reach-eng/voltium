'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Send,
  Bell,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface Notification {
  id: string;
  riderId: string;
  riderName: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface RiderOption {
  id: string;
  riderId: string;
  fullName: string;
}

const typeColors: Record<string, string> = {
  system: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
  payment: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  vehicle: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
  alert: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  INFO: 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400',
  ALERT: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  SOS: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
  PROMOTION: 'border-purple-500/20 text-purple-600 bg-purple-500/5 dark:text-purple-400',
};

export default function NotificationManagement() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    riderId: '',
    title: '',
    message: '',
    type: 'system',
  });
  const [sendToAll, setSendToAll] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState('ALL');
  const [riderSearch, setRiderSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const PAGE_SIZE = 20;

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
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
      const res = await fetch('/api/admin/notifications', {
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
      setForm({ riderId: '', title: '', message: '', type: 'system' });
      setSendToAll(false);
      setPage(1);
      fetchNotifications();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilterChange = (type: string, status: string) => {
    setTypeFilter(type);
    setReadFilter(status);
    setPage(1);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
          <p className="text-muted-foreground text-sm mt-1">Send and manage rider notifications</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Send className="h-4 w-4 mr-1" /> Send Notification
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by rider or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(e) => {
            setTypeFilter(e);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-40 rounded-xl border-muted-foreground/20 text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="vehicle">Vehicle</SelectItem>
            <SelectItem value="alert">Alert</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={readFilter}
          onValueChange={(e) => {
            setReadFilter(e);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-40 rounded-xl border-muted-foreground/20 text-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="UNREAD">Unread</SelectItem>
            <SelectItem value="READ">Read</SelectItem>
          </SelectContent>
        </Select>
        {(search || typeFilter !== 'ALL' || readFilter !== 'ALL') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              setSearch('');
              setTypeFilter('ALL');
              setReadFilter('ALL');
            }}
          >
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Send Notification Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={sendToAll} onCheckedChange={setSendToAll} />
              <Label>Send to all riders</Label>
            </div>
            {!sendToAll && (
              <div className="space-y-2">
                <Label>Target Rider</Label>
                <Input
                  placeholder="Search riders by name/ID..."
                  value={riderSearch}
                  onChange={(e) => setRiderSearch(e.target.value)}
                  className="mb-2 h-9"
                />
                <Select
                  value={form.riderId}
                  onValueChange={(v) => setForm({ ...form, riderId: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a rider" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {riders.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.fullName || 'Unknown'} ({r.riderId})
                      </SelectItem>
                    ))}
                    {riders.length === 0 && (
                      <div className="p-2 text-xs text-muted-foreground text-center">
                        No riders found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Notification title"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Notification message"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={sendNotification}
              disabled={
                isSubmitting || !form.title || !form.message || (!sendToAll && !form.riderId)
              }
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}{' '}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rider</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Read</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : notifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No notifications found
                </TableCell>
              </TableRow>
            ) : (
              notifications.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{n.riderName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{n.riderId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {n.message}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase ${typeColors[n.type] || 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'}`}
                    >
                      {n.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        n.isRead
                          ? 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400'
                          : 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400'
                      }`}
                    >
                      {n.isRead ? (
                        <>
                          <EyeOff className="h-3 w-3 mr-0.5" /> Read
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-0.5" /> Unread
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(n.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {totalCount} notifications
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
    </div>
  );
}

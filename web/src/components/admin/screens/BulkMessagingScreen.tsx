'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Send,
  Eye,
  Plus,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  Bell,
  MessageSquare,
  Smartphone,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { useDebounce } from '@/hooks/use-debounce';

interface Announcement {
  id: string;
  title: string;
  message: string;
  channel: string;
  targetAudience: string;
  targetIds: string[];
  scheduledAt: string | null;
  sentAt: string | null;
  status: string;
  totalRecipients: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface HubOption {
  id: string;
  name: string;
  city: string;
}

const PAGE_SIZE = 20;

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'SENT':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'SCHEDULED':
      return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
    case 'DRAFT':
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
    case 'FAILED':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

function getChannelIcon(channel: string) {
  switch (channel) {
    case 'PUSH':
      return Bell;
    case 'SMS':
      return Smartphone;
    case 'IN_APP':
      return MessageSquare;
    default:
      return Send;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BulkMessagingScreen() {
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
  const [form, setForm] = useState({
    title: '',
    message: '',
    channel: 'PUSH',
    targetAudience: 'ALL',
    targetIds: [] as string[],
    schedule: false,
    scheduledAt: '',
  });

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
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

  async function handleCreate() {
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
        setForm({
          title: '',
          message: '',
          channel: 'PUSH',
          targetAudience: 'ALL',
          targetIds: [],
          schedule: false,
          scheduledAt: '',
        });
        fetchAnnouncements();
      }
    } catch (error) {
      logger.error('Failed to create announcement', { error });
    } finally {
      setSending(false);
    }
  }

  function toggleTargetId(id: string) {
    setForm((prev) => ({
      ...prev,
      targetIds: prev.targetIds.includes(id)
        ? prev.targetIds.filter((i) => i !== id)
        : [...prev.targetIds, id],
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Send className="w-6 h-6 text-primary" />
            Bulk Messaging
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage announcements and broadcast messages
          </p>
        </div>
        <Button size="sm" className="rounded-full px-4 h-9" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Announcement
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search announcements..."
            className="pl-9 h-9 text-sm rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 rounded-xl">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="SENT">Sent</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Announcements Table */}
      <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="px-6">Title</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Read</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      No announcements found
                    </TableCell>
                  </TableRow>
                ) : (
                  announcements.map((a) => {
                    const ChannelIcon = getChannelIcon(a.channel);
                    return (
                      <TableRow
                        key={a.id}
                        className="hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedAnnouncement(a);
                          setDetailOpen(true);
                        }}
                      >
                        <TableCell className="font-medium px-6 max-w-[250px] truncate">
                          {a.title}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <ChannelIcon className="w-3.5 h-3.5" />
                            <span className="text-xs">{a.channel.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.targetAudience.replace('_', ' ')}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{a.totalRecipients}</TableCell>
                        <TableCell className="text-sm text-emerald-600">
                          {a.deliveredCount}
                        </TableCell>
                        <TableCell className="text-sm text-blue-600">{a.readCount}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`rounded-md text-[10px] font-bold uppercase ${getStatusBadgeClass(a.status)}`}
                          >
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(a.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
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
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Announcement Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Create Announcement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Announcement title"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Message content"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUSH">Push Notification</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="IN_APP">In-App</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select
                value={form.targetAudience}
                onValueChange={(v) => setForm({ ...form, targetAudience: v, targetIds: [] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Riders</SelectItem>
                  <SelectItem value="BY_HUB">By Hub</SelectItem>
                  <SelectItem value="BY_STATUS">By Status</SelectItem>
                  <SelectItem value="BY_PLAN">By Plan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.targetAudience === 'BY_HUB' && (
              <div className="space-y-2">
                <Label>Select Hubs</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-lg p-2">
                  {hubs.map((hub) => (
                    <div key={hub.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={form.targetIds.includes(hub.name)}
                        onCheckedChange={() => toggleTargetId(hub.name)}
                      />
                      <span className="text-sm">{hub.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.targetAudience === 'BY_STATUS' && (
              <div className="space-y-2">
                <Label>Select Statuses</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['ONBOARDING', 'PRE_ACTIVE', 'POST_ACTIVE', 'SUSPENDED'].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <Checkbox
                        checked={form.targetIds.includes(s)}
                        onCheckedChange={() => toggleTargetId(s)}
                      />
                      <span className="text-sm">{s.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.targetAudience === 'BY_PLAN' && (
              <div className="space-y-2">
                <Label>Select Plans</Label>
                <Input
                  placeholder="Enter plan names (comma separated)"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      targetIds: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            )}

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Estimated Recipients</span>
              </div>
              <span className="text-lg font-bold text-primary">
                {recipientCount.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Schedule for later</Label>
              <Switch
                checked={form.schedule}
                onCheckedChange={(v) => setForm({ ...form, schedule: v })}
              />
            </div>

            {form.schedule && (
              <div className="space-y-2">
                <Label>Schedule Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={sending || !form.title || !form.message}>
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {form.schedule ? 'Schedule' : 'Send Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedAnnouncement?.title}</DialogTitle>
          </DialogHeader>
          {selectedAnnouncement && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`rounded-md text-xs font-bold uppercase ${getStatusBadgeClass(selectedAnnouncement.status)}`}
                >
                  {selectedAnnouncement.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {selectedAnnouncement.channel.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{selectedAnnouncement.message}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target</span>
                  <span>{selectedAnnouncement.targetAudience.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Recipients</span>
                  <span className="font-semibold">{selectedAnnouncement.totalRecipients}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivered</span>
                  <span className="text-emerald-600 font-semibold">
                    {selectedAnnouncement.deliveredCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Read</span>
                  <span className="text-blue-600 font-semibold">
                    {selectedAnnouncement.readCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Failed</span>
                  <span className="text-rose-600 font-semibold">
                    {selectedAnnouncement.failedCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(selectedAnnouncement.createdAt)}</span>
                </div>
                {selectedAnnouncement.sentAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sent At</span>
                    <span>{formatDate(selectedAnnouncement.sentAt)}</span>
                  </div>
                )}
                {selectedAnnouncement.scheduledAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scheduled For</span>
                    <span>{formatDate(selectedAnnouncement.scheduledAt)}</span>
                  </div>
                )}
              </div>

              {/* Delivery Breakdown */}
              <Card className="rounded-xl border-border/50">
                <CardHeader className="pb-2 px-4 pt-3">
                  <CardTitle className="text-sm font-bold">Delivery Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-2 py-1">Status</TableHead>
                        <TableHead className="text-right px-2 py-1">Count</TableHead>
                        <TableHead className="text-right px-2 py-1">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="px-2 py-1 text-xs">Delivered</TableCell>
                        <TableCell className="text-right px-2 py-1 text-xs text-emerald-600">
                          {selectedAnnouncement.deliveredCount}
                        </TableCell>
                        <TableCell className="text-right px-2 py-1 text-xs">
                          {selectedAnnouncement.totalRecipients > 0
                            ? (
                                (selectedAnnouncement.deliveredCount /
                                  selectedAnnouncement.totalRecipients) *
                                100
                              ).toFixed(1)
                            : 0}
                          %
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="px-2 py-1 text-xs">Read</TableCell>
                        <TableCell className="text-right px-2 py-1 text-xs text-blue-600">
                          {selectedAnnouncement.readCount}
                        </TableCell>
                        <TableCell className="text-right px-2 py-1 text-xs">
                          {selectedAnnouncement.totalRecipients > 0
                            ? (
                                (selectedAnnouncement.readCount /
                                  selectedAnnouncement.totalRecipients) *
                                100
                              ).toFixed(1)
                            : 0}
                          %
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="px-2 py-1 text-xs">Failed</TableCell>
                        <TableCell className="text-right px-2 py-1 text-xs text-rose-600">
                          {selectedAnnouncement.failedCount}
                        </TableCell>
                        <TableCell className="text-right px-2 py-1 text-xs">
                          {selectedAnnouncement.totalRecipients > 0
                            ? (
                                (selectedAnnouncement.failedCount /
                                  selectedAnnouncement.totalRecipients) *
                                100
                              ).toFixed(1)
                            : 0}
                          %
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

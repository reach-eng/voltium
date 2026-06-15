'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertTriangle,
  Plus,
  Eye,
  Search,
  RefreshCw,
  Loader2,
  FileText,
  Camera,
  Clock,
  User,
  Bike,
  MapPin,
  CheckCircle2,
  Download,
  Shield,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { BRAND_DOMAIN } from '@/lib/branding';

const PAGE_SIZE = 20;

interface Incident {
  id: string;
  incidentId: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  title: string;
  description: string;
  riderId: string | null;
  riderName: string | null;
  vehicleId: string | null;
  vehicleNumber: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  hasInsurance: boolean;
  photos: string[];
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  timeline: { action: string; actor: string; timestamp: string }[];
}

interface RiderOption {
  id: string;
  riderId: string;
  fullName: string | null;
  phone: string;
}

interface VehicleOption {
  id: string;
  vehicleNumber: string;
  model: string;
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'OPEN':
      return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
    case 'INVESTIGATING':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    case 'RESOLVED':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'CLOSED':
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

function getSeverityBadgeClass(severity: string) {
  switch (severity) {
    case 'LOW':
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
    case 'MEDIUM':
      return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
    case 'HIGH':
      return 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
    case 'CRITICAL':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function IncidentManagementScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [creating, setCreating] = useState(false);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [detailTab, setDetailTab] = useState('info');
  const [form, setForm] = useState({
    type: '',
    severity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    title: '',
    description: '',
    riderId: '',
    vehicleId: '',
    location: '',
    hasInsurance: false,
  });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const incidentTypes = ['ACCIDENT', 'THEFT', 'BREAKDOWN', 'DAMAGE', 'VIOLATION', 'OTHER'];

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/incidents?${params}`);
      if (res.ok) {
        const json = await res.json();
        setIncidents(json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotal(json.pagination.total || 0);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch incidents', { error });
      toast.error('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, severityFilter, debouncedSearch]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, severityFilter, debouncedSearch]);

  useEffect(() => {
    if (createOpen) {
      fetch('/api/admin/riders?limit=50')
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then((json) => {
          if (json.success) setRiders(json.data?.riders || []);
        })
        .catch(() => logger.error('Failed to fetch riders'));
      fetch('/api/admin/vehicles?limit=50')
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then((json) => {
          if (json.success) setVehicles(json.data || []);
        })
        .catch(() => logger.error('Failed to fetch vehicles'));
    }
  }, [createOpen]);

  async function handleCreate() {
    if (!form.type || !form.title) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        severity: form.severity,
        title: form.title,
        description: form.description,
        location: form.location,
        hasInsurance: form.hasInsurance,
      };
      if (form.riderId) body.riderId = form.riderId;
      if (form.vehicleId) body.vehicleId = form.vehicleId;

      const res = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to create incident');
        return;
      }
      toast.success('Incident created');
      setCreateOpen(false);
      setForm({
        type: '',
        severity: 'MEDIUM',
        title: '',
        description: '',
        riderId: '',
        vehicleId: '',
        location: '',
        hasInsurance: false,
      });
      fetchIncidents();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(incidentId: string, newStatus: string) {
    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incidentId, status: newStatus }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to update status');
        return;
      }
      toast.success(`Status changed to ${newStatus}`);
      fetchIncidents();
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident((prev) =>
          prev ? { ...prev, status: newStatus as Incident['status'] } : null
        );
      }
    } catch {
      toast.error('Network error. Please try again.');
    }
  }

  async function handleAssign(incidentId: string, adminId: string) {
    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incidentId, assignedTo: adminId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to assign');
        return;
      }
      toast.success('Incident assigned');
      fetchIncidents();
    } catch {
      toast.error('Network error. Please try again.');
    }
  }

  function handleGenerateReport(incident: Incident) {
    const report = [
      `${BRAND_DOMAIN} Incident Report`,
      `Incident ID: ${incident.incidentId}`,
      `Generated: ${new Date().toLocaleString('en-IN')}`,
      '',
      'Details',
      `Title,${incident.title}`,
      `Type,${incident.type}`,
      `Severity,${incident.severity}`,
      `Status,${incident.status}`,
      `Rider,${incident.riderName || 'N/A'}`,
      `Vehicle,${incident.vehicleNumber || 'N/A'}`,
      `Location,${incident.location || 'N/A'}`,
      `Insurance,${incident.hasInsurance ? 'Yes' : 'No'}`,
      '',
      'Description',
      incident.description,
      '',
      'Timeline',
      'Action,Actor,Timestamp',
      ...incident.timeline.map((t) => `${t.action},${t.actor},${formatDate(t.timestamp)}`),
    ].join('\n');
    const blob = new Blob([report], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-${incident.incidentId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusCounts = {
    OPEN: incidents.filter((i) => i.status === 'OPEN').length,
    INVESTIGATING: incidents.filter((i) => i.status === 'INVESTIGATING').length,
    RESOLVED: incidents.filter((i) => i.status === 'RESOLVED').length,
    CLOSED: incidents.filter((i) => i.status === 'CLOSED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-primary" />
            Incident Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Track and resolve rider incidents</p>
        </div>
        <Button size="sm" className="rounded-full px-4 h-9" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Incident
        </Button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Open</p>
              <p className="text-2xl font-bold text-blue-600">{statusCounts.OPEN}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Search className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Investigating</p>
              <p className="text-2xl font-bold text-amber-600">{statusCounts.INVESTIGATING}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Resolved</p>
              <p className="text-2xl font-bold text-emerald-600">{statusCounts.RESOLVED}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-500/20 bg-slate-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Closed</p>
              <p className="text-2xl font-bold text-slate-600">{statusCounts.CLOSED}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="INVESTIGATING">Investigating</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {incidentTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, title, or rider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9 rounded-xl border-muted-foreground/20"
          />
        </div>
      </div>

      {/* Incidents Table */}
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
                  <TableHead className="px-6">ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rider</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="pr-6 text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      No incidents found
                    </TableCell>
                  </TableRow>
                ) : (
                  incidents.map((inc) => (
                    <TableRow
                      key={inc.id}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedIncident(inc);
                        setDetailOpen(true);
                        setDetailTab('info');
                      }}
                    >
                      <TableCell className="font-mono text-xs px-6">#{inc.incidentId}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {inc.title}
                      </TableCell>
                      <TableCell className="text-xs">{inc.type}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-md text-[10px] font-bold uppercase ${getSeverityBadgeClass(inc.severity)}`}
                        >
                          {inc.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-md text-[10px] font-bold uppercase ${getStatusBadgeClass(inc.status)}`}
                        >
                          {inc.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{inc.riderName || '—'}</TableCell>
                      <TableCell className="text-sm">{inc.vehicleNumber || '—'}</TableCell>
                      <TableCell className="text-right pr-6 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(inc.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
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

      {/* Create Incident Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Create Incident
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Incident title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v as Incident['severity'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
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
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed description"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rider (optional)</Label>
                <Select
                  value={form.riderId}
                  onValueChange={(v) => setForm({ ...form, riderId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rider" />
                  </SelectTrigger>
                  <SelectContent>
                    {riders.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.fullName || r.riderId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehicle (optional)</Label>
                <Select
                  value={form.vehicleId}
                  onValueChange={(v) => setForm({ ...form, vehicleId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.vehicleNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Incident location"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <Label className="text-sm">Insurance Claim</Label>
              <Switch
                checked={form.hasInsurance}
                onCheckedChange={(v) => setForm({ ...form, hasInsurance: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !form.type || !form.title}>
              {creating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Incident #{selectedIncident?.incidentId}
              </span>
              {selectedIncident && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateReport(selectedIncident)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-4 mb-4 bg-muted/30 p-1 rounded-xl">
                <TabsTrigger value="info" className="rounded-lg text-xs font-bold">
                  Info
                </TabsTrigger>
                <TabsTrigger value="photos" className="rounded-lg text-xs font-bold">
                  Photos
                </TabsTrigger>
                <TabsTrigger value="timeline" className="rounded-lg text-xs font-bold">
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="actions" className="rounded-lg text-xs font-bold">
                  Actions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`rounded-md text-xs font-bold uppercase ${getStatusBadgeClass(selectedIncident.status)}`}
                  >
                    {selectedIncident.status.replace('_', ' ')}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`rounded-md text-xs font-bold uppercase ${getSeverityBadgeClass(selectedIncident.severity)}`}
                  >
                    {selectedIncident.severity}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold">{selectedIncident.title}</h3>
                <p className="text-sm text-muted-foreground">{selectedIncident.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{selectedIncident.type}</span>
                    </div>
                    {selectedIncident.riderName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" /> Rider
                        </span>
                        <span className="font-medium">{selectedIncident.riderName}</span>
                      </div>
                    )}
                    {selectedIncident.vehicleNumber && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Bike className="w-3 h-3" /> Vehicle
                        </span>
                        <span className="font-medium">{selectedIncident.vehicleNumber}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {selectedIncident.location && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Location
                        </span>
                        <span className="font-medium">{selectedIncident.location}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Insurance</span>
                      <span className="font-medium">
                        {selectedIncident.hasInsurance ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>{formatDate(selectedIncident.createdAt)}</span>
                    </div>
                    {selectedIncident.resolvedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resolved</span>
                        <span>{formatDate(selectedIncident.resolvedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="photos" className="space-y-4">
                {selectedIncident.photos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <Camera className="w-12 h-12 opacity-20" />
                    <p className="text-sm">No photos attached</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedIncident.photos.map((photo, idx) => (
                      <div
                        key={idx}
                        className="aspect-video rounded-xl border bg-muted overflow-hidden"
                      >
                        <img
                          src={photo}
                          alt={`Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4">
                {selectedIncident.timeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <Clock className="w-12 h-12 opacity-20" />
                    <p className="text-sm">No timeline entries</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedIncident.timeline.map((entry, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 pl-4 border-l-2 border-border"
                      >
                        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                        <div>
                          <p className="text-sm font-medium">{entry.action}</p>
                          <p className="text-xs text-muted-foreground">
                            by {entry.actor} — {formatDate(entry.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Update Status</Label>
                    <div className="flex gap-2 flex-wrap">
                      {selectedIncident.status !== 'INVESTIGATING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(selectedIncident.id, 'INVESTIGATING')}
                        >
                          Start Investigating
                        </Button>
                      )}
                      {selectedIncident.status !== 'RESOLVED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => handleUpdateStatus(selectedIncident.id, 'RESOLVED')}
                        >
                          Mark Resolved
                        </Button>
                      )}
                      {selectedIncident.status !== 'CLOSED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(selectedIncident.id, 'CLOSED')}
                        >
                          Close
                        </Button>
                      )}
                      {selectedIncident.status !== 'OPEN' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(selectedIncident.id, 'OPEN')}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Assign To</Label>
                    <Input
                      placeholder="Admin ID or name"
                      onBlur={(e) => {
                        if (e.target.value) handleAssign(selectedIncident.id, e.target.value);
                      }}
                    />
                  </div>
                  {selectedIncident.assignedToName && (
                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        Assigned to:{' '}
                        <span className="font-semibold">{selectedIncident.assignedToName}</span>
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

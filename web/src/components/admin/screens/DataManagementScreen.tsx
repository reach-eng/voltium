'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Database,
  HardDrive,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Download,
  Trash2,
  RotateCcw,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Upload,
  Server,
  RefreshCw,
  Calendar,
  Settings2,
  Save,
  Loader2,
  Info,
  Archive,
  FolderOpen,
  ChevronRight,
  Ban,
  ListChecks,
  Activity,
  Shield,
  ClipboardCheck,
  Search,
} from 'lucide-react';
import { AdminErrorBoundary } from '../error-boundary';

// ── Types ──────────────────────────────────────────────────────────────

interface OverviewData {
  stats: {
    totalBackups: number;
    totalSizeBytes: number;
    lastBackupAt: string | null;
    lastBackupStatus: string | null;
    failedBackups: number;
    runningBackups: number;
  };
  latestBackup: BackupJobData | null;
  storage: {
    databaseSizeBytes: number;
    uploadsSizeBytes: number;
    backupsSizeBytes: number;
    freeDiskBytes: number;
    totalDiskBytes: number;
  } | null;
  maintenanceMode: boolean;
  scheduleStatus: {
    enabled: boolean;
    nextRunAt: string | null;
    lastRunAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
  } | null;
}

interface BackupJobData {
  id: string;
  type: string;
  scheduleType: string | null;
  status: string;
  databasePath: string | null;
  filesPath: string | null;
  backupPath: string | null;
  sizeBytes: number | null;
  fileCount: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface PaginatedResult<T> {
  jobs: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface BackupScheduleConfig {
  id?: string;
  enabled: boolean;
  frequency: string;
  timeOfDay: string;
  timezone: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  includeDatabase: boolean;
  includeUploads: boolean;
  includeLogs: boolean;
  primaryBackupRoot: string;
  secondaryBackupRoot: string | null;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  keepManual: number | null;
  minimumFreeDiskGb: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

interface StorageData {
  databaseSizeBytes: number;
  uploadsSizeBytes: number;
  backupsSizeBytes: number;
  logsSizeBytes: number;
  freeDiskBytes: number;
  totalDiskBytes: number;
  largestFileCategories: { category: string; sizeBytes: number }[];
}

interface TestScheduleResult {
  success: boolean;
  issues: string[];
  warnings: string[];
  freeDiskGb: number;
  backupPath: string;
  secondaryPath: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string | null | undefined) {
  const styles: Record<string, string> = {
    COMPLETED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    RUNNING: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    QUEUED: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    FAILED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
    VALIDATING: 'border-indigo-500/20 text-indigo-600 bg-indigo-500/5 dark:text-indigo-400',
    READY: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
  };
  return styles[status || ''] || 'border-border text-muted-foreground bg-muted/30';
}

function getTypeBadge(type: string | null | undefined) {
  const styles: Record<string, string> = {
    MANUAL: 'border-purple-500/20 text-purple-600 bg-purple-500/5 dark:text-purple-400',
    SCHEDULED: 'border-cyan-500/20 text-cyan-600 bg-cyan-500/5 dark:text-cyan-400',
    PRE_RESTORE: 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400',
  };
  return styles[type || ''] || 'border-border text-muted-foreground bg-muted/30';
}

function getStoragePercent(bytes: number, total: number): number {
  if (total === 0) return 0;
  return Math.min(100, Math.round((bytes / total) * 100));
}

// ── Schemas Tab Content ────────────────────────────────────────────────

function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/data-management/overview');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json.data);
      }
    } catch {
      toast.error('Failed to load overview data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Server className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm">Could not load overview data</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
          <RefreshCw className="w-3 h-3 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  const freePercent = data.storage
    ? getStoragePercent(data.storage.freeDiskBytes, data.storage.totalDiskBytes)
    : 0;
  const usedPercent = data.storage ? 100 - freePercent : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Archive className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="outline" className="text-[10px]">
                {data.stats.totalBackups > 0 ? `${data.stats.totalBackups} total` : 'No backups'}
              </Badge>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatBytes(data.stats.totalSizeBytes)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total Backup Storage</p>
          </CardContent>
        </Card>

        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {data.stats.lastBackupStatus === 'COMPLETED' ? (
                <span className="text-emerald-600 dark:text-emerald-400">Healthy</span>
              ) : data.stats.lastBackupStatus === 'FAILED' ? (
                <span className="text-rose-600 dark:text-rose-400">Failed</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.stats.lastBackupAt
                ? `Last backup: ${formatDate(data.stats.lastBackupAt)}`
                : 'No backups yet'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {data.stats.failedBackups > 0 ? (
                <span className="text-rose-600 dark:text-rose-400">{data.stats.failedBackups}</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">0</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Failed Backups</p>
          </CardContent>
        </Card>

        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {data.scheduleStatus?.nextRunAt ? (
                <span className="text-sm font-medium">
                  {formatDate(data.scheduleStatus.nextRunAt)}
                </span>
              ) : (
                <span className="text-base text-muted-foreground">Not scheduled</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Next Scheduled Backup</p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Status */}
      {data.scheduleStatus && (
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base">Schedule Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Auto-backup:</span>
                {data.scheduleStatus.enabled ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Disabled
                  </Badge>
                )}
              </div>
              {data.scheduleStatus.lastStatus && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Last run:</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${getStatusBadge(data.scheduleStatus.lastStatus)}`}
                  >
                    {data.scheduleStatus.lastStatus}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(data.scheduleStatus.lastRunAt)}
                  </span>
                </div>
              )}
              {data.scheduleStatus.lastError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <ShieldX className="w-3 h-3" />
                  <span>{data.scheduleStatus.lastError}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Mode Warning */}
      {data.maintenanceMode && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Maintenance mode is active. Automatic backups are paused.</span>
        </div>
      )}

      {/* Storage Overview */}
      {data.storage && (
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-base">Disk Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatBytes(data.storage.freeDiskBytes)} free of{' '}
                  {formatBytes(data.storage.totalDiskBytes)}
                </span>
                <span className="font-medium">{freePercent.toFixed(0)}% free</span>
              </div>
              <Progress
                value={usedPercent}
                className={`h-2.5 ${usedPercent > 90 ? '[&>div]:bg-rose-500' : usedPercent > 70 ? '[&>div]:bg-amber-500' : ''}`}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {[
                  {
                    label: 'Database',
                    bytes: data.storage.databaseSizeBytes,
                    color: 'bg-blue-500',
                  },
                  {
                    label: 'Uploads',
                    bytes: data.storage.uploadsSizeBytes,
                    color: 'bg-purple-500',
                  },
                  {
                    label: 'Backups',
                    bytes: data.storage.backupsSizeBytes,
                    color: 'bg-emerald-500',
                  },
                  { label: 'Free', bytes: data.storage.freeDiskBytes, color: 'bg-muted' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-xs font-medium">{formatBytes(item.bytes)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Backups */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-base">Recent Backups</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.latestBackup ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border text-sm">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${getTypeBadge(data.latestBackup.type)}`}
                >
                  {data.latestBackup.type}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${getStatusBadge(data.latestBackup.status)}`}
                >
                  {data.latestBackup.status}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {formatDate(data.latestBackup.createdAt)}
                </span>
                <span className="text-xs font-medium">
                  {formatBytes(data.latestBackup.sizeBytes)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                ID: {data.latestBackup.id.slice(0, 8)}...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No backups yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Backups Tab Content ────────────────────────────────────────────────

function BackupsTab() {
  const [backups, setBackups] = useState<BackupJobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string } | null>(
    null
  );
  const limit = 20;

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/data-management/backups?${params}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const paginated = json.data as PaginatedResult<BackupJobData>;
          setBackups(paginated.jobs);
          setTotalPages(paginated.pagination.totalPages);
          setTotal(paginated.pagination.total);
        }
      }
    } catch {
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/data-management/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'MANUAL' }),
      });
      if (res.ok) {
        toast.success('Backup started');
        setShowCreateDialog(false);
        fetchBackups();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to start backup');
      }
    } catch {
      toast.error('Failed to start backup');
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/admin/data-management/backups/${id}/verify`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setVerifyResult({
          valid: true,
          message: 'Backup verified successfully — all files intact',
        });
        toast.success('Backup verified');
      } else {
        setVerifyResult({ valid: false, message: json.error || 'Verification failed' });
        toast.error('Verification failed');
      }
    } catch {
      toast.error('Verification request failed');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/data-management/backups/${id}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${id.slice(0, 8)}.tar.gz`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Download started');
      } else {
        toast.error('Download failed');
      }
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/data-management/backups/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Backup deleted');
        setDeleteConfirm(null);
        fetchBackups();
      } else {
        toast.error('Failed to delete backup');
      }
    } catch {
      toast.error('Failed to delete backup');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Type:</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">
                  All types
                </SelectItem>
                <SelectItem value="MANUAL" className="text-xs">
                  Manual
                </SelectItem>
                <SelectItem value="SCHEDULED" className="text-xs">
                  Scheduled
                </SelectItem>
                <SelectItem value="PRE_RESTORE" className="text-xs">
                  Pre-restore
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Status:</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">
                  All statuses
                </SelectItem>
                <SelectItem value="COMPLETED" className="text-xs">
                  Completed
                </SelectItem>
                <SelectItem value="FAILED" className="text-xs">
                  Failed
                </SelectItem>
                <SelectItem value="RUNNING" className="text-xs">
                  Running
                </SelectItem>
                <SelectItem value="QUEUED" className="text-xs">
                  Queued
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(typeFilter || statusFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setTypeFilter('');
                setStatusFilter('');
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-1" /> Create Backup
        </Button>
      </div>

      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing page {page} of {totalPages} ({total} total backups)
        </p>
      )}

      {/* Verify Result Banner */}
      {verifyResult && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
            verifyResult.valid
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
          }`}
        >
          {verifyResult.valid ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <ShieldX className="w-4 h-4 shrink-0" />
          )}
          <span>{verifyResult.message}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 text-xs"
            onClick={() => setVerifyResult(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Backups Table */}
      <Card className="rounded-xl shadow-sm overflow-x-auto">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : backups.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Archive className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No backups found</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-3 h-3 mr-1" /> Create your first backup
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getTypeBadge(backup.type)}`}
                      >
                        {backup.type}
                        {backup.scheduleType && ` (${backup.scheduleType})`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getStatusBadge(backup.status)}`}
                      >
                        {backup.status === 'RUNNING' && (
                          <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                        )}
                        {backup.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {formatBytes(backup.sizeBytes)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {backup.fileCount ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(backup.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(backup.completedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-rose-500 max-w-[200px] truncate">
                      {backup.errorMessage || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerify(backup.id)}
                          disabled={verifyingId === backup.id || backup.status !== 'COMPLETED'}
                          title="Verify integrity"
                        >
                          {verifyingId === backup.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(backup.id)}
                          disabled={backup.status !== 'COMPLETED'}
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(backup.id)}
                          disabled={backup.status === 'RUNNING'}
                          title="Delete"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            if (pageNum > totalPages) return null;
            return (
              <Button
                key={pageNum}
                variant={pageNum === page ? 'default' : 'outline'}
                size="sm"
                className="w-8"
                onClick={() => setPage(pageNum)}
              >
                {pageNum}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create Backup Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Manual Backup</DialogTitle>
            <DialogDescription>
              Start a manual backup of the database and uploaded files.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border text-sm">
              <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="text-muted-foreground">
                <p className="text-xs">
                  This will create a full backup of the database and uploaded files. The backup will
                  be stored on the local disk.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBackup} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" /> Start Backup
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this backup? This action cannot be undone. The backup
              files will be permanently removed from disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Schedule Tab Content ───────────────────────────────────────────────

function ScheduleTab() {
  const [config, setConfig] = useState<BackupScheduleConfig>({
    enabled: true,
    frequency: 'DAILY',
    timeOfDay: '02:00',
    timezone: 'Asia/Kolkata',
    dayOfWeek: 0,
    dayOfMonth: 1,
    includeDatabase: true,
    includeUploads: true,
    includeLogs: false,
    primaryBackupRoot: '',
    secondaryBackupRoot: '',
    keepDaily: 7,
    keepWeekly: 4,
    keepMonthly: 6,
    keepManual: null,
    minimumFreeDiskGb: 20,
    lastRunAt: null,
    nextRunAt: null,
    lastStatus: null,
    lastError: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [testResult, setTestResult] = useState<TestScheduleResult | null>(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/data-management/schedule');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setConfig({
            enabled: json.data.enabled ?? true,
            frequency: json.data.frequency ?? 'DAILY',
            timeOfDay: json.data.timeOfDay ?? '02:00',
            timezone: json.data.timezone ?? 'Asia/Kolkata',
            dayOfWeek: json.data.dayOfWeek ?? 0,
            dayOfMonth: json.data.dayOfMonth ?? 1,
            includeDatabase: json.data.includeDatabase ?? true,
            includeUploads: json.data.includeUploads ?? true,
            includeLogs: json.data.includeLogs ?? false,
            primaryBackupRoot: json.data.primaryBackupRoot ?? '',
            secondaryBackupRoot: json.data.secondaryBackupRoot ?? '',
            keepDaily: json.data.keepDaily ?? 7,
            keepWeekly: json.data.keepWeekly ?? 4,
            keepMonthly: json.data.keepMonthly ?? 6,
            keepManual: json.data.keepManual ?? null,
            minimumFreeDiskGb: json.data.minimumFreeDiskGb ?? 20,
            lastRunAt: json.data.lastRunAt ?? null,
            nextRunAt: json.data.nextRunAt ?? null,
            lastStatus: json.data.lastStatus ?? null,
            lastError: json.data.lastError ?? null,
          });
        }
      }
    } catch {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/data-management/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Schedule saved');
        fetchSchedule();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save schedule');
      }
    } catch {
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/data-management/schedule?action=test', {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setTestResult(json.data);
        if (json.data.success) {
          toast.success('Schedule configuration is valid');
        } else {
          toast.error('Schedule test found issues');
        }
      }
    } catch {
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const res = await fetch('/api/admin/data-management/schedule?action=run-now', {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Scheduled backup started');
        fetchSchedule();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to start backup');
      }
    } catch {
      toast.error('Failed to start backup');
    } finally {
      setRunningNow(false);
    }
  };

  const updateConfig = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Current Schedule</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Auto-backup
              </p>
              <Badge
                variant="outline"
                className={`text-[10px] ${config.enabled ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}`}
              >
                {config.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Frequency
              </p>
              <p className="text-sm font-medium">{config.frequency}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Next Backup
              </p>
              <p className="text-sm font-medium">{formatDate(config.nextRunAt)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Last Backup
              </p>
              {config.lastStatus ? (
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${getStatusBadge(config.lastStatus)}`}
                  >
                    {config.lastStatus}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(config.lastRunAt)}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
          </div>
          {config.lastError && (
            <div className="mt-3 flex items-center gap-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <ShieldX className="w-3 h-3 text-rose-500 shrink-0" />
              <span className="text-xs text-rose-600 dark:text-rose-400">{config.lastError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Form */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Schedule Settings</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Automatic Backup</Label>
              <p className="text-xs text-muted-foreground">
                Enable or disable scheduled automatic backups
              </p>
            </div>
            <Switch checked={config.enabled} onCheckedChange={(v) => updateConfig('enabled', v)} />
          </div>

          <Separator />

          {/* Frequency & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={config.frequency} onValueChange={(v) => updateConfig('frequency', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={config.timeOfDay}
                onChange={(e) => updateConfig('timeOfDay', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input
                value={config.timezone}
                onChange={(e) => updateConfig('timezone', e.target.value)}
                placeholder="Asia/Kolkata"
              />
            </div>
          </div>

          {/* Weekly/Monthly options */}
          {config.frequency === 'WEEKLY' && (
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={String(config.dayOfWeek ?? 0)}
                onValueChange={(v) => updateConfig('dayOfWeek', parseInt(v))}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {config.frequency === 'MONTHLY' && (
            <div className="space-y-2">
              <Label>Day of Month</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={config.dayOfMonth ?? 1}
                onChange={(e) => updateConfig('dayOfMonth', parseInt(e.target.value) || 1)}
                className="w-full sm:w-24"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: day 1–28 to avoid issues in February
              </p>
            </div>
          )}

          <Separator />

          {/* Backup Contents */}
          <div>
            <p className="text-sm font-medium mb-3">Backup Contents</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Database</Label>
                  <p className="text-xs text-muted-foreground">Include PostgreSQL database dump</p>
                </div>
                <Switch
                  checked={config.includeDatabase}
                  onCheckedChange={(v) => updateConfig('includeDatabase', v)}
                  disabled
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Uploaded Files</Label>
                  <p className="text-xs text-muted-foreground">
                    Include rider KYC and other uploads
                  </p>
                </div>
                <Switch
                  checked={config.includeUploads}
                  onCheckedChange={(v) => updateConfig('includeUploads', v)}
                  disabled
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Logs</Label>
                  <p className="text-xs text-muted-foreground">Include application logs</p>
                </div>
                <Switch
                  checked={config.includeLogs}
                  onCheckedChange={(v) => updateConfig('includeLogs', v)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup Locations */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-base">Backup Locations</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Primary Backup Root</Label>
            <Input
              value={config.primaryBackupRoot}
              onChange={(e) => updateConfig('primaryBackupRoot', e.target.value)}
              placeholder="D:/VoltiumServer/data/backups"
            />
            <p className="text-xs text-muted-foreground">
              Main directory where backup archives are stored
            </p>
          </div>
          <div className="space-y-2">
            <Label>Secondary Backup Root (Optional)</Label>
            <Input
              value={config.secondaryBackupRoot ?? ''}
              onChange={(e) => updateConfig('secondaryBackupRoot', e.target.value || null)}
              placeholder="E:/VoltiumBackups"
            />
            <p className="text-xs text-muted-foreground">
              Secondary location — useful for USB drive or external disk
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Retention */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-base">Retention Policy</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Keep Daily</Label>
              <Input
                type="number"
                min={1}
                value={config.keepDaily}
                onChange={(e) => updateConfig('keepDaily', parseInt(e.target.value) || 7)}
              />
            </div>
            <div className="space-y-2">
              <Label>Keep Weekly</Label>
              <Input
                type="number"
                min={1}
                value={config.keepWeekly}
                onChange={(e) => updateConfig('keepWeekly', parseInt(e.target.value) || 4)}
              />
            </div>
            <div className="space-y-2">
              <Label>Keep Monthly</Label>
              <Input
                type="number"
                min={1}
                value={config.keepMonthly}
                onChange={(e) => updateConfig('keepMonthly', parseInt(e.target.value) || 6)}
              />
            </div>
            <div className="space-y-2">
              <Label>Keep Manual</Label>
              <Input
                type="number"
                min={0}
                value={config.keepManual ?? ''}
                onChange={(e) =>
                  updateConfig('keepManual', e.target.value ? parseInt(e.target.value) : null)
                }
                placeholder="Unlimited"
              />
              <p className="text-xs text-muted-foreground">Leave empty for unlimited</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety & Disk */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10">
              <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <CardTitle className="text-base">Safety Checks</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label>Minimum Free Disk Space (GB)</Label>
            <Input
              type="number"
              min={1}
              value={config.minimumFreeDiskGb}
              onChange={(e) => updateConfig('minimumFreeDiskGb', parseInt(e.target.value) || 20)}
            />
            <p className="text-xs text-muted-foreground">
              Backup will not run if free space is below this threshold
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Test Result */}
      {testResult && (
        <Card
          className={`rounded-xl border ${
            testResult.success
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-rose-500/5 border-rose-500/20'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <ShieldX className="w-4 h-4 text-rose-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  testResult.success
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {testResult.success ? 'All checks passed' : 'Issues found'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Free disk space: {testResult.freeDiskGb.toFixed(1)} GB</p>
              <p>Backup path: {testResult.backupPath}</p>
              {testResult.secondaryPath && <p>Secondary path: {testResult.secondaryPath}</p>}
            </div>
            {testResult.issues.length > 0 && (
              <div className="mt-2 space-y-1">
                {testResult.issues.map((issue, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400"
                  >
                    <ShieldX className="w-3 h-3 shrink-0" /> {issue}
                  </div>
                ))}
              </div>
            )}
            {testResult.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {testResult.warnings.map((warn, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" /> {warn}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-1" /> Save Schedule
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Testing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-1" /> Test Settings
            </>
          )}
        </Button>
        <Button variant="secondary" onClick={handleRunNow} disabled={runningNow}>
          {runningNow ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Starting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" /> Run Backup Now
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={() => updateConfig('enabled', false)}
          disabled={!config.enabled}
          className="text-muted-foreground"
        >
          <Ban className="w-4 h-4 mr-1" /> Disable
        </Button>
      </div>
    </div>
  );
}

// ── Restore Tab Content ────────────────────────────────────────────────

function RestoreTab() {
  const [backups, setBackups] = useState<BackupJobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreStep, setRestoreStep] = useState<'select' | 'validate' | 'confirm' | 'result'>(
    'select'
  );
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [restoreHistory, setRestoreHistory] = useState<any[]>([]);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/data-management/backups?limit=50&status=COMPLETED');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setBackups(json.data.jobs || []);
        }
      }
    } catch {
      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRestoreHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/data-management/restore/history');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setRestoreHistory(json.data || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchBackups();
    fetchRestoreHistory();
  }, [fetchBackups, fetchRestoreHistory]);

  const handleValidate = async () => {
    if (!selectedId) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch('/api/admin/data-management/restore/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: selectedId }),
      });
      const json = await res.json();
      if (json.success) {
        setValidationResult(json.data);
        setRestoreStep('validate');
        if (json.data.valid) {
          toast.success('Backup is valid and ready for restore');
        } else {
          toast.error('Backup validation failed');
        }
      } else {
        toast.error(json.error || 'Validation failed');
      }
    } catch {
      toast.error('Validation request failed');
    } finally {
      setValidating(false);
    }
  };

  const handleStartRestore = async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/admin/data-management/restore/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: selectedId }),
      });
      const json = await res.json();
      if (json.success) {
        setRestoreResult(json.data);
        setRestoreStep('result');
        toast.success('Restore started');
        fetchRestoreHistory();
      } else {
        toast.error(json.error || 'Restore failed');
      }
    } catch {
      toast.error('Restore request failed');
    } finally {
      setRestoring(false);
    }
  };

  const selectedBackup = backups.find((b) => b.id === selectedId);
  const restoreSteps = ['select', 'validate', 'confirm', 'result'] as const;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {restoreSteps.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold $              {restoreStep === step
                  ? 'bg-primary text-primary-foreground'
                  : restoreSteps.indexOf(restoreStep) > i
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {restoreSteps.indexOf(restoreStep) > i ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs ${
                restoreStep === step ? 'font-medium text-foreground' : 'text-muted-foreground'
              }`}
            >
              {step === 'select'
                ? 'Select Backup'
                : step === 'validate'
                  ? 'Validate'
                  : step === 'confirm'
                    ? 'Confirm'
                    : 'Restore'}
            </span>
            {i < 3 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Backup */}
      {restoreStep === 'select' && (
        <Card className="rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Archive className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base">Select a Backup to Restore</CardTitle>
            </div>
            <CardDescription>
              Choose a completed backup to restore from. A pre-restore backup will be created
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Archive className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No completed backups available for restore</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedId === backup.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedId(backup.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getTypeBadge(backup.type)}`}
                      >
                        {backup.type}
                      </Badge>
                      <div>
                        <p className="text-xs font-medium">
                          {formatBytes(backup.sizeBytes)} · {backup.fileCount ?? 0} files
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(backup.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${getStatusBadge(backup.status)}`}
                    >
                      {backup.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={handleValidate} disabled={!selectedId || validating}>
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Validating...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-1" /> Validate &amp; Continue
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Validation Result */}
      {restoreStep === 'validate' && validationResult && (
        <Card
          className={`rounded-xl border ${
            validationResult.valid
              ? 'border-emerald-500/20 bg-emerald-500/5'
              : 'border-rose-500/20 bg-rose-500/5'
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              {validationResult.valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <ShieldX className="w-5 h-5 text-rose-500" />
              )}
              <CardTitle className="text-base">
                {validationResult.valid ? 'Backup is Valid' : 'Validation Failed'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedBackup && (
              <div className="p-3 rounded-lg bg-muted/30 border text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${getTypeBadge(selectedBackup.type)}`}
                  >
                    {selectedBackup.type}
                  </Badge>
                  <span className="font-medium">{formatBytes(selectedBackup.sizeBytes)}</span>
                  <span className="text-muted-foreground">
                    · {selectedBackup.fileCount ?? 0} files
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Created: {formatDate(selectedBackup.createdAt)}
                </p>
              </div>
            )}

            {validationResult.errors?.length > 0 && (
              <div className="space-y-1">
                {validationResult.errors.map((err: string, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400"
                  >
                    <ShieldX className="w-3 h-3 shrink-0" /> {err}
                  </div>
                ))}
              </div>
            )}

            {validationResult.warnings?.length > 0 && (
              <div className="space-y-1">
                {validationResult.warnings.map((warn: string, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" /> {warn}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={() => setRestoreStep('confirm')} disabled={!validationResult.valid}>
                <ChevronRight className="w-4 h-4 mr-1" /> Continue to Restore
              </Button>
              <Button variant="outline" onClick={() => setRestoreStep('select')}>
                Choose Different Backup
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {restoreStep === 'confirm' && selectedBackup && (
        <Card className="rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-base">Confirm Restore</CardTitle>
            </div>
            <CardDescription>
              This will replace the current database and files with the backup. A pre-restore backup
              will be created first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                <div className="text-sm text-rose-700 dark:text-rose-400">
                  <p className="font-medium">Warning: This action is destructive</p>
                  <p className="text-xs mt-1">
                    The current database will be replaced with the backup. All changes made after
                    the backup was created will be lost.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border text-sm space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${getTypeBadge(selectedBackup.type)}`}
                >
                  {selectedBackup.type}
                </Badge>
                <span className="font-medium">{formatBytes(selectedBackup.sizeBytes)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Backup ID: {selectedBackup.id} · Created: {formatDate(selectedBackup.createdAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                Files: {selectedBackup.fileCount ?? 'N/A'} · Status: {selectedBackup.status}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="destructive"
                size="lg"
                onClick={handleStartRestore}
                disabled={restoring}
              >
                {restoring ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-1" /> Start Restore
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setRestoreStep('select')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {restoreStep === 'result' && (
        <Card className="rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <CardTitle className="text-base">Restore Initiated</CardTitle>
            </div>
            <CardDescription>
              The restore process has started. The application may be in maintenance mode during the
              restore.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {restoreResult && (
              <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground space-y-1 font-mono">
                {Object.entries(restoreResult).map(([key, val]) => (
                  <p key={key}>
                    <span className="font-medium text-foreground">{key}:</span>{' '}
                    {val ? String(val).slice(0, 80) : 'null'}
                  </p>
                ))}
              </div>
            )}
            <Button onClick={() => setRestoreStep('select')}>Restore Another Backup</Button>
          </CardContent>
        </Card>
      )}

      {/* Restore History */}
      {restoreHistory.length > 0 && (
        <Card className="rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">Restore History</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Backup ID</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restoreHistory.slice(0, 10).map((job: any, i: number) => (
                  <TableRow key={job.id || i}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getStatusBadge(job.status)}`}
                      >
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {job.restoreFromBackupId?.slice(0, 12) || '—'}...
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(job.startedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(job.completedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-rose-500 max-w-[200px] truncate">
                      {job.errorMessage || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Storage Tab Content ────────────────────────────────────────────────

function StorageTab() {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/data-management/storage');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json.data);
      }
    } catch {
      toast.error('Failed to load storage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center py-16 text-muted-foreground">
        <HardDrive className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-sm">Could not load storage data</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
          <RefreshCw className="w-3 h-3 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  const totalUsed =
    data.databaseSizeBytes + data.uploadsSizeBytes + data.backupsSizeBytes + data.logsSizeBytes;
  const total = totalUsed + data.freeDiskBytes;

  const categories = [
    { label: 'Database', bytes: data.databaseSizeBytes, color: 'bg-blue-500', icon: Database },
    { label: 'Uploads', bytes: data.uploadsSizeBytes, color: 'bg-purple-500', icon: Upload },
    { label: 'Backups', bytes: data.backupsSizeBytes, color: 'bg-emerald-500', icon: Archive },
    { label: 'Logs', bytes: data.logsSizeBytes, color: 'bg-amber-500', icon: FileText },
    {
      label: 'Free Space',
      bytes: data.freeDiskBytes,
      color: 'bg-muted-foreground/20',
      icon: HardDrive,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <HardDrive className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Storage Overview</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Disk Usage Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatBytes(totalUsed)} used of {formatBytes(total)}
              </span>
              <span className="font-medium">
                {total > 0 ? `${((totalUsed / total) * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="h-4 w-full bg-muted rounded-full overflow-hidden flex">
              {categories.slice(0, 4).map((cat, i) => {
                const pct = getStoragePercent(cat.bytes, total);
                if (pct < 1) return null;
                return (
                  <div
                    key={cat.label}
                    className={`${cat.color} h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
                    style={{ width: `${pct}%` }}
                    title={`${cat.label}: ${formatBytes(cat.bytes)} (${pct}%)`}
                  />
                );
              })}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => {
              const pct = getStoragePercent(cat.bytes, total);
              const CatIcon = cat.icon;
              return (
                <div key={cat.label} className="p-4 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`p-2 rounded-lg ${cat.color.replace('bg-', 'bg-').replace('bg-muted-foreground/20', 'bg-muted')}/10`}
                    >
                      <CatIcon
                        className={`w-4 h-4 ${
                          cat.color === 'bg-muted-foreground/20'
                            ? 'text-muted-foreground'
                            : cat.color.replace('bg-', 'text-').replace('/20', '')
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{cat.label}</p>
                      <p className="text-xs text-muted-foreground">{pct}% of total</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold">{formatBytes(cat.bytes)}</p>
                  <Progress value={pct} className="h-1.5 mt-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Largest File Categories */}
      {data.largestFileCategories.length > 0 && (
        <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">Largest File Categories</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.largestFileCategories.map((cat, i) => {
                const pct = getStoragePercent(cat.sizeBytes, totalUsed);
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{cat.category}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(cat.sizeBytes)}
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5 mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-muted">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-base">Actions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Backup Logs Tab ───────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  actorId: string;
  actorType: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

function BackupLogsTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      params.set('entity', 'BackupJob,BackupSchedule');
      if (searchQuery) params.set('q', searchQuery);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (actionFilter) params.set('actionPrefix', actionFilter);
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setLogs(json.data?.logs || json.data || []);
          setTotalPages(json.data?.pagination?.totalPages || 1);
          setTotal(json.data?.pagination?.total || 0);
        }
      }
    } catch {
      toast.error('Failed to load backup logs');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, dateFrom, dateTo, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actionLabels: Record<string, string> = {
    'backup.created': 'Backup Created',
    'backup.failed': 'Backup Failed',
    'backup.downloaded': 'Backup Downloaded',
    'backup.schedule_updated': 'Schedule Updated',
    'backup.schedule_viewed': 'Schedule Viewed',
    'backup.schedule_disabled': 'Schedule Disabled',
    'backup.schedule_tested': 'Schedule Tested',
    'backup.scheduled_started': 'Scheduled Backup Started',
    'backup.scheduled_completed': 'Scheduled Backup Completed',
    'backup.scheduled_failed': 'Scheduled Backup Failed',
    'backup.retention_applied': 'Retention Applied',
    'backup.deleted': 'Backup Deleted',
    'restore.requested': 'Restore Requested',
    'restore.validated': 'Restore Validated',
    'restore.started': 'Restore Started',
    'restore.completed': 'Restore Completed',
    'restore.failed': 'Restore Failed',
  };

  const getActionBadge = (action: string) => {
    if (action.includes('completed') || action.includes('created') || action.includes('tested'))
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    if (action.includes('failed') || action.includes('disabled'))
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    if (action.includes('started') || action.includes('viewed') || action.includes('updated'))
      return 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400';
    return 'border-muted-foreground/20 text-muted-foreground bg-muted/30';
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Action:</Label>
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">
                All actions
              </SelectItem>
              <SelectItem value="backup." className="text-xs">
                All Backup
              </SelectItem>
              <SelectItem value="restore." className="text-xs">
                All Restore
              </SelectItem>
              {Object.keys(actionLabels).map((a) => (
                <SelectItem key={a} value={a} className="text-xs">
                  {actionLabels[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">From:</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="h-8 w-36 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">To:</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="h-8 w-36 text-xs"
          />
        </div>
        {(searchQuery || dateFrom || dateTo || actionFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setSearchQuery('');
              setDateFrom('');
              setDateTo('');
              setActionFilter('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {Math.min(limit, total)} of {total} log entries
        </p>
      )}

      {/* Logs Table */}
      <Card className="rounded-xl shadow-sm overflow-x-auto">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <ListChecks className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No backup logs found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${getActionBadge(log.action)}`}
                      >
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{log.entity}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {log.entityId?.slice(0, 12) || '—'}...
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.actorType === 'SYSTEM' ? (
                        <Badge variant="outline" className="text-[8px] border-muted">
                          System
                        </Badge>
                      ) : (
                        log.actorId?.slice(0, 8) || '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                      {log.details ? (
                        <span
                          className="cursor-help border-b border-dotted border-muted-foreground/30"
                          title={(() => {
                            try {
                              const parsed = JSON.parse(log.details);
                              return JSON.stringify(parsed, null, 2);
                            } catch {
                              return log.details;
                            }
                          })()}
                        >
                          {(() => {
                            try {
                              const parsed = JSON.parse(log.details);
                              const entries = Object.entries(parsed);
                              return entries
                                .slice(0, 3)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(', ');
                            } catch {
                              return log.details.slice(0, 60);
                            }
                          })()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
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
      )}
    </div>
  );
}

// ── Disaster Recovery Tab ──────────────────────────────────────────────

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: string;
}

function DisasterRecoveryTab() {
  const [health, setHealth] = useState<Record<string, HealthCheckResult>>({});
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [verifyAllResult, setVerifyAllResult] = useState<{
    verified: number;
    failed: number;
    total: number;
  } | null>(null);

  const drChecklist = [
    {
      id: 'backup',
      label: 'Recent backup exists',
      check: () => overview?.stats?.lastBackupStatus === 'COMPLETED',
    },
    {
      id: 'schedule',
      label: 'Automatic backup is enabled',
      check: () => overview?.scheduleStatus?.enabled === true,
    },
    {
      id: 'disk',
      label: 'Sufficient free disk space',
      check: () => overview?.storage?.freeDiskBytes > 10 * 1024 * 1024 * 1024,
    }, // 10 GB
    { id: 'secondary', label: 'Secondary backup location configured', check: () => false }, // depends on schedule config
    { id: 'verify', label: 'Latest backup verified', check: () => false }, // requires separate verification check
    { id: 'maintenance', label: 'Maintenance mode not active', check: () => !maintenanceMode },
  ];

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, overviewRes] = await Promise.all([
        fetch('/api/admin/data-management/overview'),
        fetch('/api/health/db'),
      ]);

      let json: any = null;
      if (overviewRes.ok) {
        json = await overviewRes.json();
        setOverview(json.data);
        setMaintenanceMode(json.data?.maintenanceMode || false);
      }

      // Build health status
      const checks: Record<string, HealthCheckResult> = {};

      if (overviewRes.ok) {
        checks.database = { status: 'healthy', message: 'Database is reachable' };
      } else {
        checks.database = { status: 'unhealthy', message: 'Database is not reachable' };
      }

      try {
        const apiRes = await fetch('/api/health/worker');
        if (apiRes.ok) {
          checks.worker = { status: 'healthy', message: 'Worker process is running' };
        } else {
          checks.worker = { status: 'degraded', message: 'Worker process may not be running' };
        }
      } catch {
        checks.worker = { status: 'degraded', message: 'Could not check worker status' };
      }

      if (overviewRes.ok && json?.data?.storage) {
        const freeGb = json.data.storage.freeDiskBytes / (1024 * 1024 * 1024);
        if (freeGb > 10) {
          checks.disk = { status: 'healthy', message: `${freeGb.toFixed(1)} GB free disk space` };
        } else if (freeGb > 2) {
          checks.disk = {
            status: 'degraded',
            message: `Only ${freeGb.toFixed(1)} GB free — consider cleanup`,
          };
        } else {
          checks.disk = {
            status: 'unhealthy',
            message: `Critical: ${freeGb.toFixed(1)} GB free disk space`,
          };
        }
      }

      if (json?.data?.scheduleStatus?.enabled) {
        checks.schedule = { status: 'healthy', message: 'Automatic backups are enabled' };
      }

      if (json?.data?.stats?.lastBackupStatus === 'COMPLETED') {
        checks.backup = {
          status: 'healthy',
          message: `Last backup completed: ${formatDate(json.data.stats.lastBackupAt)}`,
        };
      } else if (json?.data?.stats?.lastBackupStatus === 'FAILED') {
        checks.backup = {
          status: 'unhealthy',
          message: 'Last backup failed — investigate immediately',
        };
      }

      setHealth(checks);
    } catch {
      toast.error('Failed to load health data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleToggleMaintenance = async () => {
    setTogglingMaintenance(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenanceMode: !maintenanceMode }),
      });
      if (res.ok) {
        setMaintenanceMode(!maintenanceMode);
        toast.success(maintenanceMode ? 'Maintenance mode disabled' : 'Maintenance mode enabled');
      } else {
        toast.error('Failed to toggle maintenance mode');
      }
    } catch {
      toast.error('Failed to toggle maintenance mode');
    } finally {
      setTogglingMaintenance(false);
    }
  };

  const handleVerifyAllBackups = async () => {
    setVerifyingAll(true);
    setVerifyAllResult(null);
    try {
      // Fetch all completed backups
      const res = await fetch('/api/admin/data-management/backups?limit=50&status=COMPLETED');
      if (!res.ok) {
        toast.error('Failed to fetch backups');
        return;
      }
      const json = await res.json();
      const backups = json.data?.jobs || [];

      if (backups.length === 0) {
        toast.info('No completed backups to verify');
        setVerifyAllResult({ verified: 0, failed: 0, total: 0 });
        return;
      }

      let verified = 0;
      let failed = 0;
      for (const backup of backups) {
        try {
          const verifyRes = await fetch(`/api/admin/data-management/backups/${backup.id}/verify`, {
            method: 'POST',
          });
          if (verifyRes.ok) verified++;
          else failed++;
        } catch {
          failed++;
        }
      }

      setVerifyAllResult({ verified, failed, total: backups.length });
      toast.success(`Verified ${verified}/${backups.length} backups`);
    } catch {
      toast.error('Verification process failed');
    } finally {
      setVerifyingAll(false);
    }
  };

  const checklistItems = drChecklist.map((item) => ({
    ...item,
    passed: item.check(),
  }));
  const passedCount = checklistItems.filter((i) => i.passed).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={maintenanceMode ? 'default' : 'outline'}
          onClick={handleToggleMaintenance}
          disabled={togglingMaintenance}
        >
          {togglingMaintenance ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : maintenanceMode ? (
            <Play className="w-4 h-4 mr-1" />
          ) : (
            <Ban className="w-4 h-4 mr-1" />
          )}
          {maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
        </Button>
        <Button variant="outline" onClick={handleVerifyAllBackups} disabled={verifyingAll}>
          {verifyingAll ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4 mr-1" />
          )}
          {verifyingAll ? 'Verifying...' : 'Verify All Backups'}
        </Button>
        <Button variant="outline" onClick={fetchHealth}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh Health
        </Button>
      </div>

      {/* Verify All Result */}
      {verifyAllResult && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
            verifyAllResult.failed === 0
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
          }`}
        >
          {verifyAllResult.failed === 0 ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>
            {verifyAllResult.failed === 0
              ? `All ${verifyAllResult.total} backups verified successfully`
              : `${verifyAllResult.verified}/${verifyAllResult.total} verified, ${verifyAllResult.failed} failed`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 text-xs"
            onClick={() => setVerifyAllResult(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* System Health */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">System Health</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(health).map(([key, check]) => (
              <div
                key={key}
                className={`p-3 rounded-lg border ${
                  check.status === 'healthy'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : check.status === 'degraded'
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-rose-500/5 border-rose-500/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {check.status === 'healthy' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : check.status === 'degraded' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <ShieldX className="w-3.5 h-3.5 text-rose-500" />
                  )}
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    {key}
                  </span>
                </div>
                <p className="text-sm font-medium">{check.message}</p>
              </div>
            ))}
            {Object.keys(health).length === 0 && (
              <div className="col-span-full flex flex-col items-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No health checks available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* DR Checklist */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <ClipboardCheck className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base">Disaster Recovery Checklist</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {passedCount}/{checklistItems.length} passed
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checklistItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  item.passed
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-muted/30 border-border/50'
                }`}
              >
                {item.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                )}
                <div className="flex-1">
                  <span
                    className={`text-sm ${item.passed ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}
                  >
                    {item.label}
                  </span>
                </div>
                {item.passed && (
                  <Badge className="text-[8px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    ✓ Passed
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-card rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-base">Emergency Actions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
              <p className="text-sm font-medium mb-1">Emergency Backup</p>
              <p className="text-xs text-muted-foreground mb-2">
                Create an immediate backup before making critical changes
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/admin/data-management/backups', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'MANUAL' }),
                    });
                    if (res.ok) toast.success('Emergency backup started');
                    else toast.error('Failed to start backup');
                  } catch {
                    toast.error('Failed to start backup');
                  }
                }}
              >
                <Play className="w-3 h-3 mr-1" /> Start Emergency Backup
              </Button>
            </div>
            <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
              <p className="text-sm font-medium mb-1">Check Disk Space</p>
              <p className="text-xs text-muted-foreground mb-2">
                Check current disk usage and free space across all storage
              </p>
              <Button size="sm" variant="outline" onClick={fetchHealth}>
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh Health
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Mode Notice */}
      {maintenanceMode && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Maintenance mode is <strong>enabled</strong>. Automatic backups are paused and restore
            operations may be active.
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────

export default function DataManagementScreen() {
  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Management</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Backup, restore, and manage data for your Voltium instance
          </p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto sm:h-10">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              <Server className="w-4 h-4 mr-1.5 hidden sm:inline" /> Overview
            </TabsTrigger>
            <TabsTrigger value="backups" className="text-xs sm:text-sm">
              <Archive className="w-4 h-4 mr-1.5 hidden sm:inline" /> Backups
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs sm:text-sm">
              <Calendar className="w-4 h-4 mr-1.5 hidden sm:inline" /> Schedule
            </TabsTrigger>
            <TabsTrigger value="restore" className="text-xs sm:text-sm">
              <RotateCcw className="w-4 h-4 mr-1.5 hidden sm:inline" /> Restore
            </TabsTrigger>
            <TabsTrigger value="storage" className="text-xs sm:text-sm">
              <HardDrive className="w-4 h-4 mr-1.5 hidden sm:inline" /> Storage
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs sm:text-sm">
              <ListChecks className="w-4 h-4 mr-1.5 hidden sm:inline" /> Logs
            </TabsTrigger>
            <TabsTrigger value="disaster-recovery" className="text-xs sm:text-sm">
              <Shield className="w-4 h-4 mr-1.5 hidden sm:inline" /> DR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="backups" className="mt-6">
            <BackupsTab />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <ScheduleTab />
          </TabsContent>

          <TabsContent value="restore" className="mt-6">
            <RestoreTab />
          </TabsContent>

          <TabsContent value="storage" className="mt-6">
            <StorageTab />
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <BackupLogsTab />
          </TabsContent>

          <TabsContent value="disaster-recovery" className="mt-6">
            <DisasterRecoveryTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminErrorBoundary>
  );
}

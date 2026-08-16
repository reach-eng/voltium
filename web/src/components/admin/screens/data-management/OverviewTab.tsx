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
import { AdminErrorBoundary } from '../../error-boundary';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';

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
  return formatDateTimeDDMMYYYY(dateStr);
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


export function OverviewTab() {
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
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
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


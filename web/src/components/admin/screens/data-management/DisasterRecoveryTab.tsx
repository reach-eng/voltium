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



export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: string;
}

export function DisasterRecoveryTab() {
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


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



export interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  entity?: string;
  entityId?: string;
  actorType?: string;
  actorId?: string;
}

export function BackupLogsTab() {
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


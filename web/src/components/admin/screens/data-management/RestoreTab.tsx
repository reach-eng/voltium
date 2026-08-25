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
import { DestructiveConfirm } from '@/components/admin/DestructiveConfirm';
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
import { extractErrorMessage } from '@/lib/error-utils';
import { useCanRestore } from './use-destroy-permission';

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


export function RestoreTab() {
  // Phase 7G PR-138: gate destructive controls on the
  // `data_management_restore` permission. Defaulting to `false`
  // when the session is missing or still loading is intentional —
  // the safer default is to show the controls in their disabled
  // state rather than the click-through state.
  const canRestore = useCanRestore();

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
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

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
        toast.error(extractErrorMessage(json, ''));
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
        toast.error(extractErrorMessage(json, ''));
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
      {/* Phase 7G PR-138: read-only banner when the admin lacks
          `data_management_restore`. The destructive controls below
          stay visible (so the user can still see the wizard and
          understand the flow) but every button is `disabled`. */}
      {!canRestore && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm"
          data-testid="restore-readonly-banner"
          role="status"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            You do not have the <code className="font-mono text-xs">data_management_restore</code>{' '}
            permission. Restore actions are disabled in read-only mode.
          </span>
        </div>
      )}

      {/* Step indicator */}
      <ol className="flex items-center gap-2 text-sm list-none p-0 m-0" aria-label="Restore wizard steps">
        {restoreSteps.map((step, i) => {
          const stepIndex = restoreSteps.indexOf(restoreStep);
          const isCurrent = restoreStep === step;
          const isCompleted = stepIndex > i;
          const stepLabel =
            step === 'select'
              ? 'Select Backup'
              : step === 'validate'
                ? 'Validate'
                : step === 'confirm'
                  ? 'Confirm'
                  : 'Restore';

          return (
            <li key={step} className="flex items-center gap-2" aria-current={isCurrent ? 'step' : undefined}>
              <div
                aria-label={`Step ${i + 1}: ${stepLabel}${isCurrent ? ' (current step)' : isCompleted ? ' (completed)' : ''}`}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs ${
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {stepLabel}
              </span>
              {i < 3 && <ChevronRight className="w-3 h-3 text-muted-foreground" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

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
              <Button
                onClick={handleValidate}
                disabled={!selectedId || validating || !canRestore}
                title={!canRestore ? 'You do not have the data_management_restore permission' : undefined}
              >
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
                onClick={() => setConfirmRestoreOpen(true)}
                disabled={restoring || !canRestore}
                title={!canRestore ? 'You do not have the data_management_restore permission' : undefined}
                data-testid="start-restore-btn"
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

            {selectedBackup && (
              <DestructiveConfirm
                open={confirmRestoreOpen}
                onOpenChange={setConfirmRestoreOpen}
                title="Confirm Database & System Restore"
                description={
                  <div className="space-y-1">
                    <p>
                      You are about to restore the system from backup{' '}
                      <span className="font-semibold text-foreground">{selectedBackup.id}</span>.
                    </p>
                    <p className="text-destructive font-medium">
                      All existing database records and application files will be overwritten.
                    </p>
                  </div>
                }
                expectedPhrase={selectedBackup.id.slice(0, 8)}
                confirmLabel="Execute Restore"
                loading={restoring}
                onConfirm={async () => {
                  setConfirmRestoreOpen(false);
                  await handleStartRestore();
                }}
              />
            )}
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


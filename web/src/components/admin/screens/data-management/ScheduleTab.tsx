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


export function ScheduleTab() {
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


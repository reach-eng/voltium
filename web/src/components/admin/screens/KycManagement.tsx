'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GuarantorManagement from './GuarantorManagement';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  CheckCircle2,
  XCircle,
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Eye,
  Download,
  VideoOff,
  Camera,
  Users,
  Undo2,
  Loader2,
  Keyboard,
} from 'lucide-react';
import { ExportButton } from '../export-button';
import { AdminErrorBoundary } from '../error-boundary';
import { logger } from '@/lib/logger';

// ── Media Preview with hover zoom ──────────────────────────────────────
const MediaPreview = ({
  src,
  label,
  type = 'image',
}: {
  src: string | null;
  label: string;
  type?: 'image' | 'video';
}) => {
  if (!src)
    return (
      <div className="aspect-video bg-muted/30 border border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground opacity-40">
        <Camera className="w-5 h-5 mb-2" />
        <span className="text-[10px] font-bold uppercase">{label} Missing</span>
      </div>
    );
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
        {label}
      </Label>
      <div className="aspect-video rounded-2xl border bg-black overflow-hidden relative group shadow-sm">
        {type === 'image' ? (
          <img
            src={src}
            alt={label}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <video src={src} controls className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl h-8 text-[10px] font-bold"
            onClick={() => window.open(src, '_blank')}
          >
            View Full
          </Button>
        </div>
      </div>
    </div>
  );
};

interface KycRider {
  id: string;
  riderId: string;
  phone: string;
  fullName: string | null;
  kycStatus: string;
  state: string;
  lifecycleStatus: string;
  profilePhoto: string | null;
  riderPhoto: string | null;
  aadhaarFront: string | null;
  aadhaarBack: string | null;
  aadhaarNumber: string | null;
  panCard: string | null;
  panNumber: string | null;
  signature: string | null;
  fatherName: string | null;
  motherName: string | null;
  dob: string | null;
  currentAddress: string | null;
  emergencyContact: string | null;
  teamLeader: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  guarantorName: string | null;
  guarantorStatus: string;
  guarantorRelation: string | null;
  guarantorPhone: string | null;
  guarantorDob: string | null;
  guarantorAadhaarFront: string | null;
  guarantorAadhaarBack: string | null;
  guarantorPan: string | null;
  guarantorVideo: string | null;
  guarantorSignature: string | null;
  guarantorFatherName: string | null;
  guarantorMotherName: string | null;
  guarantorAddress: string | null;
  guarantorPhoto: string | null;
  kycRejectionReason: string | null;
  pickupPhoto: string | null;
  pickupPhotoFront: string | null;
  pickupPhotoBack: string | null;
  pickupPhotoLeft: string | null;
  pickupPhotoRight: string | null;
  pickupPhotoWithVehicle: string | null;
  photoFront: string | null;
  photoBack: string | null;
  photoLeft: string | null;
  photoRight: string | null;
  photoSpeedometer: string | null;
  createdAt: string;
  submissionDate: string | null;
  sharedGuarantorWith: string[];
}

const kycDocuments = [
  { key: 'aadhaarFront' as const, label: 'Aadhaar Front' },
  { key: 'aadhaarBack' as const, label: 'Aadhaar Back' },
  { key: 'panCard' as const, label: 'PAN Card' },
  { key: 'signature' as const, label: 'Signature' },
];

function getCompletion(rider: KycRider): number {
  const total = kycDocuments.length;
  const completed = kycDocuments.filter((doc) => rider[doc.key]).length;
  return Math.round((completed / total) * 100);
}

function getKycBadge(status: string) {
  const styles: Record<string, string> = {
    APPROVED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    VERIFIED: 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
    PENDING: 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400',
    SUBMITTED: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
    REJECTED: 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400',
    INFO_REQUIRED: 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400',
  };
  return styles[status] || 'border-border text-muted-foreground bg-muted/30';
}

function KycManagementTab() {
  const [riders, setRiders] = useState<KycRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [selectedRider, setSelectedRider] = useState<KycRider | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    rider: KycRider;
    action: 'approve' | 'reject' | 'info_required';
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<{
    ids: string[];
    previousStatuses: Record<string, string>;
    action: string;
  } | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rowLoadingIds, setRowLoadingIds] = useState<Set<string>>(new Set());
  const componentRef = useRef<HTMLDivElement>(null);

  const fetchRiders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (tab === 'info_required') {
        params.set('kycStatus', 'INFO_REQUIRED');
      } else if (tab === 'pending') {
        params.append('kycStatus', 'PENDING');
        params.append('kycStatus', 'SUBMITTED');
      } else if (tab !== 'all') {
        params.set('kycStatus', tab.toUpperCase());
      }
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/admin/riders?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        // Handle paginated response: { data: { riders: [...] }, pagination: {...} }
        // or direct array: { data: [...] }
        const data = json.data?.riders || json.data || [];
        setRiders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      logger.error('Failed to fetch riders for KYC', { error: err });
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate]);

  useEffect(() => {
    fetchRiders();
  }, [fetchRiders]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (confirmAction) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        toggleSelectAll();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (selectedIds.size > 0 && !bulkLoading) {
          handleBulkAction('approve');
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        if (selectedIds.size > 0 && !bulkLoading) {
          handleBulkAction('reject');
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (lastAction && !bulkLoading) {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, bulkLoading, lastAction, confirmAction]);

  const filteredRiders = Array.isArray(riders) ? riders : [];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRiders.length && filteredRiders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRiders.map((r) => r.id)));
    }
  };

  async function handleKycAction() {
    if (!confirmAction) return;
    const { rider, action } = confirmAction;
    setRowLoadingIds((prev) => new Set([...prev, rider.id]));
    setActionLoading(true);
    const statusMap = { approve: 'APPROVED', reject: 'REJECTED', info_required: 'INFO_REQUIRED' };
    const previousStatus = rider.kycStatus;
    try {
      await fetch('/api/admin/riders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rider.id,
          kycStatus: statusMap[action],
          rejectionReason:
            action === 'reject'
              ? rejectionReason
              : action === 'info_required'
                ? rejectionReason
                : undefined,
        }),
      });
      setLastAction({
        ids: [rider.id],
        previousStatuses: { [rider.id]: previousStatus },
        action: statusMap[action],
      });
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      setConfirmAction(null);
      setRejectionReason('');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(rider.id);
        return next;
      });
      fetchRiders();
      if (selectedRider?.id === rider.id) {
        setSelectedRider({ ...rider, kycStatus: statusMap[action] });
      }
    } catch (err) {
      logger.error('Failed to update KYC', { error: err });
    } finally {
      setActionLoading(false);
      setRowLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(rider.id);
        return next;
      });
    }
  }

  async function handleUndo() {
    if (!lastAction) return;
    setBulkLoading(true);
    try {
      const promises = Object.entries(lastAction.previousStatuses).map(([id, status]) =>
        fetch('/api/admin/riders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, kycStatus: status }),
        })
      );
      await Promise.all(promises);
      setLastAction(null);
      setShowUndoToast(false);
      fetchRiders();
    } catch (err) {
      logger.error('Undo failed', { error: err });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkAction(action: 'approve' | 'reject' | 'info_required') {
    const statusMap = { approve: 'APPROVED', reject: 'REJECTED', info_required: 'INFO_REQUIRED' };
    const targets = filteredRiders.filter((r) => selectedIds.has(r.id));
    const targetIds = targets.map((r) => r.id);
    setRowLoadingIds((prev) => new Set([...prev, ...targetIds]));
    const previousStatuses: Record<string, string> = {};
    targets.forEach((r) => {
      previousStatuses[r.id] = r.kycStatus;
    });

    setBulkLoading(true);
    try {
      await fetch('/api/admin/riders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: targetIds,
          action: 'bulkKyc',
          value: statusMap[action],
        }),
      });
      setLastAction({
        ids: targetIds,
        previousStatuses,
        action: statusMap[action],
      });
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
      setSelectedIds(new Set());
      fetchRiders();
    } catch (err) {
      logger.error('Bulk KYC action failed', { error: err });
    } finally {
      setBulkLoading(false);
      setRowLoadingIds((prev) => {
        const next = new Set(prev);
        targetIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Keyboard className="w-3 h-3" />
            <span>Ctrl+A Select All · Ctrl+K Approve · Ctrl+R Reject · Ctrl+Z Undo</span>
          </div>
          <div className="flex items-center gap-3">
            {exportProgress !== null && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-xs text-primary">Exporting... {exportProgress}%</span>
                <Progress value={exportProgress} className="w-16 h-1" />
              </div>
            )}
            <ExportButton
              data={filteredRiders.map((k) => ({
                riderId: k.riderId,
                phone: k.phone,
                fullName: k.fullName,
                kycStatus: k.kycStatus,
                state: k.state,
                guarantorStatus: k.guarantorStatus,
                hasAadhaar: !!(k.aadhaarFront && k.aadhaarBack),
                hasPan: !!k.panCard,
                hasBank: !!k.accountNumber,
                hasSignature: !!k.signature,
                createdAt: k.createdAt,
              }))}
              filename="kyc"
              columns={[
                { key: 'riderId', label: 'Rider ID' },
                { key: 'phone', label: 'Phone' },
                { key: 'fullName', label: 'Name' },
                { key: 'kycStatus', label: 'KYC Status' },
                { key: 'state', label: 'State' },
                { key: 'guarantorStatus', label: 'Guarantor Status' },
                { key: 'hasAadhaar', label: 'Has Aadhaar' },
                { key: 'hasPan', label: 'Has PAN' },
                { key: 'hasBank', label: 'Has Bank/UPI' },
                { key: 'hasSignature', label: 'Has Signature' },
                { key: 'createdAt', label: 'Created At' },
              ]}
              onExportStart={() => setExportProgress(0)}
              onExportProgress={(p) => setExportProgress(p)}
              onExportComplete={() => setExportProgress(null)}
            />
          </div>
        </div>
        {/* Tab Filters */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="info_required">Needs Correction</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Date Range Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">From:</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">To:</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 w-40 text-xs"
            />
          </div>
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              Clear Filter
            </Button>
          )}
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
            <Button
              size="sm"
              onClick={() => handleBulkAction('approve')}
              disabled={bulkLoading}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
              title="Approve All (Ctrl+K)"
            >
              {bulkLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ShieldCheck className="w-3 h-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('info_required')}
              disabled={bulkLoading}
              className="h-8 text-xs border-orange-500/30 text-orange-600"
              title="Needs Correction"
            >
              {bulkLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ShieldAlert className="w-3 h-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction('reject')}
              disabled={bulkLoading}
              className="h-8 text-xs"
              title="Reject All (Ctrl+R)"
            >
              {bulkLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ShieldX className="w-3 h-3" />
              )}
            </Button>
            {lastAction && (
              <>
                <div className="w-px h-4 bg-border/50 mx-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUndo}
                  disabled={bulkLoading}
                  className="h-8 text-xs"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-3 h-3 mr-1" /> Undo
                </Button>
              </>
            )}
          </div>
        )}

        {/* Undo Toast */}
        {showUndoToast && lastAction && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-foreground text-background rounded-xl shadow-lg animate-in slide-in-from-bottom-2">
            <span className="text-sm">
              {lastAction.ids.length} rider(s) updated to {lastAction.action}
            </span>
            <Button size="sm" variant="secondary" onClick={handleUndo} className="h-7 text-xs">
              <Undo2 className="w-3 h-3 mr-1" /> Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowUndoToast(false)}
              className="h-7 w-7 p-0 text-background/60 hover:text-background"
            >
              <XCircle className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* KYC Table */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredRiders.length === 0 ? (
          <Card className="rounded-xl shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">No riders found for this filter</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl shadow-sm overflow-x-auto">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          filteredRiders.length > 0 && selectedIds.size === filteredRiders.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead>Guarantor</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>KYC Status</TableHead>
                    <TableHead>Aadhaar</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Signature</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead
                      className="text-right whitespace-nowrap"
                      style={{ minWidth: '280px' }}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRiders.map((rider) => {
                    const completion = getCompletion(rider);
                    const isRowLoading = rowLoadingIds.has(rider.id);
                    return (
                      <TableRow
                        key={rider.id}
                        className={selectedIds.has(rider.id) ? 'bg-primary/5' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(rider.id)}
                            onCheckedChange={() => toggleSelect(rider.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rider.fullName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {rider.riderId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rider.guarantorName ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className="border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400 text-[10px]"
                                >
                                  Yes
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {rider.guarantorName}
                              </span>
                              {rider.sharedGuarantorWith?.length > 0 && (
                                <Badge className="bg-amber-500 hover:bg-amber-600 border-none text-[8px] py-0 px-1 w-fit uppercase font-black">
                                  Shared ({rider.sharedGuarantorWith.length})
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{rider.phone}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${getKycBadge(rider.kycStatus)}`}
                          >
                            {rider.kycStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rider.aadhaarFront && rider.aadhaarBack ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </TableCell>
                        <TableCell>
                          {rider.panCard ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </TableCell>
                        <TableCell>
                          {rider.accountNumber ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </TableCell>
                        <TableCell>
                          {rider.signature ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {rider.submissionDate
                            ? new Date(rider.submissionDate).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={completion} className="h-2 w-16" />
                            <span className="text-xs font-medium">{completion}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap min-w-[280px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRider(rider)}
                              disabled={isRowLoading}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {rider.kycStatus === 'PENDING' ||
                            rider.kycStatus === 'SUBMITTED' ||
                            rider.kycStatus === 'INFO_REQUIRED' ? (
                              <>
                                <Button
                                  size="sm"
                                  className="text-xs bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => setConfirmAction({ rider, action: 'approve' })}
                                  title="Approve"
                                  disabled={isRowLoading}
                                >
                                  {isRowLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs border-orange-500/30 text-orange-600"
                                  onClick={() =>
                                    setConfirmAction({ rider, action: 'info_required' })
                                  }
                                  title="Needs Correction"
                                  disabled={isRowLoading}
                                >
                                  {isRowLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ShieldAlert className="w-3 h-3" />
                                  )}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => setConfirmAction({ rider, action: 'reject' })}
                                  title="Reject"
                                  disabled={isRowLoading}
                                >
                                  {isRowLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ShieldX className="w-3 h-3" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] text-muted-foreground/40 font-medium px-2">
                                  {rider.kycStatus === 'APPROVED' ? '✓' : '✗'}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* View Details Dialog */}
        <Dialog open={!!selectedRider} onOpenChange={() => setSelectedRider(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>KYC Documents - {selectedRider?.fullName}</DialogTitle>
              <DialogDescription>{selectedRider?.riderId}</DialogDescription>
            </DialogHeader>
            {selectedRider && (
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
                {/* Profile Header */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/20 shrink-0 bg-background">
                    {selectedRider.profilePhoto ? (
                      <img
                        src={selectedRider.profilePhoto}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground uppercase bg-muted">
                        {selectedRider.fullName?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedRider.fullName}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <p className="text-sm text-muted-foreground">{selectedRider.phone}</p>
                      {selectedRider.emergencyContact && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <span className="font-bold text-[10px] uppercase text-rose-500">
                            SOS:
                          </span>{' '}
                          {selectedRider.emergencyContact}
                        </p>
                      )}
                      {selectedRider.teamLeader && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <span className="font-bold text-[10px] uppercase text-blue-500">TL:</span>{' '}
                          {selectedRider.teamLeader}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rider Personal Details */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                  <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      Father's Name
                    </p>
                    <p className="text-sm font-medium">{selectedRider.fatherName || '—'}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      Mother's Name
                    </p>
                    <p className="text-sm font-medium">{selectedRider.motherName || '—'}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      Date of Birth
                    </p>
                    <p className="text-sm font-medium">{selectedRider.dob || '—'}</p>
                  </div>
                  <div className="col-span-2 bg-background/50 rounded-lg p-3 border border-border/30">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      Address
                    </p>
                    <p className="text-sm font-medium">{selectedRider.currentAddress || '—'}</p>
                  </div>
                </div>

                {/* Rejection Reason */}
                {selectedRider.kycRejectionReason &&
                  (selectedRider.kycStatus === 'REJECTED' ||
                    selectedRider.kycStatus === 'INFO_REQUIRED') && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 mb-4">
                      <p className="text-[10px] font-black uppercase text-rose-600 tracking-widest mb-1">
                        Rejection Reason
                      </p>
                      <p className="text-sm text-rose-700 dark:text-rose-400">
                        {selectedRider.kycRejectionReason}
                      </p>
                    </div>
                  )}

                {/* Quality Check */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Document Quality
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const docs = kycDocuments.map((d) => ({
                        key: d.key,
                        present: !!selectedRider[d.key as keyof KycRider],
                      }));
                      const present = docs.filter((d) => d.present).length;
                      const total = docs.length;
                      if (present === total)
                        return (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                            All Complete ({total}/{total})
                          </Badge>
                        );
                      if (present === 0)
                        return (
                          <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                            No Documents Uploaded (0/{total})
                          </Badge>
                        );
                      return (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                          Missing {total - present} of {total} docs
                        </Badge>
                      );
                    })()}
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {kycDocuments.map((doc) => {
                      const present = !!selectedRider[doc.key as keyof KycRider];
                      return (
                        <div
                          key={doc.key}
                          className={`text-[9px] font-bold uppercase px-1.5 py-1 rounded ${present ? 'bg-emerald-500/5 text-emerald-600' : 'bg-muted text-muted-foreground'}`}
                        >
                          {present ? '✓' : '✗'} {doc.label.split(' ')[0]}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-1 gap-4">
                  {kycDocuments.map((doc) => {
                    const imageUrl = selectedRider[doc.key as keyof KycRider] as string | null;

                    return (
                      <div key={doc.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {doc.label}
                          </label>
                          {imageUrl ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400 text-[10px]"
                            >
                              PRESENT
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400 text-[10px]"
                            >
                              MISSING
                            </Badge>
                          )}
                        </div>
                        <MediaPreview src={imageUrl} label={doc.label} />
                      </div>
                    );
                  })}
                </div>

                {/* Bank Details */}
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">
                    Bank Details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                        Bank Name
                      </p>
                      <p className="text-sm font-medium">{selectedRider.bankName || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                        Account Number
                      </p>
                      <p className="text-sm font-medium font-mono">
                        {selectedRider.accountNumber || '—'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">
                        IFSC Code
                      </p>
                      <p className="text-sm font-medium font-mono">
                        {selectedRider.ifscCode || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Guarantor Details */}
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Guarantor Verification
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                        Guarantor Info
                      </p>
                      <p className="text-sm font-medium">
                        {selectedRider.guarantorName || 'Not Linked'}
                      </p>
                      {selectedRider.guarantorPhone && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground font-mono">
                            {selectedRider.guarantorPhone}
                          </p>
                          {selectedRider.guarantorStatus === 'VERIFIED' ||
                          selectedRider.guarantorStatus === 'APPROVED' ||
                          selectedRider.guarantorStatus === 'SUBMITTED' ? (
                            <Badge
                              variant="outline"
                              className="text-[8px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 h-4 px-1.5"
                            >
                              Phone Verified
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[8px] bg-amber-500/10 text-amber-600 border-amber-500/20 h-4 px-1.5"
                            >
                              Unverified
                            </Badge>
                          )}
                        </div>
                      )}
                      {selectedRider.guarantorRelation && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedRider.guarantorRelation}
                        </p>
                      )}
                      {selectedRider.guarantorDob && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          DOB: {selectedRider.guarantorDob}
                        </p>
                      )}
                      {selectedRider.guarantorFatherName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Father: {selectedRider.guarantorFatherName}
                        </p>
                      )}
                      {selectedRider.guarantorMotherName && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Mother: {selectedRider.guarantorMotherName}
                        </p>
                      )}
                      {selectedRider.guarantorAddress && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Address: {selectedRider.guarantorAddress}
                        </p>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] mt-2 ${getKycBadge(selectedRider.guarantorStatus)}`}
                      >
                        {selectedRider.guarantorStatus}
                      </Badge>

                      {selectedRider.sharedGuarantorWith?.length > 0 && (
                        <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">
                            Shared Guarantor With
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {selectedRider.sharedGuarantorWith.map((name, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[8px] bg-white border-amber-200 text-amber-700"
                              >
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
                        Registration
                      </p>
                      <p className="text-sm font-medium">
                        {new Date(selectedRider.createdAt).toLocaleDateString(undefined, {
                          dateStyle: 'medium',
                        })}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[10px] mt-2 border-primary/20 text-primary bg-primary/5 dark:bg-primary/10 uppercase"
                      >
                        {selectedRider.lifecycleStatus}
                      </Badge>
                    </div>
                  </div>

                  {/* Guarantor Documents */}
                  {selectedRider.guarantorName && (
                    <div className="grid grid-cols-1 gap-4 pt-2">
                      {[
                        {
                          label: 'Guarantor Aadhaar Front',
                          url: selectedRider.guarantorAadhaarFront,
                        },
                        {
                          label: 'Guarantor Aadhaar Back',
                          url: selectedRider.guarantorAadhaarBack,
                        },
                        { label: 'Guarantor PAN', url: selectedRider.guarantorPan },
                        { label: 'Guarantor Signature', url: selectedRider.guarantorSignature },
                        { label: 'Guarantor Photo', url: selectedRider.guarantorPhoto },
                      ].map((gdoc) => (
                        <MediaPreview key={gdoc.label} src={gdoc.url} label={gdoc.label} />
                      ))}

                      {/* Video Verification */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Guarantor Video Verification
                        </label>
                        <div className="aspect-video w-full rounded-xl border bg-black overflow-hidden flex items-center justify-center relative shadow-inner">
                          {selectedRider.guarantorVideo ? (
                            <video
                              src={selectedRider.guarantorVideo}
                              controls
                              className="w-full h-full"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-white/40">
                              <VideoOff className="w-8 h-8" />
                              <span className="text-[10px] uppercase font-bold tracking-widest">
                                No Video Uploaded
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirm Action Dialog */}
        <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.action === 'approve'
                  ? 'Approve KYC'
                  : confirmAction?.action === 'info_required'
                    ? 'Request Correction'
                    : 'Reject KYC'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to{' '}
                {confirmAction?.action === 'info_required'
                  ? 'request corrections for'
                  : confirmAction?.action}{' '}
                the KYC verification for <strong>{confirmAction?.rider.fullName}</strong>?
                {(confirmAction?.action === 'reject' ||
                  confirmAction?.action === 'info_required') && (
                  <textarea
                    className="w-full mt-3 p-2 border rounded-md text-sm"
                    placeholder={
                      confirmAction?.action === 'info_required'
                        ? 'What needs correction...'
                        : 'Rejection reason...'
                    }
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleKycAction}
                disabled={actionLoading}
                className={
                  confirmAction?.action === 'reject'
                    ? 'bg-destructive text-destructive-foreground'
                    : confirmAction?.action === 'info_required'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : ''
                }
              >
                {actionLoading
                  ? 'Processing...'
                  : confirmAction?.action === 'approve'
                    ? 'Approve'
                    : confirmAction?.action === 'info_required'
                      ? 'Request Correction'
                      : 'Reject'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminErrorBoundary>
  );
}

export default function KycManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Onboarding / KYC</h2>
        <p className="text-muted-foreground text-sm">Review and approve rider KYC documents and guarantor submissions.</p>
      </div>
      <Tabs defaultValue="kyc" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="kyc" className="text-xs px-5 font-semibold">KYC Review</TabsTrigger>
          <TabsTrigger value="guarantors" className="text-xs px-5 font-semibold">Guarantors</TabsTrigger>
        </TabsList>
        <TabsContent value="kyc"><KycManagementTab /></TabsContent>
        <TabsContent value="guarantors"><GuarantorManagement /></TabsContent>
      </Tabs>
    </div>
  );
}

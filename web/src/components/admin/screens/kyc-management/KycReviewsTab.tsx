import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs } from '@/components/ui/tabs';
import { AdminErrorBoundary } from '../../error-boundary';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Download, Search, Info, RotateCcw, ChevronRight, Eye, Loader2, ShieldAlert, ShieldX, Keyboard, Undo2, Shield } from 'lucide-react';
import { ExportButton } from '../../export-button';
import { logger } from '@/lib/logger';
import { KycReviewModal } from './KycReviewModal';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';

// We just copy the KycRider and helpers since they're needed here too
export interface KycRider {
  id: string;
  riderId: string;
  phone: string;
  fullName: string | null;
  kycStatus: string;
  guarantorName: string | null;
  guarantorStatus: string;
  createdAt: string;
  submissionDate: string | null;
  sharedGuarantorWith: string[];
  [key: string]: any;
}

export const kycDocuments = [
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

export function KycReviewsTab() {
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
                            ? formatDateTimeDDMMYYYY(rider.submissionDate)
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
        <KycReviewModal 
  selectedRider={selectedRider}
  setSelectedRider={setSelectedRider}
  confirmAction={confirmAction}
  setConfirmAction={setConfirmAction}
  actionLoading={actionLoading}
  handleKycAction={handleKycAction}
  rejectionReason={rejectionReason}
  setRejectionReason={setRejectionReason}
  getKycBadge={getKycBadge}
/>

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

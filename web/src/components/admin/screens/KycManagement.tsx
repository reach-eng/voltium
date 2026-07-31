'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AdminErrorBoundary } from '../error-boundary';
import { ExportButton } from '../export-button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Keyboard, Loader2, Shield } from 'lucide-react';
import { useKycManagement } from './kyc-management/useKycManagement';
import { KycFilters } from './kyc-management/KycFilters';
import { KycRow } from './kyc-management/KycRow';
import { KycBulkActionBar } from './kyc-management/KycBulkActionBar';
import { KycConfirmDialog } from './kyc-management/KycConfirmDialog';
import { KycDetailsDialog } from './kyc-management/KycDetailsDialog';

/**
 * R3.7m split — KYC management shell.
 *
 * Pre-split: 14.9 KB / 432 lines with 13 useState + 3 fetch + 3
 * handlers + keyboard + 12-col table inline.
 * Post-split: thin orchestrator that wires the data hook and the
 * 6 subcomponents (filters, bulk bar, rows, confirm dialog, details
 * dialog). All state + network logic lives in `useKycManagement`
 * (9.2 KB).
 */
function KycManagementTab() {
  const k = useKycManagement();
  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Keyboard className="w-3 h-3" />
            <span>Ctrl+A Select All · Ctrl+K Approve · Ctrl+R Reject · Ctrl+Z Undo</span>
          </div>
          <div className="flex items-center gap-3">
            {k.exportProgress !== null && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-lg">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-xs text-primary">Exporting... {k.exportProgress}%</span>
                <Progress value={k.exportProgress} className="w-16 h-1" />
              </div>
            )}
            <ExportButton
              data={k.filteredRiders.map((r) => ({
                riderId: r.riderId,
                phone: r.phone,
                fullName: r.fullName,
                kycStatus: r.kycStatus,
                state: r.state,
                guarantorStatus: r.guarantorStatus,
                hasAadhaar: !!(r.aadhaarFront && r.aadhaarBack),
                hasPan: !!r.panCard,
                hasBank: !!r.accountNumber,
                hasSignature: !!r.signature,
                createdAt: r.createdAt,
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
              onExportStart={() => k.setExportProgress(0)}
              onExportProgress={(p) => k.setExportProgress(p)}
              onExportComplete={() => k.setExportProgress(null)}
            />
          </div>
        </div>

        <KycFilters
          tab={k.tab}
          onTabChange={(v) => k.setTab(v as typeof k.tab)}
          startDate={k.startDate}
          endDate={k.endDate}
          onStartDateChange={k.setStartDate}
          onEndDateChange={k.setEndDate}
        />

        <KycBulkActionBar
          selectedCount={k.selectedIds.size}
          bulkLoading={k.bulkLoading}
          lastAction={k.lastAction}
          showUndoToast={k.showUndoToast}
          onBulkAction={k.handleBulkAction}
          onUndo={k.handleUndo}
          onDismissUndo={() => k.setShowUndoToast(false)}
        />

        {k.loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : k.filteredRiders.length === 0 ? (
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
                          k.filteredRiders.length > 0 &&
                          k.selectedIds.size === k.filteredRiders.length
                        }
                        onCheckedChange={k.toggleSelectAll}
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
                    <TableHead>Date &amp; Time</TableHead>
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
                  {k.filteredRiders.map((rider) => (
                    <KycRow
                      key={rider.id}
                      rider={rider}
                      isSelected={k.selectedIds.has(rider.id)}
                      isRowLoading={k.rowLoadingIds.has(rider.id)}
                      onSelect={() => k.toggleSelect(rider.id)}
                      onView={() => k.setSelectedRider(rider)}
                      onAction={(action) => k.setConfirmAction({ rider, action })}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <KycDetailsDialog
          selectedRider={k.selectedRider}
          onClose={() => k.setSelectedRider(null)}
        />

        <KycConfirmDialog
          confirmAction={k.confirmAction}
          onClose={() => k.setConfirmAction(null)}
          onConfirm={k.handleKycAction}
          rejectionReason={k.rejectionReason}
          onRejectionReasonChange={k.setRejectionReason}
          actionLoading={k.actionLoading}
        />
      </div>
    </AdminErrorBoundary>
  );
}

export default function KycManagement() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Onboarding / KYC</h2>
        <p className="text-muted-foreground text-sm">
          Review and approve rider KYC documents and guarantor submissions.
        </p>
      </div>
      <Tabs defaultValue="kyc" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="kyc" className="text-xs px-5 font-semibold">
            KYC Review
          </TabsTrigger>
        </TabsList>
        <TabsContent value="kyc">
          <KycManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

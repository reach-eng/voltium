'use client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeftRight, Undo2 } from 'lucide-react';
import { AdminErrorBoundary } from '../error-boundary';
import { ExportButton } from '../export-button';
import WalletDepositManagement from './WalletDepositManagement';
import PaymentGatewayManagement from './PaymentGatewayManagement';
import { useTransactionManagement } from './transaction-management/useTransactionManagement';
import { TransactionFilters } from './transaction-management/TransactionFilters';
import { TransactionRow } from './transaction-management/TransactionRow';
import { BulkActionsBar } from './transaction-management/BulkActionsBar';
import { TransactionDetailsDialog } from './transaction-management/TransactionDetailsDialog';
import { ConfirmActionDialog } from './transaction-management/ConfirmActionDialog';
import { BulkRejectDialog } from './transaction-management/BulkRejectDialog';
import { DeductDialog } from './transaction-management/DeductDialog';
import { PaginationControls } from './transaction-management/PaginationControls';

/**
 * R3 split (TransactionManagement) — finance shell.
 *
 * Pre-split: 20.7 KB / 568 lines with 22 useState + 5 fetch handlers
 * + sort + 9 dialogs inline. Post-split: thin orchestrator that
 * wires the data hook and the 9 existing subcomponents in
 * `transaction-management/`. All state + network logic lives in
 * `useTransactionManagement` (13 KB).
 */
export default function TransactionManagement() {
  const t = useTransactionManagement();

  return (
    <AdminErrorBoundary>
      <div className="flex flex-col gap-1 mb-2">
        <h2 className="text-2xl font-bold tracking-tight">Finance</h2>
        <p className="text-muted-foreground text-sm">
          Manage payments, top-ups, wallet balances, and security deposits.
        </p>
      </div>
      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 h-10">
          <TabsTrigger value="transactions" className="text-xs px-5 font-semibold">
            Payments &amp; Top-ups
          </TabsTrigger>
          <TabsTrigger value="wallet" className="text-xs px-5 font-semibold">
            Wallet &amp; Deposits
          </TabsTrigger>
          <TabsTrigger value="gateways" className="text-xs px-5 font-semibold">
            Payment Gateway
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-0">
          <div className="space-y-6">
            <div className="flex justify-end">
              <ExportButton
                data={t.transactions.map((tx) => ({
                  id: tx.id,
                  riderName: tx.rider?.fullName || tx.rider?.name,
                  riderPhone: tx.rider?.phone,
                  type: tx.type,
                  amount: tx.amount,
                  purpose: tx.purpose,
                  method: tx.method,
                  status: tx.status,
                  reason: tx.reason,
                  createdAt: tx.createdAt,
                }))}
                filename="transactions"
                columns={[
                  { key: 'id', label: 'Transaction ID' },
                  { key: 'riderName', label: 'Rider Name' },
                  { key: 'riderPhone', label: 'Rider Phone' },
                  { key: 'type', label: 'Type' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'purpose', label: 'Purpose' },
                  { key: 'method', label: 'Method' },
                  { key: 'status', label: 'Status' },
                  { key: 'reason', label: 'Reason' },
                  { key: 'createdAt', label: 'Date' },
                ]}
              />
              <Button
                onClick={() => t.setDeductDialog(true)}
                size="default"
                className="h-11 px-5 rounded-xl"
              >
                Deduct from Wallet
              </Button>
            </div>

            <TransactionFilters
              tab={t.tab}
              onTabChange={(v) => t.setTab(v as typeof t.tab)}
              search={t.search}
              onSearchChange={t.setSearch}
              startDate={t.startDate}
              onStartDateChange={t.setStartDate}
              endDate={t.endDate}
              onEndDateChange={t.setEndDate}
            />

            <Card className="rounded-xl shadow-sm overflow-hidden border border-border/50">
              <CardContent className="p-0">
                {t.loading ? (
                  <div className="p-6 space-y-3">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : t.sorted.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ArrowLeftRight className="w-12 h-12 mb-3 opacity-40" />
                    <p className="text-sm">No transactions found</p>
                  </div>
                ) : (
                  <>
                    <BulkActionsBar
                      selectedCount={t.selectedIds.size}
                      bulkLoading={t.bulkLoading}
                      onApprove={() => t.handleBulkAction('approve')}
                      onReject={() => t.setBulkRejectDialog(true)}
                      onExport={t.handleExportSelected}
                      onClear={() => t.setSelectedIds(new Set())}
                      hasLastAction={!!t.lastAction}
                      onUndo={t.handleUndo}
                    />
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={
                                t.sorted.filter((tx) => tx.status === 'PENDING').length > 0 &&
                                t.selectedIds.size ===
                                  t.sorted.filter((tx) => tx.status === 'PENDING').length
                              }
                              onCheckedChange={(checked) => {
                                const pending = t.sorted.filter((tx) => tx.status === 'PENDING');
                                t.setSelectedIds(
                                  checked ? new Set(pending.map((tx) => tx.id)) : new Set()
                                );
                              }}
                            />
                          </TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Rider</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => t.handleSort('amount')}
                          >
                            Amount{' '}
                            {t.sortKey === 'amount' ? (t.sortDir === 'asc' ? '↑' : '↓') : ''}
                          </TableHead>
                          <TableHead>Purpose</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Proof</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead
                            className="cursor-pointer select-none"
                            onClick={() => t.handleSort('createdAt')}
                          >
                            Date{' '}
                            {t.sortKey === 'createdAt' ? (t.sortDir === 'asc' ? '↑' : '↓') : ''}
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {t.sorted.map((tx) => (
                          <TransactionRow
                            key={tx.id}
                            tx={tx}
                            isSelected={t.selectedIds.has(tx.id)}
                            onToggleSelect={t.handleToggleSelect}
                            onViewDetails={t.setSelectedTx}
                            onSetConfirmAction={(tx, action) =>
                              t.setConfirmAction({ tx, action })
                            }
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>

            <PaginationControls
              page={t.page}
              totalPages={t.totalPages}
              total={t.total}
              onPageChange={t.setPage}
            />

            <TransactionDetailsDialog
              transaction={t.selectedTx}
              onClose={() => t.setSelectedTx(null)}
            />

            <ConfirmActionDialog
              confirmAction={t.confirmAction}
              onClose={t.closeConfirmDialog}
              onConfirm={t.handleAction}
              rejectionReason={t.rejectionReason}
              onRejectionReasonChange={t.setRejectionReason}
              creditWallet={t.creditWallet}
              onCreditWalletChange={t.setCreditWallet}
              walletCreditAmount={t.walletCreditAmount}
              onWalletCreditAmountChange={t.setWalletCreditAmount}
              actionLoading={t.actionLoading}
            />

            <BulkRejectDialog
              open={t.bulkRejectDialog}
              onOpenChange={t.setBulkRejectDialog}
              selectedCount={t.selectedIds.size}
              reason={t.bulkRejectReason}
              onReasonChange={t.setBulkRejectReason}
              onConfirm={(reason) => t.handleBulkAction('reject', reason)}
            />

            {t.showUndoToast && t.lastAction && (
              <div className="fixed bottom-6 right-6 z-50 bg-foreground text-background px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-2">
                <span className="text-sm">{t.lastAction.ids.length} transaction(s) updated</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 hover:bg-background/20 text-background"
                  disabled={t.bulkLoading}
                  onClick={t.handleUndo}
                >
                  <Undo2 className="w-3 h-3 mr-1" /> Undo
                </Button>
              </div>
            )}

            <DeductDialog
              open={t.deductDialog}
              onOpenChange={t.setDeductDialog}
              riderId={t.deductRiderId}
              onRiderIdChange={t.setDeductRiderId}
              amount={t.deductAmount}
              onAmountChange={t.setDeductAmount}
              reason={t.deductReason}
              onReasonChange={t.setDeductReason}
              loading={t.deductLoading}
              onConfirm={t.handleDeduct}
            />
          </div>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6">
          <WalletDepositManagement />
        </TabsContent>

        <TabsContent value="gateways" className="space-y-6">
          <PaymentGatewayManagement />
        </TabsContent>
      </Tabs>
    </AdminErrorBoundary>
  );
}

'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import WalletDepositManagement from './WalletDepositManagement';
import PaymentGatewayManagement from './PaymentGatewayManagement';
import { AdminErrorBoundary } from '../error-boundary';
import {
  useTransactions,
  TransactionFiltersBar,
  TransactionTable,
  TransactionDetailDialog,
  ConfirmActionDialog,
  BulkRejectDialog,
  DeductWalletModal,
  UndoToast,
} from './transaction-management';

/**
 * TransactionManagement — Main coordinator screen shell.
 * Delegates state management to useTransactions() and layout rendering
 * to modular components under ./transaction-management/
 */
export default function TransactionManagement() {
  const txState = useTransactions();

  return (
    <AdminErrorBoundary>
      {/* Section Heading & Subtitle */}
      <div className="flex flex-col gap-1 mb-2">
        <h2 className="text-2xl font-bold tracking-tight">Finance</h2>
        <p className="text-muted-foreground text-sm">
          Manage payments, top-ups, wallet balances, security deposits, and payment gateways.
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
          <TabsTrigger value="payment-gateway" className="text-xs px-5 font-semibold">
            Payment Gateway
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-0">
          <div className="space-y-6">
            {/* Filters Bar & Action Triggers */}
            <TransactionFiltersBar
              tab={txState.tab}
              setTab={txState.setTab}
              search={txState.search}
              setSearch={txState.setSearch}
              startDate={txState.startDate}
              setStartDate={txState.setStartDate}
              endDate={txState.endDate}
              setEndDate={txState.setEndDate}
              transactions={txState.transactions}
              onDeductClick={() => txState.setDeductDialog(true)}
            />

            {/* Data Table */}
            <TransactionTable
              loading={txState.loading}
              sorted={txState.sorted}
              transactions={txState.transactions}
              selectedIds={txState.selectedIds}
              setSelectedIds={txState.setSelectedIds}
              sortKey={txState.sortKey}
              sortDir={txState.sortDir}
              handleSort={txState.handleSort}
              setSelectedTx={txState.setSelectedTx}
              setConfirmAction={txState.setConfirmAction}
              bulkLoading={txState.bulkLoading}
              handleBulkAction={txState.handleBulkAction}
              setBulkRejectDialog={txState.setBulkRejectDialog}
              lastAction={txState.lastAction}
              handleUndo={txState.handleUndo}
              page={txState.page}
              totalPages={txState.totalPages}
              total={txState.total}
              setPage={txState.setPage}
            />

            {/* Transaction Detail Dialog */}
            <TransactionDetailDialog
              selectedTx={txState.selectedTx}
              onClose={() => txState.setSelectedTx(null)}
            />

            {/* Action Confirmation Dialog */}
            <ConfirmActionDialog
              confirmAction={txState.confirmAction}
              onClose={() => {
                txState.setConfirmAction(null);
                txState.setCreditWallet(false);
                txState.setWalletCreditAmount(0);
              }}
              actionLoading={txState.actionLoading}
              handleAction={txState.handleAction}
              rejectionReason={txState.rejectionReason}
              setRejectionReason={txState.setRejectionReason}
              creditWallet={txState.creditWallet}
              setCreditWallet={txState.setCreditWallet}
              walletCreditAmount={txState.walletCreditAmount}
              setWalletCreditAmount={txState.setWalletCreditAmount}
            />

            {/* Bulk Reject Dialog */}
            <BulkRejectDialog
              open={txState.bulkRejectDialog}
              onClose={() => txState.setBulkRejectDialog(false)}
              bulkLoading={txState.bulkLoading}
              bulkRejectReason={txState.bulkRejectReason}
              setBulkRejectReason={txState.setBulkRejectReason}
              onConfirm={() => {
                txState.handleBulkAction('reject', txState.bulkRejectReason);
                txState.setBulkRejectDialog(false);
                txState.setBulkRejectReason('');
              }}
            />

            {/* Deduct Wallet Modal */}
            <DeductWalletModal
              open={txState.deductDialog}
              onClose={() => txState.setDeductDialog(false)}
              deductRiderId={txState.deductRiderId}
              setDeductRiderId={txState.setDeductRiderId}
              deductAmount={txState.deductAmount}
              setDeductAmount={txState.setDeductAmount}
              deductReason={txState.deductReason}
              setDeductReason={txState.setDeductReason}
              deductLoading={txState.deductLoading}
              onDeduct={txState.handleDeduct}
            />

            {/* Floating Undo Toast */}
            <UndoToast
              show={txState.showUndoToast}
              onUndo={txState.handleUndo}
              onClose={() => txState.setShowUndoToast(false)}
              bulkLoading={txState.bulkLoading}
            />
          </div>
        </TabsContent>

        <TabsContent value="wallet">
          <WalletDepositManagement />
        </TabsContent>

        <TabsContent value="payment-gateway">
          <PaymentGatewayManagement />
        </TabsContent>
      </Tabs>
    </AdminErrorBoundary>
  );
}
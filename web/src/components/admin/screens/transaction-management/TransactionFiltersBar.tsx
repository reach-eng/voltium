'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { ExportButton } from '../../export-button';
import type { Transaction } from './types';

interface TransactionFiltersBarProps {
  tab: string;
  setTab: (tab: string) => void;
  search: string;
  setSearch: (search: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  transactions: Transaction[];
  onDeductClick: () => void;
}

export function TransactionFiltersBar({
  tab,
  setTab,
  search,
  setSearch,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  transactions,
  onDeductClick,
}: TransactionFiltersBarProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButton
          data={transactions.map((tx) => ({
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
          onClick={onDeductClick}
          size="default"
          className="h-11 px-5 rounded-xl ml-2"
        >
          Deduct from Wallet
        </Button>
      </div>

      {/* Tab Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-muted/30 p-1">
            <TabsTrigger value="all" className="h-10 px-4 text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="pending" className="h-10 px-4 text-xs">
              Pending
            </TabsTrigger>
            <TabsTrigger value="SECURITY_DEPOSIT" className="h-10 px-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Deposits
            </TabsTrigger>
            <TabsTrigger value="TOP_UP" className="h-10 px-4 text-xs">
              Top-ups
            </TabsTrigger>
            <TabsTrigger value="DEBIT" className="h-10 px-4 text-xs">
              Deductions
            </TabsTrigger>
            <TabsTrigger value="approved" className="h-10 px-4 text-xs">
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="h-10 px-4 text-xs">
              Rejected
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search rider or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base"
            />
          </div>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-11 w-40 text-sm rounded-xl"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-11 w-40 text-sm rounded-xl"
          />
          {(search || startDate || endDate) && (
            <Button
              variant="ghost"
              size="default"
              className="h-11 text-sm text-muted-foreground"
              onClick={() => {
                setSearch('');
                setStartDate('');
                setEndDate('');
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

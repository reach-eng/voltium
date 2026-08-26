'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Keyboard, Loader2 } from 'lucide-react';
import { ExportButton } from '@/components/admin/export-button';
import type { KycRider } from './types';

export interface KycFiltersBarProps {
  tab: string;
  setTab: (tab: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  filteredRiders: KycRider[];
  exportProgress: number | null;
  setExportProgress: (p: number | null) => void;
}

export function KycFiltersBar({
  tab,
  setTab,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  filteredRiders,
  exportProgress,
  setExportProgress,
}: KycFiltersBarProps) {
  return (
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
    </div>
  );
}

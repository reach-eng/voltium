'use client';

import { Loader2, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExportButton } from '../../export-button';
import { STATE_FILTERS, KYC_FILTERS, type Rider } from './types';

interface RiderFiltersBarProps {
  search: string;
  searching: boolean;
  stateFilter: string;
  kycFilter: string;
  riders: Rider[];
  onSearchChange: (v: string) => void;
  onStateFilterChange: (v: string) => void;
  onKycFilterChange: (v: string) => void;
  onAddRider: () => void;
  exportProgress: number | null;
  onExportStart: () => void;
  onExportProgress: (p: number) => void;
  onExportComplete: () => void;
}

/**
 * R3.7cc split — search input + state tab strip + KYC pill row +
 * Add Rider button + the full-export progress bar.
 */
export function RiderFiltersBar({
  search,
  searching,
  stateFilter,
  kycFilter,
  riders,
  onSearchChange,
  onStateFilterChange,
  onKycFilterChange,
  onAddRider,
  exportProgress,
  onExportStart,
  onExportProgress,
  onExportComplete,
}: RiderFiltersBarProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, rider ID, or phone..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-background border-muted-foreground/20 focus:border-primary text-base"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="default"
            className="rounded-xl h-11 px-5"
            onClick={onAddRider}
          >
            <UserPlus className="w-5 h-5 mr-2" /> Add Rider
          </Button>
          {exportProgress !== null && (
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-lg">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-xs text-primary">
                Exporting... {exportProgress}%
              </span>
            </div>
          )}
          <ExportButton
            data={riders.map((r) => ({
              riderId: r.riderId,
              name: r.fullName || 'Unknown',
              phone: r.phone,
              email: r.email,
              state: r.state,
              kycStatus: r.kycStatus,
              walletBalance: r.walletBalance,
              securityDeposit: r.securityDeposit,
              depositStatus: r.depositStatus,
              guarantorName: r.guarantorName,
              guarantorPhone: r.guarantorPhone,
              createdAt: r.createdAt,
            }))}
            filename="riders"
            columns={[
              { key: 'riderId', label: 'Rider ID' },
              { key: 'name', label: 'Name' },
              { key: 'phone', label: 'Phone' },
              { key: 'email', label: 'Email' },
              { key: 'state', label: 'State' },
              { key: 'kycStatus', label: 'KYC Status' },
              { key: 'walletBalance', label: 'Wallet Balance' },
              { key: 'securityDeposit', label: 'Security Deposit' },
              { key: 'depositStatus', label: 'Deposit Status' },
              { key: 'guarantorName', label: 'Guarantor Name' },
              { key: 'guarantorPhone', label: 'Guarantor Phone' },
              { key: 'createdAt', label: 'Created At' },
            ]}
            onExportStart={onExportStart}
            onExportProgress={onExportProgress}
            onExportComplete={onExportComplete}
          />
        </div>
      </div>

      <Tabs value={stateFilter} onValueChange={onStateFilterChange}>
        <TabsList className="bg-muted/30 p-1 rounded-xl">
          {STATE_FILTERS.map((s) => (
            <TabsTrigger
              key={s}
              value={s}
              className="rounded-lg text-xs font-bold uppercase tracking-tight h-8 px-4"
            >
              {s.replace('_', ' ')}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
          KYC:
        </span>
        {KYC_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => onKycFilterChange(s)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all ${
              kycFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Loader2,
  CheckCircle2,
  MapPin,
  Trash2,
  Download,
  Undo2,
  X,
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Vehicle } from './types';

const STATUS_FILTERS = ['ALL', 'AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'LOST', 'RETIRED'];

interface VehicleFiltersProps {
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  vehicles: Vehicle[];
  filtered: Vehicle[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  bulkLoading: boolean;
  setBulkStatusDialog: (open: boolean) => void;
  setBulkHubDialog: (open: boolean) => void;
  setBulkDeleteOpen: (open: boolean) => void;
  lastAction: { ids: string[]; previousStates: Record<string, any>; action: string } | null;
  handleUndo: () => void;
}

export function VehicleFilters({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  vehicles,
  filtered,
  selectedIds,
  setSelectedIds,
  bulkLoading,
  setBulkStatusDialog,
  setBulkHubDialog,
  setBulkDeleteOpen,
  lastAction,
  handleUndo,
}: VehicleFiltersProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by number, model, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base"
        />
      </div>
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="bg-muted/30 p-1 rounded-xl">
          {STATUS_FILTERS.map((s) => {
            const count =
              s === 'ALL' ? vehicles.length : vehicles.filter((v) => v.status === s).length;
            return (
              <TabsTrigger
                key={s}
                value={s}
                className="rounded-lg text-xs font-bold uppercase h-10 px-4"
              >
                {s.replace('_', ' ')} {count > 0 && `(${count})`}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-1 p-1 bg-primary/5 rounded-xl border border-primary/20 animate-in fade-in slide-in-from-right-2">
          <span className="text-xs px-2 font-medium text-primary">
            {selectedIds.size} selected
          </span>
          <Button
            variant="ghost"
            size="default"
            className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
            disabled={bulkLoading}
            onClick={() => setBulkStatusDialog(true)}
            title="Change Status"
          >
            {bulkLoading ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
            )}{' '}
            Status
          </Button>
          <Button
            variant="ghost"
            size="default"
            className="h-10 text-sm px-3 hover:bg-primary/10 hover:text-primary transition-all duration-200"
            disabled={bulkLoading}
            onClick={() => setBulkHubDialog(true)}
            title="Reassign Hub"
          >
            <MapPin className="w-4 h-4 mr-1.5" /> Hub
          </Button>
          <Button
            variant="ghost"
            size="default"
            className="h-10 text-sm px-3 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            disabled={bulkLoading}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete
          </Button>
          <Button
            variant="ghost"
            size="default"
            className="h-10 text-sm px-3 hover:bg-muted-foreground/10 transition-all duration-200"
            onClick={() => {
              const header = 'Vehicle ID,Number,Model,Status,Hub,Battery';
              const rows = vehicles
                .filter((v) => selectedIds.has(v.id))
                .map((v) =>
                  [
                    v.vehicleId,
                    v.vehicleNumber,
                    v.model,
                    v.status,
                    v.hub?.name || '',
                    v.batteryLevel,
                  ].join(',')
                );
              const csv = [header, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute(
                'download',
                `vehicles-${formatDateDDMMYYYY(new Date())}.csv`
              );
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-1.5" /> Export
          </Button>
          {lastAction && (
            <>
              <div className="w-px h-4 bg-border/50 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-muted/10 transition-all duration-200"
                disabled={bulkLoading}
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3 h-3 mr-1" /> Undo
              </Button>
            </>
          )}
          <div className="w-px h-4 bg-border/50 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-muted-foreground/10"
            onClick={() => setSelectedIds(new Set())}
            title="Clear selection"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

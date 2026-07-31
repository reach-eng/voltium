'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { IncidentFilter, IncidentTypeFilter, IncidentSeverityFilter } from './useIncidents';

interface Props {
  statusFilter: IncidentFilter;
  setStatusFilter: (v: IncidentFilter) => void;
  typeFilter: IncidentTypeFilter;
  setTypeFilter: (v: IncidentTypeFilter) => void;
  search: string;
  setSearch: (v: string) => void;
}

/**
 * R3.7b — filter bar (status dropdown, type dropdown, search input) for
 * the Incident Management screen. Extracted from IncidentManagementScreen.tsx
 * so the table component doesn't need to wire up 4 controlled inputs.
 */
export function IncidentFiltersBar({
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  search,
  setSearch,
}: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as IncidentFilter)}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Status</SelectItem>
          <SelectItem value="OPEN">Open</SelectItem>
          <SelectItem value="INVESTIGATING">Investigating</SelectItem>
          <SelectItem value="RESOLVED">Resolved</SelectItem>
          <SelectItem value="CLOSED">Closed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as IncidentTypeFilter)}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Types</SelectItem>
          {['ACCIDENT', 'DAMAGE', 'MAINTENANCE', 'THEFT', 'OTHER'].map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative flex-1 max-w-sm ml-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID, title, or rider..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-9 rounded-xl border-muted-foreground/20"
        />
      </div>
    </div>
  );
}

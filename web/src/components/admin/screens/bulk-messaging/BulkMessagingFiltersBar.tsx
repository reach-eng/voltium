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
import { STATUS_FILTERS } from './types';

interface BulkMessagingFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
}

/**
 * R3.7x split — search + status filter bar above the table.
 */
export function BulkMessagingFiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
}: BulkMessagingFiltersBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3">
      <div className="relative flex-1 w-full sm:w-auto">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search announcements..."
          className="pl-9 h-9 text-sm rounded-xl"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-[180px] h-9 rounded-xl">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

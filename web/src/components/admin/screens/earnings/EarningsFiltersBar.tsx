'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, CalendarDays } from 'lucide-react';
import { PLATFORMS } from './types';

interface EarningsFiltersBarProps {
  search: string;
  setSearch: (v: string) => void;
  platform: string;
  setPlatform: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}

/**
 * R3.7h split — Earnings filters bar.
 *
 * Search input (icon-prefixed) on the left, platform Select next, and
 * a start–end date range on the right. All four filters feed into the
 * GET query via the data hook; debounced search uses 500ms in the hook.
 */
export function EarningsFiltersBar({
  search,
  setSearch,
  platform,
  setPlatform,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: EarningsFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by rider name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl border-muted-foreground/20"
        />
      </div>
      <Select value={platform} onValueChange={setPlatform}>
        <SelectTrigger className="w-[140px] h-10 rounded-xl">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          {PLATFORMS.map((p) => (
            <SelectItem key={p} value={p}>
              {p === 'ALL' ? 'All Platforms' : p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="h-10 rounded-xl w-[150px]"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="h-10 rounded-xl w-[150px]"
        />
      </div>
    </div>
  );
}

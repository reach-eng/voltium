'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { REFERRAL_STATUS_FILTERS } from './types';

interface ReferralsFiltersBarProps {
  search: string;
  setSearch: (v: string) => void;
  filter: string;
  setFilter: (v: string) => void;
  onPageReset: () => void;
}

/**
 * R3.7o split — Referrals filters bar.
 *
 * Search input (icon-prefixed) on the left, status Select on the
 * right with a "Status:" label. Both reset the page to 1 on change.
 */
export function ReferralsFiltersBar({
  search,
  setSearch,
  filter,
  setFilter,
  onPageReset,
}: ReferralsFiltersBarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onPageReset();
          }}
          className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
        />
      </div>
      <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
        Status:
      </span>
      <Select
        value={filter}
        onValueChange={(v) => {
          setFilter(v);
          onPageReset();
        }}
      >
        <SelectTrigger className="w-[180px] rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REFERRAL_STATUS_FILTERS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

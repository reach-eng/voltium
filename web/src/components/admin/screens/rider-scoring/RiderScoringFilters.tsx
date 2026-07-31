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
import { RISK_LEVELS, type RiskLevel } from './types';

interface RiderScoringFiltersProps {
  riskFilter: RiskLevel | 'ALL';
  setRiskFilter: (v: RiskLevel | 'ALL') => void;
  search: string;
  setSearch: (v: string) => void;
}

/**
 * R3 split (RiderScoringScreen) — filters bar.
 *
 * Risk-level Select on the left, icon-prefixed search input on
 * the right. The search is debounced 500ms in the data hook.
 */
export function RiderScoringFilters({
  riskFilter,
  setRiskFilter,
  search,
  setSearch,
}: RiderScoringFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as RiskLevel | 'ALL')}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="All Risk Levels" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Risk Levels</SelectItem>
          {RISK_LEVELS.map((r) => (
            <SelectItem key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative flex-1 max-w-sm ml-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-9 rounded-xl border-muted-foreground/20"
        />
      </div>
    </div>
  );
}

'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ACTIVE_FILTERS } from './types';

interface TeamLeaderFiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  activeFilter: string;
  onActiveFilterChange: (v: string) => void;
  hubFilter?: string;
  onHubFilterChange?: (v: string) => void;
  hubs?: Array<{ id: string; name: string }>;
  onClear: () => void;
}

/**
 * R3.7aa split — search input + status filter + hub filter + clear button row.
 */
export function TeamLeaderFiltersBar({
  search,
  onSearchChange,
  activeFilter,
  onActiveFilterChange,
  hubFilter = 'ALL',
  onHubFilterChange,
  hubs = [],
  onClear,
}: TeamLeaderFiltersBarProps) {
  const hasFilter = !!search || activeFilter !== 'ALL' || hubFilter !== 'ALL';

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base"
        />
      </div>
      <Select
        value={activeFilter}
        onValueChange={(v) => {
          onActiveFilterChange(v);
        }}
      >
        <SelectTrigger className="h-11 w-40 rounded-xl border-muted-foreground/20 text-base">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          {ACTIVE_FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hubs.length > 0 && onHubFilterChange && (
        <Select
          value={hubFilter}
          onValueChange={(v) => {
            onHubFilterChange(v);
          }}
        >
          <SelectTrigger className="h-11 w-44 rounded-xl border-muted-foreground/20 text-base">
            <SelectValue placeholder="All Hubs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Hubs</SelectItem>
            {hubs.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {hasFilter && (
        <Button
          variant="ghost"
          size="default"
          className="h-11 text-sm text-muted-foreground px-4"
          onClick={onClear}
        >
          <X className="w-4 h-4 mr-1.5" /> Clear
        </Button>
      )}
    </div>
  );
}

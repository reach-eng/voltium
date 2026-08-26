'use client';

import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';

interface ShiftFiltersBarProps {
  search: string;
  setSearch: (v: string) => void;
  activeFilter: string;
  setActiveFilter: (v: string) => void;
}

/**
 * R3.7g split — Shifts filters bar.
 *
 * Search input (icon-prefixed) on the left, All / Active tabs on the
 * right. The search hits the API (debounced 500ms in the data hook),
 * the tabs filter by isActive=true.
 */
export function ShiftFiltersBar({
  search,
  setSearch,
  activeFilter,
  setActiveFilter,
}: ShiftFiltersBarProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 rounded-xl border-muted-foreground/20"
        />
      </div>
      <Tabs value={activeFilter} onValueChange={setActiveFilter}>
        <TabsList className="bg-muted/30 p-1 rounded-xl">
          <TabsTrigger value="ALL" className="rounded-lg text-xs font-bold uppercase h-8 px-3">
            All
          </TabsTrigger>
          <TabsTrigger
            value="ACTIVE"
            className="rounded-lg text-xs font-bold uppercase h-8 px-3"
          >
            Active
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

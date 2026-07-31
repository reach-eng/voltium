'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';

interface NotificationFiltersBarProps {
  search: string;
  setSearch: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  readFilter: string;
  setReadFilter: (v: string) => void;
  onClear: () => void;
  hasActiveFilter: boolean;
}

/**
 * R3.7f split — Notification filters bar.
 *
 * Search input (icon-prefixed), type select, read-status select, and a
 * Clear button that only appears when at least one filter is active.
 * Both selects reset the page to 1 on change.
 */
export function NotificationFiltersBar({
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  readFilter,
  setReadFilter,
  onClear,
  hasActiveFilter,
}: NotificationFiltersBarProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by rider or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
        />
      </div>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="h-9 w-40 rounded-xl border-muted-foreground/20 text-sm">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Types</SelectItem>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="payment">Payment</SelectItem>
          <SelectItem value="vehicle">Vehicle</SelectItem>
          <SelectItem value="alert">Alert</SelectItem>
        </SelectContent>
      </Select>
      <Select value={readFilter} onValueChange={setReadFilter}>
        <SelectTrigger className="h-9 w-40 rounded-xl border-muted-foreground/20 text-sm">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Status</SelectItem>
          <SelectItem value="UNREAD">Unread</SelectItem>
          <SelectItem value="READ">Read</SelectItem>
        </SelectContent>
      </Select>
      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={onClear}
        >
          <X className="w-3 h-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}

'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface TicketFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  priorityFilter: string;
  onPriorityChange: (value: string) => void;
}

export function TicketFilters({
  search,
  onSearchChange,
  priorityFilter,
  onPriorityChange,
}: TicketFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search ticket ID, subject, or rider..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base"
        />
      </div>
      <select
        value={priorityFilter}
        onChange={(e) => onPriorityChange(e.target.value)}
        className="h-11 px-3 rounded-xl border border-muted-foreground/20 bg-background text-base"
      >
        <option value="ALL">All Priorities</option>
        <option value="CRITICAL">Critical</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>
      {search || priorityFilter !== 'ALL' ? (
        <Button
          variant="ghost"
          size="default"
          className="h-11 text-sm px-4 text-muted-foreground"
          onClick={() => {
            onSearchChange('');
            onPriorityChange('ALL');
          }}
        >
          Clear
        </Button>
      ) : null}
    </div>
  );
}

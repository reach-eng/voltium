'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, X } from 'lucide-react';

interface AdminFiltersBarProps {
  search: string;
  setSearch: (v: string) => void;
  onPageReset: () => void;
  onAddClick: () => void;
}

/**
 * R3 split (AdminUserManagement) — search + add bar.
 *
 * Icon-prefixed search input on the left (with a clear button when
 * non-empty), "Add New Admin" button on the right. Both reset the
 * page to 1 on change.
 */
export function AdminFiltersBar({
  search,
  setSearch,
  onPageReset,
  onAddClick,
}: AdminFiltersBarProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onPageReset();
          }}
          className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base shadow-sm"
        />
        {search && (
          <button
            onClick={() => {
              setSearch('');
              onPageReset();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button onClick={onAddClick} className="rounded-xl h-11 px-5">
        <Plus className="h-5 w-5 mr-1.5" /> Add New Admin
      </Button>
    </div>
  );
}

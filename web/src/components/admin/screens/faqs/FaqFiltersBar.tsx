'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { FAQ_CATEGORIES } from './types';

interface FaqFiltersBarProps {
  search: string;
  setSearch: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  onPageReset: () => void;
}

/**
 * R3.7n split — FAQ filters bar.
 *
 * Search input (icon-prefixed) with a clear button on the right when
 * non-empty, plus a category select next to it. Both reset the page
 * to 1 on change.
 */
export function FaqFiltersBar({
  search,
  setSearch,
  category,
  setCategory,
  onPageReset,
}: FaqFiltersBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1 w-full max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search FAQs..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onPageReset();
            }}
            className="pl-10 h-10 rounded-xl border-muted-foreground/20 text-sm"
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
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v);
            onPageReset();
          }}
        >
          <SelectTrigger className="w-[160px] h-10 rounded-xl border-muted-foreground/20 text-sm">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {FAQ_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

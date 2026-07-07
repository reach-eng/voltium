'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';
import { logger } from '@/lib/logger';

export interface RiderOption {
  id: string;
  riderId: string;
  fullName: string;
}

interface RiderSelectorProps {
  value: string;
  onChange: (riderId: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RiderSelector({
  value,
  onChange,
  placeholder = 'Choose a rider',
  className = '',
}: RiderSelectorProps) {
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const fetchRiders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/riders?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setRiders(json.data.riders || []);
      }
    } catch (err) {
      logger.error('Failed to fetch riders for selector', { error: err });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchRiders();
  }, [fetchRiders]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl bg-muted/30 border-transparent focus:bg-background h-11"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-xl bg-muted/30 border-transparent h-11">
          <SelectValue placeholder={placeholder}>
            {value && riders.find((r) => r.id === value) && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>
                  {riders.find((r) => r.id === value)?.fullName} (
                  {riders.find((r) => r.id === value)?.riderId})
                </span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[250px] rounded-xl">
          {riders.length === 0 && !loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No riders found
            </div>
          ) : (
            riders.map((r) => (
              <SelectItem key={r.id} value={r.id} className="rounded-lg">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{r.fullName}</span>
                  <span className="text-muted-foreground text-xs">({r.riderId})</span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

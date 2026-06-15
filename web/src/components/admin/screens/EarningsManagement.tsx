'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface Earning {
  id: string;
  date: string;
  platform: string | null;
  amount: number;
  trips: number;
  distance: number | null;
  hoursOnline: number | null;
  notes: string | null;
  createdAt: string;
  rider: {
    id: string;
    riderId: string;
    fullName: string | null;
    phone: string;
  };
}

interface Summary {
  totalAmount: number;
  totalTrips: number;
  averageAmount: number;
}

const PLATFORMS = ['ALL', 'Zomato', 'Swiggy', 'Zepto', 'Other'];

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const PAGE_SIZE = 20;

export default function EarningsManagement() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalAmount: 0,
    totalTrips: 0,
    averageAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [platform, setPlatform] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const mountedRef = useRef(true);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (platform && platform !== 'ALL') params.set('platform', platform);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/admin/earnings?${params}`);
      if (!mountedRef.current) return;
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error?.message || 'Failed to load earnings');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setEarnings(json.data.earnings);
        setSummary(json.data.summary);
        setTotalPages(json.data.pagination.totalPages);
        setTotal(json.data.pagination.total);
      }
    } catch (err) {
      logger.error('Failed to fetch earnings', { error: err });
      toast.error('Failed to load earnings');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [debouncedSearch, platform, startDate, endDate, page]);

  useEffect(() => {
    mountedRef.current = true;
    fetchEarnings();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchEarnings]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, platform, startDate, endDate]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Rider Earnings</h2>
        <p className="text-muted-foreground text-sm mt-1">View rider self-reported earnings</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-emerald-500/5 border-emerald-500/10">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              Total Earnings
            </p>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {formatINR(summary.totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/10">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Total Trips
            </p>
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
              {summary.totalTrips.toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/10">
          <CardContent className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Avg per Entry
            </p>
            <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
              {formatINR(summary.averageAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
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

      {/* Table */}
      <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-muted/30">
                  <TableHead>Rider Name</TableHead>
                  <TableHead>Rider ID</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Trips</TableHead>
                  <TableHead>Distance (km)</TableHead>
                  <TableHead>Hours Online</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-64 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <IndianRupee className="w-8 h-8 opacity-20" />
                        <p>No earnings found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  earnings.map((e) => (
                    <TableRow key={e.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold">{e.rider.fullName || '—'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {e.rider.riderId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {e.platform || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        {formatINR(e.amount)}
                      </TableCell>
                      <TableCell>{e.trips}</TableCell>
                      <TableCell>{e.distance ?? '—'}</TableCell>
                      <TableCell>
                        {e.hoursOnline != null ? `${e.hoursOnline.toFixed(1)}h` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(e.date)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {e.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

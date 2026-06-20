'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Users,
  UserCheck,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface Referral {
  id: string;
  refereeId: string;
  refereeName: string;
  refereePhone: string;
  refereeState: string;
  referredAt: string;
  referrerName: string;
  referrerCode: string;
  earningForReferrer: number;
  refereePlanStatus?: string;
  refereeLifecycleStatus?: string;
  refereeRentalStatus?: string;
}

export default function ReferralManagement() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [referralBonus, setReferralBonus] = useState(500);
  const [summary, setSummary] = useState({ totalLeads: 0, activeRiders: 0, totalEarnings: 0 });

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchReferrals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filter !== 'all') params.set('status', filter);

      const res = await fetch(`/api/admin/referrals?${params}`);
      if (res.ok) {
        const json = await res.json();
        const inner = json.data || {};
        setReferrals(Array.isArray(inner.referrals) ? inner.referrals : []);
        setTotalPages(Math.ceil((inner.total || 0) / 20));
        if (inner.summary) setSummary(inner.summary);
        setTotalCount(inner.total || 0);
      } else {
        setReferrals([]);
      }
    } catch {
      setReferrals([]);
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filter]);

  const fetchReferralBonus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const json = await res.json();
        const settings = json.data || {};
        if (settings.referralBonus) setReferralBonus(Number(settings.referralBonus));
      }
    } catch {
      logger.error('Failed to fetch referral bonus');
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
    fetchReferralBonus();
  }, [fetchReferrals, fetchReferralBonus]);

  // Summary stats (now with earnings info)
  const stats = {
    total: summary.totalLeads,
    completed: summary.activeRiders,
    pending: summary.totalLeads - summary.activeRiders,
    totalEarningsInRupees: summary.totalEarnings,
  };

  const handleFilterChange = (v: string) => {
    setFilter(v);
    setPage(1);
  };
  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6 px-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Referral Intelligence</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Track conversions, payment updates, and earnings distribution.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card rounded-xl border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total Leads
                </p>
                <p className="text-2xl font-black mt-1">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card rounded-xl border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/5">
                <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Active Riders
                </p>
                <p className="text-2xl font-black mt-1">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card rounded-xl border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/5">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total Earnings
                </p>
                <p className="text-2xl font-black mt-1">₹{stats.totalEarningsInRupees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card rounded-xl border shadow-sm">
          <CardContent className="p-6 text-center flex flex-col items-center justify-center bg-primary/5 border-primary/20">
            <p className="text-[10px] font-black uppercase text-primary tracking-widest">
              Reward per rider
            </p>
            <p className="text-3xl font-black text-primary mt-1">₹{referralBonus}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
          />
        </div>
        <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          Status:
        </span>
        <Select value={filter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[180px] rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Referrals</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="KYC_SUBMITTED">KYC Submitted</SelectItem>
            <SelectItem value="ACTIVE">Verified Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Referrals Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Referrer (Code)
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Referred (Referee)
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Payment Status
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                KYC Status
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Earning (Referrer)
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                Action Date
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow key="loading">
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Analyzing referral
                  data...
                </TableCell>
              </TableRow>
            )}
            {!loading && referrals.length === 0 && (
              <TableRow key="empty">
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground font-medium"
                >
                  No records matching criteria.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              referrals.length > 0 &&
              referrals.map((r: Referral) => (
                <TableRow key={r.refereeId} className="hover:bg-muted/10 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                        {(r.referrerName || 'U')[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{r.referrerName || 'Unknown Referrer'}</p>
                        <p className="text-[10px] text-primary font-black font-mono tracking-widest">
                          {r.referrerCode || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-bold text-sm">{r.refereeName}</p>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {r.refereePhone}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className={`text-[11px] font-black uppercase tracking-tight ${r.refereeLifecycleStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'}`}
                      >
                        {r.refereeLifecycleStatus === 'ACTIVE' ? 'Paid & Active' : 'No Active Plan'}
                      </span>
                      {r.refereeRentalStatus && (
                        <span className="text-[9px] font-medium text-muted-foreground">
                          Rental: {r.refereeRentalStatus}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-black uppercase px-2 py-0.5 ${
                        r.refereeState === 'ACTIVE' || r.refereeState === 'POST_ACTIVE'
                          ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400'
                          : r.refereeState === 'SUSPENDED'
                            ? 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400'
                            : 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400'
                      }`}
                    >
                      {r.refereeState}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p
                      className={`text-sm font-black ${r.earningForReferrer > 0 ? 'text-emerald-600' : 'text-muted-foreground/40'}`}
                    >
                      {r.earningForReferrer > 0 ? `₹${r.earningForReferrer}` : '—'}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-[11px] font-medium">
                    {formatDate(r.referredAt)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-sm font-medium px-2">{page}</span>
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
    </div>
  );
}

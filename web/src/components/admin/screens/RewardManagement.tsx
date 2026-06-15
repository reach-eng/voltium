'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Award,
  Users,
  TrendingUp,
  Plus,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface Reward {
  id: string;
  riderName: string;
  riderId: string;
  title: string;
  points: number;
  createdAt: string;
}

interface Summary {
  totalPoints: number;
  uniqueRiders: number;
  thisMonthCount: number;
  thisMonthPoints: number;
}

interface RiderListItem {
  id: string;
  fullName: string;
  riderId: string;
}

export default function RewardManagement() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalPoints: 0,
    uniqueRiders: 0,
    thisMonthCount: 0,
    thisMonthPoints: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [riders, setRiders] = useState<RiderListItem[]>([]);
  const [riderSearch, setRiderSearch] = useState('');
  const [selectedRider, setSelectedRider] = useState('');
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchRewards = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/rewards?${params}`);
      if (!res.ok) {
        logger.error('Failed to fetch rewards', { status: res.status });
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        setRewards(json.data.rewards || []);
        setSummary(
          json.data.summary || {
            totalPoints: 0,
            uniqueRiders: 0,
            thisMonthCount: 0,
            thisMonthPoints: 0,
          }
        );
        setTotalPages(json.data.pagination?.totalPages || 1);
        setTotalCount(json.data.pagination?.total || 0);
      }
    } catch {
      toast.error('Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  const fetchRiders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (riderSearch) params.set('search', riderSearch);
      const res = await fetch(`/api/admin/riders?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setRiders(json.data.riders || []);
      }
    } catch {
      logger.error('Failed to fetch riders');
    }
  }, [riderSearch]);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  useEffect(() => {
    if (showForm) fetchRiders();
  }, [showForm, riderSearch, fetchRiders]);

  const handleAwardPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRider || !title || !points) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riderDbId: selectedRider,
          title,
          points: parseInt(points),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Points awarded successfully!');
        setTitle('');
        setPoints('');
        setSelectedRider('');
        setShowForm(false);
        fetchRewards();
      } else {
        toast.error(json.message || 'Failed to award points');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Rewards</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Track rider rewards and loyalty points
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary hover:bg-primary/90 text-white shadow-md transition-all active:scale-95"
        >
          {showForm ? (
            'Cancel'
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Award Points
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <Card className="bg-card rounded-xl border-primary/20 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <CardContent className="p-6">
            <form
              onSubmit={handleAwardPoints}
              className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
            >
              <div className="space-y-2">
                <Label>Rider Selection</Label>
                <Input
                  placeholder="Search riders..."
                  value={riderSearch}
                  onChange={(e) => setRiderSearch(e.target.value)}
                  className="bg-vf-surface"
                />
                <Select value={selectedRider} onValueChange={setSelectedRider}>
                  <SelectTrigger className="bg-vf-surface">
                    <SelectValue placeholder="Choose a rider" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {riders.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.fullName} ({r.riderId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Reason / Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Weekly Bonus"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-vf-surface"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  placeholder="Points amount"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="bg-vf-surface"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Award'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card rounded-xl border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Points Awarded</p>
                <div className="text-2xl font-bold mt-1">
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-sm px-2 py-0.5">
                    {summary.totalPoints.toLocaleString()} pts
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card rounded-xl border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-50">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique Riders Rewarded</p>
                <p className="text-2xl font-bold mt-1">{summary.uniqueRiders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card rounded-xl border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold mt-1">
                  {summary.thisMonthCount}{' '}
                  <span className="text-sm font-normal text-muted-foreground">rewards</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.thisMonthPoints.toLocaleString()} pts awarded
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search rewards or riders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9 rounded-xl border-muted-foreground/20 text-sm"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold">Rider Name</TableHead>
              <TableHead className="font-bold">Rider ID</TableHead>
              <TableHead className="font-bold">Title</TableHead>
              <TableHead className="font-bold">Points</TableHead>
              <TableHead className="font-bold">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading rewards...
                </TableCell>
              </TableRow>
            ) : rewards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No rewards found
                </TableCell>
              </TableRow>
            ) : (
              rewards.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">{r.riderName}</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground uppercase">
                    {r.riderId}
                  </TableCell>
                  <TableCell className="text-foreground">{r.title}</TableCell>
                  <TableCell>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                      +{r.points} pts
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Total: {totalCount} records</p>
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

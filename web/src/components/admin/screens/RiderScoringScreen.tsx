'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Target,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Award,
  User,
  Phone,
  MapPin,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

interface RiderScore {
  id: string;
  riderId: string;
  fullName: string | null;
  phone: string;
  pickupHub: string | null;
  compositeScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  paymentScore: number;
  complianceScore: number;
  engagementScore: number;
  vehicleScore: number;
  locationScore: number;
  lastCalculated: string;
}

function getRiskBadgeClass(risk: string) {
  switch (risk) {
    case 'LOW':
      return 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400';
    case 'MEDIUM':
      return 'border-amber-500/20 text-amber-600 bg-amber-500/5 dark:text-amber-400';
    case 'HIGH':
      return 'border-orange-500/20 text-orange-600 bg-orange-500/5 dark:text-orange-400';
    case 'CRITICAL':
      return 'border-rose-500/20 text-rose-600 bg-rose-500/5 dark:text-rose-400';
    default:
      return 'border-slate-500/20 text-slate-600 bg-slate-500/5 dark:text-slate-400';
  }
}

function getRiskIcon(risk: string) {
  switch (risk) {
    case 'LOW':
      return ShieldCheck;
    case 'MEDIUM':
      return Shield;
    case 'HIGH':
      return AlertTriangle;
    case 'CRITICAL':
      return ShieldAlert;
    default:
      return Shield;
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-rose-600';
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RiderScoringScreen() {
  const [scores, setScores] = useState<RiderScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [hubFilter, setHubFilter] = useState('ALL');
  const [hubs, setHubs] = useState<{ id: string; name: string }[]>([]);
  const [selectedScore, setSelectedScore] = useState<RiderScore | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('scores');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (riskFilter !== 'ALL') params.set('riskLevel', riskFilter);
      if (hubFilter !== 'ALL') params.set('hubId', hubFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/scores?${params}`);
      if (res.ok) {
        const json = await res.json();
        setScores(json.data?.scores || json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotal(json.pagination.total || 0);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch rider scores', { error });
      toast.error('Failed to load scores');
    } finally {
      setLoading(false);
    }
  }, [page, riskFilter, hubFilter, debouncedSearch]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  useEffect(() => {
    fetch('/api/admin/hubs')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setHubs(json.data || []);
      })
      .catch(() => logger.error('Failed to fetch hubs'));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [riskFilter, hubFilter, debouncedSearch]);

  async function handleRecalculateAll() {
    setRecalculating(true);
    try {
      const res = await fetch('/api/admin/scores/recalculate', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to recalculate scores');
        return;
      }
      toast.success('Scores recalculated');
      fetchScores();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRecalculating(false);
    }
  }

  const riskCounts = {
    LOW: scores.filter((s) => s.riskLevel === 'LOW').length,
    MEDIUM: scores.filter((s) => s.riskLevel === 'MEDIUM').length,
    HIGH: scores.filter((s) => s.riskLevel === 'HIGH').length,
    CRITICAL: scores.filter((s) => s.riskLevel === 'CRITICAL').length,
  };

  const leaderboard = [...scores].sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Rider Scoring
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Composite risk scores and performance metrics
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-full px-4 h-9"
          onClick={handleRecalculateAll}
          disabled={recalculating}
        >
          {recalculating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Recalculate All
        </Button>
      </div>

      {/* Risk Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Low Risk</p>
              <p className="text-2xl font-bold text-emerald-600">{riskCounts.LOW}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Medium Risk</p>
              <p className="text-2xl font-bold text-amber-600">{riskCounts.MEDIUM}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-orange-500/20 bg-orange-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">High Risk</p>
              <p className="text-2xl font-bold text-orange-600">{riskCounts.HIGH}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-rose-500/20 bg-rose-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-600" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">Critical</p>
              <p className="text-2xl font-bold text-rose-600">{riskCounts.CRITICAL}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All Risk Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Risk Levels</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9 rounded-xl border-muted-foreground/20"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/30 p-1 rounded-xl">
          <TabsTrigger
            value="scores"
            className="rounded-lg text-xs font-bold uppercase tracking-tight h-8 px-4"
          >
            Scores Table
          </TabsTrigger>
          <TabsTrigger
            value="leaderboard"
            className="rounded-lg text-xs font-bold uppercase tracking-tight h-8 px-4"
          >
            Leaderboard
          </TabsTrigger>
        </TabsList>

        {/* Scores Table */}
        <TabsContent value="scores" className="mt-4">
          <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="px-6">Rider</TableHead>
                      <TableHead>Composite Score</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Compliance</TableHead>
                      <TableHead>Engagement</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="pr-6 text-right">Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                          No scores available
                        </TableCell>
                      </TableRow>
                    ) : (
                      scores.map((s) => {
                        const RiskIcon = getRiskIcon(s.riskLevel);
                        return (
                          <TableRow
                            key={s.id}
                            className="hover:bg-muted/20 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedScore(s);
                              setDetailOpen(true);
                            }}
                          >
                            <TableCell className="font-medium px-6">
                              <div>
                                <p className="text-sm font-semibold">{s.fullName || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {s.riderId}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-lg font-bold ${getScoreColor(s.compositeScore)}`}
                              >
                                {s.compositeScore}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`rounded-md text-[10px] font-bold uppercase ${getRiskBadgeClass(s.riskLevel)}`}
                              >
                                <RiskIcon className="w-3 h-3 mr-1" />
                                {s.riskLevel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-sm font-semibold ${getScoreColor(s.paymentScore)}`}
                              >
                                {s.paymentScore}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-sm font-semibold ${getScoreColor(s.complianceScore)}`}
                              >
                                {s.complianceScore}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-sm font-semibold ${getScoreColor(s.engagementScore)}`}
                              >
                                {s.engagementScore}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-sm font-semibold ${getScoreColor(s.vehicleScore)}`}
                              >
                                {s.vehicleScore}
                              </span>
                            </TableCell>
                            <TableCell className="text-right pr-6 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(s.lastCalculated)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
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
                  Previous
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
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Leaderboard */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
            <CardHeader className="pb-3 px-6 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                Top 20 Riders by Composite Score
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="px-6 w-16">Rank</TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead>Composite Score</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Engagement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        No data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaderboard.map((s, idx) => {
                      const RiskIcon = getRiskIcon(s.riskLevel);
                      return (
                        <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="px-6">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                idx === 0
                                  ? 'bg-amber-500/20 text-amber-600'
                                  : idx === 1
                                    ? 'bg-slate-400/20 text-slate-600'
                                    : idx === 2
                                      ? 'bg-orange-500/20 text-orange-600'
                                      : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {idx + 1}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              <p className="text-sm font-semibold">{s.fullName || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground font-mono">{s.riderId}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-lg font-bold ${getScoreColor(s.compositeScore)}`}
                            >
                              {s.compositeScore}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`rounded-md text-[10px] font-bold uppercase ${getRiskBadgeClass(s.riskLevel)}`}
                            >
                              <RiskIcon className="w-3 h-3 mr-1" />
                              {s.riskLevel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-sm font-semibold ${getScoreColor(s.paymentScore)}`}
                            >
                              {s.paymentScore}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-sm font-semibold ${getScoreColor(s.complianceScore)}`}
                            >
                              {s.complianceScore}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-sm font-semibold ${getScoreColor(s.engagementScore)}`}
                            >
                              {s.engagementScore}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Score Breakdown Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Score Breakdown
            </DialogTitle>
          </DialogHeader>
          {selectedScore &&
            (() => {
              const RiskIcon = getRiskIcon(selectedScore.riskLevel);
              const subScores = [
                { label: 'Payment History', score: selectedScore.paymentScore, icon: TrendingUp },
                { label: 'Compliance', score: selectedScore.complianceScore, icon: ShieldCheck },
                { label: 'Engagement', score: selectedScore.engagementScore, icon: TrendingDown },
                { label: 'Vehicle Health', score: selectedScore.vehicleScore, icon: Target },
                { label: 'Location Accuracy', score: selectedScore.locationScore, icon: MapPin },
              ];
              return (
                <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold">{selectedScore.fullName || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {selectedScore.riderId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-3xl font-bold ${getScoreColor(selectedScore.compositeScore)}`}
                      >
                        {selectedScore.compositeScore}
                      </p>
                      <Badge
                        variant="outline"
                        className={`rounded-md text-xs font-bold uppercase mt-1 ${getRiskBadgeClass(selectedScore.riskLevel)}`}
                      >
                        <RiskIcon className="w-3 h-3 mr-1" />
                        {selectedScore.riskLevel}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Sub-Scores</p>
                    {subScores.map((sub) => {
                      const Icon = sub.icon;
                      return (
                        <div
                          key={sub.label}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{sub.label}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  sub.score >= 80
                                    ? 'bg-emerald-500'
                                    : sub.score >= 60
                                      ? 'bg-amber-500'
                                      : sub.score >= 40
                                        ? 'bg-orange-500'
                                        : 'bg-rose-500'
                                }`}
                                style={{ width: `${sub.score}%` }}
                              />
                            </div>
                            <span
                              className={`text-sm font-bold w-8 text-right ${getScoreColor(sub.score)}`}
                            >
                              {sub.score}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2 text-sm pt-2 border-t">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium">{selectedScore.phone}</span>
                    </div>
                    {selectedScore.pickupHub && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hub</span>
                        <span>{selectedScore.pickupHub}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Calculated</span>
                      <span>{formatDate(selectedScore.lastCalculated)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Play,
  RefreshCw,
  History,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Database,
  Clock,
  ShieldAlert,
  Sparkles,
  Search,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface JobData {
  id: string;
  name: string;
  schedule: string;
  purpose: string;
  lastRun: string | null;
  lastStatus: string;
  details: string | null;
}

interface ReconciliationReport {
  id: string;
  reportDate: string;
  totalWallets: number;
  matched: number;
  mismatched: number;
  totalLedgerSum: number;
  totalWalletSum: number;
  drift: number;
  mismatchDetails: string;
  createdAt: string;
}

export default function BackgroundJobsScreen() {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [reconHistory, setReconHistory] = useState<ReconciliationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReconciliationReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchJobsData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/admin/jobs');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setJobs(json.data.jobs || []);
          setReconHistory(json.data.reconHistory || []);
        } else {
          toast.error(json.error?.message || 'Failed to fetch background jobs');
        }
      } else {
        toast.error('Failed to communicate with server');
      }
    } catch (err) {
      toast.error('Network error fetching jobs');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobsData();
  }, []);

  const triggerJob = async (jobId: string) => {
    setRunningJobId(jobId);
    toast.info(`Triggering background job: ${jobId}...`);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-bold">{json.message || 'Job executed successfully'}</span>
              <span className="text-xs text-muted-foreground">{json.data.result?.details}</span>
            </div>
          );
          fetchJobsData(true);
        } else {
          toast.error(json.error?.message || 'Job execution failed');
        }
      } else {
        toast.error('Server error executing job');
      }
    } catch (err) {
      toast.error('Network error executing job');
    } finally {
      setRunningJobId(null);
    }
  };

  const getJobIcon = (id: string) => {
    switch (id) {
      case 'wallet-reconciliation':
        return <Database className="h-5 w-5 text-indigo-500" />;
      case 'rent-due-checker':
        return <Calendar className="h-5 w-5 text-pink-500" />;
      case 'auto-debit':
        return <Clock className="h-5 w-5 text-emerald-500" />;
      case 'device-compliance':
        return <ShieldAlert className="h-5 w-5 text-amber-500" />;
      case 'referral-reward':
        return <Sparkles className="h-5 w-5 text-cyan-500" />;
      case 'notifications-cleanup':
      case 'telemetry-cleanup':
        return <RefreshCw className="h-5 w-5 text-violet-500" />;
      case 'daily-engagement':
        return <Bell className="h-5 w-5 text-rose-500" />;
      default:
        return <Play className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const filteredHistory = reconHistory.filter((r) =>
    r.reportDate.includes(searchTerm) ||
    r.drift.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Premium Gradient Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-2xl border border-indigo-900/30">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-semibold border border-indigo-500/20">
              <Sparkles className="h-3 w-3 text-indigo-400" /> System Automation
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">
              Background Jobs & Reconciliation
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Monitor schedules, review wallet ledger integrity reports, and manually trigger system automation tasks for the Voltium platform.
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => fetchJobsData()} 
            disabled={loading}
            size="default"
            className="self-start md:self-center border-slate-700 hover:bg-slate-800 text-white bg-slate-900/50 backdrop-blur-sm transition-all duration-300 gap-2 shrink-0 h-11 px-5 rounded-xl"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Status
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse border-indigo-900/10 bg-slate-900/5">
              <CardHeader className="pb-2">
                <div className="h-6 w-32 bg-slate-200 rounded" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 w-full bg-slate-100 rounded" />
                <div className="h-4 w-2/3 bg-slate-100 rounded" />
                <div className="h-8 w-24 bg-slate-200 rounded mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Scheduled Jobs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <Card 
                key={job.id} 
                className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-indigo-500/30 border border-slate-200/80 bg-white"
              >
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-indigo-50/20 group-hover:scale-125 transition-transform duration-500" />
                
                <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors duration-300">
                        {getJobIcon(job.id)}
                      </div>
                      <CardTitle className="text-base font-bold text-slate-800">{job.name}</CardTitle>
                    </div>
                  </div>
                  <Badge 
                    className={
                      job.lastStatus === 'SUCCESS' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50' 
                        : job.lastStatus === 'FAILED'
                        ? 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50'
                        : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-50'
                    }
                    variant="outline"
                  >
                    {job.lastStatus === 'SUCCESS' ? '✓ Online' : job.lastStatus === 'FAILED' ? '⚠️ Drift Detected' : 'Never Run'}
                  </Badge>
                </CardHeader>
                
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed h-10 overflow-hidden text-ellipsis">
                      {job.purpose}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <Clock className="h-3.5 w-3.5 text-indigo-500" />
                      <span>{job.schedule}</span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 border-t pt-3">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Last Run:</span>
                      <span className="font-medium text-slate-700">
                        {job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}
                      </span>
                    </div>
                    {job.details && (
                      <div className="text-[11px] text-slate-600 bg-indigo-50/30 px-2.5 py-1.5 rounded-md border border-indigo-100/10 mt-1 font-mono">
                        {job.details}
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={() => triggerJob(job.id)} 
                    disabled={runningJobId !== null}
                    className="w-full bg-slate-900 hover:bg-indigo-950 text-white rounded-xl py-5 transition-all duration-300 font-semibold gap-2 border-0 shadow-sm hover:shadow"
                  >
                    {runningJobId === job.id ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" /> Execute Now
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Wallet Reconciliation Section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Reconciliation History */}
            <Card className="xl:col-span-2 border border-slate-200/80 shadow-sm bg-white">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <History className="h-5 w-5 text-indigo-500" /> Wallet Reconciliation Reports
                    </CardTitle>
                    <CardDescription>
                      Review daily integrity checks comparing Rider Wallet balances against double-entry ledger sums.
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search reports..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 h-11 text-base rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50/50">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Report Date</TableHead>
                        <TableHead className="font-bold text-slate-700">Total Wallets</TableHead>
                        <TableHead className="font-bold text-slate-700">Matched</TableHead>
                        <TableHead className="font-bold text-slate-700 text-rose-600">Mismatched</TableHead>
                        <TableHead className="font-bold text-slate-700">Total Drift</TableHead>
                        <TableHead className="font-bold text-slate-700">Status</TableHead>
                        <TableHead className="text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No reconciliation reports found matching criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredHistory.map((report) => (
                          <TableRow 
                            key={report.id}
                            className={`cursor-pointer hover:bg-indigo-50/30 transition-colors ${selectedReport?.id === report.id ? 'bg-indigo-50/50' : ''}`}
                            onClick={() => setSelectedReport(report)}
                          >
                            <TableCell className="font-semibold text-slate-800">{report.reportDate}</TableCell>
                            <TableCell className="text-slate-600">{report.totalWallets}</TableCell>
                            <TableCell className="text-slate-600">{report.matched}</TableCell>
                            <TableCell className="text-rose-600 font-medium">{report.mismatched}</TableCell>
                            <TableCell className={`font-semibold ${report.drift === 0 ? 'text-slate-600' : 'text-rose-600'}`}>
                              ₹{(report.drift / 100).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={
                                  report.mismatched === 0 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50' 
                                    : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50'
                                }
                                variant="outline"
                              >
                                {report.mismatched === 0 ? 'Balanced ✓' : 'Drift Alert ⚠️'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <ChevronRight className="h-4 w-4 inline-block text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Mismatch Details / Report Inspector */}
            <Card className="border border-slate-200/80 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-base font-bold text-slate-800">
                  Report Inspector
                </CardTitle>
                <CardDescription>
                  Select a report from the table to view granular details or discrepancies.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedReport ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Report Date:</span>
                        <span className="font-bold text-slate-800">{selectedReport.reportDate}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Generated At:</span>
                        <span className="font-medium text-slate-700">
                          {new Date(selectedReport.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Ledger Sum:</span>
                        <span className="font-semibold text-slate-800">₹{(selectedReport.totalLedgerSum / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Wallet Balance:</span>
                        <span className="font-semibold text-slate-800">₹{(selectedReport.totalWalletSum / 100).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Discrepancies & Drifts
                      </h4>
                      {selectedReport.mismatched === 0 ? (
                        <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/50 text-emerald-800 text-xs">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          <span>All wallets balanced perfectly. Source of truth matches cache ledger sums.</span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50/50 border border-rose-100/50 text-rose-800 text-xs">
                            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                            <span>Drift detected across {selectedReport.mismatched} rider wallet(s). Action required.</span>
                          </div>
                          <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-slate-100 p-2 bg-slate-50/30">
                            {JSON.parse(selectedReport.mismatchDetails || '[]').map((m: any, idx: number) => (
                              <div key={idx} className="p-2.5 rounded-lg border border-slate-100 bg-white shadow-sm text-xs space-y-1">
                                <div className="flex justify-between font-semibold">
                                  <span>Rider ID:</span>
                                  <span className="text-slate-800">{m.riderId}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground text-[11px]">
                                  <span>Ledger Sum:</span>
                                  <span>₹{(m.ledgerSum / 100).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground text-[11px]">
                                  <span>Wallet Balance:</span>
                                  <span>₹{(m.walletBalance / 100).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-rose-600 font-semibold text-[11px] pt-1 border-t mt-1">
                                  <span>Drift:</span>
                                  <span>₹{(m.drift / 100).toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-2xl border-slate-200">
                    <Database className="h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-xs">Select a reconciliation report to inspect specific details.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

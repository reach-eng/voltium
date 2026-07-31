'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronRight, History, Search } from 'lucide-react';
import {
  getReconStatusBadgeClass,
  getReconStatusLabel,
  type ReconciliationReport,
} from './types';

interface ReconciliationTableProps {
  reports: ReconciliationReport[];
  selectedReportId: string | null;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onSelect: (report: ReconciliationReport) => void;
}

/**
 * R3 split (BackgroundJobsScreen) — wallet reconciliation table.
 *
 * Search input on the right, then a 7-column table (date /
 * total / matched / mismatched / drift / status / chevron).
 * Each row is clickable; the selected row is highlighted with
 * a soft indigo background.
 */
export function ReconciliationTable({
  reports,
  selectedReportId,
  searchTerm,
  setSearchTerm,
  onSelect,
}: ReconciliationTableProps) {
  return (
    <Card className="xl:col-span-2 border border-slate-200/80 shadow-sm bg-white">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-500" /> Wallet Reconciliation Reports
            </CardTitle>
            <CardDescription>
              Review daily integrity checks comparing Rider Wallet balances against double-entry
              ledger sums.
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
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No reconciliation reports found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow
                    key={report.id}
                    className={`cursor-pointer hover:bg-indigo-50/30 transition-colors ${
                      selectedReportId === report.id ? 'bg-indigo-50/50' : ''
                    }`}
                    onClick={() => onSelect(report)}
                  >
                    <TableCell className="font-semibold text-slate-800">
                      {report.reportDate}
                    </TableCell>
                    <TableCell className="text-slate-600">{report.totalWallets}</TableCell>
                    <TableCell className="text-slate-600">{report.matched}</TableCell>
                    <TableCell className="text-rose-600 font-medium">{report.mismatched}</TableCell>
                    <TableCell
                      className={`font-semibold ${
                        report.drift === 0 ? 'text-slate-600' : 'text-rose-600'
                      }`}
                    >
                      ₹{(report.drift / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={getReconStatusBadgeClass(report.mismatched)}
                        variant="outline"
                      >
                        {getReconStatusLabel(report.mismatched)}
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
  );
}

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Database } from 'lucide-react';
import type { ReconciliationReport } from './types';

interface MismatchDetail {
  riderId: string;
  ledgerSum: number;
  walletBalance: number;
  drift: number;
}

interface ReportInspectorProps {
  report: ReconciliationReport | null;
}

/**
 * R3 split (BackgroundJobsScreen) — report inspector.
 *
 * Right-hand panel that shows the selected report's metadata
 * (date / generated / ledger sum / wallet sum) plus either an
 * "all balanced" success banner or a list of per-rider drift
 * cards parsed from the `mismatchDetails` JSON column.
 * When no report is selected, shows a placeholder.
 */
export function ReportInspector({ report }: ReportInspectorProps) {
  return (
    // WEB-AUDIT 2026-08-14 P0-2: `bg-white` was light-locked. Add
    // dark-aware surface + foreground tokens so the inspector
    // card tracks the user's theme.
    <Card className="border border-slate-200/80 dark:border-slate-700 shadow-sm bg-white dark:bg-card">
      <CardHeader>
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">Report Inspector</CardTitle>
        <CardDescription>
          Select a report from the table to view granular details or discrepancies.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {report ? <ReportInspectorBody report={report} /> : <ReportInspectorEmpty />}
      </CardContent>
    </Card>
  );
}

function ReportInspectorEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-2xl border-slate-200 dark:border-slate-700">
      <Database className="h-8 w-8 text-slate-300 dark:text-slate-600 dark:text-slate-400 mb-3" />
      <p className="text-xs">Select a reconciliation report to inspect specific details.</p>
    </div>
  );
}

function ReportInspectorBody({ report }: { report: ReconciliationReport }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-background border border-slate-100 dark:border-slate-700 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Report Date:</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{report.reportDate}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Generated At:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {new Date(report.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Ledger Sum:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            ₹{(report.totalLedgerSum / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Wallet Balance:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            ₹{(report.totalWalletSum / 100).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Discrepancies &amp; Drifts
        </h4>
        {report.mismatched === 0 ? (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100/50 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>All wallets balanced perfectly. Source of truth matches cache ledger sums.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-500/10 border border-rose-100/50 dark:border-rose-500/20 text-rose-800 dark:text-rose-200 text-xs">
              <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>
                Drift detected across {report.mismatched} rider wallet(s). Action required.
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-slate-100 dark:border-slate-700 p-2 bg-slate-50/30 dark:bg-slate-900/30">
              {JSON.parse(report.mismatchDetails || '[]').map((m: MismatchDetail, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-card shadow-sm text-xs space-y-1"
                >
                  <div className="flex justify-between font-semibold">
                    <span>Rider ID:</span>
                    <span className="text-slate-800 dark:text-slate-100">{m.riderId}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>Ledger Sum:</span>
                    <span>₹{(m.ledgerSum / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground text-[11px]">
                    <span>Wallet Balance:</span>
                    <span>₹{(m.walletBalance / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold text-[11px] pt-1 border-t border-slate-100 dark:border-slate-700 mt-1">
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
  );
}

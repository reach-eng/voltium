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
    <Card className="border border-slate-200/80 shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="text-base font-bold text-slate-800">Report Inspector</CardTitle>
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
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed rounded-2xl border-slate-200">
      <Database className="h-8 w-8 text-slate-300 mb-3" />
      <p className="text-xs">Select a reconciliation report to inspect specific details.</p>
    </div>
  );
}

function ReportInspectorBody({ report }: { report: ReconciliationReport }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Report Date:</span>
          <span className="font-bold text-slate-800">{report.reportDate}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Generated At:</span>
          <span className="font-medium text-slate-700">
            {new Date(report.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Ledger Sum:</span>
          <span className="font-semibold text-slate-800">
            ₹{(report.totalLedgerSum / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Wallet Balance:</span>
          <span className="font-semibold text-slate-800">
            ₹{(report.totalWalletSum / 100).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Discrepancies &amp; Drifts
        </h4>
        {report.mismatched === 0 ? (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/50 text-emerald-800 text-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>All wallets balanced perfectly. Source of truth matches cache ledger sums.</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50/50 border border-rose-100/50 text-rose-800 text-xs">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>
                Drift detected across {report.mismatched} rider wallet(s). Action required.
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-slate-100 p-2 bg-slate-50/30">
              {JSON.parse(report.mismatchDetails || '[]').map((m: MismatchDetail, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-slate-100 bg-white shadow-sm text-xs space-y-1"
                >
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
  );
}

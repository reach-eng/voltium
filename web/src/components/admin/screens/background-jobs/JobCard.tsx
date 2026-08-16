'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Play, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import {
  getJobIcon,
  getJobStatusBadgeClass,
  getJobStatusLabel,
  type JobData,
} from './types';

interface JobCardProps {
  job: JobData;
  isRunning: boolean;
  anyJobRunning: boolean;
  onTrigger: (jobId: string) => void;
}

/**
 * R3 split (BackgroundJobsScreen) — single job card.
 *
 * Header: icon + name + status badge. Body: purpose line,
 * schedule chip, last run timestamp, optional details.
 * Footer: Execute Now button (or spinner when this specific
 * job is running). All jobs disable their button while another
 * job is in flight.
 */
export function JobCard({ job, isRunning, anyJobRunning, onTrigger }: JobCardProps) {
  // PR-B: collapsible error detail. Visible by default only when the
  // last status is FAILED. Otherwise the operator has to click
  // "Show error" to expand.
  const showErrorByDefault = job.lastStatus === 'FAILED' && !!job.lastError;
  const [errorExpanded, setErrorExpanded] = useState(showErrorByDefault);
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-indigo-500/30 border border-slate-200/80 dark:border-slate-700 dark:bg-card">
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-indigo-50/20 dark:bg-indigo-500/10 group-hover:scale-125 transition-transform duration-500" />

      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-background border border-slate-100 dark:border-slate-700 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/15 group-hover:border-indigo-100 dark:group-hover:border-indigo-500/30 transition-colors duration-300 text-xl">
              {getJobIcon(job.id)}
            </div>
            {/* WEB-AUDIT 2026-08-14 P0-2: the previous version pinned the
                title text to `text-slate-800` (light slate-800). In dark
                mode the title became invisible against the dark card
                surface (which is `#1E293B`, also a slate-800). Read
                the title from the foreground token instead. */}
            <CardTitle className="text-base font-bold text-foreground">
              {job.name}
            </CardTitle>
          </div>
        </div>
        <Badge
          className={getJobStatusBadgeClass(job.lastStatus)}
          variant="outline"
        >
          {getJobStatusLabel(job.lastStatus)}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed h-10 overflow-hidden text-ellipsis">
            {job.purpose}
          </p>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-background p-2 rounded-lg border border-slate-100 dark:border-slate-700">
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
            <span>{job.schedule}</span>
          </div>
        </div>

        <div className="text-xs space-y-1.5 border-t pt-3">
          <div className="flex justify-between text-muted-foreground">
            <span>Last Run:</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}
            </span>
          </div>
          {/* PR-B: next-run estimate. Computed server-side from the
              textual schedule label. Renders "—" when the schedule
              is on-demand or unparseable. */}
          <div className="flex justify-between text-muted-foreground" data-testid={`next-run-${job.id}`}>
            <span className="flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> Next run:
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {job.nextRun
                ? new Date(job.nextRun).toLocaleString()
                : '— (on-demand)'}
            </span>
          </div>
          {job.details && (
            <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-indigo-50/30 dark:bg-indigo-500/10 px-2.5 py-1.5 rounded-md border border-indigo-100/10 dark:border-indigo-500/20 mt-1 font-mono">
              {job.details}
            </div>
          )}
          {/* PR-B: last-failure error text. Collapsible so the UI
              stays compact for healthy jobs but the error is one
              click away when something breaks. Visible by default
              when the last run was a FAILED. */}
          {job.lastError && (
            <div
              className="mt-1.5 border border-rose-200 dark:border-rose-500/30 rounded-md bg-rose-50/40 dark:bg-rose-500/10"
              data-testid={`error-block-${job.id}`}
            >
              <button
                type="button"
                onClick={() => setErrorExpanded((v) => !v)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-rose-700 dark:text-rose-300 px-2.5 py-1.5"
              >
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Last failure
                </span>
                <span className="text-rose-500 dark:text-rose-400">{errorExpanded ? '▲' : '▼'}</span>
              </button>
              {errorExpanded && (
                <pre className="text-[11px] text-rose-900 dark:text-rose-100 bg-rose-50/60 dark:bg-rose-500/15 px-2.5 py-2 border-t border-rose-200 dark:border-rose-500/30 font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">
                  {job.lastError}
                </pre>
              )}
            </div>
          )}
        </div>

        <Button
          onClick={() => onTrigger(job.id)}
          disabled={anyJobRunning}
          className="w-full bg-slate-900 hover:bg-indigo-950 text-white rounded-xl py-5 transition-all duration-300 font-semibold gap-2 border-0 shadow-sm hover:shadow"
        >
          {isRunning ? (
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
  );
}

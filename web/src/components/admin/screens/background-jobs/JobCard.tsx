'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Play, RefreshCw } from 'lucide-react';
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
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-indigo-500/30 border border-slate-200/80 bg-white">
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-indigo-50/20 group-hover:scale-125 transition-transform duration-500" />

      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors duration-300 text-xl">
              {getJobIcon(job.id)}
            </div>
            <CardTitle className="text-base font-bold text-slate-800">{job.name}</CardTitle>
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

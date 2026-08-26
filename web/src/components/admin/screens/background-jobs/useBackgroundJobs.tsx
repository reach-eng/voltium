'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { JobData, ReconciliationReport } from './types';

/**
 * R3 split (BackgroundJobsScreen) â€” data hook.
 *
 * Owns the jobs + recon history, the search term, the selected
 * report, the running-job lock, and the triggerJob POST. The
 * `silent` flag on `fetchJobsData` is used for re-fetching after
 * a trigger without flashing the loading skeleton.
 */
export function useBackgroundJobs() {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [reconHistory, setReconHistory] = useState<ReconciliationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReconciliationReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchJobsData = useCallback(async (silent = false) => {
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
  }, []);

  useEffect(() => {
    fetchJobsData();
  }, [fetchJobsData]);

  const triggerJob = async (jobId: string) => {
    setRunningJobId(jobId);
    toast.info(`Triggering background job: ${jobId}...`);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const filteredHistory = reconHistory.filter(
    (r) => r.reportDate.includes(searchTerm) || r.drift.toString().includes(searchTerm)
  );

  return {
    // data
    jobs,
    reconHistory,
    filteredHistory,
    loading,
    // selection
    selectedReport,
    setSelectedReport,
    // search
    searchTerm,
    setSearchTerm,
    // job trigger
    runningJobId,
    triggerJob,
    // revalidation
    fetchJobsData,
  };
}

export type BackgroundJobsHook = ReturnType<typeof useBackgroundJobs>;


'use client';

import { JobCard } from './JobCard';
import type { JobData } from './types';

interface JobsGridProps {
  jobs: JobData[];
  runningJobId: string | null;
  onTrigger: (jobId: string) => void;
}

/**
 * R3 split (BackgroundJobsScreen) — scheduled jobs grid.
 *
 * 1-2-3 column responsive grid of JobCard components. Each card
 * receives the same `onTrigger` handler and the `runningJobId`
 * so it can render its own spinner when active.
 */
export function JobsGrid({ jobs, runningJobId, onTrigger }: JobsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          isRunning={runningJobId === job.id}
          anyJobRunning={runningJobId !== null}
          onTrigger={onTrigger}
        />
      ))}
    </div>
  );
}

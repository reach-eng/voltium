'use client';

import { useBackgroundJobs } from './background-jobs/useBackgroundJobs';
import { BackgroundJobsHeader } from './background-jobs/BackgroundJobsHeader';
import { BackgroundJobsSkeleton } from './background-jobs/BackgroundJobsSkeleton';
import { JobsGrid } from './background-jobs/JobsGrid';
import { ReconciliationTable } from './background-jobs/ReconciliationTable';
import { ReportInspector } from './background-jobs/ReportInspector';

/**
 * R3 split (BackgroundJobsScreen) — shell.
 *
 * Pre-split: 20.7 KB / 442 lines with 5 useState + 2 fetch +
 * 8 helper functions + 3 sections inline.
 * Post-split: thin orchestrator that wires the data hook and
 * 5 subcomponents. All state + network logic lives in
 * `useBackgroundJobs` (3.2 KB); the 5 status/label helpers
 * live in `types.ts` (2.5 KB).
 */
export default function BackgroundJobsScreen() {
  const b = useBackgroundJobs();

  return (
    <div className="space-y-6">
      <BackgroundJobsHeader loading={b.loading} onRefresh={() => b.fetchJobsData()} />

      {b.loading ? (
        <BackgroundJobsSkeleton />
      ) : (
        <>
          <JobsGrid
            jobs={b.jobs}
            runningJobId={b.runningJobId}
            onTrigger={b.triggerJob}
          />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <ReconciliationTable
              reports={b.filteredHistory}
              selectedReportId={b.selectedReport?.id ?? null}
              searchTerm={b.searchTerm}
              setSearchTerm={b.setSearchTerm}
              onSelect={b.setSelectedReport}
            />
            <ReportInspector report={b.selectedReport} />
          </div>
        </>
      )}
    </div>
  );
}

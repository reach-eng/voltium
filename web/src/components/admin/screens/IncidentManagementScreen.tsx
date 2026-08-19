'use client';

import { AdminErrorBoundary } from '../error-boundary';
import {
  useIncidents,
  IncidentFiltersBar,
  IncidentTable,
  IncidentDetailDialog,
  CreateIncidentDialog,
} from './incident-management';

/**
 * IncidentManagementScreen — Main coordinator screen shell.
 * Delegates state management to useIncidents() and layout rendering
 * to modular components under ./incident-management/
 */
export default function IncidentManagementScreen() {
  const incidentState = useIncidents();

  return (
    <AdminErrorBoundary>
      <div className="space-y-6">
        {/* Filters Bar & Header */}
        <IncidentFiltersBar
          statusFilter={incidentState.statusFilter}
          setStatusFilter={incidentState.setStatusFilter}
          typeFilter={incidentState.typeFilter}
          setTypeFilter={incidentState.setTypeFilter}
          severityFilter={incidentState.severityFilter}
          setSeverityFilter={incidentState.setSeverityFilter}
          search={incidentState.search}
          setSearch={incidentState.setSearch}
          incidentTypes={incidentState.incidentTypes}
          statusCounts={incidentState.statusCounts}
          onCreateClick={() => incidentState.setCreateOpen(true)}
        />

        {/* Data Table */}
        <IncidentTable
          loading={incidentState.loading}
          incidents={incidentState.incidents}
          onViewDetail={(inc) => {
            incidentState.setSelectedIncident(inc);
            incidentState.setDetailOpen(true);
            incidentState.setDetailTab('info');
          }}
          onGenerateReport={incidentState.handleGenerateReport}
          page={incidentState.page}
          totalPages={incidentState.totalPages}
          total={incidentState.total}
          setPage={incidentState.setPage}
        />

        {/* Create Incident Modal */}
        <CreateIncidentDialog
          open={incidentState.createOpen}
          onOpenChange={incidentState.setCreateOpen}
          form={incidentState.form}
          setForm={incidentState.setForm}
          incidentTypes={incidentState.incidentTypes}
          riders={incidentState.riders}
          vehicles={incidentState.vehicles}
          creating={incidentState.creating}
          onCreate={incidentState.handleCreate}
        />

        {/* Detail View Dialog */}
        <IncidentDetailDialog
          open={incidentState.detailOpen}
          onOpenChange={incidentState.setDetailOpen}
          selectedIncident={incidentState.selectedIncident}
          detailTab={incidentState.detailTab}
          setDetailTab={incidentState.setDetailTab}
          onGenerateReport={incidentState.handleGenerateReport}
          onUpdateStatus={incidentState.handleUpdateStatus}
          onAssign={incidentState.handleAssign}
        />
      </div>
    </AdminErrorBoundary>
  );
}

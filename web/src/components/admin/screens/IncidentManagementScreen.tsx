'use client';

import { useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateIncidentModal } from './incidents/CreateIncidentModal';
import {
  IncidentDetailModal,
  type Incident,
} from './incidents/IncidentDetailModal';
import { useIncidents } from './incidents/useIncidents';
import { IncidentStatusCards } from './incidents/IncidentStatusCards';
import { IncidentFiltersBar } from './incidents/IncidentFiltersBar';
import { IncidentTable } from './incidents/IncidentTable';
import { handleGenerateIncidentReport } from './incidents/incidentReport';

const PAGE_SIZE = 20;

/**
 * R3.7b split — Incident Management screen. After the split this file
 * is a thin shell (~95 lines) that orchestrates the data hook and the
 * 3 child components + 2 modals.
 *
 * Pre-split: 16 KB / 437 lines
 * Post-split: ~3 KB shell + useIncidents (5 KB) + IncidentStatusCards
 *             (2.8 KB) + IncidentFiltersBar (2.5 KB) + IncidentTable (4 KB)
 *             + incidentReport (1 KB)
 */
export default function IncidentManagementScreen() {
  const {
    incidents,
    loading,
    page,
    totalPages,
    total,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    search,
    setSearch,
    setPage,
    fetchIncidents,
    updateStatus,
    assignIncident,
    statusCounts,
  } = useIncidents();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailTab, setDetailTab] = useState('info');

  const handleSelect = (inc: Incident) => {
    setSelectedIncident(inc);
    setDetailOpen(true);
    setDetailTab('info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-primary" />
            Incident Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Track and resolve rider incidents</p>
        </div>
        <Button size="sm" className="rounded-full px-4 h-9" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Incident
        </Button>
      </div>

      <IncidentStatusCards counts={statusCounts} />

      <IncidentFiltersBar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        search={search}
        setSearch={setSearch}
      />

      <IncidentTable incidents={incidents} loading={loading} onSelect={handleSelect} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <CreateIncidentModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchIncidents}
      />

      <IncidentDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        incident={selectedIncident}
        detailTab={detailTab}
        onTabChange={setDetailTab}
        onUpdateStatus={(id, newStatus) => {
          updateStatus(id, newStatus);
          if (selectedIncident?.id === id) {
            setSelectedIncident((prev) =>
              prev ? { ...prev, status: newStatus as Incident['status'] } : null,
            );
          }
        }}
        onAssign={assignIncident}
        onGenerateReport={handleGenerateIncidentReport}
      />
    </div>
  );
}

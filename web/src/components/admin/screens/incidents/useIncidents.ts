'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import type { Incident } from './IncidentDetailModal';

const PAGE_SIZE = 20;

export type IncidentFilter = 'ALL' | 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
export type IncidentTypeFilter = 'ALL' | string;
export type IncidentSeverityFilter = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface IncidentListResponse {
  data?: Incident[];
  pagination?: { totalPages: number; total: number };
}

/**
 * R3.7b — data hook for the Incident Management screen. Extracted from
 * IncidentManagementScreen.tsx. Owns:
 *   - page state + auto-reset on filter change
 *   - debounced search state
 *   - the fetch + pagination logic
 *   - the three update operations (status, assign, generate report)
 */
export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<IncidentFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<IncidentTypeFilter>('ALL');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverityFilter>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/admin/incidents?${params}`);
      if (res.ok) {
        const json = (await res.json()) as IncidentListResponse;
        setIncidents(json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotal(json.pagination.total || 0);
        }
      } else if (res.status === 403) {
        // No permission — silent fallback (Phase 1 C1 fix)
        setIncidents([]);
      }
    } catch (error) {
      logger.error('Failed to fetch incidents', { error });
      toast.error('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, severityFilter, debouncedSearch]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, severityFilter, debouncedSearch]);

  /**
   * PATCH an incident's status (e.g. OPEN → INVESTIGATING). Returns true
   * on success and triggers a refetch.
   */
  const updateStatus = useCallback(
    async (incidentId: string, newStatus: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/admin/incidents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: incidentId, status: newStatus }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          toast.error(json?.error?.message || 'Failed to update status');
          return false;
        }
        toast.success(`Status changed to ${newStatus}`);
        await fetchIncidents();
        return true;
      } catch {
        toast.error('Network error. Please try again.');
        return false;
      }
    },
    [fetchIncidents],
  );

  /**
   * PATCH an incident's assignee. Returns true on success.
   */
  const assignIncident = useCallback(
    async (incidentId: string, adminId: string): Promise<boolean> => {
      try {
        const res = await fetch('/api/admin/incidents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: incidentId, assignedTo: adminId }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          toast.error(json?.error?.message || 'Failed to assign');
          return false;
        }
        toast.success('Incident assigned');
        await fetchIncidents();
        return true;
      } catch {
        toast.error('Network error. Please try again.');
        return false;
      }
    },
    [fetchIncidents],
  );

  const statusCounts = {
    OPEN: incidents.filter((i) => i.status === 'OPEN').length,
    INVESTIGATING: incidents.filter((i) => i.status === 'INVESTIGATING').length,
    RESOLVED: incidents.filter((i) => i.status === 'RESOLVED').length,
    CLOSED: incidents.filter((i) => i.status === 'CLOSED').length,
  };

  return {
    incidents,
    loading,
    page,
    totalPages,
    total,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    severityFilter,
    setSeverityFilter,
    search,
    setSearch,
    setPage,
    fetchIncidents,
    updateStatus,
    assignIncident,
    statusCounts,
  };
}

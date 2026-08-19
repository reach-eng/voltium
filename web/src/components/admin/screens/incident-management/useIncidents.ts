import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { BRAND_DOMAIN } from '@/lib/branding';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import type { Incident, RiderOption, VehicleOption, CreateIncidentForm } from './types';
import { formatDate } from './helpers';

const PAGE_SIZE = 20;

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [creating, setCreating] = useState(false);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [detailTab, setDetailTab] = useState('info');
  const [form, setForm] = useState<CreateIncidentForm>({
    type: '',
    severity: 'MEDIUM',
    title: '',
    description: '',
    riderId: '',
    vehicleId: '',
    location: '',
    latitude: '',
    longitude: '',
    hasInsurance: false,
    photos: [],
  });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const incidentTypes = ['ACCIDENT', 'THEFT', 'BREAKDOWN', 'DAMAGE', 'OTHER'];

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
        const json = await res.json();
        setIncidents(json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotal(json.pagination.total || 0);
        }
      } else if (res.status === 403) {
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

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, severityFilter, debouncedSearch]);

  useEffect(() => {
    if (createOpen) {
      fetch('/api/admin/riders?limit=50')
        .then((res) => {
          if (res.ok) return res.json();
          if (res.status !== 403) throw new Error();
          return null;
        })
        .then((json) => {
          if (json?.success) setRiders(json.data?.riders || []);
        })
        .catch(() => logger.error('Failed to fetch riders'));
      fetch('/api/admin/vehicles?limit=50')
        .then((res) => {
          if (res.ok) return res.json();
          if (res.status !== 403) throw new Error();
          return null;
        })
        .then((json) => {
          if (json?.success) setVehicles(json.data?.vehicles || json.data || []);
        })
        .catch(() => logger.error('Failed to fetch vehicles'));
    }
  }, [createOpen]);

  async function handleCreate() {
    if (!form.type || form.title.trim().length < 3 || form.description.trim().length < 10) {
      toast.error('Please provide a title (min 3 chars), type, and description (min 10 chars)');
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        severity: form.severity,
        title: form.title,
        description: form.description,
        location: form.location,
        hasInsurance: form.hasInsurance,
      };
      if (form.riderId) body.riderId = form.riderId;
      if (form.vehicleId) body.vehicleId = form.vehicleId;

      const res = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to create incident');
        return;
      }
      toast.success('Incident created');
      setCreateOpen(false);
      setForm({
        type: '',
        severity: 'MEDIUM',
        title: '',
        description: '',
        riderId: '',
        vehicleId: '',
        location: '',
        latitude: '',
        longitude: '',
        hasInsurance: false,
        photos: [],
      });
      fetchIncidents();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(incidentId: string, newStatus: string) {
    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incidentId, status: newStatus }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to update status');
        return;
      }
      toast.success(`Status changed to ${newStatus}`);
      fetchIncidents();
      if (selectedIncident?.id === incidentId) {
        setSelectedIncident((prev) =>
          prev ? { ...prev, status: newStatus as Incident['status'] } : null
        );
      }
    } catch {
      toast.error('Network error. Please try again.');
    }
  }

  async function handleAssign(incidentId: string, adminId: string) {
    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incidentId, assignedTo: adminId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message || 'Failed to assign');
        return;
      }
      toast.success('Incident assigned');
      fetchIncidents();
    } catch {
      toast.error('Network error. Please try again.');
    }
  }

  function handleGenerateReport(incident: Incident) {
    const report = [
      `${BRAND_DOMAIN} Incident Report`,
      `Incident ID: ${incident.incidentId}`,
      `Generated: ${formatDateTimeDDMMYYYY(new Date().toISOString())}`,
      '',
      'Details',
      `Title,${incident.title}`,
      `Type,${incident.type}`,
      `Severity,${incident.severity}`,
      `Status,${incident.status}`,
      `Rider,${incident.riderName || 'N/A'}`,
      `Vehicle,${incident.vehicleNumber || 'N/A'}`,
      `Location,${incident.location || 'N/A'}`,
      `Insurance,${incident.hasInsurance ? 'Yes' : 'No'}`,
      '',
      'Description',
      incident.description,
      '',
      'Timeline',
      'Action,Actor,Timestamp',
      ...incident.timeline.map((t) => `${t.action},${t.actor},${formatDate(t.timestamp)}`),
    ].join('\n');
    const blob = new Blob([report], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-${incident.incidentId}-${formatDateDDMMYYYY(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
    setPage,
    totalPages,
    total,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    severityFilter,
    setSeverityFilter,
    createOpen,
    setCreateOpen,
    detailOpen,
    setDetailOpen,
    selectedIncident,
    setSelectedIncident,
    creating,
    riders,
    vehicles,
    detailTab,
    setDetailTab,
    form,
    setForm,
    search,
    setSearch,
    incidentTypes,
    statusCounts,
    fetchIncidents,
    handleCreate,
    handleUpdateStatus,
    handleAssign,
    handleGenerateReport,
  };
}

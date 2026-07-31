'use client';

import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import { BRAND_DOMAIN } from '@/lib/branding';
import type { Incident } from './IncidentDetailModal';

/**
 * R3.7b — extracted from IncidentManagementScreen.tsx. Generates a CSV
 * report for an incident and triggers a browser download.
 *
 * Kept as a pure function (not a hook) because the only side effect
 * is a Blob URL + anchor click, which is appropriate at the call site
 * (after a user action) rather than inside a useEffect.
 */
export function handleGenerateIncidentReport(incident: Incident): void {
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
    ...incident.timeline.map((t) => `${t.action},${t.actor},${formatDateDDMMYYYY(t.timestamp)}`),
  ].join('\n');
  const blob = new Blob([report], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `incident-${incident.incidentId}-${formatDateDDMMYYYY(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

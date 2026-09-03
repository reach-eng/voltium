import { BRAND_DOMAIN } from '@/lib/branding';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Rider } from './types';

/**
 * R3.7cc split — CSV export of the currently selected riders. The
 * header is a fixed 5-column shape (riderId, name, phone, state,
 * kycStatus) and the value is a tiny RFC-4180 double-quote escape.
 */
export function buildSelectedRiderCsv(riders: Rider[], selectedIds: Set<string>): string {
  const header = 'Rider ID,Name,Phone,State,KYC Status';
  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const rows = riders
    .filter((r) => selectedIds.has(r.id))
    .map((r) =>
      [r.riderId, escapeCsv(r.fullName || ''), r.phone, r.state, r.kycStatus].join(',')
    );
  return [header, ...rows].join('\n');
}

export function downloadSelectedRiderCsv(riders: Rider[], selectedIds: Set<string>): void {
  const csv = buildSelectedRiderCsv(riders, selectedIds);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    `${BRAND_DOMAIN.split('.')[0]}-riders-${formatDateDDMMYYYY(new Date())}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

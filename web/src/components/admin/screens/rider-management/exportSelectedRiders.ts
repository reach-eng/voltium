import { BRAND_DOMAIN } from '@/lib/branding';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Rider } from './types';

/**
 * R3.7cc split — CSV export of the currently selected riders.
 * Unified on the canonical 12-column shape matching RiderFiltersBar export.
 */
export function buildSelectedRiderCsv(riders: Rider[], selectedIds: Set<string>): string {
  const header =
    'Rider ID,Name,Phone,Email,State,KYC Status,Wallet Balance,Security Deposit,Deposit Status,Guarantor Name,Guarantor Phone,Created At';
  const escapeCsv = (val: unknown) => {
    if (val === null || val === undefined) return '';
    return `"${String(val).replace(/"/g, '""')}"`;
  };
  const rows = riders
    .filter((r) => selectedIds.has(r.id))
    .map((r) =>
      [
        escapeCsv(r.riderId ?? ''),
        escapeCsv(r.fullName || ''),
        escapeCsv(r.phone ?? ''),
        escapeCsv(r.email ?? ''),
        escapeCsv(r.state ?? ''),
        escapeCsv(r.kycStatus ?? ''),
        r.walletBalance ?? 0,
        r.securityDeposit ?? 0,
        escapeCsv(r.depositStatus ?? ''),
        escapeCsv(r.guarantorName ?? ''),
        escapeCsv(r.guarantorPhone ?? ''),
        escapeCsv(r.createdAt ? formatDateDDMMYYYY(r.createdAt) : ''),
      ].join(',')
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

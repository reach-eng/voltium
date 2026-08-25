import { BRAND_DOMAIN } from '@/lib/branding';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { Rider } from './types';

/**
 * R3.7cc split — CSV export of the currently selected riders. The
 * header is a fixed 5-column shape (riderId, name, phone, state,
 * kycStatus) and each value goes through a proper RFC-4180 escape.
 *
 * RFC 4180 rules:
 *   - If a field contains `,`, `"`, or a line break, the whole
 *     field must be enclosed in double quotes.
 *   - Internal `"` characters are escaped as `""`.
 *
 * Admin Panel Phase 3 / P2-06 (2026-08-23): the previous
 * implementation only wrapped the name field in `"..."` and
 * did NOT escape internal double quotes. A rider with a name
 * like `Arjun "The Ace" Sharma, Jr.` would render as
 * `"Arjun "The Ace" Sharma, Jr."` — invalid CSV (the
 * enclosing quotes don't pair up). The fix below applies the
 * full RFC-4180 contract to every field, not just the name.
 */
function escapeCsvField(value: string | null | undefined): string {
  const s = value == null ? '' : String(value);
  // Quote if the value contains any of the RFC-4180 special chars.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildSelectedRiderCsv(riders: Rider[], selectedIds: Set<string>): string {
  const header = 'Rider ID,Name,Phone,State,KYC Status';
  const rows = riders
    .filter((r) => selectedIds.has(r.id))
    .map((r) =>
      [
        escapeCsvField(r.riderId),
        escapeCsvField(r.fullName),
        escapeCsvField(r.phone),
        escapeCsvField(r.state),
        escapeCsvField(r.kycStatus),
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

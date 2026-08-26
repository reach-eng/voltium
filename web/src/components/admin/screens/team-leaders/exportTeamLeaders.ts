import { formatDateDDMMYYYY } from '@/lib/date-utils';
import type { TeamLeader } from './types';

/**
 * R3.7aa split — CSV export for selected team leaders.
 * RFC-4180 escaping (quote fields containing commas/quotes, double the quotes).
 */
export function buildTeamLeaderCsv(leaders: TeamLeader[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const header = [
    esc('Name'),
    esc('Phone'),
    esc('Email'),
    esc('Status'),
    esc('Riders'),
    esc('Created'),
  ].join(',');

  const rows = leaders.map((l) =>
    [
      esc(l.name),
      esc(l.phone),
      esc(l.email || ''),
      esc(l.isActive ? 'Active' : 'Inactive'),
      esc(String(l.riderCount || 0)),
      esc(l.createdAt),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

export function downloadTeamLeaderCsv(leaders: TeamLeader[]): void {
  const csv = buildTeamLeaderCsv(leaders);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    `team-leaders-${formatDateDDMMYYYY(new Date())}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import { describe, it, expect } from 'vitest';
import { buildReportCsv } from '@/components/admin/screens/dashboard/exportReport';
import type {
  DashboardStats,
  RecentTransaction,
} from '@/components/admin/screens/dashboard/types';

const stats: DashboardStats = {
  totalRiders: 10,
  activeRiders: 8,
  totalVehicles: 12,
  availableVehicles: 5,
  totalBalance: 1000,
  totalDeposits: 500,
  totalRevenue: 2500,
  pendingTransactions: 1,
  openTickets: 2,
  activeRentals: 6,
  totalHubs: 3,
  pendingKyc: 1,
  pendingGuarantor: 0,
  pendingInfoRequired: 0,
  totalAdmins: 2,
};

function tx(name: string | null): RecentTransaction {
  return {
    id: 'tx_1',
    type: 'DEBIT',
    amount: 500,
    purpose: 'RENT_PAYMENT',
    status: 'APPROVED',
    createdAt: new Date('2026-09-01T10:00:00Z').toISOString(),
    rider: { fullName: name, name: null, riderId: 'RDR001' },
  };
}

describe('Dashboard CSV export (P0-1 formula injection, P2 truncation note)', () => {
  it('neutralizes formula payloads in rider-controlled names', () => {
    const csv = buildReportCsv(stats, [tx('=2+5+cmd|’/C calc’!A0')]);
    const dataLine = csv.split('\n').find((l) => l.includes('cmd')) || '';
    // No cell may be formula-live: a leading = + - @ (or tab/CR) is only
    // safe when neutralized by the `'` prefix escape (RFC-4180 quoting
    // alone does NOT stop formula evaluation).
    for (const cell of dataLine.split(',')) {
      const unquoted = cell.replace(/^"/, '');
      const first = unquoted[0] ?? '';
      if ('=+-@\t\r'.includes(first)) {
        expect(unquoted.startsWith("'")).toBe(true);
      }
    }
    expect(dataLine).toContain("'=2+5");
  });

  it('quotes fields containing commas/quotes without breaking rows', () => {
    const csv = buildReportCsv(stats, [tx('Doe, "John"')]);
    expect(csv).toContain('"Doe, ""John"""');
  });

  it('declares the 5-row snapshot scope inside the file', () => {
    const csv = buildReportCsv(stats, [tx('Asha')]);
    expect(csv).toContain('Scope: latest 1 transactions');
  });
});

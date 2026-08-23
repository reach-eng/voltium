/**
 * P1-2 (ADMIN_DASHBOARD_AUDIT_2026-08-24): the dashboard's CSV export
 * (`dashboard/exportReport.ts`) was previously emitting rider full names
 * unconditionally. For non-operations roles (READ_ONLY, SUPPORT_AGENT)
 * the name column must be redacted to initials so a read-only admin
 * can't use the dashboard to dump a rider directory.
 *
 * The redaction is irreversible — the audit log records the actor
 * and the export timestamp so compliance can re-link if a redacted
 * export is investigated.
 */

import { describe, it, expect } from 'vitest';
import { buildReportCsv } from '@/components/admin/screens/dashboard/exportReport';
import type { DashboardStats, RecentTransaction } from '@/components/admin/screens/dashboard/types';

const baseStats: DashboardStats = {
  totalRiders: 100,
  activeRiders: 42,
  totalVehicles: 60,
  availableVehicles: 12,
  totalBalance: 250000,
  totalDeposits: 100000,
  totalRevenue: 500000,
  pendingTransactions: 3,
  openTickets: 4,
  activeRentals: 30,
  totalHubs: 5,
  pendingKyc: 6,
  pendingGuarantor: 2,
  pendingInfoRequired: 1,
  totalAdmins: 8,
};

const baseTransactions: RecentTransaction[] = [
  {
    id: 'tx_1',
    type: 'CREDIT',
    amount: 5000,
    purpose: 'TOP_UP',
    status: 'SUCCESS',
    createdAt: '2026-08-24T10:00:00.000Z',
    rider: { fullName: 'Ravi Kumar', name: 'Ravi K', riderId: 'rider_1' },
  },
  {
    id: 'tx_2',
    type: 'DEBIT',
    amount: 2000,
    purpose: 'RENT',
    status: 'SUCCESS',
    createdAt: '2026-08-24T11:00:00.000Z',
    rider: { fullName: 'Madhur Singhania', name: 'Madhur', riderId: 'rider_2' },
  },
  {
    id: 'tx_3',
    type: 'CREDIT',
    amount: 1000,
    purpose: 'TOP_UP',
    status: 'PENDING',
    createdAt: '2026-08-24T12:00:00.000Z',
    // No rider attached — fallback path.
  },
];

describe('dashboard/exportReport.buildReportCsv — P1-2 PII redaction', () => {
  it('emits full rider names when redactPii is omitted (default)', () => {
    const csv = buildReportCsv(baseStats, baseTransactions);
    expect(csv).toContain('Ravi Kumar');
    expect(csv).toContain('Madhur Singhania');
  });

  it('emits full rider names when redactPii is false', () => {
    const csv = buildReportCsv(baseStats, baseTransactions, { redactPii: false });
    expect(csv).toContain('Ravi Kumar');
    expect(csv).toContain('Madhur Singhania');
  });

  it('redacts two-part names to "F.L." initials when redactPii is true', () => {
    const csv = buildReportCsv(baseStats, baseTransactions, { redactPii: true });
    expect(csv).toContain('R.K.');
    expect(csv).toContain('M.S.');
    // The original full names must NOT be present in the redacted CSV.
    expect(csv).not.toContain('Ravi Kumar');
    expect(csv).not.toContain('Madhur Singhania');
  });

  it('redacts single-part names to "F." form when redactPii is true', () => {
    const csv = buildReportCsv(baseStats, [
      {
        id: 'tx_single',
        type: 'CREDIT',
        amount: 100,
        purpose: 'TOP_UP',
        status: 'SUCCESS',
        createdAt: '2026-08-24T12:00:00.000Z',
        rider: { fullName: 'Madhur', name: 'Madhur', riderId: 'r_s' },
      },
    ], { redactPii: true });
    expect(csv).toContain('M.');
    expect(csv).not.toContain('Madhur');
  });

  it('falls back to literal "Rider" when name is missing or "Unknown"', () => {
    const csv = buildReportCsv(baseStats, baseTransactions, { redactPii: true });
    // The 3rd transaction has no rider; the function returns 'Unknown'
    // from transactionDisplayName — the redactor must handle it.
    expect(csv).toContain('Rider');
    expect(csv).not.toContain('Unknown');
  });

  it('preserves the numeric columns when redactPii is true (only names change)', () => {
    const csv = buildReportCsv(baseStats, baseTransactions, { redactPii: true });
    // Amount column is the 2nd column in the recent-transactions section.
    // The first row should be "R.K.,5000,SUCCESS,...".
    const lines = csv.split('\n');
    const txHeader = lines.indexOf('Rider,Amount,Status,Date');
    expect(txHeader).toBeGreaterThan(-1);
    expect(lines[txHeader + 1]).toMatch(/^R\.K\.,5000,SUCCESS,/);
    expect(lines[txHeader + 2]).toMatch(/^M\.S\.,2000,SUCCESS,/);
  });

  it('keeps the metrics block (no PII) intact when redactPii is true', () => {
    const csv = buildReportCsv(baseStats, baseTransactions, { redactPii: true });
    expect(csv).toContain('Active Riders,42');
    expect(csv).toContain('Open Tickets,4');
  });

  it('rejects empty/whitespace names without throwing', () => {
    const csv = buildReportCsv(
      baseStats,
      [
        {
          id: 'tx_empty',
          type: 'CREDIT',
          amount: 1,
          purpose: 'TOP_UP',
          status: 'SUCCESS',
          createdAt: '2026-08-24T12:00:00.000Z',
          rider: { fullName: '   ', name: null, riderId: 'r_e' },
        },
      ],
      { redactPii: true }
    );
    expect(csv).toContain('Rider');
    // No double-quoted empty string in the CSV body.
    expect(csv).not.toMatch(/^,.*,.*,$/m);
  });
});

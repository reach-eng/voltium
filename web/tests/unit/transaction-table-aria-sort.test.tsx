/**
 * T-AR-SORT test for `TransactionTable` — third user of the
 * "sortable header" pattern, this one finally moving sort to the
 * server (the hook is `useTransactions.ts`, the route is
 * `app/api/admin/transactions/route.ts`). This file only verifies
 * the table renders the a11y + visual state correctly:
 *   1. `aria-sort` is wired on the Amount + Date columns.
 *   2. The arrows are lucide primitives, not Unicode glyphs.
 *   3. The rendered output never contains the "↑" / "↓" Unicode
 *      characters (the same encoding-loss class as A-1 in
 *      RiderTable).
 *   4. The 3rd-click "cleared" state renders as `aria-sort="none"`
 *      (no active column) — the new contract from Step 5.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TransactionTable } from '@/components/admin/screens/transaction-management/TransactionTable';
import type { Transaction } from '@/components/admin/screens/transaction-management/types';

const transactions: Transaction[] = [
  {
    id: 't1',
    type: 'CREDIT',
    amount: 1000,
    purpose: 'TOP_UP',
    method: 'UPI',
    status: 'PENDING',
    reason: null,
    remark: null,
    description: null,
    rejectionReason: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    approvedAt: null,
    proofUrl: null,
    rider: { id: 'r1', riderId: 'V-001', fullName: 'Bravo Rider', name: null, phone: '9000000001' },
  },
  {
    id: 't2',
    type: 'DEBIT',
    amount: 500,
    purpose: 'RENT_PAYMENT',
    method: null,
    status: 'APPROVED',
    reason: null,
    remark: null,
    description: null,
    rejectionReason: null,
    createdAt: '2026-08-02T10:00:00.000Z',
    approvedAt: '2026-08-02T11:00:00.000Z',
    proofUrl: null,
    rider: { id: 'r2', riderId: 'V-002', fullName: 'Alpha Rider', name: null, phone: '9000000002' },
  },
];

function renderTable(
  sortKey: string | null = null,
  sortDir: 'asc' | 'desc' | null = null,
) {
  return renderToStaticMarkup(
    <TransactionTable
      loading={false}
      sorted={transactions}
      transactions={transactions}
      selectedIds={new Set()}
      setSelectedIds={() => {}}
      sortKey={sortKey}
      sortDir={sortDir}
      handleSort={() => {}}
      setSelectedTx={() => {}}
      setConfirmAction={() => {}}
      bulkLoading={false}
      handleBulkAction={() => {}}
      setBulkRejectDialog={() => {}}
      lastAction={null}
      handleUndo={() => {}}
      page={1}
      totalPages={1}
      total={transactions.length}
      setPage={() => {}}
    />,
  );
}

describe('TransactionTable — aria-sort + lucide arrows', () => {
  it('renders aria-sort="none" on Amount and Date headers initially', () => {
    const html = renderTable();
    const matches = html.match(/aria-sort="none"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('flips aria-sort to "ascending" on Amount when sortKey=amount, sortDir=asc', () => {
    const html = renderTable('amount', 'asc');
    const asc = html.match(/aria-sort="ascending"/g) ?? [];
    expect(asc.length).toBe(1);
    const idx = html.indexOf('aria-sort="ascending"');
    const after = html.slice(idx, idx + 200);
    expect(after).toMatch(/aria-sort="ascending"[^>]*>[^<]*<[^>]+>Amount/);
  });

  it('flips aria-sort to "descending" on Date when sortKey=createdAt, sortDir=desc', () => {
    const html = renderTable('createdAt', 'desc');
    const desc = html.match(/aria-sort="descending"/g) ?? [];
    expect(desc.length).toBe(1);
    const idx = html.indexOf('aria-sort="descending"');
    const after = html.slice(idx, idx + 200);
    expect(after).toMatch(/aria-sort="descending"[^>]*>[^<]*<[^>]+>Date/);
  });

  it('renders the lucide ArrowUp on the active asc column', () => {
    const html = renderTable('amount', 'asc');
    expect(html).toContain('lucide-arrow-up');
  });

  it('renders the lucide ArrowDown on the active desc column', () => {
    const html = renderTable('createdAt', 'desc');
    expect(html).toContain('lucide-arrow-down');
  });

  it('renders the lucide ArrowUpDown affordance on the inactive sortable column', () => {
    // Amount is the active asc column → the Date column should still
    // show the dimmed ArrowUpDown so the user knows it's sortable.
    const html = renderTable('amount', 'asc');
    expect(html).toContain('lucide-arrow-up-down');
  });

  it('renders BOTH columns as aria-sort="none" when the sort is cleared (3rd click)', () => {
    // Step 5's 3-state cycle: none → desc → asc → none. The cleared
    // state must look identical to the initial state — no active
    // arrows, no active sort key.
    const html = renderTable(null, null);
    const asc = html.match(/aria-sort="ascending"/g) ?? [];
    const desc = html.match(/aria-sort="descending"/g) ?? [];
    expect(asc.length).toBe(0);
    expect(desc.length).toBe(0);
    const none = html.match(/aria-sort="none"/g) ?? [];
    expect(none.length).toBe(2);
  });

  it('never contains the "↑" or "↓" Unicode characters anywhere', () => {
    const asc = renderTable('amount', 'asc');
    const desc = renderTable('createdAt', 'desc');
    expect(asc).not.toMatch(/[↑↓]/);
    expect(desc).not.toMatch(/[↑↓]/);
  });
});

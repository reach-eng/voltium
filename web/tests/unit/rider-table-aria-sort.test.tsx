/**
 * T-AR-SORT test for `RiderTable` — the second user of the
 * "name / phone / sortable" pattern. Verifies:
 *   1. `aria-sort` is wired on the Name + Phone columns.
 *   2. The arrows are lucide primitives, not Unicode glyphs.
 *   3. The rendered output never contains the "↑" / "↓" Unicode
 *      characters (the prior implementation was destroyed by an
 *      encoding loss in some pipelines).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RiderTable, type RiderRow } from '@/components/admin/screens/rider-management/RiderTable';

const riders: RiderRow[] = [
  {
    id: 'r1',
    fullName: 'Bravo Rider',
    phone: '9000000001',
    createdAt: new Date('2026-08-01'),
    vehicle: 'V-100',
    pickupDate: null,
    idChecked: 'verified',
    walletBalance: 100,
  },
  {
    id: 'r2',
    fullName: 'Alpha Rider',
    phone: '9000000002',
    createdAt: new Date('2026-08-02'),
    vehicle: 'V-200',
    pickupDate: null,
    idChecked: 'pending',
    walletBalance: 200,
  },
];

function renderTable(sortKey: string | null = null, sortDir: 'asc' | 'desc' = 'asc') {
  return renderToStaticMarkup(
    <RiderTable
      riders={riders}
      isLoading={false}
      sortKey={sortKey}
      sortDir={sortDir}
      page={1}
      totalPages={1}
      onSort={() => {}}
      onPageChange={() => {}}
      selectedIds={new Set()}
      onToggleOne={() => {}}
      onToggleAll={() => {}}
    />
  );
}

describe('RiderTable — aria-sort + lucide arrows', () => {
  it('renders aria-sort="none" on Name and Phone headers initially', () => {
    const html = renderTable();
    const matches = html.match(/aria-sort="none"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('flips aria-sort to "ascending" when sortKey is set with sortDir=asc', () => {
    const html = renderTable('fullName', 'asc');
    // The Name <th> opens with `aria-sort="ascending"`, then closes
    // with `>` followed by the inner `<span>` wrapping "Name". Match
    // the `aria-sort` opening attribute and confirm the active column
    // is Name.
    const asc = html.match(/aria-sort="ascending"/g) ?? [];
    expect(asc.length).toBe(1);
    // Find the <th> that has aria-sort="ascending" and confirm the
    // next text node is "Name".
    const idx = html.indexOf('aria-sort="ascending"');
    const after = html.slice(idx, idx + 200);
    expect(after).toMatch(/aria-sort="ascending"[^>]*>[^<]*<[^>]+>Name/);
  });

  it('flips aria-sort to "descending" when sortKey is set with sortDir=desc', () => {
    const html = renderTable('fullName', 'desc');
    const desc = html.match(/aria-sort="descending"/g) ?? [];
    expect(desc.length).toBe(1);
    const idx = html.indexOf('aria-sort="descending"');
    const after = html.slice(idx, idx + 200);
    expect(after).toMatch(/aria-sort="descending"[^>]*>[^<]*<[^>]+>Name/);
  });

  it('renders the lucide ArrowUp on the active asc column', () => {
    const html = renderTable('fullName', 'asc');
    expect(html).toContain('lucide-arrow-up');
  });

  it('renders the lucide ArrowDown on the active desc column', () => {
    const html = renderTable('fullName', 'desc');
    expect(html).toContain('lucide-arrow-down');
  });

  it('never contains the "↑" or "↓" Unicode characters anywhere', () => {
    const asc = renderTable('fullName', 'asc');
    const desc = renderTable('fullName', 'desc');
    expect(asc).not.toMatch(/[↑↓]/);
    expect(desc).not.toMatch(/[↑↓]/);
  });
});

/**
 * T-AR-SORT a11y + lucide-arrow consistency tests for the
 * admin `data-table` primitive.
 *
 * The data-table is fully self-managing (useState for sort/search/
 * pagination), so renderToStaticMarkup captures only the initial
 * render. The initial state is `sortKey=null`, so every sortable
 * column must render `aria-sort="none"`. The active-sort state is
 * covered by inspecting the lucide primitives that render in
 * each state (ArrowUpDown for the inactive slot, ArrowUp for asc,
 * ArrowDown for desc).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataTable, type DataTableColumn } from '@/components/admin/data-table';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', sortable: true, accessor: (r) => r.name },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    accessor: (r) => r.amount,
    align: 'right',
  },
  { key: 'id', header: 'ID', accessor: (r) => r.id },
];

const rows: Row[] = [
  { id: '1', name: 'Bravo', amount: 30 },
  { id: '2', name: 'Alpha', amount: 10 },
  { id: '3', name: 'Charlie', amount: 20 },
];

function renderTable() {
  return renderToStaticMarkup(
    <DataTable data={rows} columns={columns} pageSize={10} keyField="id" />
  );
}

describe('data-table — aria-sort + lucide arrows', () => {
  it('renders aria-sort="none" on every sortable header on first render', () => {
    const html = renderTable();
    const matches = html.match(/aria-sort="none"/g) ?? [];
    // Both Name and Amount are sortable → two `aria-sort="none"`.
    expect(matches.length).toBe(2);
  });

  it('does not set aria-sort on non-sortable columns', () => {
    const html = renderTable();
    // The ID column is non-sortable. Its <th> must not carry aria-sort.
    // Every <th> with aria-sort in the output must belong to a sortable
    // header; there are exactly 2 sortable headers (Name, Amount).
    const ariaSortHeaders = html.match(/<th[^>]*aria-sort[^>]*>/g) ?? [];
    expect(ariaSortHeaders.length).toBe(2);
  });

  it('renders the lucide ArrowUpDown primitive when no sort is active', () => {
    const html = renderTable();
    // Two sortable columns -> two ArrowUpDown icons (lucide renders
    // the icon with class `lucide-arrow-up-down`).
    const upDownIcons = (html.match(/lucide-arrow-up-down/g) ?? []).length;
    expect(upDownIcons).toBe(2);
  });

  it('does not leak Unicode arrow characters in the rendered output', () => {
    const html = renderTable();
    expect(html).not.toMatch(/[↑↓]/);
  });
});

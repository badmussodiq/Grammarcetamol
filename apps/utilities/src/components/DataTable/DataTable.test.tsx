import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';
import type { DataTableColumn } from './DataTable';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const rows: Row[] = [
  { id: '1', name: 'Alice', amount: 10 },
  { id: '2', name: 'Bob', amount: 20 },
];

const columns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', cell: (r) => r.name },
  { key: 'amount', header: 'Amount', cell: (r) => `$${r.amount}` },
];

describe('DataTable', () => {
  it('renders one row per item with the right cell content', () => {
    render(<DataTable columns={columns} data={rows} keyExtractor={(r) => r.id} />);

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('$10')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('$20')).toBeTruthy();
  });

  it('renders skeleton rows when data is null (loading)', () => {
    const { container } = render(<DataTable columns={columns} data={null} keyExtractor={(r) => r.id} skeletonRows={3} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('renders the empty message when data is an empty array', () => {
    render(<DataTable columns={columns} data={[]} keyExtractor={(r) => r.id} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('renders a header as a link when headerHref is provided', () => {
    render(
      <DataTable
        columns={[{ key: 'name', header: 'Name', cell: (r) => r.name, headerHref: '/sorted' }]}
        data={rows}
        keyExtractor={(r) => r.id}
      />,
    );
    const link = screen.getByRole('link', { name: 'Name' });
    expect(link.getAttribute('href')).toBe('/sorted');
  });
});
